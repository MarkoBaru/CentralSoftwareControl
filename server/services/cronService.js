const cron = require('node-cron');
const db = require('../database');
const { randomUUID: uuidv4 } = require('node:crypto');
const { sendBlockNotification, sendUnblockNotification, sendInvoiceMail, sendPaymentReminder } = require('./emailService');
const { syncBankPayments } = require('./bankService');
const { createBackup } = require('./backupService');

/**
 * Kernlogik: Zahlungsstatus für ein Projekt prüfen und Block-Status setzen.
 * Wird von Cron-Job, Bank-Webhook und manueller Prüfung aufgerufen.
 */
async function checkAndUpdateBlockStatus(projectId) {
  const settings = db.prepare('SELECT * FROM payment_settings WHERE project_id = ?').get(projectId);
  if (!settings || !settings.auto_block || settings.monthly_amount <= 0) {
    return { projectId, action: 'skipped', reason: 'Keine aktiven Zahlungseinstellungen' };
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return { projectId, action: 'skipped', reason: 'Projekt nicht gefunden' };

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const currentPayment = db.prepare(
    "SELECT id FROM payments WHERE project_id = ? AND period_month = ? AND period_year = ? AND status = 'confirmed'"
  ).get(projectId, currentMonth, currentYear);

  let isWithinBuffer = false;
  if (!currentPayment && settings.buffer_months > 0) {
    const lastPayment = db.prepare(`
      SELECT period_month, period_year FROM payments
      WHERE project_id = ? AND status = 'confirmed'
      ORDER BY period_year DESC, period_month DESC LIMIT 1
    `).get(projectId);

    if (lastPayment) {
      const diff = (currentYear * 12 + currentMonth) - (lastPayment.period_year * 12 + lastPayment.period_month);
      if (diff <= settings.buffer_months) isWithinBuffer = true;
    }
  }

  const isPaid = !!currentPayment || isWithinBuffer;

  if (isPaid && project.is_blocked) {
    db.prepare("UPDATE projects SET is_blocked = 0, status = 'active', subscription_status = 'active', updated_at = datetime('now') WHERE id = ?").run(projectId);
    db.prepare('INSERT INTO activity_log (id, project_id, action, details, performed_by) VALUES (?, ?, ?, ?, ?)').run(
      uuidv4(), projectId, 'auto_unblocked', 'Automatisch freigegeben (Zahlung bestätigt)', 'System'
    );
    try { await sendUnblockNotification(project); } catch (e) { console.error('[Cron] Email-Fehler:', e.message); }
    return { projectId, projectName: project.name, action: 'unblocked' };
  }

  if (!isPaid && !project.is_blocked) {
    db.prepare("UPDATE projects SET is_blocked = 1, status = 'blocked', subscription_status = 'overdue', updated_at = datetime('now') WHERE id = ?").run(projectId);
    db.prepare('INSERT INTO activity_log (id, project_id, action, details, performed_by) VALUES (?, ?, ?, ?, ?)').run(
      uuidv4(), projectId, 'auto_blocked', 'Automatisch blockiert (keine Zahlung)', 'System'
    );
    try { await sendBlockNotification(project); } catch (e) { console.error('[Cron] Email-Fehler:', e.message); }
    return { projectId, projectName: project.name, action: 'blocked' };
  }

  if (isPaid && !project.is_blocked && project.subscription_status !== 'active') {
    db.prepare("UPDATE projects SET subscription_status = 'active', updated_at = datetime('now') WHERE id = ?").run(projectId);
  }

  return { projectId, projectName: project.name, action: 'no_change' };
}

/**
 * Alle Projekte mit aktivem Auto-Block prüfen.
 */
async function checkAllProjects() {
  const allSettings = db.prepare('SELECT * FROM payment_settings WHERE auto_block = 1').all();
  const results = [];
  for (const s of allSettings) {
    const result = await checkAndUpdateBlockStatus(s.project_id);
    results.push(result);
  }
  return results;
}

/**
 * Generiert wiederkehrende Rechnungen für Projekte mit auto_invoice=1.
 * Wird täglich geprüft – erstellt Rechnung wenn invoice_day = heute UND
 * für den aktuellen Monat noch keine existiert.
 */
async function generateRecurringInvoices() {
  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();

  const settings = db.prepare(`
    SELECT ps.*, p.name as project_name, p.client_email
    FROM payment_settings ps
    JOIN projects p ON ps.project_id = p.id
    WHERE ps.auto_invoice = 1 AND ps.invoice_day = ? AND ps.monthly_amount > 0
  `).all(day);

  const created = [];

  for (const s of settings) {
    // Schon eine Rechnung für diesen Zeitraum?
    const existing = db.prepare(
      "SELECT id FROM invoices WHERE project_id = ? AND period_month = ? AND period_year = ? AND status != 'cancelled'"
    ).get(s.project_id, month, year);
    if (existing) continue;

    try {
      // Lazy-load um Zirkular-Imports zu vermeiden
      const invoiceHelper = require('../routes/invoices');
      const result = invoiceHelper.createRecurringInvoice
        ? await invoiceHelper.createRecurringInvoice(s.project_id, s.monthly_amount, month, year)
        : null;
      if (result) created.push(result);
    } catch (err) {
      console.error(`[Cron] Rechnung für ${s.project_name} fehlgeschlagen:`, err.message);
    }
  }

  return created;
}

/**
 * Markiert offene Rechnungen als überfällig wenn due_date < heute.
 */
function markOverdueInvoices() {
  const result = db.prepare(`
    UPDATE invoices
    SET status = 'overdue'
    WHERE status = 'sent' AND due_date IS NOT NULL AND due_date < date('now')
  `).run();
  return result.changes;
}

/**
 * Mahnwesen: sendet Erinnerungen / Mahnungen fuer ueberfaellige Rechnungen.
 * Stufen:
 *   Level 1 (Erinnerung)  - 7 Tage nach Faelligkeit, reminder_count = 0
 *   Level 2 (1. Mahnung)  - 14 Tage nach letzter Mahnung, reminder_count = 1
 *   Level 3 (2. Mahnung)  - 14 Tage nach letzter Mahnung, reminder_count = 2
 */
async function processReminders() {
  const candidates = db.prepare(`
    SELECT * FROM invoices
    WHERE status = 'overdue' AND reminder_count < 3
  `).all();

  const sent = [];
  let generatePDF;
  try { generatePDF = require('../routes/invoices').generatePDF; } catch (_) { /* lazy */ }

  for (const invoice of candidates) {
    const dueMs = invoice.due_date ? Date.parse(invoice.due_date) : null;
    if (!dueMs) continue;
    const daysOverdue = Math.floor((Date.now() - dueMs) / 86400000);
    const lastMs = invoice.last_reminder_at ? Date.parse(invoice.last_reminder_at) : null;
    const daysSinceLast = lastMs ? Math.floor((Date.now() - lastMs) / 86400000) : Infinity;

    let level = 0;
    if (invoice.reminder_count === 0 && daysOverdue >= 7) level = 1;
    else if (invoice.reminder_count === 1 && daysSinceLast >= 14) level = 2;
    else if (invoice.reminder_count === 2 && daysSinceLast >= 14) level = 3;
    if (!level) continue;

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(invoice.project_id);
    if (!project || !project.client_email) continue;

    try {
      const settings = db.prepare('SELECT key, value FROM app_settings').all().reduce((a, r) => (a[r.key] = r.value, a), {});
      let pdfBuffer = null;
      if (generatePDF) {
        try { pdfBuffer = await generatePDF(project, invoice, settings); } catch (e) { console.error('[Cron] PDF fuer Mahnung fehlgeschlagen:', e.message); }
      }
      await sendPaymentReminder(project, invoice, level, pdfBuffer);
      db.prepare(`UPDATE invoices SET reminder_count = ?, last_reminder_at = datetime('now') WHERE id = ?`).run(level, invoice.id);
      db.prepare('INSERT INTO activity_log (id, project_id, action, details, performed_by) VALUES (?, ?, ?, ?, ?)').run(
        uuidv4(), invoice.project_id, 'invoice_reminder', `Mahnstufe ${level} fuer Rechnung ${invoice.invoice_number} versendet`, 'System'
      );
      sent.push({ invoice: invoice.invoice_number, level });
    } catch (e) {
      console.error('[Cron] Mahnung fehlgeschlagen:', e.message);
    }
  }
  return sent;
}

/**
 * Cron-Jobs starten.
 * Täglich 08:00 Uhr: Bank-Sync + Zahlungsstatus prüfen + Rechnungen generieren + Überfällig markieren
 */
function startCronJobs() {
  cron.schedule('0 8 * * *', async () => {
    console.log('[Cron] Tägliche Aufgaben gestartet...');

    // 1. Bank-Sync
    try {
      const syncResult = await syncBankPayments();
      console.log(`[Cron] Bank-Sync: ${syncResult.fetched} Transaktionen, ${syncResult.processed} verarbeitet`);
    } catch (e) {
      console.error('[Cron] Bank-Sync Fehler:', e.message);
    }

    // 2. Wiederkehrende Rechnungen generieren
    try {
      const invoices = await generateRecurringInvoices();
      if (invoices.length > 0) console.log(`[Cron] ${invoices.length} wiederkehrende Rechnung(en) erstellt`);
    } catch (e) {
      console.error('[Cron] Auto-Rechnung Fehler:', e.message);
    }

    // 3. Überfällige Rechnungen markieren
    try {
      const overdueCount = markOverdueInvoices();
      if (overdueCount > 0) console.log(`[Cron] ${overdueCount} Rechnung(en) als überfällig markiert`);
    } catch (e) {
      console.error('[Cron] Überfällig-Fehler:', e.message);
    }

    // 3b. Mahnungen versenden
    try {
      const reminders = await processReminders();
      if (reminders.length > 0) console.log(`[Cron] ${reminders.length} Mahnung(en) versendet`);
    } catch (e) {
      console.error('[Cron] Mahnwesen-Fehler:', e.message);
    }

    // 4. Block-Status prüfen
    try {
      const results = await checkAllProjects();
      const blocked = results.filter(r => r.action === 'blocked').length;
      const unblocked = results.filter(r => r.action === 'unblocked').length;
      console.log(`[Cron] Statusprüfung: ${blocked} blockiert, ${unblocked} freigegeben`);
    } catch (e) {
      console.error('[Cron] Prüfungsfehler:', e.message);
    }
  }, { timezone: 'Europe/Zurich' });

  // Taegliches Backup um 03:00
  cron.schedule('0 3 * * *', async () => {
    try {
      await createBackup();
    } catch (e) {
      console.error('[Cron] Backup-Fehler:', e.message);
    }
  }, { timezone: 'Europe/Zurich' });

  console.log('[Cron] Jobs gestartet (täglich 08:00 Uhr Europe/Zurich)');
}

module.exports = { startCronJobs, checkAndUpdateBlockStatus, checkAllProjects, generateRecurringInvoices, markOverdueInvoices, processReminders };

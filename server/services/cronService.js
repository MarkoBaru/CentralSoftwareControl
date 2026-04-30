const cron = require('node-cron');
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const { sendBlockNotification, sendUnblockNotification } = require('./emailService');
const { syncBankPayments } = require('./bankService');

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
 * Cron-Jobs starten.
 * Täglich 08:00 Uhr: Bank-Sync + Zahlungsstatus prüfen
 * Täglich 09:00 Uhr: Rechnungsversand fällige Rechnungen
 */
function startCronJobs() {
  // Täglich 08:00 – Bank-Sync + Zahlungsprüfung
  cron.schedule('0 8 * * *', async () => {
    console.log('[Cron] Bank-Sync gestartet...');
    try {
      const syncResult = await syncBankPayments();
      console.log(`[Cron] Bank-Sync: ${syncResult.fetched} Transaktionen, ${syncResult.processed} verarbeitet`);
    } catch (e) {
      console.error('[Cron] Bank-Sync Fehler:', e.message);
    }

    console.log('[Cron] Zahlungsstatus-Prüfung...');
    try {
      const results = await checkAllProjects();
      const blocked = results.filter(r => r.action === 'blocked').length;
      const unblocked = results.filter(r => r.action === 'unblocked').length;
      console.log(`[Cron] Prüfung abgeschlossen: ${blocked} blockiert, ${unblocked} freigegeben`);
    } catch (e) {
      console.error('[Cron] Prüfungsfehler:', e.message);
    }
  }, { timezone: 'Europe/Zurich' });

  console.log('[Cron] Jobs gestartet (täglich 08:00 Uhr Europe/Zurich)');
}

module.exports = { startCronJobs, checkAndUpdateBlockStatus, checkAllProjects };

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ============================================================
// Payment Settings pro Projekt
// ============================================================

// GET /api/payments/settings/:projectId - Payment-Einstellungen abrufen
router.get('/settings/:projectId', authMiddleware, (req, res) => {
  const settings = db.prepare('SELECT * FROM payment_settings WHERE project_id = ?').get(req.params.projectId);
  if (!settings) {
    return res.json({
      project_id: req.params.projectId,
      monthly_amount: 0,
      reference_number: null,
      buffer_months: 3,
      billing_cycle: 'monthly',
      auto_block: 1
    });
  }
  res.json(settings);
});

// PUT /api/payments/settings/:projectId - Payment-Einstellungen speichern
router.put('/settings/:projectId', authMiddleware, (req, res) => {
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.projectId);
  if (!project) {
    return res.status(404).json({ error: 'Projekt nicht gefunden' });
  }

  const { monthly_amount, reference_number, buffer_months, billing_cycle, auto_block, auto_invoice, invoice_day } = req.body;

  const existing = db.prepare('SELECT id FROM payment_settings WHERE project_id = ?').get(req.params.projectId);

  if (existing) {
    db.prepare(`
      UPDATE payment_settings SET
        monthly_amount = ?,
        reference_number = ?,
        buffer_months = ?,
        billing_cycle = ?,
        auto_block = ?,
        auto_invoice = ?,
        invoice_day = ?,
        updated_at = datetime('now')
      WHERE project_id = ?
    `).run(
      monthly_amount || 0,
      reference_number || null,
      buffer_months != null ? buffer_months : 3,
      billing_cycle === 'yearly' ? 'yearly' : 'monthly',
      auto_block != null ? (auto_block ? 1 : 0) : 1,
      auto_invoice ? 1 : 0,
      invoice_day != null ? Math.min(28, Math.max(1, parseInt(invoice_day))) : 1,
      req.params.projectId
    );
  } else {
    db.prepare(`
      INSERT INTO payment_settings (id, project_id, monthly_amount, reference_number, buffer_months, billing_cycle, auto_block, auto_invoice, invoice_day)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      req.params.projectId,
      monthly_amount || 0,
      reference_number || null,
      buffer_months != null ? buffer_months : 3,
      billing_cycle === 'yearly' ? 'yearly' : 'monthly',
      auto_block != null ? (auto_block ? 1 : 0) : 1,
      auto_invoice ? 1 : 0,
      invoice_day != null ? Math.min(28, Math.max(1, parseInt(invoice_day))) : 1
    );
  }

  const settings = db.prepare('SELECT * FROM payment_settings WHERE project_id = ?').get(req.params.projectId);

  db.prepare('INSERT INTO activity_log (id, project_id, action, details, performed_by) VALUES (?, ?, ?, ?, ?)').run(
    uuidv4(), req.params.projectId, 'payment_settings_updated', 'Zahlungseinstellungen aktualisiert', req.user.name
  );

  res.json(settings);
});

// ============================================================
// Zahlungen verwalten
// ============================================================

// GET /api/payments/:projectId - Zahlungen eines Projekts abrufen
router.get('/:projectId', authMiddleware, (req, res) => {
  const payments = db.prepare(
    'SELECT * FROM payments WHERE project_id = ? ORDER BY period_year DESC, period_month DESC'
  ).all(req.params.projectId);
  res.json(payments);
});

// POST /api/payments/:projectId - Zahlung manuell erfassen
router.post('/:projectId', authMiddleware, (req, res) => {
  const project = db.prepare('SELECT id, name FROM projects WHERE id = ?').get(req.params.projectId);
  if (!project) {
    return res.status(404).json({ error: 'Projekt nicht gefunden' });
  }

  const { amount, reference_number, payment_date, period_month, period_year, notes } = req.body;
  if (!amount || !period_month || !period_year) {
    return res.status(400).json({ error: 'Betrag, Monat und Jahr erforderlich' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO payments (id, project_id, amount, reference_number, payment_date, period_month, period_year, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)
  `).run(id, req.params.projectId, amount, reference_number || null, payment_date || new Date().toISOString().split('T')[0], period_month, period_year, notes || null);

  db.prepare('INSERT INTO activity_log (id, project_id, action, details, performed_by) VALUES (?, ?, ?, ?, ?)').run(
    uuidv4(), req.params.projectId, 'payment_received',
    `Zahlung ${amount}€ für ${period_month}/${period_year} erhalten (Ref: ${reference_number || 'keine'})`,
    req.user.name
  );

  // Nach Zahlungseingang automatisch Blockstatus prüfen
  checkAndUpdateBlockStatus(req.params.projectId);

  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
  res.status(201).json(payment);
});

// DELETE /api/payments/entry/:paymentId - Zahlung löschen
router.delete('/entry/:paymentId', authMiddleware, (req, res) => {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.paymentId);
  if (!payment) {
    return res.status(404).json({ error: 'Zahlung nicht gefunden' });
  }

  db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.paymentId);

  db.prepare('INSERT INTO activity_log (id, project_id, action, details, performed_by) VALUES (?, ?, ?, ?, ?)').run(
    uuidv4(), payment.project_id, 'payment_deleted',
    `Zahlung ${payment.amount}€ für ${payment.period_month}/${payment.period_year} gelöscht`,
    req.user.name
  );

  // Nach Löschung Block-Status erneut prüfen
  checkAndUpdateBlockStatus(payment.project_id);

  res.json({ message: 'Zahlung gelöscht' });
});

// ============================================================
// Webhook: Bank-Zahlung empfangen (öffentlich, per Referenznummer)
// ============================================================

// POST /api/payments/webhook/bank - Bank meldet Zahlungseingang
router.post('/webhook/bank', (req, res) => {
  const { reference_number, amount, payment_date } = req.body;

  if (!reference_number || !amount) {
    return res.status(400).json({ error: 'Referenznummer und Betrag erforderlich' });
  }

  // Projekt anhand der Referenznummer finden
  const settings = db.prepare('SELECT * FROM payment_settings WHERE reference_number = ?').get(reference_number);
  if (!settings) {
    return res.status(404).json({ error: 'Kein Projekt mit dieser Referenznummer gefunden' });
  }

  const project = db.prepare('SELECT id, name FROM projects WHERE id = ?').get(settings.project_id);
  if (!project) {
    return res.status(404).json({ error: 'Projekt nicht gefunden' });
  }

  // Bestimme den Zahlungszeitraum basierend auf dem Betrag und Abrechnungszyklus
  const now = new Date();
  const pDate = payment_date ? new Date(payment_date) : now;
  let periodMonth = pDate.getMonth() + 1;
  let periodYear = pDate.getFullYear();

  // Bei Jahreszahlung: prüfen ob Betrag ~12x Monatsbetrag ist
  const monthsCovered = settings.billing_cycle === 'yearly'
    ? (Math.round(amount / settings.monthly_amount) || 12)
    : (Math.round(amount / settings.monthly_amount) || 1);

  // Zahlungen für alle abgedeckten Monate eintragen
  for (let i = 0; i < monthsCovered; i++) {
    let m = periodMonth + i;
    let y = periodYear;
    while (m > 12) { m -= 12; y++; }

    const existing = db.prepare(
      'SELECT id FROM payments WHERE project_id = ? AND period_month = ? AND period_year = ?'
    ).get(settings.project_id, m, y);

    if (!existing) {
      db.prepare(`
        INSERT INTO payments (id, project_id, amount, reference_number, payment_date, period_month, period_year, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed')
      `).run(
        uuidv4(), settings.project_id,
        settings.monthly_amount, reference_number,
        pDate.toISOString().split('T')[0], m, y
      );
    }
  }

  db.prepare('INSERT INTO activity_log (id, project_id, action, details, performed_by) VALUES (?, ?, ?, ?, ?)').run(
    uuidv4(), settings.project_id, 'bank_payment_received',
    `Bank-Zahlung ${amount}€ empfangen (Ref: ${reference_number}, ${monthsCovered} Monat(e) abgedeckt)`,
    'System (Bank-Webhook)'
  );

  // Block-Status aktualisieren
  checkAndUpdateBlockStatus(settings.project_id);

  res.json({ message: 'Zahlung verarbeitet', months_covered: monthsCovered });
});

// ============================================================
// Status-Prüfung: Alle Projekte prüfen (Admin-Aufruf oder Cron)
// ============================================================

// POST /api/payments/check-all - Alle Projekte auf Zahlungsstatus prüfen
router.post('/check-all', authMiddleware, (req, res) => {
  const allSettings = db.prepare('SELECT * FROM payment_settings WHERE auto_block = 1').all();
  const results = [];

  for (const settings of allSettings) {
    const result = checkAndUpdateBlockStatus(settings.project_id);
    results.push(result);
  }

  res.json({ checked: results.length, results });
});

// ============================================================
// Kernlogik: Block-Status basierend auf Zahlungen prüfen
// ============================================================

function checkAndUpdateBlockStatus(projectId) {
  const settings = db.prepare('SELECT * FROM payment_settings WHERE project_id = ?').get(projectId);
  if (!settings || !settings.auto_block || settings.monthly_amount <= 0) {
    return { projectId, action: 'skipped', reason: 'Keine aktiven Zahlungseinstellungen' };
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    return { projectId, action: 'skipped', reason: 'Projekt nicht gefunden' };
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Prüfe ob der aktuelle Monat bezahlt ist
  const currentPayment = db.prepare(
    "SELECT id FROM payments WHERE project_id = ? AND period_month = ? AND period_year = ? AND status = 'confirmed'"
  ).get(projectId, currentMonth, currentYear);

  // Prüfe ob innerhalb der Puffer-Monate bezahlt wurde
  let isWithinBuffer = false;
  if (!currentPayment && settings.buffer_months > 0) {
    // Schau in die Zukunft: Wenn z.B. 3 Monate Puffer, darf der letzte bezahlte Monat
    // maximal buffer_months vor dem aktuellen Monat liegen
    const lastPayment = db.prepare(`
      SELECT period_month, period_year FROM payments 
      WHERE project_id = ? AND status = 'confirmed'
      ORDER BY period_year DESC, period_month DESC LIMIT 1
    `).get(projectId);

    if (lastPayment) {
      const lastPaidTotal = lastPayment.period_year * 12 + lastPayment.period_month;
      const currentTotal = currentYear * 12 + currentMonth;
      const diff = currentTotal - lastPaidTotal;
      // Wenn die Differenz innerhalb des Puffers liegt, gilt es als bezahlt
      if (diff <= settings.buffer_months) {
        isWithinBuffer = true;
      }
    }
  }

  const isPaid = !!currentPayment || isWithinBuffer;

  if (isPaid && project.is_blocked) {
    // Bezahlt aber blockiert → freigeben
    db.prepare("UPDATE projects SET is_blocked = 0, status = 'active', subscription_status = 'active', updated_at = datetime('now') WHERE id = ?").run(projectId);
    db.prepare('INSERT INTO activity_log (id, project_id, action, details, performed_by) VALUES (?, ?, ?, ?, ?)').run(
      uuidv4(), projectId, 'auto_unblocked', 'Projekt automatisch freigegeben (Zahlung bestätigt)', 'System'
    );
    return { projectId, projectName: project.name, action: 'unblocked', reason: 'Zahlung bestätigt' };
  }

  if (!isPaid && !project.is_blocked) {
    // Nicht bezahlt und nicht blockiert → blockieren
    db.prepare("UPDATE projects SET is_blocked = 1, status = 'blocked', subscription_status = 'overdue', updated_at = datetime('now') WHERE id = ?").run(projectId);
    db.prepare('INSERT INTO activity_log (id, project_id, action, details, performed_by) VALUES (?, ?, ?, ?, ?)').run(
      uuidv4(), projectId, 'auto_blocked', 'Projekt automatisch blockiert (keine Zahlung)', 'System'
    );
    return { projectId, projectName: project.name, action: 'blocked', reason: 'Keine Zahlung' };
  }

  if (isPaid && !project.is_blocked) {
    // Bezahlt und aktiv → Status sicherstellen
    if (project.subscription_status !== 'active') {
      db.prepare("UPDATE projects SET subscription_status = 'active', updated_at = datetime('now') WHERE id = ?").run(projectId);
    }
    return { projectId, projectName: project.name, action: 'no_change', reason: 'Bezahlt und aktiv' };
  }

  return { projectId, projectName: project.name, action: 'no_change', reason: 'Blockiert und unbezahlt' };
}

module.exports = router;

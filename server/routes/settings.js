const express = require('express');
const db = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Erlaubte Keys (Whitelist für Sicherheit)
const ALLOWED_KEYS = [
  'company_name', 'company_address', 'company_zip', 'company_city', 'company_country',
  'company_email', 'company_phone', 'company_iban', 'company_bank',
  'company_uid', 'company_logo_url',
  'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass', 'smtp_from',
  'bank_api_url', 'bank_api_key', 'bank_api_account',
  'invoice_prefix', 'invoice_due_days', 'invoice_footer',
  'payment_check_enabled',
];

// GET /api/settings - Alle Einstellungen laden (smtp_pass wird maskiert)
router.get('/', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM app_settings').all();
  const result = {};
  rows.forEach(r => {
    result[r.key] = r.key === 'smtp_pass' ? '••••••••' : r.value;
  });
  res.json(result);
});

// PUT /api/settings - Einstellungen speichern
router.put('/', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Nur Admins dürfen Einstellungen ändern' });
  }

  const upsert = db.prepare(`
    INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);

  const saveMany = db.transaction((data) => {
    for (const [key, value] of Object.entries(data)) {
      if (!ALLOWED_KEYS.includes(key)) continue;
      // smtp_pass: leeres Feld oder Masken-Wert nicht überschreiben
      if (key === 'smtp_pass' && (!value || value === '••••••••')) continue;
      upsert.run(key, String(value));
    }
  });

  saveMany(req.body);
  res.json({ message: 'Einstellungen gespeichert' });
});

// GET /api/settings/test-email - Test-E-Mail senden
router.post('/test-email', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Admins' });
  const { sendMail } = require('../services/emailService');
  try {
    const ok = await sendMail({
      to: req.user.email,
      subject: 'Control Dashboard – Test-E-Mail',
      html: '<h2>Test-E-Mail</h2><p>SMTP-Konfiguration funktioniert korrekt.</p>',
    });
    if (ok) res.json({ message: `Test-E-Mail an ${req.user.email} gesendet` });
    else res.status(400).json({ error: 'SMTP nicht konfiguriert' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings/bank-sync - Manueller Bank-Sync
router.post('/bank-sync', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Admins' });
  const { syncBankPayments } = require('../services/bankService');
  const { checkAllProjects } = require('../services/cronService');
  try {
    const sync = await syncBankPayments();
    const check = await checkAllProjects();
    const blocked = check.filter(r => r.action === 'blocked').length;
    const unblocked = check.filter(r => r.action === 'unblocked').length;
    res.json({ ...sync, blocked, unblocked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings/upload-camt - camt.054 XML hochladen und verarbeiten
router.post('/upload-camt', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Admins' });
  const { parseCamt054, processPayments } = require('../services/bankService');
  const { checkAllProjects } = require('../services/cronService');

  const { xmlContent } = req.body;
  if (!xmlContent) return res.status(400).json({ error: 'XML-Inhalt erforderlich' });

  try {
    const payments = await parseCamt054(xmlContent);
    const processed = processPayments(payments);
    const check = await checkAllProjects();
    const blocked = check.filter(r => r.action === 'blocked').length;
    const unblocked = check.filter(r => r.action === 'unblocked').length;
    res.json({ found: payments.length, processed, blocked, unblocked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

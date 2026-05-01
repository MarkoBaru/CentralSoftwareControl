const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'database.sqlite'));

// WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    client_name TEXT NOT NULL,
    client_email TEXT,
    type TEXT NOT NULL CHECK(type IN ('website', 'app', 'webapp', 'other')),
    url TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'blocked', 'maintenance', 'development')),
    is_blocked INTEGER NOT NULL DEFAULT 0,
    api_key TEXT UNIQUE NOT NULL,
    subscription_status TEXT NOT NULL DEFAULT 'active' CHECK(subscription_status IN ('active', 'overdue', 'cancelled')),
    subscription_end_date TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    performed_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS payment_settings (
    id TEXT PRIMARY KEY,
    project_id TEXT UNIQUE NOT NULL,
    monthly_amount REAL NOT NULL DEFAULT 0,
    reference_number TEXT,
    buffer_months INTEGER NOT NULL DEFAULT 3,
    billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK(billing_cycle IN ('monthly', 'yearly')),
    auto_block INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    amount REAL NOT NULL,
    reference_number TEXT,
    payment_date TEXT NOT NULL,
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed', 'pending', 'failed')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    project_id TEXT NOT NULL,
    amount REAL NOT NULL,
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
    due_date TEXT,
    sent_at TEXT,
    paid_at TEXT,
    pdf_path TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
`);

// Migrationen: neue Spalten sicher hinzufügen
function safeAddColumn(table, column, definition) {
  try {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  } catch (e) {
    // Spalte existiert bereits → ignorieren
  }
}

safeAddColumn('projects', 'client_address', 'TEXT');
safeAddColumn('projects', 'client_zip', 'TEXT');
safeAddColumn('projects', 'client_city', 'TEXT');
safeAddColumn('invoices', 'qr_reference', 'TEXT');
safeAddColumn('payment_settings', 'auto_invoice', 'INTEGER NOT NULL DEFAULT 0');
safeAddColumn('payment_settings', 'invoice_day', 'INTEGER NOT NULL DEFAULT 1');
safeAddColumn('invoices', 'reminder_count', 'INTEGER NOT NULL DEFAULT 0');
safeAddColumn('invoices', 'last_reminder_at', 'TEXT');
safeAddColumn('users', 'totp_secret', 'TEXT');
safeAddColumn('users', 'totp_enabled', 'INTEGER NOT NULL DEFAULT 0');

// Migration: Klartext-Geheimnisse in app_settings nachtraeglich verschluesseln
try {
  const { encrypt, isEncrypted } = require('./services/crypto');
  const SECRET_KEYS = ['smtp_pass', 'bank_api_key'];
  const upsert = db.prepare(`UPDATE app_settings SET value = ?, updated_at = datetime('now') WHERE key = ?`);
  for (const key of SECRET_KEYS) {
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
    if (row && row.value && !isEncrypted(row.value)) {
      upsert.run(encrypt(row.value), key);
      console.log(`[DB] ${key} nachtraeglich verschluesselt`);
    }
  }
} catch (e) {
  console.warn('[DB] Migration Verschluesselung uebersprungen:', e.message);
}

module.exports = db;

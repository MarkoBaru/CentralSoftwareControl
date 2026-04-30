const fs = require('fs');
const path = require('path');
const db = require('../database');
const logger = require('./logger');

const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');
const MAX_BACKUPS = 14;

try { fs.mkdirSync(BACKUP_DIR, { recursive: true }); } catch (_) { /* ignore */ }

/**
 * Erstellt einen Snapshot der SQLite-Datenbank via Online-Backup-API (better-sqlite3).
 * Lauft auch waehrend Schreiboperationen sicher.
 */
async function createBackup() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').split('Z')[0];
  const target = path.join(BACKUP_DIR, `database-${ts}.sqlite`);
  try {
    await db.backup(target);
    logger.info({ target }, 'Backup erstellt');
    cleanupOldBackups();
    return target;
  } catch (err) {
    logger.error({ err: err.message }, 'Backup fehlgeschlagen');
    throw err;
  }
}

function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('database-') && f.endsWith('.sqlite'))
      .map(f => ({ f, t: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    const toDelete = files.slice(MAX_BACKUPS);
    for (const { f } of toDelete) {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
      logger.info({ file: f }, 'Altes Backup geloescht');
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'Backup-Cleanup fehlgeschlagen');
  }
}

function listBackups() {
  try {
    return fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('database-') && f.endsWith('.sqlite'))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return { filename: f, size: stat.size, created_at: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch (_) {
    return [];
  }
}

module.exports = { createBackup, listBackups, cleanupOldBackups, BACKUP_DIR };

const { randomUUID } = require('node:crypto');
const db = require('../database');
const logger = require('./logger');

/**
 * Schreibt einen Audit-Log-Eintrag.
 * Im Gegensatz zu activity_log sind Audit-Eintraege NICHT an ein Projekt gebunden
 * und decken Sicherheits-/Account-Ereignisse ab (Login, 2FA, Pwd-Reset, Backups, ...).
 *
 * @param {object} entry
 * @param {string} entry.action - Bsp: 'login_success', 'login_failed', '2fa_enabled'
 * @param {string} [entry.user_id]
 * @param {string} [entry.user_email]
 * @param {string} [entry.ip]
 * @param {object|string} [entry.details]
 */
function logAudit({ action, user_id = null, user_email = null, ip = null, details = null }) {
  try {
    const id = randomUUID();
    const detailsStr = details == null ? null
      : (typeof details === 'string' ? details : JSON.stringify(details));
    db.prepare(`
      INSERT INTO audit_log (id, action, user_id, user_email, ip, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, action, user_id, user_email, ip, detailsStr);
  } catch (err) {
    logger.warn({ err: err.message, action }, 'audit_log_failed');
  }
}

/** Express-Helper: extrahiert IP aus Request (unter Beruecksichtigung von trust-proxy). */
function getRequestIp(req) {
  if (!req) return null;
  return req.ip || req.socket?.remoteAddress || null;
}

module.exports = { logAudit, getRequestIp };

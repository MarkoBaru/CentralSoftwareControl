const db = require('../database');

/** Fuegt einen JWT-jti zur Blacklist hinzu (bis zu seinem Expiry). */
function blacklistToken(jti, userId, expiresAt) {
  if (!jti || !expiresAt) return;
  db.prepare(`
    INSERT OR REPLACE INTO token_blacklist (jti, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(jti, userId || null, expiresAt);
}

/** Prueft ob ein jti widerrufen wurde. */
function isBlacklisted(jti) {
  if (!jti) return false;
  const row = db.prepare('SELECT jti FROM token_blacklist WHERE jti = ?').get(jti);
  return !!row;
}

/** Loescht abgelaufene Eintraege (vom Cron periodisch aufrufen). */
function cleanupExpired() {
  const res = db.prepare("DELETE FROM token_blacklist WHERE expires_at < datetime('now')").run();
  return res.changes;
}

module.exports = { blacklistToken, isBlacklisted, cleanupExpired };

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID: uuidv4, randomBytes, createHash } = require('node:crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const db = require('../database');
const { encrypt, decrypt } = require('../services/crypto');
const { logAudit, getRequestIp } = require('../services/auditService');
const { blacklistToken } = require('../services/tokenBlacklist');
const { validateBody, schemas } = require('../services/validation');
const { sendPasswordResetMail } = require('../services/emailService');
const { authMiddleware } = (() => {
  const m = require('../middleware/auth');
  return typeof m === 'function' ? { authMiddleware: m } : m;
})();

const router = express.Router();

function issueToken(user) {
  const jti = uuidv4();
  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, jti },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  return token;
}

function hashResetToken(plain) {
  return createHash('sha256').update(plain).digest('hex');
}

// POST /api/auth/login
router.post('/login', validateBody(schemas.login), (req, res) => {
  const { email, password, totp } = req.body;
  const ip = getRequestIp(req);

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    logAudit({ action: 'login_failed', user_email: email, ip, details: { reason: 'user_not_found' } });
    return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    logAudit({ action: 'login_failed', user_id: user.id, user_email: email, ip, details: { reason: 'bad_password' } });
    return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
  }

  if (user.totp_enabled) {
    if (!totp) {
      return res.status(401).json({ requires_2fa: true, error: '2FA-Code erforderlich' });
    }
    const secret = decrypt(user.totp_secret);
    const ok = speakeasy.totp.verify({ secret, encoding: 'base32', token: String(totp), window: 1 });
    if (!ok) {
      logAudit({ action: 'login_failed', user_id: user.id, user_email: email, ip, details: { reason: 'bad_totp' } });
      return res.status(401).json({ requires_2fa: true, error: 'Ungültiger 2FA-Code' });
    }
  }

  const token = issueToken(user);
  logAudit({ action: 'login_success', user_id: user.id, user_email: email, ip });
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, totp_enabled: !!user.totp_enabled }
  });
});

// POST /api/auth/logout - widerruft das aktuelle Token
router.post('/logout', authMiddleware, (req, res) => {
  if (req.tokenJti && req.tokenExp) {
    const expiresAt = new Date(req.tokenExp * 1000).toISOString().slice(0, 19).replace('T', ' ');
    blacklistToken(req.tokenJti, req.user.id, expiresAt);
  }
  logAudit({
    action: 'logout',
    user_id: req.user.id,
    user_email: req.user.email,
    ip: getRequestIp(req),
  });
  res.json({ message: 'Abgemeldet' });
});

// POST /api/auth/setup - Erstellt den ersten Admin-User
router.post('/setup', validateBody(schemas.setup), (req, res) => {
  const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (existingUsers.count > 0) {
    return res.status(400).json({ error: 'Setup bereits abgeschlossen' });
  }

  const { email, password, name } = req.body;
  const passwordHash = bcrypt.hashSync(password, 12);
  const id = uuidv4();

  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, password_changed_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(id, email, passwordHash, name, 'admin');

  const token = issueToken({ id, email, name, role: 'admin' });
  logAudit({ action: 'admin_setup', user_id: id, user_email: email, ip: getRequestIp(req) });
  res.json({ token, user: { id, email, name, role: 'admin' } });
});

// POST /api/auth/password-reset/request - sendet Reset-Mail (immer 200 zur Privacy)
router.post('/password-reset/request', validateBody(schemas.passwordResetRequest), async (req, res) => {
  const { email } = req.body;
  const ip = getRequestIp(req);
  const user = db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(email);

  // Immer mit Erfolgsmeldung antworten (verhindert User-Enumeration)
  const okResponse = { message: 'Falls die E-Mail bekannt ist, wurde eine Nachricht gesendet.' };

  if (!user) {
    logAudit({ action: 'password_reset_requested', user_email: email, ip, details: { found: false } });
    return res.json(okResponse);
  }

  const plainToken = randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(plainToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1h
    .toISOString().slice(0, 19).replace('T', ' ');

  // alte unbenutzte Tokens fuer den User loeschen
  db.prepare('DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL').run(user.id);
  db.prepare(`
    INSERT INTO password_resets (token_hash, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(tokenHash, user.id, expiresAt);

  const baseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
  const resetUrl = `${baseUrl}/reset-password/${plainToken}`;

  try {
    await sendPasswordResetMail(user, resetUrl);
  } catch (e) {
    // E-Mail-Fehler nicht nach aussen leaken
    console.warn('[auth] password-reset Mail Fehler:', e.message);
  }

  logAudit({ action: 'password_reset_requested', user_id: user.id, user_email: user.email, ip, details: { found: true } });
  res.json(okResponse);
});

// POST /api/auth/password-reset/confirm
router.post('/password-reset/confirm', validateBody(schemas.passwordResetConfirm), (req, res) => {
  const { token, password } = req.body;
  const ip = getRequestIp(req);
  const tokenHash = hashResetToken(token);

  const reset = db.prepare(`
    SELECT token_hash, user_id, expires_at, used_at
    FROM password_resets WHERE token_hash = ?
  `).get(tokenHash);

  if (!reset || reset.used_at || new Date(reset.expires_at + 'Z') < new Date()) {
    logAudit({ action: 'password_reset_failed', ip, details: { reason: !reset ? 'unknown' : reset.used_at ? 'used' : 'expired' } });
    return res.status(400).json({ error: 'Token ungültig oder abgelaufen' });
  }

  const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(reset.user_id);
  if (!user) return res.status(400).json({ error: 'Token ungültig' });

  const passwordHash = bcrypt.hashSync(password, 12);
  db.prepare(`
    UPDATE users SET password_hash = ?, password_changed_at = datetime('now') WHERE id = ?
  `).run(passwordHash, user.id);
  db.prepare(`UPDATE password_resets SET used_at = datetime('now') WHERE token_hash = ?`).run(tokenHash);

  logAudit({ action: 'password_reset_completed', user_id: user.id, user_email: user.email, ip });
  res.json({ message: 'Passwort wurde zurückgesetzt. Bitte erneut anmelden.' });
});

// POST /api/auth/2fa/setup - generiert ein neues TOTP-Secret + QR-Code
router.post('/2fa/setup', authMiddleware, async (req, res) => {
  try {
    const user = db.prepare('SELECT id, email, totp_enabled FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    if (user.totp_enabled) return res.status(400).json({ error: '2FA ist bereits aktiviert' });

    const secret = speakeasy.generateSecret({
      name: `CentralControl (${user.email})`,
      length: 20
    });
    // Secret nur temporaer (verschluesselt) speichern, bis verify erfolgreich
    db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?')
      .run(encrypt(secret.base32), user.id);
    const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);
    res.json({ secret: secret.base32, qr: qrDataUrl });
  } catch (e) {
    res.status(500).json({ error: 'Fehler beim 2FA-Setup', details: e.message });
  }
});

// POST /api/auth/2fa/enable - bestaetigt Setup mit Code
router.post('/2fa/enable', authMiddleware, validateBody(schemas.totpCode), (req, res) => {
  const { token } = req.body;
  const user = db.prepare('SELECT id, totp_secret FROM users WHERE id = ?').get(req.user.id);
  if (!user || !user.totp_secret) return res.status(400).json({ error: 'Bitte zuerst Setup starten' });
  const secret = decrypt(user.totp_secret);
  const ok = speakeasy.totp.verify({ secret, encoding: 'base32', token: String(token), window: 1 });
  if (!ok) return res.status(401).json({ error: 'Ungültiger Code' });
  db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(user.id);
  logAudit({ action: '2fa_enabled', user_id: req.user.id, user_email: req.user.email, ip: getRequestIp(req) });
  res.json({ message: '2FA aktiviert' });
});

// POST /api/auth/2fa/disable - 2FA deaktivieren (Code-Bestaetigung erforderlich)
router.post('/2fa/disable', authMiddleware, validateBody(schemas.totpCode), (req, res) => {
  const { token } = req.body;
  const user = db.prepare('SELECT id, totp_secret, totp_enabled FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  if (!user.totp_enabled) return res.status(400).json({ error: '2FA ist nicht aktiviert' });
  const secret = decrypt(user.totp_secret);
  const ok = speakeasy.totp.verify({ secret, encoding: 'base32', token: String(token), window: 1 });
  if (!ok) return res.status(401).json({ error: 'Ungültiger Code' });
  db.prepare('UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?').run(user.id);
  logAudit({ action: '2fa_disabled', user_id: req.user.id, user_email: req.user.email, ip: getRequestIp(req) });
  res.json({ message: '2FA deaktiviert' });
});

// GET /api/auth/2fa/status
router.get('/2fa/status', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT totp_enabled FROM users WHERE id = ?').get(req.user.id);
  res.json({ enabled: !!(user && user.totp_enabled) });
});

module.exports = router;

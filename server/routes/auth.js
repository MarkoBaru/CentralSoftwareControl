const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID: uuidv4 } = require('node:crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const db = require('../database');
const { encrypt, decrypt } = require('../services/crypto');
const { authMiddleware } = (() => {
  const m = require('../middleware/auth');
  return typeof m === 'function' ? { authMiddleware: m } : m;
})();

const router = express.Router();

function issueToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password, totp } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
  }

  if (user.totp_enabled) {
    if (!totp) {
      return res.status(401).json({ requires_2fa: true, error: '2FA-Code erforderlich' });
    }
    const secret = decrypt(user.totp_secret);
    const ok = speakeasy.totp.verify({ secret, encoding: 'base32', token: String(totp), window: 1 });
    if (!ok) {
      return res.status(401).json({ requires_2fa: true, error: 'Ungültiger 2FA-Code' });
    }
  }

  const token = issueToken(user);
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, totp_enabled: !!user.totp_enabled }
  });
});

// POST /api/auth/setup - Erstellt den ersten Admin-User
router.post('/setup', (req, res) => {
  const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (existingUsers.count > 0) {
    return res.status(400).json({ error: 'Setup bereits abgeschlossen' });
  }

  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'E-Mail, Passwort und Name erforderlich' });
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  const id = uuidv4();

  db.prepare('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)').run(
    id, email, passwordHash, name, 'admin'
  );

  const token = jwt.sign(
    { id, email, name, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token, user: { id, email, name, role: 'admin' } });
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
router.post('/2fa/enable', authMiddleware, (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Code erforderlich' });
  const user = db.prepare('SELECT id, totp_secret FROM users WHERE id = ?').get(req.user.id);
  if (!user || !user.totp_secret) return res.status(400).json({ error: 'Bitte zuerst Setup starten' });
  const secret = decrypt(user.totp_secret);
  const ok = speakeasy.totp.verify({ secret, encoding: 'base32', token: String(token), window: 1 });
  if (!ok) return res.status(401).json({ error: 'Ungültiger Code' });
  db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(user.id);
  res.json({ message: '2FA aktiviert' });
});

// POST /api/auth/2fa/disable - 2FA deaktivieren (Code-Bestaetigung erforderlich)
router.post('/2fa/disable', authMiddleware, (req, res) => {
  const { token } = req.body;
  const user = db.prepare('SELECT id, totp_secret, totp_enabled FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  if (!user.totp_enabled) return res.status(400).json({ error: '2FA ist nicht aktiviert' });
  if (!token) return res.status(400).json({ error: 'Code zur Bestaetigung erforderlich' });
  const secret = decrypt(user.totp_secret);
  const ok = speakeasy.totp.verify({ secret, encoding: 'base32', token: String(token), window: 1 });
  if (!ok) return res.status(401).json({ error: 'Ungültiger Code' });
  db.prepare('UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?').run(user.id);
  res.json({ message: '2FA deaktiviert' });
});

// GET /api/auth/2fa/status
router.get('/2fa/status', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT totp_enabled FROM users WHERE id = ?').get(req.user.id);
  res.json({ enabled: !!(user && user.totp_enabled) });
});

module.exports = router;

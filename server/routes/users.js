const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Nur Admins dürfen Benutzer verwalten
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Nur Administratoren haben Zugriff' });
  }
  next();
}

// GET /api/users - Alle Benutzer auflisten
router.get('/', authMiddleware, adminOnly, (req, res) => {
  const users = db.prepare('SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

// POST /api/users - Neuen Benutzer erstellen (einladen)
router.post('/', authMiddleware, adminOnly, (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'E-Mail, Passwort und Name erforderlich' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'E-Mail wird bereits verwendet' });
  }

  const validRoles = ['admin', 'viewer'];
  const userRole = validRoles.includes(role) ? role : 'viewer';
  const passwordHash = bcrypt.hashSync(password, 12);
  const id = uuidv4();

  db.prepare('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)').run(
    id, email, passwordHash, name, userRole
  );

  res.status(201).json({ id, email, name, role: userRole });
});

// PUT /api/users/:id - Benutzer aktualisieren
router.put('/:id', authMiddleware, adminOnly, (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  }

  const { name, role } = req.body;
  const validRoles = ['admin', 'viewer'];

  db.prepare(`
    UPDATE users SET
      name = COALESCE(?, name),
      role = COALESCE(?, role)
    WHERE id = ?
  `).run(name || null, (role && validRoles.includes(role)) ? role : null, req.params.id);

  const updated = db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// PATCH /api/users/:id/password - Passwort ändern
router.patch('/:id/password', authMiddleware, (req, res) => {
  // Eigenes Passwort oder Admin kann fremde Passwörter ändern
  if (req.user.id !== req.params.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Keine Berechtigung' });
  }

  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Neues Passwort muss mindestens 6 Zeichen lang sein' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  }

  // Wenn man sein eigenes PW ändert, muss das aktuelle angegeben werden
  if (req.user.id === req.params.id) {
    if (!currentPassword) {
      return res.status(400).json({ error: 'Aktuelles Passwort erforderlich' });
    }
    const valid = bcrypt.compareSync(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Aktuelles Passwort ist falsch' });
    }
  }

  const passwordHash = bcrypt.hashSync(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, req.params.id);

  res.json({ message: 'Passwort erfolgreich geändert' });
});

// DELETE /api/users/:id - Benutzer löschen
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  if (req.user.id === req.params.id) {
    return res.status(400).json({ error: 'Du kannst dich nicht selbst löschen' });
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'Benutzer gelöscht' });
});

module.exports = router;

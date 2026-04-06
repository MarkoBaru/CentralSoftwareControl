const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Generiert einen einzigartigen API-Key für Projekte
function generateApiKey() {
  return 'ccd_' + crypto.randomBytes(32).toString('hex');
}

// GET /api/projects - Alle Projekte abrufen
router.get('/', authMiddleware, (req, res) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  res.json(projects);
});

// GET /api/projects/stats - Dashboard-Statistiken
router.get('/stats', authMiddleware, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM projects').get().count;
  const active = db.prepare("SELECT COUNT(*) as count FROM projects WHERE status = 'active' AND is_blocked = 0").get().count;
  const blocked = db.prepare('SELECT COUNT(*) as count FROM projects WHERE is_blocked = 1').get().count;
  const overdue = db.prepare("SELECT COUNT(*) as count FROM projects WHERE subscription_status = 'overdue'").get().count;
  const maintenance = db.prepare("SELECT COUNT(*) as count FROM projects WHERE status = 'maintenance'").get().count;

  res.json({ total, active, blocked, overdue, maintenance });
});

// GET /api/projects/:id - Einzelnes Projekt abrufen
router.get('/:id', authMiddleware, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Projekt nicht gefunden' });
  }

  const activities = db.prepare(
    'SELECT * FROM activity_log WHERE project_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.params.id);

  res.json({ ...project, activities });
});

// POST /api/projects - Neues Projekt anlegen
router.post('/', authMiddleware, (req, res) => {
  const { name, client_name, client_email, type, url, description, subscription_end_date, notes } = req.body;
  if (!name || !client_name || !type) {
    return res.status(400).json({ error: 'Name, Kundenname und Typ erforderlich' });
  }

  const id = uuidv4();
  const api_key = generateApiKey();

  db.prepare(`
    INSERT INTO projects (id, name, client_name, client_email, type, url, description, api_key, subscription_end_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, client_name, client_email || null, type, url || null, description || null, api_key, subscription_end_date || null, notes || null);

  // Aktivität loggen
  db.prepare('INSERT INTO activity_log (id, project_id, action, details, performed_by) VALUES (?, ?, ?, ?, ?)').run(
    uuidv4(), id, 'project_created', `Projekt "${name}" erstellt`, req.user.name
  );

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.status(201).json(project);
});

// PUT /api/projects/:id - Projekt aktualisieren
router.put('/:id', authMiddleware, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Projekt nicht gefunden' });
  }

  const { name, client_name, client_email, type, url, description, status, subscription_status, subscription_end_date, notes } = req.body;

  db.prepare(`
    UPDATE projects SET
      name = COALESCE(?, name),
      client_name = COALESCE(?, client_name),
      client_email = COALESCE(?, client_email),
      type = COALESCE(?, type),
      url = COALESCE(?, url),
      description = COALESCE(?, description),
      status = COALESCE(?, status),
      subscription_status = COALESCE(?, subscription_status),
      subscription_end_date = COALESCE(?, subscription_end_date),
      notes = COALESCE(?, notes),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name || null, client_name || null, client_email || null, type || null,
    url || null, description || null, status || null, subscription_status || null,
    subscription_end_date || null, notes || null, req.params.id
  );

  db.prepare('INSERT INTO activity_log (id, project_id, action, details, performed_by) VALUES (?, ?, ?, ?, ?)').run(
    uuidv4(), req.params.id, 'project_updated', 'Projekt aktualisiert', req.user.name
  );

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// PATCH /api/projects/:id/block - Projekt blockieren/freigeben
router.patch('/:id/block', authMiddleware, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Projekt nicht gefunden' });
  }

  const { is_blocked } = req.body;
  if (typeof is_blocked !== 'boolean' && typeof is_blocked !== 'number') {
    return res.status(400).json({ error: 'is_blocked muss boolean sein' });
  }

  const blocked = is_blocked ? 1 : 0;
  const newStatus = blocked ? 'blocked' : 'active';

  db.prepare('UPDATE projects SET is_blocked = ?, status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
    blocked, newStatus, req.params.id
  );

  const action = blocked ? 'project_blocked' : 'project_unblocked';
  const details = blocked
    ? `Projekt "${project.name}" wurde BLOCKIERT`
    : `Projekt "${project.name}" wurde FREIGEGEBEN`;

  db.prepare('INSERT INTO activity_log (id, project_id, action, details, performed_by) VALUES (?, ?, ?, ?, ?)').run(
    uuidv4(), req.params.id, action, details, req.user.name
  );

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// PATCH /api/projects/:id/regenerate-key - Neuen API-Key generieren
router.patch('/:id/regenerate-key', authMiddleware, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Projekt nicht gefunden' });
  }

  const newKey = generateApiKey();
  db.prepare("UPDATE projects SET api_key = ?, updated_at = datetime('now') WHERE id = ?").run(newKey, req.params.id);

  db.prepare('INSERT INTO activity_log (id, project_id, action, details, performed_by) VALUES (?, ?, ?, ?, ?)').run(
    uuidv4(), req.params.id, 'api_key_regenerated', 'API-Key neu generiert', req.user.name
  );

  res.json({ api_key: newKey });
});

// DELETE /api/projects/:id - Projekt löschen
router.delete('/:id', authMiddleware, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Projekt nicht gefunden' });
  }

  db.prepare('DELETE FROM activity_log WHERE project_id = ?').run(req.params.id);
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);

  res.json({ message: 'Projekt gelöscht' });
});

module.exports = router;

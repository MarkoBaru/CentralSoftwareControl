const express = require('express');
const db = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/activity - Globales Activity-Log mit Projekt-Namen
// Query: ?limit=100&action=auto_blocked&project_id=xxx&since=2026-01-01
router.get('/', authMiddleware, (req, res) => {
  const limit = Math.min(500, parseInt(req.query.limit) || 100);
  const filters = [];
  const params = [];

  if (req.query.action) {
    filters.push('a.action = ?');
    params.push(req.query.action);
  }
  if (req.query.project_id) {
    filters.push('a.project_id = ?');
    params.push(req.query.project_id);
  }
  if (req.query.since) {
    filters.push('a.created_at >= ?');
    params.push(req.query.since);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const sql = `
    SELECT a.id, a.project_id, a.action, a.details, a.performed_by, a.created_at,
           p.name AS project_name
    FROM activity_log a
    LEFT JOIN projects p ON a.project_id = p.id
    ${where}
    ORDER BY a.created_at DESC
    LIMIT ?
  `;
  const rows = db.prepare(sql).all(...params, limit);
  res.json(rows);
});

// GET /api/activity/actions - Liste aller bisher genutzten Aktionen (fuer Filter)
router.get('/actions', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT DISTINCT action FROM activity_log ORDER BY action').all();
  res.json(rows.map(r => r.action));
});

// GET /api/activity/export - CSV-Export
function csvEscape(value) {
  if (value == null) return '';
  const s = String(value);
  if (/[",\r\n;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

router.get('/export', authMiddleware, (req, res) => {
  const filters = [];
  const params = [];
  if (req.query.action) { filters.push('a.action = ?'); params.push(req.query.action); }
  if (req.query.project_id) { filters.push('a.project_id = ?'); params.push(req.query.project_id); }
  if (req.query.since) { filters.push('a.created_at >= ?'); params.push(req.query.since); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const rows = db.prepare(`
    SELECT a.created_at, a.action, p.name AS project_name, a.project_id, a.details, a.performed_by
    FROM activity_log a
    LEFT JOIN projects p ON a.project_id = p.id
    ${where}
    ORDER BY a.created_at DESC
  `).all(...params);

  const header = 'Zeitpunkt;Aktion;Projekt;Projekt-ID;Details;Ausgefuehrt von';
  const lines = rows.map(r => [
    r.created_at, r.action, r.project_name || '', r.project_id || '', r.details || '', r.performed_by || ''
  ].map(csvEscape).join(';'));
  const csv = '\uFEFF' + [header, ...lines].join('\r\n'); // UTF-8 BOM fuer Excel

  const filename = `activity_${new Date().toISOString().split('T')[0]}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

module.exports = router;

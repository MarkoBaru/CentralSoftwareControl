const express = require('express');
const db = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin-Rechte erforderlich' });
  }
  next();
}

// GET /api/audit - Sicherheits-/Account-Ereignisse
// Query: ?limit=100&action=login_failed&user_email=...&since=2026-01-01
router.get('/', authMiddleware, requireAdmin, (req, res) => {
  const limit = Math.min(500, parseInt(req.query.limit) || 100);
  const filters = [];
  const params = [];

  if (req.query.action) { filters.push('action = ?'); params.push(req.query.action); }
  if (req.query.user_email) { filters.push('user_email = ?'); params.push(req.query.user_email); }
  if (req.query.since) { filters.push('created_at >= ?'); params.push(req.query.since); }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const sql = `
    SELECT id, action, user_id, user_email, ip, details, created_at
    FROM audit_log
    ${where}
    ORDER BY created_at DESC
    LIMIT ?
  `;
  const rows = db.prepare(sql).all(...params, limit);
  res.json(rows);
});

// GET /api/audit/actions
router.get('/actions', authMiddleware, requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT DISTINCT action FROM audit_log ORDER BY action').all();
  res.json(rows.map(r => r.action));
});

module.exports = router;

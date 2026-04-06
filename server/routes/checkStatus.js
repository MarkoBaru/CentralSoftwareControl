const express = require('express');
const db = require('../database');

const router = express.Router();

// GET /api/check-status/:apiKey - Öffentlicher Endpunkt für Client-Websites/Apps
// Wird von der Client-Middleware/SDK aufgerufen um den Block-Status zu prüfen
router.get('/:apiKey', (req, res) => {
  const { apiKey } = req.params;

  if (!apiKey || !apiKey.startsWith('ccd_')) {
    return res.status(400).json({ error: 'Ungültiger API-Key' });
  }

  const project = db.prepare('SELECT is_blocked, status, name FROM projects WHERE api_key = ?').get(apiKey);

  if (!project) {
    return res.status(404).json({ error: 'Projekt nicht gefunden' });
  }

  res.json({
    is_blocked: !!project.is_blocked,
    status: project.status,
    project_name: project.name
  });
});

module.exports = router;

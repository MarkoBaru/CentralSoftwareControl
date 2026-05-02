const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../database');
const { listBackups } = require('../services/backupService');

const router = express.Router();
const startedAt = Date.now();

// GET /api/health - oeffentlicher Health-Check (fuer Monitoring/Uptime-Robots)
router.get('/', (req, res) => {
  const checks = {};
  let healthy = true;

  // DB-Ping
  try {
    db.prepare('SELECT 1').get();
    checks.database = { status: 'ok' };
  } catch (e) {
    healthy = false;
    checks.database = { status: 'error', message: e.message };
  }

  // Letztes Backup
  try {
    const backups = listBackups();
    if (backups.length === 0) {
      checks.backup = { status: 'warn', message: 'keine Backups vorhanden' };
    } else {
      const newest = backups[0];
      const ageHours = (Date.now() - new Date(newest.created_at).getTime()) / 36e5;
      checks.backup = {
        status: ageHours < 36 ? 'ok' : 'warn',
        latest: newest.filename,
        age_hours: Math.round(ageHours * 10) / 10,
        count: backups.length,
      };
    }
  } catch (e) {
    checks.backup = { status: 'error', message: e.message };
  }

  // DB-Dateigroesse
  try {
    const dbPath = path.join(__dirname, '..', '..', 'database.sqlite');
    const stat = fs.statSync(dbPath);
    checks.database_size_mb = Math.round((stat.size / 1024 / 1024) * 100) / 100;
  } catch (_) {}

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    uptime_seconds: Math.round((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || 'dev',
    checks,
  });
});

module.exports = router;

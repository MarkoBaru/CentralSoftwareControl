require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const logger = require('./services/logger');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const checkStatusRoutes = require('./routes/checkStatus');
const userRoutes = require('./routes/users');
const paymentRoutes = require('./routes/payments');
const settingsRoutes = require('./routes/settings');
const invoiceRoutes = require('./routes/invoices');
const activityRoutes = require('./routes/activity');
const { startCronJobs } = require('./services/cronService');

const app = express();
const PORT = process.env.PORT || 3001;

// Security-Header (Helmet) - CSP angepasst fuer React-CRA inline-styles
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'blob:'],
      'connect-src': ["'self'"],
      'font-src': ["'self'", 'data:'],
      'object-src': ["'none'"],
      'frame-ancestors': ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Request-Logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    logger.info({ method: req.method, path: req.path, status: res.statusCode, ms, ip: req.ip }, 'request');
  });
  next();
});

// Middleware — Manuelle CORS-Header (Express 5 kompatibel)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
app.use(express.json({ limit: '5mb' }));

// Rate-Limiting für Login (Brute-Force-Schutz): 5 Versuche / 15 Min pro IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Login-Versuche. Bitte versuchen Sie es in 15 Minuten erneut.' },
});

// Allgemeines API-Limit: 300 Requests / 15 Min
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

// API-Routen
app.use('/api/auth/login', loginLimiter);
app.use('/api/', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/check-status', checkStatusRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/activity', activityRoutes);

// Client-SDK statisch ausliefern
app.use('/client', express.static(path.join(__dirname, '..', 'client-sdk')));

// Frontend statisch ausliefern (Production)
const frontendPath = path.join(__dirname, '..', 'frontend', 'build');
app.use(express.static(frontendPath));
app.get('{*splat}', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`✓ Control Dashboard Server läuft auf Port ${PORT}`);
  console.log(`  Dashboard: http://localhost:${PORT}`);
  console.log(`  API:       http://localhost:${PORT}/api`);
  startCronJobs();
});

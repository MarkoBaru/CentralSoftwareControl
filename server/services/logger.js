const path = require('path');
const fs = require('fs');
const pino = require('pino');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch (_) { /* ignore */ }

const isProd = process.env.NODE_ENV === 'production';
const level = process.env.LOG_LEVEL || (isProd ? 'info' : 'debug');

// pino-roll fuer taegliche Rotation, max 14 Tage
const fileTransport = {
  target: 'pino-roll',
  level,
  options: {
    file: path.join(LOG_DIR, 'app'),
    frequency: 'daily',
    extension: '.log',
    mkdir: true,
    limit: { count: 14 },
  },
};

const consoleTransport = isProd
  ? { target: 'pino/file', options: { destination: 1 } } // stdout, JSON
  : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } };

const transport = pino.transport({
  targets: [fileTransport, { ...consoleTransport, level }],
});

const logger = pino({ level, base: { service: 'ccd' } }, transport);

module.exports = logger;

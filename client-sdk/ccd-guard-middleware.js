/**
 * CCD Client Guard - Express/Node.js Middleware
 * ==============================================
 * Middleware für Node.js-basierte Webseiten (Express, Koa etc.)
 * Prüft den Block-Status serverseitig und blockiert alle Requests.
 *
 * Verwendung:
 *   const ccdGuard = require('./ccd-guard-middleware');
 *   app.use(ccdGuard({
 *     apiKey: 'ccd_DEIN_API_KEY',
 *     serverUrl: 'https://DEIN-DASHBOARD-SERVER',
 *     checkInterval: 60 // Sekunden (default: 60)
 *   }));
 */
const http = require('http');
const https = require('https');

function ccdGuard(options = {}) {
  const { apiKey, serverUrl, checkInterval = 60 } = options;

  if (!apiKey || !serverUrl) {
    throw new Error('[CCD Guard] apiKey und serverUrl sind erforderlich.');
  }

  const baseUrl = serverUrl.replace(/\/$/, '');
  let isBlocked = false;
  let lastCheck = 0;

  function fetchStatus() {
    return new Promise((resolve) => {
      const url = `${baseUrl}/api/check-status/${encodeURIComponent(apiKey)}`;
      const client = url.startsWith('https') ? https : http;

      const req = client.get(url, { timeout: 10000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            isBlocked = !!parsed.is_blocked;
          } catch {
            // Parse-Fehler: fail-open
          }
          lastCheck = Date.now();
          resolve();
        });
      });

      req.on('error', () => {
        // Netzwerk-Fehler: fail-open (Seite bleibt erreichbar)
        lastCheck = Date.now();
        resolve();
      });

      req.on('timeout', () => {
        req.destroy();
        lastCheck = Date.now();
        resolve();
      });
    });
  }

  // Initialen Check durchführen
  fetchStatus();

  // Regelmäßig prüfen
  setInterval(fetchStatus, checkInterval * 1000);

  // Block-Seite HTML
  const blockPageHtml = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nicht verfügbar</title>
  <style>
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; font-family: sans-serif; background: #f9fafb; }
    .container { text-align: center; max-width: 480px; padding: 2rem; }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.5rem; color: #111; margin-bottom: 0.5rem; }
    p { color: #666; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">&#128274;</div>
    <h1>Website vorübergehend nicht verfügbar</h1>
    <p>Diese Website ist derzeit nicht erreichbar. Bitte kontaktieren Sie den Betreiber für weitere Informationen.</p>
  </div>
</body>
</html>`;

  return async function (req, res, next) {
    // Prüfe ob Refresh nötig
    if (Date.now() - lastCheck > checkInterval * 1000) {
      await fetchStatus();
    }

    if (isBlocked) {
      res.status(503).type('html').send(blockPageHtml);
      return;
    }

    next();
  };
}

module.exports = ccdGuard;

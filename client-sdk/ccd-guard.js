/**
 * CCD Client Guard - JavaScript Snippet für Webseiten
 * ====================================================
 * Dieses Script wird in die verwalteten Kunden-Webseiten eingebaut.
 * Es prüft regelmäßig den Block-Status über das Control Dashboard.
 * Wenn blockiert, wird die gesamte Seite mit einer Maintenance-Nachricht überlagert.
 *
 * Einbindung (im <head> der Webseite):
 *   <script src="https://DEIN-DASHBOARD-SERVER/client/ccd-guard.js"
 *           data-api-key="ccd_DEIN_API_KEY"
 *           data-server="https://DEIN-DASHBOARD-SERVER"></script>
 */
(function () {
  'use strict';

  // Konfiguration aus Script-Tag lesen
  var scriptTag = document.currentScript;
  if (!scriptTag) {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf('ccd-guard') !== -1) {
        scriptTag = scripts[i];
        break;
      }
    }
  }

  var API_KEY = scriptTag ? scriptTag.getAttribute('data-api-key') : null;
  var SERVER = scriptTag ? scriptTag.getAttribute('data-server') : null;
  var CHECK_INTERVAL = parseInt(scriptTag ? scriptTag.getAttribute('data-interval') : '300', 10) * 1000; // Default: 300s

  if (!API_KEY || !SERVER) {
    console.warn('[CCD Guard] data-api-key und data-server Attribute sind erforderlich.');
    return;
  }

  // Server-URL normalisieren
  if (SERVER.endsWith('/')) SERVER = SERVER.slice(0, -1);

  var overlayId = 'ccd-block-overlay';

  function showBlockOverlay() {
    if (document.getElementById(overlayId)) return;

    var overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:999999;background:#fff;display:flex;' +
      'align-items:center;justify-content:center;flex-direction:column;font-family:sans-serif;';

    overlay.innerHTML =
      '<div style="text-align:center;max-width:480px;padding:2rem;">' +
      '<div style="font-size:3rem;margin-bottom:1rem;">&#128274;</div>' +
      '<h1 style="font-size:1.5rem;color:#111;margin-bottom:0.5rem;">Website vorübergehend nicht verfügbar</h1>' +
      '<p style="color:#666;line-height:1.6;">Diese Website ist derzeit nicht erreichbar. ' +
      'Bitte kontaktieren Sie den Betreiber für weitere Informationen.</p>' +
      '</div>';

    document.body.appendChild(overlay);
  }

  function removeBlockOverlay() {
    var el = document.getElementById(overlayId);
    if (el) el.remove();
  }

  function checkStatus() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', SERVER + '/api/check-status/' + encodeURIComponent(API_KEY), true);
    xhr.timeout = 10000;

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          if (data.is_blocked) {
            showBlockOverlay();
          } else {
            removeBlockOverlay();
          }
        } catch (e) {
          // Parse-Fehler ignorieren — Seite bleibt erreichbar
        }
      }
      // Bei Netzwerk-/Server-Fehlern: Seite bleibt erreichbar (fail-open)
    };

    xhr.send();
  }

  // Erste Prüfung sofort
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkStatus);
  } else {
    checkStatus();
  }

  // Regelmäßige Prüfung
  setInterval(checkStatus, CHECK_INTERVAL);
})();

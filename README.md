# Central Control Dashboard

Zentrales Dashboard zur Verwaltung von Kundenprojekten (Webseiten, Apps, Web-Apps).

## Features

- **Projektübersicht** mit Status-Anzeige (Aktiv, Blockiert, Wartung, Entwicklung)
- **Block/Unblock-Toggle** — Kunden-Websites/Apps per Klick blockieren/freigeben
- **Abo-Verwaltung** — Abo-Status und Enddatum je Projekt
- **API-Key pro Projekt** — für die automatische Integration
- **Aktivitätslog** — alle Änderungen werden protokolliert
- **Client-SDK** — Fertige Snippets für JS, React, Node.js, Flutter, React Native

## Quick Start

```bash
# Backend-Dependencies installieren
npm install

# Frontend-Dependencies installieren
cd frontend && npm install && cd ..

# Development-Modus starten (Backend + Frontend)
npm run dev
```

- Dashboard: http://localhost:3000
- API: http://localhost:3001

## Projektstruktur

```
├── server/              # Express Backend
│   ├── index.js         # Server-Einstiegspunkt
│   ├── database.js      # SQLite-Datenbank
│   ├── middleware/       # Auth-Middleware
│   └── routes/          # API-Routen
├── frontend/            # React Frontend
├── client-sdk/          # Integrations-Snippets
│   ├── ccd-guard.js           # Vanilla JS (für HTML-Seiten)
│   ├── ccd-guard-middleware.js # Express Middleware
│   └── ccd-guard-react.js     # React Hook
├── INTEGRATION.md       # Ausführliche Integrations-Anleitung
└── .env                 # Konfiguration (JWT_SECRET etc.)
```

## Produktion

```bash
# Frontend bauen
npm run build

# Server starten
npm start
```

Die `.env`-Datei muss angepasst werden:
- `JWT_SECRET` — Zufälliger, sicherer String
- `PORT` — Server-Port (default: 3001)

## Integration

Siehe [INTEGRATION.md](INTEGRATION.md) für die vollständige Anleitung zur Integration in Kunden-Webseiten und Apps.

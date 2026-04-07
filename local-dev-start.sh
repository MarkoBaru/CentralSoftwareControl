#!/usr/bin/env bash
set -e

echo "============================================"
echo "  Central Control Dashboard - Dev Setup"
echo "============================================"
echo ""

# In das Projektverzeichnis wechseln (dort wo das Script liegt)
cd "$(dirname "$0")"

# Prüfen ob Node.js installiert ist
if ! command -v node &> /dev/null; then
    echo "[FEHLER] Node.js ist nicht installiert oder nicht im PATH."
    echo "Bitte installiere Node.js von https://nodejs.org/"
    exit 1
fi

echo "[OK] Node.js gefunden: $(node --version)"

# .env anlegen falls nicht vorhanden
if [ ! -f ".env" ]; then
    echo "[SETUP] Erstelle .env Datei mit Standardwerten..."
    cat > .env <<EOF
PORT=3001
JWT_SECRET=change-this-to-a-random-secret-in-production
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
EOF
    echo "[OK] .env erstellt - Bitte später das JWT_SECRET ändern!"
else
    echo "[OK] .env vorhanden"
fi

# Backend-Dependencies installieren
if [ ! -d "node_modules" ]; then
    echo ""
    echo "[SETUP] Installiere Backend-Dependencies..."
    npm install
    echo "[OK] Backend-Dependencies installiert"
else
    echo "[OK] Backend node_modules vorhanden"
fi

# Frontend-Dependencies installieren
if [ ! -d "frontend/node_modules" ]; then
    echo ""
    echo "[SETUP] Installiere Frontend-Dependencies..."
    (cd frontend && npm install)
    echo "[OK] Frontend-Dependencies installiert"
else
    echo "[OK] Frontend node_modules vorhanden"
fi

echo ""
echo "============================================"
echo "  Starte Development Server..."
echo "============================================"
echo ""
echo "  Dashboard:  http://localhost:3000"
echo "  API:        http://localhost:3001/api"
echo ""
echo "  Beenden mit: Ctrl+C"
echo "============================================"
echo ""

# Dev-Server starten (Backend + Frontend parallel)
npm run dev

@echo off
chcp 65001 >nul
title Central Control Dashboard - Dev Start

echo ============================================
echo   Central Control Dashboard - Dev Setup
echo ============================================
echo.

:: Pruefen ob Node.js installiert ist
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [FEHLER] Node.js ist nicht installiert oder nicht im PATH.
    echo Bitte installiere Node.js von https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js gefunden: 
node --version

:: In das Projektverzeichnis wechseln (dort wo die .bat liegt)
cd /d "%~dp0"

:: .env anlegen falls nicht vorhanden
if not exist ".env" (
    echo [SETUP] Erstelle .env Datei mit Standardwerten...
    (
        echo PORT=3001
        echo JWT_SECRET=change-this-to-a-random-secret-in-production
        echo ADMIN_EMAIL=admin@example.com
        echo ADMIN_PASSWORD=admin123
    ) > .env
    echo [OK] .env erstellt - Bitte spaeter das JWT_SECRET aendern!
) else (
    echo [OK] .env vorhanden
)

:: Backend-Dependencies installieren
if not exist "node_modules" (
    echo.
    echo [SETUP] Installiere Backend-Dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [FEHLER] npm install fehlgeschlagen!
        pause
        exit /b 1
    )
    echo [OK] Backend-Dependencies installiert
) else (
    echo [OK] Backend node_modules vorhanden
)

:: Frontend-Dependencies installieren
if not exist "frontend\node_modules" (
    echo.
    echo [SETUP] Installiere Frontend-Dependencies...
    cd frontend
    call npm install
    if %errorlevel% neq 0 (
        echo [FEHLER] Frontend npm install fehlgeschlagen!
        pause
        exit /b 1
    )
    cd ..
    echo [OK] Frontend-Dependencies installiert
) else (
    echo [OK] Frontend node_modules vorhanden
)

echo.
echo ============================================
echo   Starte Development Server...
echo ============================================
echo.
echo   Dashboard:  http://localhost:3000
echo   API:        http://localhost:3001/api
echo.
echo   Beenden mit: Ctrl+C
echo ============================================
echo.

:: Dev-Server starten (Backend + Frontend parallel)
call npm run dev

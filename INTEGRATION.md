# Central Control Dashboard – Integrations-Anleitung

## Übersicht

Das **Central Control Dashboard (CCD)** ermöglicht es, Kundenprojekte (Webseiten, Apps, Web-Apps) zentral zu verwalten. Über einen einfachen Toggle können Webseiten/Apps blockiert werden, z.B. wenn ein Kunde sein Abo nicht bezahlt.

---

## 1. Dashboard starten

```bash
# Dependencies installieren
npm install

# Frontend Dependencies
cd frontend && npm install && cd ..

# Beide Server gleichzeitig starten (Development)
npm run dev
```

Das Dashboard ist dann erreichbar unter:
- **Dashboard:** http://localhost:3000
- **API:** http://localhost:3001/api

Beim ersten Aufruf wird ein Admin-Konto erstellt.

---

## 2. Projekt anlegen

1. Im Dashboard auf **"Neues Projekt"** klicken
2. Projektname, Kundenname, Typ (Website/App/Web-App) und URL eingeben
3. Nach dem Anlegen wird automatisch ein **API-Key** generiert (z.B. `ccd_a1b2c3d4...`)
4. Diesen API-Key kopieren — er wird für die Integration benötigt

---

## 3. Integration in Kunden-Webseiten/Apps

Es gibt **3 Integrations-Varianten**, je nach Tech-Stack der Kunden-Seite:

---

### Variante A: Einfaches JavaScript-Snippet (für jede HTML-Website)

**Am einfachsten.** Einfach ein `<script>`-Tag im `<head>` der Webseite einfügen:

```html
<head>
  <!-- ... andere Tags ... -->
  <script
    src="https://DEIN-DASHBOARD-SERVER.de/client/ccd-guard.js"
    data-api-key="ccd_DEIN_API_KEY_HIER"
    data-server="https://DEIN-DASHBOARD-SERVER.de"
    data-interval="300">
  </script>
</head>
```

**Wie es funktioniert:**
- Das Script prüft beim Laden der Seite den Block-Status
- Alle 5 Minuten (300 Sek.) wird erneut geprüft
- Wenn blockiert: Ein Fullscreen-Overlay verdeckt die Seite mit "Nicht verfügbar"-Nachricht
- Wenn nicht blockiert: Die Seite wird normal angezeigt
- Bei Netzwerkfehler: **Fail-Open** — die Seite bleibt erreichbar

**Alternativ** kann das Script auch lokal eingebunden werden — Datei `client-sdk/ccd-guard.js` kopieren.

| Parameter        | Beschreibung                          | Default |
| ---------------- | ------------------------------------- | ------- |
| `data-api-key`   | Der API-Key des Projekts              | —       |
| `data-server`    | URL des Dashboard-Servers             | —       |
| `data-interval`  | Prüfintervall in Sekunden             | 300     |

---

### Variante B: Node.js/Express Middleware (Server-seitiges Blocking)

**Sicherer**. Blockiert auf Server-Ebene, bevor die Seite ausgeliefert wird.

1. Datei `client-sdk/ccd-guard-middleware.js` in das Kundenprojekt kopieren

2. Als Express-Middleware einbinden:

```javascript
const express = require('express');
const ccdGuard = require('./ccd-guard-middleware');

const app = express();

// CCD Guard als erste Middleware einbinden
app.use(ccdGuard({
  apiKey: 'ccd_DEIN_API_KEY_HIER',
  serverUrl: 'https://DEIN-DASHBOARD-SERVER.de',
  checkInterval: 60  // Prüfung alle 60 Sekunden
}));

// ... restliche App-Routen ...
app.get('/', (req, res) => {
  res.send('Meine Website');
});
```

**Wie es funktioniert:**
- Die Middleware cached den Block-Status im Speicher
- Alle 60 Sekunden wird der Status aktualisiert
- Wenn blockiert: Alle Requests bekommen HTTP 503 + Maintenance-Seite
- **Fail-Open**: Bei Netzwerkfehlern bleibt die Seite erreichbar

---

### Variante C: React/Next.js Hook

Für Single-Page-Apps mit React:

1. Datei `client-sdk/ccd-guard-react.js` in das Kundenprojekt kopieren

2. In der Haupt-Komponente einbinden:

```jsx
import { useCCDGuard, CCDBlockScreen } from './ccd-guard-react';

function App() {
  const { isBlocked, loading } = useCCDGuard({
    apiKey: 'ccd_DEIN_API_KEY_HIER',
    serverUrl: 'https://DEIN-DASHBOARD-SERVER.de',
    checkInterval: 300, // Prüf-Intervall in Sekunden
  });

  if (loading) return null; // oder LoadingSpinner
  if (isBlocked) return <CCDBlockScreen />;

  return (
    <div>
      {/* Normale App-Inhalte */}
    </div>
  );
}
```

---

## 4. Für Mobile Apps (React Native / Flutter / Native)

Für Mobile Apps muss der API-Endpunkt direkt aufgerufen werden:

### API-Endpunkt

```
GET https://DEIN-DASHBOARD-SERVER.de/api/check-status/ccd_DEIN_API_KEY
```

### Antwort

```json
{
  "is_blocked": false,
  "status": "active",
  "project_name": "Kunde XY Website"
}
```

### React Native Beispiel

```javascript
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';

function useBlockCheck(apiKey, serverUrl) {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${serverUrl}/api/check-status/${apiKey}`);
        const data = await res.json();
        setBlocked(data.is_blocked);
      } catch {}
    };
    check();
    const interval = setInterval(check, 300000); // alle 5 Min
    return () => clearInterval(interval);
  }, []);

  return blocked;
}

function App() {
  const isBlocked = useBlockCheck('ccd_DEIN_KEY', 'https://DEIN-SERVER.de');

  if (isBlocked) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>App vorübergehend nicht verfügbar</Text>
      </View>
    );
  }

  return <MeineApp />;
}
```

### Flutter Beispiel

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:async';

class CCDGuard {
  final String apiKey;
  final String serverUrl;
  bool isBlocked = false;
  Timer? _timer;

  CCDGuard({required this.apiKey, required this.serverUrl});

  Future<void> checkStatus() async {
    try {
      final response = await http.get(
        Uri.parse('$serverUrl/api/check-status/$apiKey'),
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        isBlocked = data['is_blocked'] == true;
      }
    } catch (_) {
      // Fail-open: App bleibt nutzbar
    }
  }

  void startPeriodicCheck({Duration interval = const Duration(minutes: 5)}) {
    checkStatus();
    _timer = Timer.periodic(interval, (_) => checkStatus());
  }

  void dispose() => _timer?.cancel();
}
```

---

## 5. CORS-Konfiguration

Der Dashboard-Server hat CORS aktiviert. Für Produktivbetrieb sollte die CORS-Konfiguration in `server/index.js` auf die erlaubten Domains eingeschränkt werden:

```javascript
app.use(cors({
  origin: ['https://dashboard.deinefirma.de', 'https://kunde1.de', 'https://kunde2.de']
}));
```

---

## 6. Sicherheitshinweise

- **API-Keys** sollten geheim gehalten werden. Das JS-Snippet ist im Quellcode sichtbar, aber der Key erlaubt nur Lese-Zugriff auf den Block-Status.
- Für maximale Sicherheit die **Server-Middleware** (Variante B) verwenden — dort ist der Key nicht im Client-Code sichtbar.
- **JWT-Secret** in `.env` unbedingt ändern für Produktion.
- **Fail-Open-Prinzip**: Bei Verbindungsfehlern zum Dashboard bleibt die Kunden-Seite erreichbar. So wird kein ungewollter Ausfall verursacht.

---

## 7. Projekt-Statuses

| Status         | Bedeutung                                    |
| -------------- | -------------------------------------------- |
| `active`       | Projekt läuft normal                         |
| `blocked`      | Projekt ist blockiert (Seite nicht erreichbar)|
| `maintenance`  | Projekt in Wartung                           |
| `development`  | Projekt in Entwicklung                       |

| Abo-Status     | Bedeutung                                    |
| -------------- | -------------------------------------------- |
| `active`       | Abo bezahlt und aktiv                        |
| `overdue`      | Zahlung überfällig                           |
| `cancelled`    | Abo gekündigt                                |

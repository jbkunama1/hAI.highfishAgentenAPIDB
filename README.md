# hAI · HighFish Agenten API DB

> Leichtgewichtige SQLite-basierte API-Schlüsselverwaltung für KI-Agenten-Infrastrukturen – containerisiert, sofort einsatzbereit.

![HighFish API DB Logo](highfishapidblogo.png)

---

## Inhalt

- [Überblick](#überblick)
- [Features](#features)
- [Schnellstart](#schnellstart)
- [Docker-Deployment](#docker-deployment)
- [API-Referenz](#api-referenz)
  - [Einträge abrufen](#einträge-abrufen)
  - [Eintrag erstellen](#eintrag-erstellen)
  - [Eintrag aktualisieren](#eintrag-aktualisieren)
  - [Eintrag löschen](#eintrag-löschen)
  - [Export](#export)
  - [Import (Text-Format)](#import-text-format)
  - [Health-Check](#health-check)
- [Datenstruktur](#datenstruktur)
- [Umgebungsvariablen](#umgebungsvariablen)
- [Lizenz](#lizenz)

---

## Überblick

**HighFish Agenten API DB** ist ein schlankes Node.js/Express-Backend zur zentralen Verwaltung von API-Endpunkten und API-Keys für KI-Agenten (z. B. OpenAI, lokale LLMs, Webhooks). Die Daten werden in einer SQLite-Datenbank gespeichert und über eine REST-API exponiert. Ein Web-UI (`index.html`) ist bereits integriert.

---

## Features

- ✅ CRUD für API-Einträge (Name, URL, API-Key, Notizen)
- ✅ **JSON-Export** aller Einträge
- ✅ **Text-Import** (semikolongetrennt, Batch)
- ✅ Rate Limiting (100 Anfragen/min pro IP)
- ✅ Docker-ready (inkl. Volume-Persistenz)
- ✅ Integriertes Web-UI

---

## Schnellstart

```bash
# Repository klonen
git clone https://github.com/jbkunama1/hAI.highfishAgentenAPIDB.git
cd hAI.highfishAgentenAPIDB

# Abhängigkeiten installieren
npm install

# Entwicklungsserver starten (Port 3000)
node server.js
```

Aufruf im Browser: `http://localhost:3000`

---

## Docker-Deployment

### Mit docker-compose (empfohlen)

```bash
docker compose up -d
```

Die Datenbank wird im Volume `highfish-data` persistiert (`/data/highfish.db` im Container).

### Manuell

```bash
docker build -t highfish-api-db .
docker run -d \
  -p 3000:3000 \
  -v highfish-data:/data \
  --name highfish-api-db \
  highfish-api-db
```

### In Portainer

Stack aus `docker-compose.yml` importieren oder direkt deployen.

---

## API-Referenz

Basis-URL: `http://<host>:3000`

---

### Einträge abrufen

#### Alle Einträge

```
GET /api/entries
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "OpenAI",
    "url": "https://api.openai.com",
    "apiKey": "sk-...",
    "notes": "GPT-4o",
    "created_at": "2026-06-01T10:00:00.000Z",
    "updated_at": "2026-06-01T10:00:00.000Z"
  }
]
```

#### Einzelner Eintrag

```
GET /api/entries/:id
```

---

### Eintrag erstellen

```
POST /api/entries
Content-Type: application/json
```

**Body:**
```json
{
  "name": "OpenAI",
  "url": "https://api.openai.com",
  "apiKey": "sk-...",
  "notes": "Optional"
}
```

Pflichtfelder: `name`, `url`, `apiKey`

---

### Eintrag aktualisieren

```
PUT /api/entries/:id
Content-Type: application/json
```

**Body:** identisch mit POST

---

### Eintrag löschen

```
DELETE /api/entries/:id
```

**Response:**
```json
{ "success": true, "message": "Entry deleted" }
```

---

### Export

Exportiert alle Einträge als JSON-Array (ohne `id`, `created_at`, `updated_at`):

```
GET /api/export
```

**Response:**
```json
[
  { "name": "OpenAI", "url": "https://api.openai.com", "apiKey": "sk-...", "notes": "" }
]
```

---

### Import (Text-Format)

Importiert mehrere Einträge auf einmal im semikolongetrennten Format.

```
POST /api/import-text
Content-Type: application/json
```

**Body:** Array von Strings im Format `Name;URL;API_KEY;Notizen (optional)`

```json
[
  "OpenWeather;https://api.openweathermap.org;KEY123;Wetterdaten",
  "hAI Agent DB;https://api.highfish.local;ABCDEF;Interne Tests",
  "Groq Cloud;https://api.groq.com;gsk_xxx;Llama3 70B"
]
```

**Response:**
```json
{ "success": true, "imported": 3 }
```

**Hinweise:**
- Zeilen mit fehlendem `name`, `url` oder `apiKey` werden übersprungen
- `notes` ist optional; mehrere `;` im Notizfeld werden korrekt zusammengeführt
- Duplikate werden **nicht** geprüft – bei Bedarf vor dem Import exportieren und bereinigen

---

### Health-Check

```
GET /api/health
```

**Response:**
```json
{ "status": "ok", "timestamp": "2026-06-12T10:00:00.000Z" }
```

---

## Datenstruktur

Tabelle: `api_entries`

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | INTEGER (PK, AUTO) | Automatische ID |
| `name` | TEXT (NOT NULL) | Anzeigename des Dienstes |
| `url` | TEXT (NOT NULL) | API-Endpunkt-URL |
| `apiKey` | TEXT (NOT NULL) | API-Schlüssel |
| `notes` | TEXT | Optionale Notizen |
| `created_at` | DATETIME | Erstellungszeitpunkt |
| `updated_at` | DATETIME | Letzte Änderung |

---

## Umgebungsvariablen

| Variable | Standard | Beschreibung |
|----------|----------|--------------|
| `PORT` | `3000` | HTTP-Port des Servers |
| `DB_PATH` | `./data/highfish.db` (dev) / `/data/highfish.db` (prod) | Pfad zur SQLite-Datei |
| `NODE_ENV` | – | `production` aktiviert den Docker-Datenpfad |
| `API_KEY` | – | API-Key für Bearer-Token-Authentifizierung (empfohlen) |
| `AUTH_USER` / `AUTH_PASSWORD` | – | Alternativ: Basic-Auth-Zugangsdaten |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Kommagetrennte CORS-Whitelist |

### Authentifizierung

Alle `/api`-Routen außer `/api/health` sind **geschützt**. Setze mindestens eine der folgenden Optionen:

**Option 1 – Bearer-Token:**
```bash
API_KEY=geheimer-schluessel
# Anfrage:
curl -H "Authorization: Bearer geheimer-schluessel" http://localhost:3000/api/entries
```

**Option 2 – Basic Auth:**
```bash
AUTH_USER=admin
AUTH_PASSWORD=geheim
# Anfrage:
curl -u admin:geheim http://localhost:3000/api/entries
```

**Wichtig:** Ohne gesetzten `API_KEY`/`AUTH_*` sind die Routen weiterhin offen. Setze die Variablen in Produktion immer! In `docker-compose.yml` werden die Variablen bereits aus der lokalen `.env` übernommen.

---

## Lizenz

MIT – siehe [LICENSE](LICENSE)

---

*Teil der **hAI · HighFish** Infrastruktur – selbstgehostete KI-Agenten-Verwaltung.*

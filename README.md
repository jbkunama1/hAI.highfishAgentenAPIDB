# hAI · HighFish Agenten API DB
[![Status](https://img.shields.io/badge/status-active-brightgreen?style=for-the-badge)](https://github.com/jbkunama1/hAI.highfishAgentenAPIDB)
[![WebApp](https://img.shields.io/badge/WebApp-Responsive-0f766e?style=for-the-badge&logo=html5&logoColor=white)](https://github.com/jbkunama1/hAI.highfishAgentenAPIDB)
[![API](https://img.shields.io/badge/API-Manager-6f42c1?style=for-the-badge&logo=api&logoColor=white)](https://github.com/jbkunama1/hAI.highfishAgentenAPIDB)
[![DarkTheme](https://img.shields.io/badge/Theme-Dark-222222?style=for-the-badge&logo=darkreader&logoColor=white)](https://github.com/jbkunama1/hAI.highfishAgentenAPIDB)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)




[![Buy me a coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/highfish)

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
  - [Authentifizierung](#authentifizierung)
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
- ✅ **Authentifizierung** auf allen API-Endpunkten (Bearer-Token oder Basic Auth)
- ✅ **CI/CD** – automatischer Docker-Build per GitHub Actions (bei Push + manuell)
- ✅ Docker-ready (inkl. Volume-Persistenz, läuft als non-root)
- ✅ Integriertes Web-UI

---

## Schnellstart

```bash
# Repository klonen
git clone https://github.com/jbkunama1/hAI.highfishAgentenAPIDB.git
cd hAI.highfishAgentenAPIDB

# Abhängigkeiten installieren
npm install

# Entwicklungsserver starten (Port 3000) – mit API-Key absichern
API_KEY=geheimer-schluessel node server.js
```

Aufruf im Browser: `http://localhost:3000`

> Im Web-UI loggst du dich mit deinem **API-Key** ein (der eingegebene Wert wird gegen das Backend geprüft). Setze dafür vor dem Start die Env-Variable `API_KEY` (siehe [umgebungsvariablen](#umgebungsvariablen)).

---

## Docker-Deployment

> ⚠️ Setze in Produktion immer einen **API-Key**, sonst sind die Endpunkte ungeschützt (siehe [Authentifizierung](#authentifizierung)).

### Mit docker-compose (empfohlen)

```bash
# Optional: .env-Datei mit Zugangsdaten anlegen
echo "API_KEY=geheimer-schluessel" > .env

docker compose up -d
```

Die Datenbank wird im Volume `highfish-data` persistiert (`/data/highfish.db` im Container). Die Variablen aus `.env` werden von `docker-compose.yml` automatisch übernommen (`API_KEY`, `AUTH_USER`, `AUTH_PASSWORD`, `ALLOWED_ORIGINS`).

### Manuell

```bash
docker build -t highfish-api-db .
docker run -d \
  -p 3000:3000 \
  -e API_KEY=geheimer-schluessel \
  -v highfish-data:/data \
  --name highfish-api-db \
  highfish-api-db
```

### CI/CD – automatischer Docker-Build

Ein [GitHub Actions Workflow](.github/workflows/docker-build.yml) baut das Image und pusht es bei jedem Push auf `main` sowie manuell nach **GHCR** (`ghcr.io/jbkunama1/hAI.highfishAgentenAPIDB`) als `latest` und Commit-SHA:

- **Automatisch:** bei Push auf `main`
- **Manuell:** *Actions → Docker Build → Run workflow*

### In Portainer

Das GHCR-Image (`ghcr.io/jbkunama1/hai.highfishagentenapidb:latest`) wird vom CI-Workflow gebaut. Für Portainer gibt es eine spezielle Datei **`docker-compose.prod.yml`**, die das fertige Image nutzt (statt lokal zu bauen).

**Schritt 1 – GHCR-Registry hinterlegen (nur bei privatem Paket)**

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained** → **Generate new token**
   - Repository: `hAI.highfishAgentenAPIDB`
   - Repository permissions → **Packages: Read**
2. Portainer → **Registries** → **Add registry** → **GitHub Container Registry**
   - **URL:** `https://ghcr.io`
   - **Username:** `jbkunama1`
   - **Token:** der erstellte Personal Access Token
3. Speichern

> Ist das Container-Paket **öffentlich** (`github.com/jbkunama1/hAI.highfishAgentenAPIDB/pkgs/container/hai.highfishagentenapidb` → Settings → Change visibility), entfällt dieser Schritt.

**Schritt 2 – Stack aus dem Repository anlegen**

1. Portainer → **Stacks** → **Add stack**
2. **Name:** bspw. `highfish-api-db`
3. **Build method:** **Repository** (Alternative: importiere `docker-compose.prod.yml` als Web-Editor)
4. - **Repository URL:** `https://github.com/jbkunama1/hAI.highfishAgentenAPIDB.git`
   - **Ref:** `main`
   - **Compose path:** `docker-compose.prod.yml`
5. **Environment variables** setzen (mindestens `API_KEY`):
   | Variable | Beispiel |
   |----------|----------|
   | `API_KEY` | `dein-geheimer-schluessel` |
   | `ALLOWED_ORIGINS` | `https://api.deine-domain.de` |
   | `AUTH_USER` / `AUTH_PASSWORD` | optional |
6. **Deploy the stack**

**Schritt 3 – prüfen**

- Container innerhalb von ~30 s **healthy** (Healthcheck via `curl /api/health`)
- `curl http://<server-ip>:3000/api/health` → `{"status":"ok",...}`
- `curl http://<server-ip>:3000/api/entries` → `401` ohne API-Key

> **Nach einem Image-Update:** In Portainer beim Stack **Update the stack** klicken, damit der Container das neue `latest`-Image zieht und neu startet.

---

## API-Referenz

Basis-URL: `http://<host>:3000`

> **Authentifizierung:** Alle Endpunkte außer `/api/health` erfordern einen Auth-Header:
> - **Bearer-Token:** `Authorization: Bearer <API_KEY>`
> - **Basic Auth:** `Authorization: Basic base64(Benutzer:Passwort)`
>
> Ohne gültigen Key antwortet der Server mit `401 Unauthorized`.

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


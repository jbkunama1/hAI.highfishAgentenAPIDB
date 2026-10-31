# Environment Variables für HighFish Agenten API DB

## Grundlegende Konfiguration

| Variable | Standard | Beschreibung |
|----------|----------|--------------|
| `PORT` | `3000` | HTTP-Port des Servers |
| `DB_PATH` | `./data/highfish.db` (dev) / `/data/highfish.db` (prod) | Pfad zur SQLite-Datei |
| `NODE_ENV` | – | `production` aktiviert den Docker-Datenpfad |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Kommagetrennte CORS-Whitelist |

## Authentifizierung

⚠️ **Wichtig:** Ohne gesetzten `API_KEY`/`AUTH_*` sind alle Routen offen!

| Variable | Standard | Beschreibung |
|----------|----------|--------------|
| `API_KEY` | – | **API-Key für Bearer-Token-Authentifizierung (empfohlen)** |
| `AUTH_USER` | – | Benutzername für Basic Auth |
| `AUTH_PASSWORD` | – | Passwort für Basic Auth |

**Option 1 – Bearer-Token (empfohlen):**
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

## MCP Server Integration

| Variable | Standard | Beschreibung |
|----------|----------|--------------|
| `MCP_PORT` | `3001` | MCP Server Port |
| `MCP_HOST` | `localhost` | MCP Server Host |
| `MCP_DEBUG` | `false` | MCP Server Debug Mode |

## Telegram Bot Integration

| Variable | Standard | Beschreibung |
|----------|----------|--------------|
| `TELEGRAM_BOT_TOKEN` | – | Telegram Bot Token von @BotFather |
| `TELEGRAM_ALLOWED_CHAT_IDS` | – | Kommagetrennte Liste erlaubter Telegram Chat-IDs |
| `TELEGRAM_ADMIN_API_KEY` | – | Optionaler Admin API-Key für den Bot |
| `TELEGRAM_DAILY_TIME` | `09:00` | Uhrzeit für tägliche Status-Benachrichtigung |

## Docker Integration

| Variable | Standard | Beschreibung |
|----------|----------|--------------|
| `DATABASE_URL` | – | Datenbank-Verbindungsstring (optional) |
| `API_ENCRYPTION_KEY` | – | Datenbank-Verschlüsselungsschlüssel (optional) |

## Docker-Beispiele

### docker-compose.yml (.env)
```env
# Grundkonfiguration
PORT=3000
NODE_ENV=production

# Authentifizierung
API_KEY=dein-geheimer-schluessel
# ODER:
AUTH_USER=admin
AUTH_PASSWORD=geheim

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://deine-domain.de

# MCP Server
MCP_PORT=3001
MCP_HOST=localhost
MCP_DEBUG=false

# Telegram Bot (optional)
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_ALLOWED_CHAT_IDS=123456789,987654321
TELEGRAM_DAILY_TIME=09:00
```

### Docker Run
```bash
docker run -d \
  -p 3000:3000 \
  -p 3001:3001 \
  -e API_KEY=dein-schluessel \
  -e MCP_PORT=3001 \
  -e MCP_HOST=localhost \
  -e MCP_DEBUG=false \
  -v highfish-data:/data \
  --name highfish-api-db \
  ghcr.io/jbkunama1/hai.highfishagentenapidb:latest
```

## AnythingMCP Konfiguration

### anything-mcp-config.json
```json
{
  "name": "HighFish API DB",
  "command": "node",
  "args": ["mcp-server.js"],
  "env": {
    "MCP_PORT": "3001",
    "MCP_HOST": "localhost",
    "MCP_DEBUG": "false"
  }
}
```

### MCP Tools Übersicht

- `list_api_entries` - API-Einträge auflisten
- `get_api_entry` - Einzelnen Eintrag abrufen
- `create_api_entry` - Neuen Eintrag erstellen
- `update_api_entry` - Eintrag aktualisieren
- `delete_api_entry` - Eintrag löschen
- `export_api_entries` - Daten exportieren
- `import_api_entries` - Daten importieren
- `get_database_stats` - Systemstatistiken

## Ports

- **WebUI**: `http://localhost:3000`
- **MCP Server**: `http://localhost:3001`
- **Health Checks**: `http://localhost:3000/api/health`
- **MCP Health**: `http://localhost:3001/mcp/health`

## Sicherheitshinweise

1. **Setze immer API_KEY oder AUTH_* in Produktion**
2. **Verwende starfe Passwörter für Basic Auth**
3. **Beschränke ALLOWED_ORIGINS auf deine Domainen**
4. **Schütze Telegram Bot Token und Chat-IDs**
5. **MCP Port 3001 ist nur für lokale Kommunikation vorgesehen**
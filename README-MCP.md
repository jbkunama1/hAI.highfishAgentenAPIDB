# hAI · HighFish Agenten API DB MCP Server

Ein MCP (Model Context Protocol) Server für die hAI.highfishAgentenAPIDB Datenbank. Ermöglicht es Agenten, auf die API-Verwaltungsfunktionen zuzugreifen und die Datenbank über AnythingMCP zu steuern.

## 🚀 Features

### ✅ Verfügbare MCP Tools

1. **API Einträge Management**
   - `list_api_entries` - Listet alle API Einträge mit Filteroptionen
   - `get_api_entry` - Ruft einen spezifischen API Eintrag ab
   - `create_api_entry` - Erstellt neue API Einträge
   - `update_api_entry` - Aktualisiert bestehende API Einträge
   - `delete_api_entry` - Löscht API Einträge

2. **Daten Export/Import**
   - `export_api_entries` - Exportiert API Einträge (JSON, CSV, TXT)
   - `import_api_entries` - Importiert API Einträge (JSON, Text)

3. **System Informationen**
   - `get_database_stats` - Gibt Datenbank Statistiken zurück

## 🛠️ Installation & Setup

### 1. Server Installation

```bash
# Installiere Abhängigkeiten
npm install

# Starte den MCP Server
npm run mcp

# Oder direkt
node mcp-server.js
```

### 2. AnythingMCP Konfiguration

Kopiere `anything-mcp-config.json` in dein AnythingMCP Konfigurationsverzeichnis:

```bash
# Linux/macOS
mkdir -p ~/.config/anything-mcp/servers
cp anything-mcp-config.json ~/.config/anything-mcp/servers/highfish-api-db-mcp.json

# Windows
mkdir -p %APPDATA%\anything-mcp\servers
copy anything-mcp-config.json %APPDATA%\anything-mcp\servers\highfish-api-db-mcp.json
```

## 🔌 API Doku

### Tool Reference

#### 1. `list_api_entries`
**Beschreibung:** Listet alle API Einträge mit optionalen Filteroptionen

**Parameter:**
- `page` (integer, optional): Seitenzahl für Paginierung (Standard: 1)
- `limit` (integer, optional): Max. Einträge pro Seite (max: 500, Standard: 100)
- `search` (string, optional): Suchbegriff zum Filtern
- `category` (string, optional): Filter nach Kategorie

**Beispiel:**
```json
{
  "tool": "list_api_entries",
  "params": {
    "page": 1,
    "limit": 50,
    "search": "OpenAI"
  }
}
```

#### 2. `get_api_entry`
**Beschreibung:** Ruft einen spezifischen API Eintrag anhand seiner ID ab

**Parameter:**
- `id` (integer, required): ID des API Eintrags

**Beispiel:**
```json
{
  "tool": "get_api_entry", 
  "params": {
    "id": 42
  }
}
```

#### 3. `create_api_entry`
**Beschreibung:** Erstellt einen neuen API Eintrag

**Parameter:**
- `name` (string, required): Name des API Eintrags
- `url` (string, optional): URL des API Eintrags
- `apiKey` (string, required): API Schlüssel (wird in Antworten maskiert)
- `category` (string, optional): Kategorie
- `notes` (string, optional): Notizen

**Beispiel:**
```json
{
  "tool": "create_api_entry",
  "params": {
    "name": "OpenAI GPT-4",
    "url": "https://api.openai.com/v1",
    "apiKey": "sk-proj-abc123...",
    "category": "AI",
    "notes": "Künstliche Intelligenz API"
  }
}
```

#### 4. `update_api_entry`
**Beschreibung:** Aktualisiert einen bestehenden API Eintrag

**Parameter:**
- `id` (integer, required): ID des zu aktualisierenden Eintrags
- `name` (string, optional): Neuer Name
- `url` (string, optional): Neue URL
- `apiKey` (string, optional): Neuer API Schlüssel
- `category` (string, optional): Neue Kategorie
- `notes` (string, optional): Neue Notizen

**Beispiel:**
```json
{
  "tool": "update_api_entry",
  "params": {
    "id": 42,
    "apiKey": "sk-proj-updated...",
    "notes": "Aktualisierter Schlüssel und Notizen"
  }
}
```

#### 5. `delete_api_entry`
**Beschreibung:** Löscht einen API Eintrag

**Parameter:**
- `id` (integer, required): ID des zu löschenden Eintrags

**Beispiel:**
```json
{
  "tool": "delete_api_entry",
  "params": {
    "id": 42
  }
}
```

#### 6. `export_api_entries`
**Beschreibung:** Exportiert API Einträge in verschiedenen Formaten

**Parameter:**
- `format` (string, optional): Exportformat - "json", "csv", "txt" (Standard: "json")
- `search` (string, optional): Filter für Export

**Beispiel:**
```json
{
  "tool": "export_api_entries",
  "params": {
    "format": "csv",
    "search": "AI"
  }
}
```

#### 7. `import_api_entries`
**Beschreibung:** Importiert API Einträge aus Daten

**Parameter:**
- `data` (array, required): Array von API Einträgen zum Import
- `format` (string, optional): Format der Daten - "json" oder "text" (Standard: "json")

**Beispiel JSON Import:**
```json
{
  "tool": "import_api_entries",
  "params": {
    "data": [
      {
        "name": "New API",
        "url": "https://api.example.com",
        "apiKey": "sk-import...",
        "category": "Importiert",
        "notes": "Importierter Eintrag"
      }
    ],
    "format": "json"
  }
}
```

**Beispiel Text Import:**
```json
{
  "tool": "import_api_entries",
  "params": {
    "data": [
      "New API;https://api.example.com;sk-import...;Importiert;Importierter Eintrag",
      "Another API;https://another.com;sk-another...;Another;Another entry"
    ],
    "format": "text"
  }
}
```

#### 8. `get_database_stats`
**Beschreibung:** Gibt Datenbank Statistiken und Systeminformationen zurück

**Parameter:** Keine

**Beispiel:**
```json
{
  "tool": "get_database_stats",
  "params": {}
}
```

## 🔗 Endpoints

### HTTP Endpoints (für Testing)

- `GET /mcp/health` - Health Check
- `GET /mcp/tools` - Liste aller Tools
- `POST /mcp/execute` - Tool Ausführung (für Debugging)

### WebSocket (MCP Protocol)
- `ws://localhost:3001` - Haupt MCP WebSocket Verbindung

## 🧪 Beispiele

### Beispiel 1: API Einträge auflisten
```json
{
  "method": "tools/call",
  "params": {
    "name": "list_api_entries",
    "arguments": {
      "limit": 10,
      "search": "OpenAI"
    }
  }
}
```

### Beispiel 2: Neuen API Eintrag erstellen
```json
{
  "method": "tools/call",
  "params": {
    "name": "create_api_entry",
    "arguments": {
      "name": "Hugging Face",
      "url": "https://api.huggingface.co",
      "apiKey": "hf_abc123...",
      "category": "ML",
      "notes": "Machine Learning Model Hub"
    }
  }
}
```

### Beispiel 3: Daten exportieren
```json
{
  "method": "tools/call",
  "params": {
    "name": "export_api_entries",
    "arguments": {
      "format": "csv",
      "search": "AI"
    }
  }
}
```

## 📋 Environment Variablen

| Variable | Standard | Beschreibung |
|----------|----------|--------------|
| `MCP_PORT` | `3001` | Port für den MCP Server |
| `MCP_HOST` | `localhost` | Host Adresse |
| `MCP_DEBUG` | `false` | Debug Modus aktivieren |

## 🔒 Sicherheit

- API Schlüssel werden in Antworten immer maskiert (z.B. "sk-xxxx...xxxx")
- Rate Limiting ist für mehrere Tools implementiert
- Validierung aller Eingabeparameter

## 🚀 Integration in Agents

Agenten können dieses MCP Server verwenden, um:
- API Management zu automatisieren
- Backup & Export Prozesse durchzuführen
- System Monitoring durchzuführen
- Daten Analyse zu betreiben

## 📞 Support

Bei Problemen:
1. Prüfe die Logs: `npm run mcp`
2. Teste die Health Check: `curl http://localhost:3001/mcp/health`
3. Prüfe die AnythingMCP Konfiguration
4. Überprüfe die Port Verbindungen

---

**Version:** 1.0.0  
**Author:** jbkunama1  
**License:** MIT
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'];

const DB_PATH = process.env.DB_PATH || (process.env.NODE_ENV === 'production' ? '/data/highfish.db' : './data/highfish.db');

// Middleware
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(bodyParser.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '.')));

// Rate limiting (max 100 req/min per IP, auto-cleanup)
const rateLimit = {};
setInterval(() => {
  const now = Date.now();
  for (const ip in rateLimit) {
    rateLimit[ip] = rateLimit[ip].filter(t => t > now - 60000);
    if (rateLimit[ip].length === 0) delete rateLimit[ip];
  }
}, 60000);

app.use((req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  if (!rateLimit[ip]) rateLimit[ip] = [];
  rateLimit[ip] = rateLimit[ip].filter(t => t > now - 60000);
  if (rateLimit[ip].length >= 100) {
    return res.status(429).json({ error: 'Too many requests, please try again later' });
  }
  rateLimit[ip].push(now);
  next();
});

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
try {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
} catch (err) {
  console.warn(`Warning: Could not create data directory at ${dataDir}:`, err.message);
}

// Initialize SQLite database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database at:', DB_PATH);
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS api_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        apiKey TEXT NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, url)
      )
    `, err => { if (err) console.error('Error creating table:', err); });

    db.run(`
      CREATE TRIGGER IF NOT EXISTS update_timestamp
      AFTER UPDATE ON api_entries
      BEGIN
        UPDATE api_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `, err => { if (err) console.error('Error creating trigger:', err); });

    console.log('Database schema initialized');
  });
}

// --- API Routes ---

// GET all entries (with optional paging: ?page=1&limit=50)
app.get('/api/entries', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const page  = Math.max(parseInt(req.query.page)  || 1, 1);
  const offset = (page - 1) * limit;

  db.get(`SELECT COUNT(*) as total FROM api_entries`, [], (err, countRow) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all(
      `SELECT id, name, url, apiKey, notes, created_at, updated_at
       FROM api_entries ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ total: countRow.total, page, limit, data: rows });
      }
    );
  });
});

// GET single entry
app.get('/api/entries/:id', (req, res) => {
  db.get(
    `SELECT id, name, url, apiKey, notes, created_at, updated_at FROM api_entries WHERE id = ?`,
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Entry not found' });
      res.json(row);
    }
  );
});

// POST create entry
app.post('/api/entries', (req, res) => {
  const { name, url, apiKey, notes } = req.body;
  if (!name || !url || !apiKey) {
    return res.status(400).json({ error: 'Missing required fields: name, url, apiKey' });
  }
  db.run(
    `INSERT INTO api_entries (name, url, apiKey, notes) VALUES (?, ?, ?, ?)`,
    [name, url, apiKey, notes || ''],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, name, url, apiKey, notes: notes || '',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }
  );
});

// PUT update entry
app.put('/api/entries/:id', (req, res) => {
  const { name, url, apiKey, notes } = req.body;
  if (!name || !url || !apiKey) {
    return res.status(400).json({ error: 'Missing required fields: name, url, apiKey' });
  }
  db.run(
    `UPDATE api_entries SET name = ?, url = ?, apiKey = ?, notes = ? WHERE id = ?`,
    [name, url, apiKey, notes || '', req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Entry not found' });
      res.json({ id: parseInt(req.params.id), name, url, apiKey, notes: notes || '',
        updated_at: new Date().toISOString() });
    }
  );
});

// DELETE entry
app.delete('/api/entries/:id', (req, res) => {
  db.run(`DELETE FROM api_entries WHERE id = ?`, [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Entry not found' });
    res.json({ success: true, message: 'Entry deleted' });
  });
});

// GET export
app.get('/api/export', (req, res) => {
  db.all(
    `SELECT name, url, apiKey, notes FROM api_entries ORDER BY created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// POST import-text — semikolon-getrenntes Array: ["Name;URL;KEY;Notiz"]
app.post('/api/import-text', (req, res) => {
  const lines = req.body;
  if (!Array.isArray(lines)) {
    return res.status(400).json({ error: 'Request body must be an array of text lines' });
  }

  const entries = lines.map(line => {
    if (typeof line !== 'string') return null;
    const parts = line.trim().split(';');
    const name   = (parts[0] || '').trim();
    const url    = (parts[1] || '').trim();
    const apiKey = (parts[2] || '').trim();
    const notes  = parts.slice(3).join(';').trim();
    if (!name || !url || !apiKey) return null;
    return { name, url, apiKey, notes };
  }).filter(Boolean);

  if (entries.length === 0) {
    return res.status(400).json({ error: 'No valid entries found in provided text lines' });
  }

  const stmt = db.prepare(
    `INSERT OR IGNORE INTO api_entries (name, url, apiKey, notes) VALUES (?, ?, ?, ?)`
  );

  db.serialize(() => {
    try {
      entries.forEach(e => stmt.run(e.name, e.url, e.apiKey, e.notes || ''));
      stmt.finalize(err => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, imported: entries.length });
      });
    } catch (e) {
      stmt.finalize();
      res.status(500).json({ error: 'Import failed' });
    }
  });
});

// POST import-json — direktes JSON-Array: [{ name, url, apiKey, notes }]
app.post('/api/import', (req, res) => {
  const entries = req.body;
  if (!Array.isArray(entries)) {
    return res.status(400).json({ error: 'Request body must be an array of objects' });
  }

  const valid = entries.filter(e => e && e.name && e.url && e.apiKey);
  if (valid.length === 0) {
    return res.status(400).json({ error: 'No valid entries found' });
  }

  const stmt = db.prepare(
    `INSERT OR IGNORE INTO api_entries (name, url, apiKey, notes) VALUES (?, ?, ?, ?)`
  );

  db.serialize(() => {
    try {
      valid.forEach(e => stmt.run(e.name, e.url, e.apiKey, e.notes || ''));
      stmt.finalize(err => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, imported: valid.length });
      });
    } catch (e) {
      stmt.finalize();
      res.status(500).json({ error: 'Import failed' });
    }
  });
});

// GET health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start
app.listen(PORT, () => {
  console.log(`HighFish API DB server running at http://0.0.0.0:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
});

// Graceful shutdown (SIGINT + SIGTERM)
function shutdown() {
  console.log('Closing database connection...');
  db.close(err => {
    if (err) console.error('Error closing database:', err);
    process.exit(0);
  });
}
process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

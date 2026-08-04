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

// API-Authentifizierung per Bearer-Token oder Basic Auth.
// Der Key wird über die Umgebungsvariable API_KEY bzw. die Auth-Kombination
// AUTH_USER/AUTH_PASSWORD konfiguriert.
const API_KEY = process.env.API_KEY;
const AUTH_USER = process.env.AUTH_USER;
const AUTH_PASSWORD = process.env.AUTH_PASSWORD;

const DB_PATH = process.env.DB_PATH || (process.env.NODE_ENV === 'production' ? '/data/highfish.db' : './data/highfish.db');

// Middleware
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(bodyParser.json({ limit: '1mb' }));

// Serve only the logo image statically (keeps server.js, package.json, etc. private)
app.use('/highfishapidblogo.png', express.static(path.join(__dirname, 'highfishapidblogo.png')));

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

// --- API-Authentifizierung ---
// Schützt alle /api-Routen außer /api/health.
// Konfiguration:
//   - Bearer-Token: Header "Authorization: Bearer <API_KEY>"
//   - Basic Auth:   Header "Authorization: Basic base64(user:password)"
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';

    // 1. Master API_KEY Check (Admin)
    if (API_KEY) {
      const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
      if (bearerMatch && bearerMatch[1] === API_KEY) {
        req.user = { id: 0, username: 'admin', role: 'admin' };
        return next();
      }
    }

    // 2. Legacy Basic Auth Check (Admin)
    if (AUTH_USER && AUTH_PASSWORD) {
      const basicMatch = authHeader.match(/^Basic\s+(.+)$/i);
      if (basicMatch) {
        try {
          const decoded = Buffer.from(basicMatch[1], 'base64').toString('utf8');
          const separatorIndex = decoded.indexOf(':');
          if (separatorIndex !== -1) {
            const user = decoded.slice(0, separatorIndex);
            const pass = decoded.slice(separatorIndex + 1);
            if (user === AUTH_USER && pass === AUTH_PASSWORD) {
              req.user = { id: 0, username: 'admin', role: 'admin' };
              return next();
            }
          }
        } catch (e) { /* ignore */ }
      }
    }

    // 3. Database User Check (Bearer Token)
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch) {
      const token = bearerMatch[1];
      db.get('SELECT id, username, role FROM users WHERE api_key = ?', [token], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database auth error' });
        if (user) {
          req.user = user;
          return next();
        }
        return reject();
      });
    } else {
      reject();
    }

    function reject() {
      res.setHeader('WWW-Authenticate', 'Basic realm="HighFish API DB"');
      res.status(401).json({ error: 'Unauthorized' });
    }
}

app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  requireAuth(req, res, next);
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
    // Create api_entries table (with user_id)
    db.run(`
      CREATE TABLE IF NOT EXISTS api_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT,
        apiKey TEXT NOT NULL,
        category TEXT,
        notes TEXT,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, url)
      )
    `, err => { if (err) console.error('Error creating api_entries table:', err); });

    // Create users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        api_key TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, err => { if (err) console.error('Error creating users table:', err); });

    // Trigger to update timestamps
    db.run(`
      CREATE TRIGGER IF NOT EXISTS update_timestamp
      AFTER UPDATE ON api_entries
      BEGIN
        UPDATE api_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `, err => { if (err) console.error('Error creating trigger:', err); });

    // Migration: add missing columns and make url nullable
    db.all(`PRAGMA table_info(api_entries)`, (err, cols) => {
      if (err) return console.error('Error reading schema:', err);

      if (!cols.find(c => c.name === 'category')) {
        console.log('Migrating schema: adding category column...');
        db.run(`ALTER TABLE api_entries ADD COLUMN category TEXT`);
      }

      if (!cols.find(c => c.name === 'user_id')) {
        console.log('Migrating schema: adding user_id column...');
        db.run(`ALTER TABLE api_entries ADD COLUMN user_id INTEGER`);
      }

      const urlCol = cols.find(c => c.name === 'url');
      if (urlCol && urlCol.notnull === 1) {
        console.log('Migrating schema: making url column nullable...');
        db.exec(`
          CREATE TABLE api_entries_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            url TEXT,
            apiKey TEXT NOT NULL,
            category TEXT,
            notes TEXT,
            user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(name, url)
          );
          INSERT INTO api_entries_new (id, name, url, apiKey, category, notes, user_id, created_at, updated_at)
            SELECT id, name, url, apiKey, category, notes, user_id, created_at, updated_at FROM api_entries;
          DROP TABLE api_entries;
          ALTER TABLE api_entries_new RENAME TO api_entries;
          CREATE TRIGGER IF NOT EXISTS update_timestamp
            AFTER UPDATE ON api_entries
            BEGIN
              UPDATE api_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END;
        `);
      }
    });

    console.log('Database schema initialized');
  });
}

// --- API Routes ---

// GET all entries (with optional paging: ?page=1&limit=50)
app.get('/api/entries', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const page  = Math.max(parseInt(req.query.page)  || 1, 1);
  const offset = (page - 1) * limit;

  const isUser = req.user.role === 'user';
  const whereClause = isUser ? 'WHERE user_id = ?' : '';
  const params = isUser ? [req.user.id] : [];

  db.get(`SELECT COUNT(*) as total FROM api_entries ${whereClause}`, params, (err, countRow) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all(
      `SELECT id, name, url, apiKey, category, notes, user_id, created_at, updated_at
       FROM api_entries ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ total: countRow.total, page, limit, data: rows });
      }
    );
  });
});

// GET single entry
app.get('/api/entries/:id', (req, res) => {
  const isAdmin = req.user.role !== 'user';
  const whereClause = isAdmin ? 'WHERE id = ?' : 'WHERE id = ? AND user_id = ?';
  const params = isAdmin ? [req.params.id] : [req.params.id, req.user.id];
  db.get(
    `SELECT id, name, url, apiKey, category, notes, user_id, created_at, updated_at FROM api_entries ${whereClause}`,
    params,
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Entry not found' });
      res.json(row);
    }
  );
});

// POST create entry
app.post('/api/entries', (req, res) => {
  const { name, url, apiKey, category, notes } = req.body;
  if (!name || !apiKey) {
    return res.status(400).json({ error: 'Missing required fields: name, apiKey' });
  }
  db.run(
    `INSERT INTO api_entries (name, url, apiKey, category, notes, user_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [name, url || null, apiKey, category || null, notes || '', req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, name, url: url || null, apiKey, category: category || null, notes: notes || '',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }
  );
});

// PUT update entry
app.put('/api/entries/:id', (req, res) => {
  const { name, url, apiKey, category, notes } = req.body;
  if (!name || !apiKey) {
    return res.status(400).json({ error: 'Missing required fields: name, apiKey' });
  }
  const isAdmin = req.user.role !== 'user';
  const ownerClause = isAdmin ? '' : ' AND user_id = ?';
  const updateParams = isAdmin ? [name, url || null, apiKey, category || null, notes || '', req.params.id]
                               : [name, url || null, apiKey, category || null, notes || '', req.params.id, req.user.id];
  db.run(
    `UPDATE api_entries SET name = ?, url = ?, apiKey = ?, category = ?, notes = ? WHERE id = ?${ownerClause}`,
    updateParams,
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Entry not found' });
      res.json({ id: parseInt(req.params.id), name, url: url || null, apiKey, category: category || null, notes: notes || '',
        updated_at: new Date().toISOString() });
    }
  );
});

// DELETE entry
app.delete('/api/entries/:id', (req, res) => {
  const isAdmin = req.user.role !== 'user';
  const ownerClause = isAdmin ? '' : ' AND user_id = ?';
  const delParams = isAdmin ? [req.params.id] : [req.params.id, req.user.id];
  db.run(`DELETE FROM api_entries WHERE id = ?${ownerClause}`, delParams, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Entry not found' });
    res.json({ success: true, message: 'Entry deleted' });
  });
});

// GET export
app.get('/api/export', (req, res) => {
  const isUser = req.user.role === 'user';
  const whereClause = isUser ? 'WHERE user_id = ?' : '';
  const params = isUser ? [req.user.id] : [];
  db.all(
    `SELECT name, url, apiKey, category, notes FROM api_entries ${whereClause} ORDER BY created_at DESC`,
    params,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// POST import-text — semikolon-getrenntes Array: ["Name;URL;KEY;Category;Notiz"]
app.post('/api/import-text', (req, res) => {
  const lines = req.body;
  if (!Array.isArray(lines)) {
    return res.status(400).json({ error: 'Request body must be an array of text lines' });
  }

  const entries = lines.map(line => {
    if (typeof line !== 'string') return null;
    const parts = line.trim().split(';');
    const name     = (parts[0] || '').trim();
    const url      = (parts[1] || '').trim();
    const apiKey   = (parts[2] || '').trim();
    const category = (parts[3] || '').trim();
    const notes    = parts.slice(4).join(';').trim();
    if (!name || !apiKey) return null;
    return { name, url: url || null, apiKey, category: category || null, notes };
  }).filter(Boolean);

  if (entries.length === 0) {
    return res.status(400).json({ error: 'No valid entries found in provided text lines' });
  }

  const stmt = db.prepare(
      `INSERT OR IGNORE INTO api_entries (name, url, apiKey, category, notes, user_id) VALUES (?, ?, ?, ?, ?, ?)`
  );

  db.serialize(() => {
    try {
        entries.forEach(e => stmt.run(e.name, e.url, e.apiKey, e.category, e.notes || '', req.user.id));
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

// POST import-json — direktes JSON-Array: [{ name, url, apiKey, category, notes }]
app.post('/api/import', (req, res) => {
  const entries = req.body;
  if (!Array.isArray(entries)) {
    return res.status(400).json({ error: 'Request body must be an array of objects' });
  }

  const valid = entries.filter(e => e && e.name && e.apiKey);
  if (valid.length === 0) {
    return res.status(400).json({ error: 'No valid entries found' });
  }

  const stmt = db.prepare(
      `INSERT OR IGNORE INTO api_entries (name, url, apiKey, category, notes, user_id) VALUES (?, ?, ?, ?, ?, ?)`
  );

  db.serialize(() => {
    try {
        valid.forEach(e => stmt.run(e.name, e.url || null, e.apiKey, e.category || null, e.notes || '', req.user.id));
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

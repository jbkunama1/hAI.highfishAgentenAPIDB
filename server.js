const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
// Use /data for Docker, or ./data for local development
const DB_PATH = process.env.DB_PATH || (process.env.NODE_ENV === 'production' ? '/data/highfish.db' : './data/highfish.db');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '.')));

// Simple rate limiting middleware (max 100 requests per minute per IP)
const rateLimit = {};
app.use((req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute window
  
  if (!rateLimit[ip]) {
    rateLimit[ip] = [];
  }
  
  // Remove old requests outside the window
  rateLimit[ip] = rateLimit[ip].filter(time => time > windowStart);
  
  // Check if rate limit exceeded
  if (rateLimit[ip].length >= 100) {
    return res.status(429).json({ error: 'Too many requests, please try again later' });
  }
  
  rateLimit[ip].push(now);
  next();
});

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
} catch (err) {
  console.warn(`Warning: Could not create data directory at ${dataDir}:`, err.message);
  // Continue anyway, database might be accessible
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

// Initialize database schema
function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS api_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      apiKey TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating table:', err);
    } else {
      console.log('Database schema initialized');
    }
  });
}

// API Routes

// Get all entries
app.get('/api/entries', (req, res) => {
  db.all(`SELECT id, name, url, apiKey, notes, created_at, updated_at FROM api_entries ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get single entry by ID
app.get('/api/entries/:id', (req, res) => {
  const { id } = req.params;
  db.get(`SELECT id, name, url, apiKey, notes, created_at, updated_at FROM api_entries WHERE id = ?`, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    res.json(row);
  });
});

// Create new entry
app.post('/api/entries', (req, res) => {
  const { name, url, apiKey, notes } = req.body;
  
  if (!name || !url || !apiKey) {
    return res.status(400).json({ error: 'Missing required fields: name, url, apiKey' });
  }

  db.run(
    `INSERT INTO api_entries (name, url, apiKey, notes) VALUES (?, ?, ?, ?)`,
    [name, url, apiKey, notes || ''],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ 
        id: this.lastID, 
        name, 
        url, 
        apiKey, 
        notes: notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  );
});

// Update entry
app.put('/api/entries/:id', (req, res) => {
  const { id } = req.params;
  const { name, url, apiKey, notes } = req.body;

  if (!name || !url || !apiKey) {
    return res.status(400).json({ error: 'Missing required fields: name, url, apiKey' });
  }

  db.run(
    `UPDATE api_entries SET name = ?, url = ?, apiKey = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [name, url, apiKey, notes || '', id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Entry not found' });
      }
      res.json({ 
        id: parseInt(id), 
        name, 
        url, 
        apiKey, 
        notes: notes || '',
        updated_at: new Date().toISOString()
      });
    }
  );
});

// Delete entry
app.delete('/api/entries/:id', (req, res) => {
  const { id } = req.params;
  
  db.run(`DELETE FROM api_entries WHERE id = ?`, [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    res.json({ success: true, message: 'Entry deleted' });
  });
});

// Export all entries as JSON
app.get('/api/export', (req, res) => {
  db.all(`SELECT name, url, apiKey, notes FROM api_entries ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Import entries from JSON (array of { name, url, apiKey, notes })
// Expected JSON body: [
//   "Name;URL;API_KEY;Notizen optional",
//   "OpenWeather;https://api.openweathermap.org;KEY123;Wetterdaten",
//   "hAI Agent DB;https://api.highfish.local;ABCDEF;Interne Tests"
// ]
app.post('/api/import-text', (req, res) => {
  const lines = req.body;

  if (!Array.isArray(lines)) {
    return res.status(400).json({ error: 'Request body must be an array of text lines' });
  }

  const entries = lines
    .map(line => {
      if (typeof line !== 'string') return null;
      const trimmed = line.trim();
      if (!trimmed) return null;

      const parts = trimmed.split(';');
      const name = parts[0] ? parts[0].trim() : '';
      const url = parts[1] ? parts[1].trim() : '';
      const apiKey = parts[2] ? parts[2].trim() : '';
      const notes = parts.slice(3).join(';').trim();

      if (!name || !url || !apiKey) {
        return null; // skip invalid
      }

      return { name, url, apiKey, notes };
    })
    .filter(e => e !== null);

  if (entries.length === 0) {
    return res.status(400).json({ error: 'No valid entries found in provided text lines' });
  }

  const stmt = db.prepare(
    `INSERT INTO api_entries (name, url, apiKey, notes) VALUES (?, ?, ?, ?)`
  );

  db.serialize(() => {
    try {
      let importedCount = 0;

      entries.forEach(entry => {
        stmt.run(entry.name, entry.url, entry.apiKey, entry.notes || '');
        importedCount++;
      });

      stmt.finalize(err => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, imported: importedCount });
      });
    } catch (e) {
      stmt.finalize();
      res.status(500).json({ error: 'Import failed' });
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve index.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`HighFish API DB server running at http://0.0.0.0:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Closing database connection...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    }
    process.exit(0);
  });
});

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || '/data/highfish.db';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '.')));

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
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

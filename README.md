# 🐟 highfishAPIDB 🌈

<p align="left">
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js 18+" />
  <img src="https://img.shields.io/badge/Express.js-4.x-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express 4.x" />
  <img src="https://img.shields.io/badge/SQLite-3-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite 3" />
  <img src="https://img.shields.io/badge/Docker-ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker Ready" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT License" />
</p>

<p align="left">
  <img src="highfishapidblogo.png" alt="highfishAPIDB Logo" width="220" />
</p>

🎨 A modern, responsive, dark-themed web application for managing your API keys and credentials with a persistent SQLite backend.

---

## 📋 Overview

**highfishAPIDB** is a full-stack web application that lets you store, search, and manage API keys and database credentials in a dedicated SQLite database. It features a sleek dark theme, password protection, and a full set of CRUD operations — making it the perfect API credential manager that persists across browser sessions and devices. Deploy it easily with Docker!

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 **Password Protection** | Access is gated by a configurable password. Default: `highfish123`. |
| 📝 **API Management** | Add, edit, and delete API entries with name, URL, key, and notes fields. |
| 🔍 **Search** | Real-time search across all stored API entries (name, URL, notes). |
| 👁️ **API Key Masking** | API keys are masked by default; use the Show/Hide toggle to reveal them individually. |
| 📋 **Copy to Clipboard** | One-click copying of any API key to the clipboard. |
| 📤 **JSON Export** | Export all stored entries as a formatted JSON file for backup or transfer. |
| 💾 **Persistent Database** | All data is stored in SQLite database — persists across sessions, browsers, and devices. |
| 🐳 **Docker Support** | Easy deployment with Docker and Docker Compose. |
| 📱 **Mobile-Optimised** | Fully responsive layout that works on phones, tablets, and desktops. |
| 🌑 **Dark Theme** | Eye-friendly dark UI, always on. |

---

## 🚀 Getting Started

### Option 1: Docker Deployment (Recommended)

**Requirements:** Docker and Docker Compose

1. **Clone the repository:**
   ```bash
   git clone https://github.com/jbkunama1/highfishAPIDB.git
   cd highfishAPIDB
   ```

2. **Start with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

3. **Access the application:**
   - Open your browser and navigate to `http://localhost:3000`

4. **Log in** with the default password:
   ```
   highfish123
   ```

The SQLite database will be automatically created in the `highfish-data` volume.

#### Using with Portainer

If you're using Portainer:
1. Go to **Stacks** → **Add Stack**
2. Paste the contents of `docker-compose.yml`
3. Set the name to `highfish-api-db`
4. Click **Deploy the stack**
5. Access via `http://your-portainer-host:3000`

### Option 2: Manual Installation

**Requirements:** Node.js 18+ and npm

1. **Clone the repository:**
   ```bash
   git clone https://github.com/jbkunama1/highfishAPIDB.git
   cd highfishAPIDB
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```
   The app will be available at `http://localhost:3000`

4. **Log in** with the default password:
   ```
   highfish123
   ```

---

## 🔑 Changing the Password

The password is stored in the application's source code and can be changed before you deploy:

1. Open `index.html` in a text editor.
2. Locate the password constant in the JavaScript section (around the beginning of the script block): `const MASTER_PASSWORD = 'highfish123';`
3. Replace `highfish123` with your desired password.
4. Rebuild and redeploy the Docker container:
   ```bash
   docker-compose down
   docker-compose up --build -d
   ```

---

## ⚙️ Environment Variables

The following environment variables can be set when running the Docker container:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the server listens on |
| `DB_PATH` | `/data/highfish.db` | Path to the SQLite database file |
| `NODE_ENV` | `production` | Node.js environment |

Example with custom port (modify `docker-compose.yml` or set via environment variable):
```bash
# Option 1: Create a .env file with your variables
echo "PORT=8080" > .env
docker-compose up -d

# Option 2: Export environment variables and modify docker-compose.yml
# Edit docker-compose.yml and set PORT under the environment section
```

Or modify `docker-compose.yml`:
```yaml
environment:
  - PORT=8080
  - DB_PATH=/data/highfish.db
```

---

## 🗂️ Usage Guide

### Adding an API Entry
1. Click the **Add API** button.
2. Fill in the fields: Name, URL, API Key, and optional Notes.
3. Click **Save** — the entry appears in the list immediately.

### Editing an Entry
1. Click the **Edit** (pencil) icon on any entry.
2. Modify the fields as needed.
3. Click **Save** to apply changes.

### Deleting an Entry
1. Click the **Delete** (trash) icon on the entry you want to remove.
2. Confirm the deletion when prompted.

### Searching
- Type into the **Search** bar at the top to filter entries in real-time by name, URL, or notes.

### Showing / Hiding an API Key
- By default all API keys are masked (`••••••••`).
- Click the **Show** button next to an entry to reveal its key.
- Click **Hide** to mask it again.

### Copying an API Key
- Click the **Copy** button next to any entry to copy the key to your clipboard instantly.

### Exporting Data
- Click the **Export JSON** button to download all entries as a `.json` file.
- Keep this file in a safe place — it contains your API keys in plain text.

---

## 🛠️ Technical Details

### Architecture

- **Frontend:** HTML, CSS, and vanilla JavaScript (no dependencies)
- **Backend:** Node.js with Express.js
- **Database:** SQLite 3 for persistent data storage
- **Deployment:** Docker and Docker Compose
- **Storage:** Server-side SQLite database (persists across sessions, browsers, and devices)
- **Authentication:** Session-based with password stored in `localStorage` (client-side auth state)

### Project Structure

```
highfishAPIDB/
├── index.html              # Frontend UI
├── server.js               # Node.js/Express backend with API endpoints
├── package.json            # Node.js dependencies
├── Dockerfile              # Docker image configuration
├── docker-compose.yml      # Docker Compose orchestration
├── README.md              # This file
└── highfishapidblogo.png  # Logo asset
```

### API Endpoints

- `GET /api/entries` - Get all stored API entries
- `GET /api/entries/:id` - Get a specific entry by ID
- `POST /api/entries` - Create a new API entry
- `PUT /api/entries/:id` - Update an existing entry
- `DELETE /api/entries/:id` - Delete an entry
- `GET /api/export` - Export all entries as JSON
- `GET /api/health` - Health check endpoint

### Database Schema

The SQLite database contains a single table:

```sql
CREATE TABLE api_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  apiKey TEXT NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

---

## 🔒 Security Notes

- Data is stored **on the server in a SQLite database**, not in the browser.
- The application runs on your own infrastructure (Docker container).
- The password provides basic access control; it is **not** cryptographically secure. Do not rely on it as the sole protection for highly sensitive credentials.
- In production, consider:
  - Using strong passwords and changing the default
  - Running behind HTTPS/TLS
  - Using environment variables for sensitive configuration
  - Restricting network access to the container
  - Regular backups of the `highfish-data` volume
- For production use with sensitive secrets, consider a dedicated secrets manager.

---

## 📄 License

✅ This project is licensed under the **MIT License**.  
See [LICENSE](LICENSE) for full details.

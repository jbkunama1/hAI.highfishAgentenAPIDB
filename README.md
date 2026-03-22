# 🐟 highfishAPIDB

A modern, responsive, dark-themed web application for managing your API keys and credentials — entirely in the browser, with no backend required.

---

## 📋 Overview

**highfishAPIDB** is a lightweight, single-file web application that lets you store, search, and manage API keys and database credentials directly in your browser using `localStorage`. It features a sleek dark theme, password protection, and a full set of CRUD operations — making it the perfect personal API credential manager you can use instantly by just opening a file.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 **Password Protection** | Access is gated by a configurable password stored securely in `localStorage`. Default: `highfish123`. |
| 📝 **API Management** | Add, edit, and delete API entries with name, URL, key, and notes fields. |
| 🔍 **Search** | Real-time search across all stored API entries. |
| 👁️ **API Key Masking** | API keys are masked by default; use the Show/Hide toggle to reveal them individually. |
| 📋 **Copy to Clipboard** | One-click copying of any API key to the clipboard. |
| 📤 **JSON Export** | Export all stored entries as a formatted JSON file for backup or transfer. |
| 💾 **Local Storage** | All data is stored in the browser's `localStorage` — no server, no account needed. |
| 📱 **Mobile-Optimised** | Fully responsive layout that works on phones, tablets, and desktops. |
| 🌑 **Dark Theme** | Eye-friendly dark UI, always on. |

---

## 🚀 Getting Started

No installation or build step required.

1. **Clone or download** this repository:
   ```bash
   git clone https://github.com/jbkunama1/highfishAPIDB.git
   ```

2. **Open** `index.html` (or the main HTML file) in any modern web browser.

3. **Log in** with the default password:
   ```
   highfish123
   ```

4. Start adding your API entries — they are saved automatically in your browser.

> **Tip:** Because data is stored in `localStorage`, it is scoped to the browser and device you use. Use the JSON Export feature to back up your entries.

---

## 🔑 Changing the Password

The password is stored in the application's source code and can be changed before you deploy or use it:

1. Open the main HTML/JS file in a text editor.
2. Locate the password constant (e.g. `const PASSWORD = "highfish123";`).
3. Replace `highfish123` with your desired password.
4. Save the file and reopen it in the browser.

> **Note:** After changing the password in the code, any previously saved session in `localStorage` may need to be cleared for the new password to take effect.

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

- **Stack:** Pure HTML, CSS, and vanilla JavaScript — zero dependencies.
- **Storage:** Browser `localStorage` (client-side only, never sent to any server).
- **Authentication:** Simple password check against a hardcoded value; session state tracked in `localStorage`.
- **Compatibility:** Works in all modern browsers (Chrome, Firefox, Edge, Safari).

---

## 🔒 Security Notes

- All data is stored **locally in your browser**. No data is transmitted to any external server.
- The password provides basic access control; it is **not** cryptographically secure. Do not rely on it as the sole protection for highly sensitive credentials.
- If you share the device or browser profile with others, they may be able to access `localStorage` directly.
- For production use with sensitive secrets, consider a dedicated secrets manager.

---

## 📄 License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.


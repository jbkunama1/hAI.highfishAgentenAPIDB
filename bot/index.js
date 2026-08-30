require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const API_BASE = process.env.API_BASE_URL || 'http://highfish-api-db:3000';
const API_KEY = process.env.API_KEY;
const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID;

// --- Auth middleware ---
bot.use((ctx, next) => {
  if (ctx.from.id.toString() !== ADMIN_ID) {
    return ctx.replyWithHTML(
      `<b>🔒  Access Denied</b>\n\n`
      + `<tg-emoji emoji-id="🚫">🚫</tg-emoji>  Du bist nicht autorisiert.\n`
      + `<i>Deine ID:</i>  <code>${ctx.from.id}</code>`
    );
  }
  return next();
});

// --- API helper ---
function apiRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const lib = url.protocol === 'https:' ? https : http;
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': 'Bearer ' + API_KEY,
        'Content-Type': 'application/json'
      }
    };
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// --- Menus ---
const mainMenu = Markup.inlineKeyboard([
  [Markup.button.callback('🔍  Search', 'search'), Markup.button.callback('📋  List', 'list')],
  [Markup.button.callback('📤  Export', 'export'), Markup.button.callback('📥  Import', 'import')],
  [Markup.button.callback('⚙️  Settings', 'settings')]
]);

const backMenu = Markup.inlineKeyboard([
  [Markup.button.callback('🔙  Back to Menu', 'menu')]
]);

const settingsMenu = Markup.inlineKeyboard([
  [Markup.button.callback('📊  Stats', 'stats'), Markup.button.callback('🔄  Restart Bot', 'restart')],
  [Markup.button.callback('🔙  Back', 'menu')]
]);

// Welcome message
function welcomeMessage() {
  return `<b>🐟  Welcome to hAI Admin Bot!</b>

Dein zentraler Endpoint für die HighFish API-Verwaltung.

<b>Was du hier machen kannst:</b>
  🔍  <i>Search</i>   → API-Keys durchsuchen
  📋  <i>List</i>     → Alle Einträge anzeigen
  📤  <i>Export</i>    → Datenbank exportieren
  📥  <i>Import</i>    → Einträge importieren
  ⚙️  <i>Settings</i>  → Statistik & System

Wähle eine Option:`;
}

const state = new Map();
const getState = (id) => state.get(id) || 'idle';
const setState = (id, s) => state.set(id, s);

bot.start((ctx) => { setState(ctx.from.id, 'idle'); ctx.replyWithHTML(welcomeMessage(), mainMenu); });
bot.action('menu', (ctx) => { setState(ctx.from.id, 'idle'); ctx.replyWithHTML(welcomeMessage(), mainMenu); });

// --- List entries ---
bot.action('list', async (ctx) => {
  setState(ctx.from.id, 'idle');
  try {
    const entries = await apiRequest('/api/entries');
    if (!entries.length) {
      return ctx.replyWithHTML(
        `<b>📋  Entry List</b>\n\n`
        + `<tg-emoji emoji-id="😶">😶</tg-emoji> <i>No entries yet.</i>\n\n`
        + `Lege neue Einträge über <b>📥 Import</b> oder die API an.`,
        mainMenu
      );
    }
    const lines = entries.map((e, i) => (
      `<b>${i + 1}.  ${escapeHtml(e.name)}</b>\n`
      + `🌐  <code>${escapeHtml(e.url)}</code>\n`
      + `🔑  <code>${escapeHtml(e.apiKey)}</code>`
      + (e.notes ? `\n📝  <i>${escapeHtml(e.notes)}</i>` : '')
    ));
    const header = `<b>📋  Entry List</b>  <i>(${entries.length} total)</i>\n${'─'.repeat(20)}\n\n`;
    await ctx.replyWithHTML(header + lines.join('\n\n'), mainMenu);
  } catch (e) { ctx.replyWithHTML(`<tg-emoji emoji-id="❌">❌</tg-emoji> <b>Error:</b>  <code>${escapeHtml(e.message)}</code>`, mainMenu); }
});

// --- Search entries ---
bot.action('search', (ctx) => {
  setState(ctx.from.id, 'search');
  ctx.replyWithHTML(
    `<b>🔍  Search</b>\n\n`
    + `📝  Gib einen Suchbegriff ein.\n`
    + `<i>Es wird in Name und Notizen gesucht.</i>`,
    backMenu
  );
});

// --- Export ---
bot.action('export', async (ctx) => {
  setState(ctx.from.id, 'idle');
  try {
    const entries = await apiRequest('/api/export');
    const json = JSON.stringify(entries, null, 2);
    await ctx.replyWithHTML(
      `<b>📤  Export complete</b>\n\n`
      + `📦  <b>${entries.length}</b>  entries exported\n`
      + `💾  JSON follows below 👇`,
      mainMenu
    );
    if (json.length <= 3500) {
      await ctx.replyWithHTML('<pre>' + escapeHtml(json) + '</pre>');
    } else {
      await ctx.replyWithHTML(`<i>⚠️  Export zu groß für Telegram (${json.length} Zeichen).</i>`);
    }
  } catch (e) { ctx.replyWithHTML(`<tg-emoji emoji-id="❌">❌</tg-emoji> <b>Error:</b>  <code>${escapeHtml(e.message)}</code>`, mainMenu); }
});

// --- Import ---
bot.action('import', (ctx) => {
  setState(ctx.from.id, 'import');
  ctx.replyWithHTML(
    `<b>📥  Import</b>\n\n`
    + `Sende ein JSON-Array.  Format:\n\n`
    + `<pre>[{ "name":"X", "url":"Y", "apiKey":"Z", "notes":"optional" }]</pre>`,
    backMenu
  );
});

// --- Settings ---
bot.action('settings', (ctx) => {
  ctx.replyWithHTML(
    `<b>⚙️  Settings</b>\n\n`
    + `🤖  <b>Bot:</b>  hAI Admin\n`
    + `🌐  <b>API:</b>  <code>${escapeHtml(API_BASE)}</code>\n`
    + `👤  <b>Admin:</b>  <code>${escapeHtml(String(ctx.from.id))}</code>\n`
    + `🕐  <b>Uptime:</b>  <code>${formatUptime(process.uptime())}</code>`,
    settingsMenu
  );
});

bot.action('stats', async (ctx) => {
  try {
    const entries = await apiRequest('/api/entries');
    ctx.replyWithHTML(
      `<b>📊  Statistics</b>\n\n`
      + `🔢  <b>Entries:</b>  <code>${entries.length}</code>\n`
      + `🕐  <b>Uptime:</b>  <code>${formatUptime(process.uptime())}</code>\n`
      + `💾  <b>Memory:</b>  <code>${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB</code>\n`
      + `🟢  <b>Status:</b>  <i>operational</i>`,
      settingsMenu
    );
  } catch (e) {
    ctx.replyWithHTML(`<tg-emoji emoji-id="❌">❌</tg-emoji> <b>Error:</b>  <code>${escapeHtml(e.message)}</code>`, settingsMenu);
  }
});

bot.action('restart', (ctx) => {
  ctx.replyWithHTML(`<b>🔄  Restarting...</b>\n\n<i>Bot fährt in 2 Sekunden herunter.</i>`);
  setTimeout(() => process.exit(0), 2000);
});

// --- Helpers ---
function escapeHtml(s) {
  if (s === undefined || s === null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatUptime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// --- Text handler (state-aware) ---
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const mode = getState(userId);
  if (mode === 'search') {
    setState(userId, 'idle');
    const term = ctx.message.text.toLowerCase();
    try {
      const entries = await apiRequest('/api/entries');
      const found = entries.filter(e => e.name.toLowerCase().includes(term) || (e.notes || '').toLowerCase().includes(term));
      if (!found.length) {
        return ctx.replyWithHTML(
          `<b>🔍  Search</b>  <i>"${escapeHtml(ctx.message.text)}"</i>\n\n`
          + `<tg-emoji emoji-id="😶">😶</tg-emoji>  <i>No matches found.</i>`,
          mainMenu
        );
      }
      const lines = found.map((e, i) => (
        `<b>${i + 1}.  ${escapeHtml(e.name)}</b>\n`
        + `🌐  <code>${escapeHtml(e.url)}</code>\n`
        + `🔑  <code>${escapeHtml(e.apiKey)}</code>`
        + (e.notes ? `\n📝  <i>${escapeHtml(e.notes)}</i>` : '')
      ));
      const header = `<b>🔍  Results</b>  <i>(${found.length} matches for "${escapeHtml(ctx.message.text)}")</i>\n${'─'.repeat(20)}\n\n`;
      await ctx.replyWithHTML(header + lines.join('\n\n'), mainMenu);
    } catch (e) { ctx.replyWithHTML(`<tg-emoji emoji-id="❌">❌</tg-emoji> <b>Error:</b>  <code>${escapeHtml(e.message)}</code>`, mainMenu); }
  } else if (mode === 'import') {
    setState(userId, 'idle');
    try {
      const data = JSON.parse(ctx.message.text);
      if (!Array.isArray(data)) throw new Error('Must be array');
      // Validate: convert to text-import format expected by /api/import-text
      const textFormat = data.map(d => `${d.name};${d.url};${d.apiKey}${d.notes ? ';' + d.notes : ''}`);
      const result = await apiRequest('/api/import-text', 'POST', textFormat);
      await ctx.replyWithHTML(
        `<b>📥  Import successful</b>\n\n`
        + `✅  <b>${result.imported}</b>  entries imported\n`
        + `🎉  <i>Database updated.</i>`,
        mainMenu
      );
    } catch (e) {
      ctx.replyWithHTML(
        `<b>📥  Import failed</b>\n\n`
        + `<tg-emoji emoji-id="❌">❌</tg-emoji>  <b>Error:</b>  <code>${escapeHtml(e.message)}</code>\n\n`
        + `<i>Use this format:</i>\n<pre>[{ "name":"X", "url":"Y", "apiKey":"Z" }]</pre>`,
        mainMenu
      );
    }
  } else {
    ctx.replyWithHTML(
      `<b>👋  Hi!</b>\n\n`
      + `Ich habe deine Nachricht nicht verstanden.  Wähle eine Option:`,
      mainMenu
    );
  }
});

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

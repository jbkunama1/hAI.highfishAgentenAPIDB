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
  if (ctx.from.id.toString() !== ADMIN_ID) return ctx.reply('Unauthorized');
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

// --- Main menu ---
const mainMenu = Markup.inlineKeyboard([
  [Markup.button.callback('List', 'list'), Markup.button.callback('Search', 'search')],
  [Markup.button.callback('Export DB', 'export'), Markup.button.callback('Import', 'import')]
]);

const state = new Map();
const getState = (id) => state.get(id) || 'idle';
const setState = (id, s) => state.set(id, s);

bot.start((ctx) => { setState(ctx.from.id, 'idle'); ctx.reply('hAI Admin Bot', mainMenu); });

// --- List entries ---
bot.action('list', async (ctx) => {
  setState(ctx.from.id, 'idle');
  try {
    const entries = await apiRequest('/api/entries');
    if (!entries.length) return ctx.reply('No entries found.', mainMenu);
    const text = entries.map(e => `*${e.name}*\n${e.url}\n\`${e.apiKey}\`${e.notes ? '\n' + e.notes : ''}`).join('\n\n');
    ctx.reply(text, { parse_mode: 'Markdown' });
  } catch (e) { ctx.reply('Error: ' + e.message); }
});

// --- Search entries ---
bot.action('search', (ctx) => {
  setState(ctx.from.id, 'search');
  ctx.reply('Send search term:');
});

// --- Export ---
bot.action('export', async (ctx) => {
  setState(ctx.from.id, 'idle');
  try {
    const entries = await apiRequest('/api/export');
    ctx.reply(`Export: ${entries.length} entries`, mainMenu);
    ctx.reply('```json\n' + JSON.stringify(entries, null, 2) + '```', { parse_mode: 'Markdown' });
  } catch (e) { ctx.reply('Error: ' + e.message); }
});

// --- Import ---
bot.action('import', (ctx) => {
  setState(ctx.from.id, 'import');
  ctx.reply('Send entries as JSON array:\n`[{ "name":"X","url":"Y","apiKey":"Z" }]`', { parse_mode: 'Markdown' });
});

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
      if (!found.length) return ctx.reply('No matches.', mainMenu);
      const text = found.map(e => `*${e.name}*\n${e.url}\n\`${e.apiKey}\``).join('\n\n');
      ctx.reply(text, { parse_mode: 'Markdown' });
    } catch (e) { ctx.reply('Error: ' + e.message); }
  } else if (mode === 'import') {
    setState(userId, 'idle');
    try {
      const data = JSON.parse(ctx.message.text);
      if (!Array.isArray(data)) throw new Error('Must be array');
      // Validate: convert to text-import format expected by /api/import-text
      const textFormat = data.map(d => `${d.name};${d.url};${d.apiKey}${d.notes ? ';' + d.notes : ''}`);
      const result = await apiRequest('/api/import-text', 'POST', textFormat);
      ctx.reply(`Imported: ${result.imported} entries`, mainMenu);
    } catch (e) { ctx.reply('Invalid format. Use: `[{ "name":"X","url":"Y","apiKey":"Z" }]`', { parse_mode: 'Markdown' }); }
  } else {
    ctx.reply('Use the menu:', mainMenu);
  }
});

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

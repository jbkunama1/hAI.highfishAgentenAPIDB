'use strict';

/**
 * Telegram bot for hAI · HighFish Agenten API DB
 *
 * Setup:
 *   1. Create bot via @BotFather → get BOT_TOKEN
 *   2. Get your Chat ID via @userinfobot or /getupdates
 *   3. Set env: TELEGRAM_BOT_TOKEN, TELEGRAM_ALLOWED_CHAT_IDS (comma-separated)
 *      If TELEGRAM_BOT_TOKEN is absent the module stays inactive (no error).
 *   4. Optionally set TELEGRAM_ADMIN_API_KEY to match API_KEY for admin auth.
 *   5. Optionally set TELEGRAM_DAILY_TIME for status notifications (default: 09:00)
 *   6. Optionally set TELEGRAM_THEME to change message styling (ocean, forest, sunset)
 *
 * Theme System (Mobile-First):
  *   🌊 Ocean Blue - Default mobile-optimized blue theme
  *   🌲 Forest Green - Nature-inspired green theme  
  *   🌅 Sunset Orange - Warm orange theme
  *   Use /theme to switch themes or /themes to see options
  *
  * Commands:
 *   /start          – Welcome message + keyboard menu
 *   /help           – Help text
 *   /list           – List all API entries (name + masked key only)
 *   /search <term>  – Search entries by name, URL, category or notes
 *   /health         – Quick health check
 *   /export         – Export all entries as JSON
 *   /backup         – Create backup (PDF + JSON export)
 *   /status         – Daily status overview (manual)
 *   /cancel         – Cancel ongoing operation
 *
 * Notifications:
 *   🚀 Startup – Bot sends welcome message when starting
 *   📊 Daily – Automatic status once per day (configurable time)
 *   🛡️ Backup – PDF + JSON backup documents
 *
 * Inline buttons:
 *   📋 List       → /list
 *   ➕ Add        → opens add form
 *   🔍 Search     → search prompt
 *   🛡️ Backup     → creates PDF + JSON backup
 *   💾 Export     → sends JSON export
 *   📊 Status     → manual status overview
 *   ℹ️ Info       → entry detail (name, url, category, notes, created/updated)
 *   ✏️  Edit       → updates entry
 *   🗑️  Delete     → deletes entry (confirmation required)
 *   ❤️  Health     → server health check
 *   ❓ Help       → help message
 *
 * Security:
 *   • Only chat IDs in TELEGRAM_ALLOWED_CHAT_IDS are served
 *   • apiKey values are always masked (sk-xxxx…xxxx)
 */

// Import theme system
const themes = require('./themes.js');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED = process.env.TELEGRAM_ALLOWED_CHAT_IDS
  ? process.env.TELEGRAM_ALLOWED_CHAT_IDS.split(',').map(s => s.trim())
  : [];
const ADMIN_KEY = process.env.TELEGRAM_ADMIN_API_KEY || process.env.API_KEY || '';
const PORT = process.env.TELEGRAM_WEBHOOK_PORT || process.env.PORT || 3000;
const USE_WEBHOOK = process.env.TELEGRAM_USE_WEBHOOK === 'true';
const WEBHOOK_PATH = process.env.TELEGRAM_WEBHOOK_PATH || `/telegram/${TOKEN}`;

// Theme configuration
const DEFAULT_THEME = process.env.TELEGRAM_THEME || 'ocean';
themes.setTheme(DEFAULT_THEME);

// User theme preferences (stored in memory for chat persistence)
const userThemes = new Map(); // chatId -> themeName

// ── Lazy-load bot only when token is configured ─────────────────────────────────
let bot = null;
let db = null;

// Per-chat state: Map<chatId, { state: string, entryId?: string, messageId?: number }>
const chatState = new Map();

// Per-chat rate limit: 20 messages/min (sliding window)
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 1000;
// Map<chatId, number[]> timestamps of recent messages (oldest first)
const rateBuckets = new Map();

// ── Notification tracking ──────────────────────────────────────────────────────
let lastStartupNotification = null; // Date of last startup notification
let lastDailyNotification = null;   // Date of last daily notification
const DAILY_NOTIFICATION_TIME = process.env.TELEGRAM_DAILY_TIME || '09:00'; // Default 9 AM

// Cleanup functions to prevent memory leaks
let dailyTimer = null;
let startupTimeout = null;

function rateLimit(chatId) {
  const key = String(chatId);
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  const arr = rateBuckets.get(key) || [];
  // Drop expired entries
  while (arr.length && arr[0] < cutoff) arr.shift();
  if (arr.length >= RATE_LIMIT) return false;
  arr.push(now);
  rateBuckets.set(key, arr);
  return true;
}

function mask(str) {
  if (!str || str.length < 8) return '****';
  return str.slice(0, 4) + '…' + str.slice(-4);
}

function chunk(text, limit = 4000) {
  const lines = text.split('\n');
  const chunks = [];
  let current = '';
  for (const line of lines) {
    if (line.length > limit) {
      if (current) {
        chunks.push(current.trim());
        current = '';
      }
      for (let i = 0; i < line.length; i += limit) {
        chunks.push(line.slice(i, i + limit));
      }
      continue;
    }
    if ((current + '\n' + line).length > limit) {
      if (current) chunks.push(current.trim());
      current = line;
    } else {
      current += '\n' + line;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

// options (e.g. reply_markup) are attached to the LAST chunk so keyboards
// survive multi-part messages.
async function sendChunks(chatId, text, options = {}) {
  const parts = chunk(text);
  for (let i = 0; i < parts.length; i++) {
    const extra = i === parts.length - 1 ? options : {};
    await bot.sendMessage(chatId, parts[i], { parse_mode: 'HTML', ...extra });
  }
}

function buildMenu(chatId) {
  const formatters = themes.getFormatters();
  const userTheme = chatId ? (userThemes.get(chatId) || DEFAULT_THEME) : DEFAULT_THEME;
  
  const themeButtons = themes.getAllThemes().map(theme => ({
    text: theme.current ? `🌟 ${theme.name} (current)` : `🎨 ${theme.name}`,
    callback_data: `cmd:theme_${theme.id}`
  }));

  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📋 List', callback_data: 'cmd:list' },
          { text: '➕ Add',  callback_data: 'cmd:add' },
          { text: '🔍 Search', callback_data: 'cmd:search' },
        ],
        [
          { text: '💾 Export', callback_data: 'cmd:export' },
          { text: '🛡️ Backup', callback_data: 'cmd:backup' },
          { text: '📊 Status', callback_data: 'cmd:status' },
          { text: '❤️  Health', callback_data: 'cmd:health' },
        ],
        [
          { text: '🎨 Themes', callback_data: 'cmd:themes' },
          { text: '❓ Help', callback_data: 'cmd:help' },
        ],
      ],
    },
  };
}

// ── Auth check ────────────────────────────────────────────────────────────────
function isAllowed(chatId) {
  return ALLOWED.includes(String(chatId));
}

function checkRateLimit(chatId, botInstance) {
  if (!rateLimit(chatId)) {
    botInstance.sendMessage(chatId, '⚠️ Rate limit exceeded (20 messages/min). Please slow down.').catch(() => {});
    return false;
  }
  return true;
}

async function handleMessage(msg) {
  const chatId = String(msg.chat.id);

  if (!isAllowed(chatId)) {
    console.warn('[telegram] Ignored unauthorized chat:', chatId);
    // Silent ignore for unauthorized chats (strict allowlist)
    return;
  }

  if (!checkRateLimit(chatId, bot)) return;

  const text = (msg.text || '').trim();
    const formatters = themes.getFormatters();
    const userTheme = userThemes.get(chatId) || DEFAULT_THEME;

  // State machine: if this chat is waiting for input, the next non-command message is the data.
  const state = chatState.get(String(chatId));
  if (state && state.state === 'awaiting_add_entry') {
    if (text.toLowerCase() === '/cancel') {
      chatState.delete(String(chatId));
      await bot.sendMessage(chatId, '🚫 Add cancelled.');
      return;
    }
    if (text.startsWith('/')) {
      // A new command while waiting — fall through to normal command handling.
    } else {
      await processAddEntry(chatId, text);
      return;
    }
  } else if (state && state.state === 'awaiting_edit_entry') {
    if (text.toLowerCase() === '/cancel') {
      chatState.delete(String(chatId));
      await bot.sendMessage(chatId, '🚫 Edit cancelled.');
      return;
    }
    if (text.startsWith('/')) {
      // A new command while waiting — fall through to normal command handling.
    } else {
      await processEditEntry(chatId, text);
      return;
    }
  } else if (state && state.state === 'awaiting_search') {
    if (text.toLowerCase() === '/cancel') {
      chatState.delete(String(chatId));
      await bot.sendMessage(chatId, '🚫 Search cancelled.');
      return;
    }
    if (text.startsWith('/')) {
      // A new command while waiting — fall through to normal command handling.
    } else {
      await performSearch(chatId, text);
      return;
    }
  }

  if (text.startsWith('/')) {
    const cmd = text.split(' ')[0].toLowerCase();
    switch (cmd) {
      case '/start':
        await bot.sendMessage(
          chatId,
          '🐟 <b>hAI · HighFish Agenten API DB</b>\n\nUse the menu below or type /help for commands.',
          { parse_mode: 'HTML', ...buildMenu(chatId) }
        );
        break;
            case '/test':
              await bot.sendMessage(chatId, '✅ Bot is working!', { parse_mode: 'HTML' });
              break;
            case '/help':
        await bot.sendMessage(chatId,
          '📖 <b>Available commands</b>\n\n' +
          '/start – Show menu\n' +
          '/help  – This message\n' +
          '/list  – List all entries\n' +
          '/search <term> – Search entries (name, URL, category, notes)\n' +
          '/add   – Add a new entry\n' +
          '/edit  – Edit an entry\n' +
          '/health – Server health check\n' +
                      '/export – Export all entries as JSON\n' +
                      '/backup – Create backup (PDF + JSON)\n' +
                      '/status – Daily status overview\n' +
                      '/cancel – Cancel ongoing operation\n\n' +
                      '<b>Note:</b> API keys shown are always masked.',
                      { parse_mode: 'HTML' }
                    );
        break;
      case '/list':
        await cmdList(chatId);
        break;
      case '/search':
      case '/suche': {
        const q = text.split(' ').slice(1).join(' ').trim();
        if (q) {
          await performSearch(chatId, q);
        } else {
          await cmdSearchStart(chatId);
        }
        break;
      }
      case '/add':
        await cmdAddStart(chatId);
        break;
            case '/edit':
              await cmdEditStart(chatId);
              break;
            case '/health':
        await cmdHealth(chatId);
        break;
      case '/export':
        await cmdExport(chatId);
        break;
            case '/backup':
              await cmdBackup(chatId);
              break;
            case '/status':
              await cmdDailyStatus(chatId);
              break;
            case '/theme':
              await cmdTheme(chatId);
              break;
            case '/themes':
              await cmdThemes(chatId);
              break;
            case '/cancel':
              if (chatState.delete(String(chatId))) {
                await bot.sendMessage(chatId, '🚫 Cancelled.');
              } else {
                await bot.sendMessage(chatId, 'Nothing to cancel.');
              }
              break;
      default:
        await bot.sendMessage(chatId, '❓ Unknown command. Send /help for options.');
    }
  }
}

async function handleCallbackQuery(cb) {
  const chatId = String(cb.message.chat.id);
  const data = cb.data || '';

  if (!isAllowed(chatId)) {
    console.warn('[telegram] Ignored unauthorized chat:', chatId);
    // Silent ignore for unauthorized chats (strict allowlist)
    return;
  }

  if (!checkRateLimit(chatId, bot)) return;

  await bot.answerCallbackQuery(cb.id);

  if (data.startsWith('cmd:')) {
    const cmd = data.slice(4);
      if (cmd.startsWith('list:')) {
        const page = parseInt(cmd.slice(5), 10) || 0;
        await cmdList(chatId, page);
      } else {
        switch (cmd) {
          case 'list':   chatState.delete(String(chatId)); await cmdList(chatId); break;
          case 'add':    await cmdAddStart(chatId); break;
          case 'search': await cmdSearchStart(chatId); break;
          case 'health': await cmdHealth(chatId);   break;
          case 'export': await cmdExport(chatId);   break;
                  case 'backup': await cmdBackup(chatId);   break;
                  case 'status': await cmdDailyStatus(chatId); break;
                  case 'help':   await cmdHelp(chatId);     break;
                          case 'themes': await cmdThemes(chatId); break;
                          case 'edit':   await cmdEditStart(chatId, cb.message.message_id, cb.message.text); break;
                          default:
                            await bot.sendMessage(chatId, '❓ Unknown action.');
                        }
              }
    } else if (data.startsWith('info:')) {
    await cmdInfo(chatId, data.slice(5));
  } else if (data.startsWith('del:')) {
    await cmdDeleteConfirm(chatId, data.slice(4), cb.message.message_id);
  } else if (data.startsWith('dodelete:')) {
    await cmdDeleteExecute(chatId, data.slice(9));
  } else if (data.startsWith('delcancel:')) {
    await bot.sendMessage(chatId, 'Operation cancelled.');
    await cmdList(chatId);
  } else if (data.startsWith('edit:')) {
    chatState.set(String(chatId), { state: 'awaiting_edit_entry', entryId: data.slice(5) });
    await bot.sendMessage(chatId,
      '✏️ <b>Enter new values for entry #' + data.slice(5) + '</b>\n\n' +
      'Send in this format (one message):\n' +
      '<code>name | url | apikey | category | notes</code>\n\n' +
      'Leave fields empty to keep current values. Send /cancel to abort.',
      { parse_mode: 'HTML' }
    );
    } else if (data.startsWith('theme:')) {
      const themeId = data.slice(6);
      if (themes.setTheme(themeId)) {
        userThemes.set(chatId, themeId);
        const currentTheme = themes.getCurrentTheme();
        await bot.sendMessage(chatId,
          `🎨 <b>Theme Changed!</b>\n\n` +
          `${currentTheme.name}\n\n` +
          `All future messages will use this theme. You can change it anytime with /themes.`,
          { parse_mode: 'HTML' }
        );
      } else {
        await bot.sendMessage(chatId, '❌ <b>Invalid theme</b>\n\nUse /themes to see available options.', { parse_mode: 'HTML' });
      }
    }
  }

// ── Commands ───────────────────────────────────────────────────────────────────
async function cmdList(chatId, page = 0) {
  const pageSize = 5; // Limiting to 5 entries per page for now

  const totalRows = await new Promise((res, rej) =>
    db.get('SELECT COUNT(*) AS count FROM api_entries', [], (err, r) =>
      err ? rej(err) : res(r.count)
    )
  );

  const offset = page * pageSize;
  const rows = await new Promise((res, rej) =>
    db.all('SELECT id, name, category FROM api_entries ORDER BY name LIMIT ? OFFSET ?', [pageSize, offset], (err, r) =>
      err ? rej(err) : res(r)
    )
  );

  if (!totalRows) {
    await bot.sendMessage(chatId, '📭 No entries yet. Use ➕ Add to create one.');
    return;
  }

  const lines = rows.map((r, i) =>
    `${offset + i + 1}. ${escHtml(r.name)}${r.category ? ' [' + escHtml(r.category) + ']' : ''}`
  );

  const keyboard = rows.map(r => [{ text: `ℹ️ ${escHtml(r.name)}`, callback_data: `info:${r.id}` }]);

  const navButtons = [];
  if (page > 0) {
    navButtons.push({ text: '◀️ Prev', callback_data: `cmd:list:${page - 1}` });
  }
  if ((page + 1) * pageSize < totalRows) {
    navButtons.push({ text: '▶️ Next', callback_data: `cmd:list:${page + 1}` });
  }
  if (navButtons.length) {
    keyboard.push(navButtons);
  }
  keyboard.push([{ text: '➕ Add', callback_data: 'cmd:add' }]);

  await sendChunks(chatId, `📋 <b>API Entries (Page ${page + 1}/${Math.ceil(totalRows / pageSize)})</b>\n\n` + lines.join('\n'), {
    reply_markup: {
      inline_keyboard: keyboard,
    },
  });
}

async function cmdSearchStart(chatId) {
  chatState.set(String(chatId), { state: 'awaiting_search' });
  await bot.sendMessage(chatId,
    '🔍 <b>Search entries</b>\n\n' +
    'Send a search term – matches <b>name</b>, <b>URL</b>, <b>category</b> and <b>notes</b>.\n' +
    'Tip: you can also use <code>/search &lt;term&gt;</code> directly.\n\n' +
    'Send /cancel to abort.',
    { parse_mode: 'HTML' }
  );
}

async function performSearch(chatId, query) {
  chatState.delete(String(chatId));

  // Parameterized LIKE query; strip LIKE wildcards from user input
  const like = `%${query.replace(/[%_]/g, '')}%`;
  const rows = await new Promise((res, rej) =>
    db.all(
      `SELECT id, name, category FROM api_entries
       WHERE name LIKE ? OR url LIKE ? OR category LIKE ? OR notes LIKE ?
       ORDER BY name LIMIT 20`,
      [like, like, like, like],
      (err, r) => err ? rej(err) : res(r)
    )
  );

  if (!rows.length) {
    await bot.sendMessage(chatId, `🔍 No entries found for <b>${escHtml(query)}</b>.`, { parse_mode: 'HTML' });
    return;
  }

  const lines = rows.map((r, i) =>
    `${i + 1}. ${escHtml(r.name)}${r.category ? ' [' + escHtml(r.category) + ']' : ''}`
  );

  const keyboard = rows.map(r => [{ text: `ℹ️ ${escHtml(r.name)}`, callback_data: `info:${r.id}` }]);
  keyboard.push([{ text: '📋 Full list', callback_data: 'cmd:list' }]);

  await sendChunks(chatId,
    `🔍 <b>${rows.length}${rows.length === 20 ? '+' : ''} result${rows.length === 1 ? '' : 's'} for „${escHtml(query)}“</b>\n\n` + lines.join('\n'),
    {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    }
  );
}

async function cmdInfo(chatId, id) {
  const row = await new Promise((res, rej) =>
    db.get('SELECT * FROM api_entries WHERE id = ?', [id], (err, r) =>
      err ? rej(err) : res(r)
    )
  );

  if (!row) {
    await bot.sendMessage(chatId, '❌ Entry not found.');
    return;
  }

  const text =
    `🔑 <b>${escHtml(row.name)}</b>\n\n` +
    `URL: <code>${escHtml(row.url || '-')}</code>\n` +
    `Key: <code>${escHtml(mask(row.apiKey))}</code>\n` +
    `Category: ${escHtml(row.category || '-')}\n` +
    `Notes: ${escHtml(row.notes || '-')}\n` +
    `Created: ${row.created_at}\n` +
    `Updated: ${row.updated_at}`;

  await bot.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✏️ Edit', callback_data: `edit:${id}` },
          { text: '🗑️ Delete', callback_data: `del:${id}` },
        ],
        [
          { text: '🔙 Back', callback_data: 'cmd:list' },
        ],
      ],
    },
  });
}

async function cmdAddStart(chatId, msgId) {
  chatState.set(String(chatId), { state: 'awaiting_add_entry' });
  await bot.sendMessage(chatId,
    '📝 <b>Add new entry</b>\n\n' +
    'Send in this format (one message):\n' +
    '<code>name | url | apikey | category | notes</code>\n\n' +
    'Example:\n' +
    '<code>OpenAI | https://api.openai.com | sk-xxx | AI | GPT-4o</code>\n\n' +
    'Fields: <b>name</b> and <b>apikey</b> are required. Send /cancel to abort.',
    { parse_mode: 'HTML' }
  );
}

async function cmdEditStart(chatId) {
  chatState.set(String(chatId), { state: 'awaiting_edit_entry' });
  await bot.sendMessage(chatId,
    '✏️ <b>Edit entry</b>\n\n' +
    'Send in this format (one message):\n' +
    '<code>id | name | url | apikey | category | notes</code>\n\n' +
    'Example:\n' +
    '<code>1 | OpenAI | https://api.openai.com | sk-xxx | AI | GPT-4o</code>\n\n' +
    'All fields are optional except <b>id</b>. Send /cancel to abort.',
    { parse_mode: 'HTML' }
  );
}

async function processAddEntry(chatId, text) {
  const parts = text.split('|').map(s => s.trim());
  if (parts.length < 3) {
    await bot.sendMessage(chatId,
      '❌ Need at least: <code>name | url | apikey</code>. Try again or /cancel.',
      { parse_mode: 'HTML' }
    );
    return;
  }
  const [name, url, apiKey, category = '', notes = ''] = parts;
  if (!name || !apiKey) {
    await bot.sendMessage(chatId, '❌ <b>name</b> and <b>apikey</b> are required.', { parse_mode: 'HTML' });
    return;
  }

  await new Promise((res, rej) =>
    db.run(
      'INSERT INTO api_entries (name, url, apiKey, category, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime("now"), datetime("now"))',
      [name, url || '', apiKey, category, notes],
      err => err ? rej(err) : res()
    )
  );

  chatState.delete(String(chatId));
  await bot.sendMessage(chatId, `✅ Entry <b>${escHtml(name)}</b> added.`, { parse_mode: 'HTML' });
  await cmdList(chatId);
}

async function processEditEntry(chatId, text) {
  const parts = text.split('|').map(s => s.trim());
  if (parts.length < 1) {
    await bot.sendMessage(chatId,
      '❌ Need at least: <code>id</code>. Try again or /cancel.',
      { parse_mode: 'HTML' }
    );
    return;
  }
  const [id, name, url, apiKey, category, notes] = parts;
  if (!id) {
    await bot.sendMessage(chatId, '❌ <b>id</b> is required.', { parse_mode: 'HTML' });
    return;
  }

  // Build dynamic update query
  const updates = [];
  const params = [];
  if (name) { updates.push('name = ?'); params.push(name); }
  if (url !== undefined) { updates.push('url = ?'); params.push(url); }
  if (apiKey) { updates.push('apiKey = ?'); params.push(apiKey); }
  if (category !== undefined) { updates.push('category = ?'); params.push(category); }
  if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
  updates.push('updated_at = datetime("now")');
  params.push(id);

  if (updates.length === 1) {
    await bot.sendMessage(chatId, '❌ No fields to update.', { parse_mode: 'HTML' });
    return;
  }

  const query = `UPDATE api_entries SET ${updates.join(', ')} WHERE id = ?`;
  const result = await new Promise((res, rej) =>
    db.run(query, params, function onUpdate(err) {
      if (err) return rej(err);
      res(this.changes || 0);
    })
  );

  if (!result) {
    await bot.sendMessage(chatId, '❌ Entry not found.');
    await cmdList(chatId);
    return;
  }

  chatState.delete(String(chatId));
  await bot.sendMessage(chatId, `✅ Entry #${id} updated.`, { parse_mode: 'HTML' });
  await cmdList(chatId);
}

async function cmdDeleteConfirm(chatId, id, msgId) {
  await bot.sendMessage(chatId,
    `⚠️ Delete entry #${id}?`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Yes, delete', callback_data: `dodelete:${id}` },
            { text: '❌ Cancel', callback_data: `delcancel:${id}` },
          ],
        ],
      },
    }
  );
}

async function cmdDeleteExecute(chatId, id) {
  const result = await new Promise((res, rej) =>
    db.run('DELETE FROM api_entries WHERE id = ?', [id], function onDelete(err) {
      if (err) return rej(err);
      res(this.changes || 0);
    })
  );

  if (!result) {
    await bot.sendMessage(chatId, '❌ Entry not found.');
    await cmdList(chatId);
    return;
  }

  await bot.sendMessage(chatId, `✅ Entry #${id} deleted.`);
  await cmdList(chatId);
}

async function cmdHealth(chatId) {
  await bot.sendMessage(chatId, '✅ <b>Health check:</b> <code>ok</code>\nServer is running.', { parse_mode: 'HTML' });
}

async function cmdExport(chatId) {
  const rows = await new Promise((res, rej) =>
    db.all('SELECT name, url, apiKey, category, notes FROM api_entries ORDER BY name', [], (err, r) =>
      err ? rej(err) : res(r)
    )
  );

  const json = JSON.stringify(rows, null, 2);
  await bot.sendMessage(chatId, '💾 <b>Export</b>\nSending JSON…', { parse_mode: 'HTML' });
  await bot.sendMessage(chatId, `<pre>${escHtml(json)}</pre>`, { parse_mode: 'HTML' });
}

async function cmdBackup(chatId) {
  try {
    await bot.sendMessage(chatId, '🔄 <b>Starting backup...</b>\n\nCreating backup and PDF export...', { parse_mode: 'HTML' });
    
    // Get all entries for backup
    const rows = await new Promise((res, rej) =>
      db.all('SELECT name, url, apiKey, category, notes, created_at, updated_at FROM api_entries ORDER BY name', [], (err, r) =>
        err ? rej(err) : res(r)
      )
    );

    if (!rows.length) {
      await bot.sendMessage(chatId, '📭 No entries to backup.', { parse_mode: 'HTML' });
      return;
    }

    // Create PDF content
    const pdfContent = await createPDFBackup(rows);
    
    // Create JSON backup
    const jsonContent = JSON.stringify(rows, null, 2);
    
    // Send PDF backup
    await bot.sendDocument(chatId, {
      source: Buffer.from(pdfContent),
      filename: `highfish_backup_${new Date().toISOString().split('T')[0]}.pdf`
    });
    
    // Send JSON backup
    await bot.sendDocument(chatId, {
      source: Buffer.from(jsonContent),
      filename: `highfish_backup_${new Date().toISOString().split('T')[0]}.json`
    });
    
    await bot.sendMessage(chatId, '✅ <b>Backup completed!</b>\n\nYou should receive:\n• PDF backup document\n• JSON export file\n\n🔒 All data is exported to your local device.', { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('[Telegram] Backup error:', error);
    await bot.sendMessage(chatId, '❌ <b>Backup failed!</b>\n\nError: ' + escHtml(error.message), { parse_mode: 'HTML' });
  }
}

async function createPDFBackup(rows) {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument();
  const chunks = [];
  
  doc.on('data', chunks.push.bind(chunks));
  
  // Add title
  doc.fontSize(20).text('hAI · HighFish Agenten API DB Backup', 0, 20, { align: 'center' });
  doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`, 0, 50, { align: 'center' });
  doc.text(`Total entries: ${rows.length}`, 0, 70, { align: 'center' });
  doc.moveDown();
  
  // Add table of contents
  doc.fontSize(16).text('Table of Contents', 0, 100, { underline: true });
  doc.fontSize(12).text('1. Entry Details', 0, 120);
  doc.text('2. Backup Summary', 0, 140);
  doc.moveDown();
  
  // Entry details
  doc.fontSize(16).text('1. Entry Details', 0, 180, { underline: true });
  doc.moveDown();
  
  rows.forEach((row, index) => {
    doc.fontSize(14).text(`${index + 1}. ${row.name}`, 0, doc.y);
    
    if (row.category) {
      doc.fontSize(10).text(`   Category: ${row.category}`, 0, doc.y);
    }
    
    doc.fontSize(10).text(`   URL: ${row.url}`, 0, doc.y);
    doc.fontSize(10).text(`   API Key: ${mask(row.apiKey)}`, 0, doc.y);
    
    if (row.notes) {
      const wrappedNotes = doc.widthOfString(row.notes) > doc.width - 20
        ? doc.widthOfString(row.notes)
        : row.notes.length;
      doc.fontSize(10).text(`   Notes: ${row.notes}`, 0, doc.y, { width: doc.width - 20 });
    }
    
    doc.fontSize(9).text(`   Created: ${new Date(row.created_at).toLocaleString()}`, 0, doc.y);
    doc.fontSize(9).text(`   Updated: ${new Date(row.updated_at).toLocaleString()}`, 0, doc.y);
    doc.moveDown();
  });
  
  // Backup summary
  doc.fontSize(16).text('2. Backup Summary', 0, doc.y + 20, { underline: true });
  doc.moveDown();
  
  doc.fontSize(12).text('This backup contains all API entries from your hAI · HighFish Agenten API DB.', 0, doc.y);
  doc.text('The JSON format can be imported back to restore your data.', 0, doc.y + 15);
  doc.text('PDF format provides a readable formatted version of your API keys.', 0, doc.y + 30);
  doc.moveDown();

  doc.fontSize(10).text('⚠️ Security Note: This backup contains sensitive API keys.', 0, doc.y);
  doc.text('Store it securely and delete when no longer needed.', 0, doc.y + 15);

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

async function cmdStatus(chatId) {
  try {
    // Get system statistics
    const totalEntries = await new Promise((res, rej) =>
      db.get('SELECT COUNT(*) AS count FROM api_entries', [], (err, r) =>
        err ? rej(err) : res(r.count)
      )
    );

    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    
    const statusMessage = days > 0 
      ? `🐟 <b>hAI · HighFish Agenten API DB - Status</b>\n\n` +
        `📊 <b>System Status:</b> OK\n` +
        `📋 Total API Entries: ${totalEntries}\n` +
        `⏱️ Uptime: ${days}d ${hours}h\n` +
        `📡 Bot Status: Active\n` +
        `🔧 Last Backup: Use /backup\n\n` +
        `📖 Available: /help | /list | /search\n` +
        `🎨 Theme: Use /theme to change`
      : `🐟 <b>hAI · HighFish Agenten API DB - Status</b>\n\n` +
        `📊 <b>System Status:</b> OK\n` +
        `📋 Total API Entries: ${totalEntries}\n` +
        `⏱️ Uptime: ${hours}h\n` +
        `📡 Bot Status: Active\n` +
        `🔧 Last Backup: Use /backup\n\n` +
        `📖 Available: /help | /list | /search\n` +
        `🎨 Theme: Use /theme to change`;

    await bot.sendMessage(chatId, statusMessage, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('[Telegram] Status command error:', err);
    await bot.sendMessage(chatId, '❌ Error getting status. Try again later.');
  }
}

async function cmdDailyStatus(chatId) {
  try {
    // Get system statistics
    const totalEntries = await new Promise((res, rej) =>
      db.get('SELECT COUNT(*) AS count FROM api_entries', [], (err, r) =>
        err ? rej(err) : res(r.count)
      )
    );

    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    
    const statusMessage = days > 0 
      ? `🐟 <b>hAI · HighFish Agenten API DB - Status</b>\n\n` +
        `📊 <b>System Status:</b> OK\n` +
        `📋 Total API Entries: ${totalEntries}\n` +
        `⏱️ Uptime: ${days}d ${hours}h\n` +
        `📡 Bot Status: Active\n` +
        `🔧 Last Backup: Use /backup\n\n` +
        `📖 Available: /help | /list | /search\n` +
        `🛡️ Backup: /backup | Export: /export`
      : `🐟 <b>hAI · HighFish Agenten API DB - Status</b>\n\n` +
        `📊 <b>System Status:</b> OK\n` +
        `📋 Total API Entries: ${totalEntries}\n` +
        `⏱️ Uptime: ${hours}h\n` +
        `📡 Bot Status: Active\n` +
        `🔧 Last Backup: Use /backup\n\n` +
        `📖 Available: /help | /list | /search\n` +
        `🛡️ Backup: /backup | Export: /export`;

    await bot.sendMessage(chatId, statusMessage, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('[Telegram] Status command error:', error);
    await bot.sendMessage(chatId, '❌ <b>Error fetching status</b>\n\nPlease try again later.', { parse_mode: 'HTML' });
  }
}

async function cmdHelp(chatId) {
  await handleMessage({ chat: { id: chatId }, text: '/help' });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Notification functions ─────────────────────────────────────────────────────
async function sendStartupNotifications() {
  if (!TOKEN || !ALLOWED.length) return;
  
  const now = new Date();
  // Only send startup notification once per hour to prevent spam
  if (lastStartupNotification && (now - lastStartupNotification) < 60 * 60 * 1000) return;
  
  try {
    for (const chatId of ALLOWED) {
      if (checkRateLimit(chatId, bot)) {
          const userTheme = userThemes.get(chatId) || DEFAULT_THEME;
          const formatters = themes.getFormatters();
        
          await bot.sendMessage(chatId, formatters.composeMessage([
            formatters.header('🐟 hAI · HighFish Agenten API DB'),
            '✅ Bot started successfully',
            '📡 Ready for commands',
            '🛡️ Use /backup to create backup',
            '🔍 Use /help for available commands'
          ]), { parse_mode: 'HTML' });
        }
      }
      lastStartupNotification = now;
      console.log('[Telegram] Startup notifications sent');
    } catch (error) {
      console.error('[Telegram] Startup notification error:', error.message);
    }
}

async function sendDailyStatus() {
  if (!TOKEN || !ALLOWED.length) return;
  
  const now = new Date();
  const today = now.toDateString();
  
  // Check if we've already sent today's notification
  if (lastDailyNotification && lastDailyNotification.toDateString() === today) return;
  
  try {
    // Get system statistics
    const totalEntries = await new Promise((res, rej) =>
      db.get('SELECT COUNT(*) AS count FROM api_entries', [], (err, r) =>
        err ? rej(err) : res(r.count)
      )
    );

    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    
    for (const chatId of ALLOWED) {
          if (checkRateLimit(chatId, bot)) {
            const userTheme = userThemes.get(chatId) || DEFAULT_THEME;
            const formatters = themes.getFormatters();
        
            const statusParts = [
              formatters.header('🐟 hAI · HighFish Agenten API DB - Status'),
              formatters.success('System Status: OK'),
              `📋 Total API Entries: ${totalEntries}`,
              `⏱️ Uptime: ${days > 0 ? `${days}d ${hours}h` : `${hours}h`}`,
              formatters.info('Bot Status: Active'),
              formatters.warning('Last Backup: Use /backup'),
              '',
              formatters.subtitle('Available Commands'),
              '📋 /help | /list | /search',
              '🛡️ /backup | /export'
            ];

            await bot.sendMessage(chatId, formatters.composeMessage(statusParts), { parse_mode: 'HTML' });
          }
        }
    
    lastDailyNotification = now;
    console.log('[Telegram] Daily status notification sent');
  } catch (error) {
    console.error('[Telegram] Daily status notification error:', error.message);
  }
}

function startDailyTimer() {
  if (!TOKEN || !ALLOWED.length) return;
  
  // Parse daily time (default: 09:00)
  const [hours, minutes] = DAILY_NOTIFICATION_TIME.split(':').map(Number);
  
  const scheduleDailyNotification = () => {
      // Clear any existing timer to prevent memory leaks
      if (dailyTimer) {
        clearTimeout(dailyTimer);
        dailyTimer = null;
      }
    
      const now = new Date();
      const nextNotification = new Date();
      nextNotification.setHours(hours, minutes, 0, 0);
    
      // If we've passed today's notification time, schedule for tomorrow
      if (nextNotification <= now) {
        nextNotification.setDate(nextNotification.getDate() + 1);
      }
    
      const delay = nextNotification.getTime() - now.getTime();
      console.log(`[Telegram] Next daily status scheduled for: ${nextNotification.toLocaleString()}`);
    
      dailyTimer = setTimeout(async () => {
        try {
          await sendDailyStatus();
          scheduleDailyNotification(); // Schedule next day
        } catch (error) {
          console.error('[Telegram] Error in daily notification schedule:', error.message);
          // Try to reschedule even if there was an error
          setTimeout(() => scheduleDailyNotification(), 60000); // Wait 1 minute and retry
        }
      }, delay);
    };
  
    // Start the daily schedule
    scheduleDailyNotification();
}

// ── Theme Commands ─────────────────────────────────────────────────────────────
async function cmdTheme(chatId) {
  const formatters = themes.getFormatters();
  const currentTheme = themes.getCurrentTheme();
  const availableThemes = themes.getAllThemes();
  
  const themeInfo = formatters.composeMessage([
    formatters.header('🎨 Available Themes'),
    'Choose a theme below to change the bot message styling:',
    '',
    ...availableThemes.map(theme => 
      theme.current 
        ? `✅ ${formatters.success(theme.name)} (current)`
        : `⭕ ${theme.name}`
    ),
    '',
    formatters.subtitle('Theme affects all future message formatting')
  ]);
  
  const keyboard = availableThemes.map(theme => [{
    text: theme.current ? `🌟 ${theme.name} (current)` : `🎨 ${theme.name}`,
    callback_data: `cmd:theme_${theme.id}`
  }]);
  
  await bot.sendMessage(chatId, themeInfo, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

async function cmdThemes(chatId) {
  const formatters = themes.getFormatters();
  const currentTheme = themes.getCurrentTheme();
  
  const themesMessage = formatters.composeMessage([
    formatters.header('🎨 Current Theme'),
    currentTheme.name,
    '',
    formatters.subtitle('Your theme preference is saved for this chat'),
    '',
    formatters.info('Use /theme to see all options'),
    formatters.info('Themes are mobile-optimized for better display')
  ]);
  
  await bot.sendMessage(chatId, themesMessage, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[
        { text: '🎨 Change Theme', callback_data: 'cmd:themes' },
        { text: '📋 Main Menu', callback_data: 'cmd:list' }
      ]]
    }
  });
}

async function cmdHelp(chatId) {
  const formatters = themes.getFormatters();
  const userTheme = userThemes.get(chatId) || DEFAULT_THEME;
  
  const helpMessage = formatters.composeMessage([
    formatters.header('🤖 Bot Help'),
    '✅ <b>Commands:</b>',
    '📋 /list - List all API entries',
    '➕ /add - Create new API entry',
    '🔍 /search [term] - Search entries',
    '🛡️ /backup - Create PDF + JSON backup',
    '💾 /export - Export as JSON',
    '📊 /status - System status overview',
    '❤️ /health - Health check',
    '🎨 /theme - Change message styling',
    '❓ /help - Show this help',
    '',
    formatters.subtitle('Inline Menu'),
    'Tap buttons for quick actions',
    '',
    formatters.info('Themes are saved per chat'),
    formatters.warning('Rate limit: 20 messages/min')
  ]);
  
  await bot.sendMessage(chatId, helpMessage, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[
        { text: '🎨 Change Theme', callback_data: 'cmd:themes' },
        { text: '📋 Show Commands', callback_data: 'cmd:list' }
      ]]
    }
  });
}

// ── Module init ────────────────────────────────────────────────────────────────
let initDone = false;

function init({ db: _db, app }) {
  if (initDone) return;
  initDone = true;
  db = _db;

  if (!TOKEN) {
    console.log('[Telegram] TELEGRAM_BOT_TOKEN not set – bot inactive.');
    return;
  }

  // Dynamic require to avoid crash when module is installed but token missing
  const TelegramBot = require('node-telegram-bot-api');
  bot = new TelegramBot(TOKEN, { polling: !USE_WEBHOOK });

    bot.on('polling_error', (error) => {
      console.error('[Telegram] Polling error:', error.code, error.message);
    });

    bot.on('webhook_error', (error) => {
      console.error('[Telegram] Webhook error:', error.code, error.message);
    });

    // Handle callback queries for inline buttons
    async function handleCallbackQuery(query) {
      const chatId = query.message.chat.id;
      const callbackData = query.data;
      
      // Rate limiting for callback queries
      if (!rateLimit(chatId)) {
    await query.answer('⏳ Rate limit reached. Please wait a moment.', { show_alert: true });
    return;
      }
      
      // Check for admin commands
      if (callbackData === 'cmd:admin' && ALLOWED.includes(String(chatId))) {
    await query.answer();
    await buildAdminMenu(chatId);
    return;
      }
      
      // Forward to specific command handlers (already handled by bot.action below)
      // This is a fallback for any cases not caught by specific action handlers
      await query.answer();
    }

    // Add action handlers for inline buttons
    bot.action(/^cmd:theme_(.+)$/, async (query) => {
      const chatId = query.message.chat.id;
      const themeId = query.match[1];
      
      try {
    // Set the theme for this chat
    userThemes.set(chatId, themeId);
        
    // Get updated formatters
    const formatters = themes.getFormatters();
    const currentTheme = themes.getCurrentTheme();
        
    // Send confirmation message
    const message = formatters.composeMessage([
      formatters.header('🎨 Theme Updated!'),
      `✅ <b>${currentTheme.name}</b> is now active for this chat.`,
      '',
      formatters.subtitle('All future messages will use this theme'),
      '',
      formatters.info('Use /theme to change again or see all options')
    ]);
        
    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '🎨 Change Theme', callback_data: 'cmd:themes' },
          { text: '📋 Show Commands', callback_data: 'cmd:list' }
        ]]
      }
    });
        
    // Answer the callback query
    await query.answer();
      } catch (error) {
    console.error('[Telegram] Theme change error:', error);
    await query.answer('❌ Error changing theme', { show_alert: true });
      }
    });

    // Handle other command callbacks
    bot.action('cmd:themes', async (query) => {
      await query.answer();
      await cmdThemes(query.message.chat.id);
    });

    bot.action('cmd:list', async (query) => {
      await query.answer();
      await cmdList(query.message.chat.id);
    });

    bot.action('cmd:add', async (query) => {
      await query.answer();
      await cmdAdd(query.message.chat.id);
    });

    bot.action('cmd:search', async (query) => {
      await query.answer();
      await cmdSearch(query.message.chat.id);
    });

    bot.action('cmd:export', async (query) => {
      await query.answer();
      await cmdExport(query.message.chat.id);
    });

    bot.action('cmd:backup', async (query) => {
      await query.answer();
      await cmdBackup(query.message.chat.id);
    });

    bot.action('cmd:status', async (query) => {
      await query.answer();
      await cmdStatus(query.message.chat.id);
    });

    bot.action('cmd:health', async (query) => {
      await query.answer();
      await cmdHealth(query.message.chat.id);
    });

    bot.action('cmd:help', async (query) => {
      await query.answer();
      await cmdHelp(query.message.chat.id);
    });

    bot.on('message', handleMessage);
    bot.on('callback_query', handleCallbackQuery);

  if (USE_WEBHOOK) {
    const url = `https://your-domain.com${WEBHOOK_PATH}`;
    bot.setWebHook(url).catch(err => {
      console.error('[Telegram] Webhook set failed:', err.message);
    });
    app.post(WEBHOOK_PATH, (req, res) => {
      bot.processUpdate(req.body);
      res.sendStatus(200);
    });
  }

  bot.on('polling_error', (error) => {
    console.error('[Telegram] Polling error:', error.code, error.message);
  });

  bot.on('webhook_error', (error) => {
    console.error('[Telegram] Webhook error:', error.code, error.message);
  });

  console.log(`[Telegram] Bot active – polling: ${!USE_WEBHOOK}, allowed chats: ${ALLOWED.join(', ') || '(none)'}`);

  // Send startup notifications
    startupTimeout = setTimeout(() => {
    sendStartupNotifications().catch(err => {
      console.error('[Telegram] Startup notification failed:', err.message);
    });
  }, 2000); // Wait 2 seconds to ensure bot is ready

  // Start daily status notifications
  startDailyTimer();

  console.log('[Telegram] Notifications enabled - startup and daily status configured');
  }

  // Cleanup function to prevent memory leaks
  function cleanup() {
    if (dailyTimer) {
      clearTimeout(dailyTimer);
      dailyTimer = null;
    }
    if (startupTimeout) {
      clearTimeout(startupTimeout);
      startupTimeout = null;
    }
    console.log('[Telegram] Cleanup completed - timers cleared');
  }

  // Add process event listeners for graceful shutdown
  process.on('SIGINT', () => {
    console.log('[Telegram] Received SIGINT - cleaning up...');
    cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('[Telegram] Received SIGTERM - cleaning up...');
    cleanup();
    process.exit(0);
  });

  process.on('exit', () => {
    cleanup();
  });

  module.exports = { init, chunk, cleanup };

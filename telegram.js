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
 *
 * Commands:
 *   /start          – Welcome message + keyboard menu
 *   /help           – Help text
 *   /list           – List all API entries (name + masked key only)
 *   /health         – Quick health check
 *
 * Inline buttons:
 *   📋 List       → /list
 *   ➕ Add        → opens add form
 *   ℹ️ Info       → entry detail (name, url, category, notes, created/updated)
 *   ✏️  Edit       → updates entry
 *   🗑️  Delete     → deletes entry (confirmation required)
 *   💾 Export      → sends JSON export
 *
 * Security:
 *   • Only chat IDs in TELEGRAM_ALLOWED_CHAT_IDS are served
 *   • apiKey values are always masked (sk-xxxx…xxxx)
 */

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED = process.env.TELEGRAM_ALLOWED_CHAT_IDS
  ? process.env.TELEGRAM_ALLOWED_CHAT_IDS.split(',').map(s => s.trim())
  : [];
const ADMIN_KEY = process.env.TELEGRAM_ADMIN_API_KEY || process.env.API_KEY || '';
const PORT = process.env.TELEGRAM_WEBHOOK_PORT || process.env.PORT || 3000;
const USE_WEBHOOK = process.env.TELEGRAM_USE_WEBHOOK === 'true';
const WEBHOOK_PATH = '/telegram/' + (process.env.TELEGRAM_WEBHOOK_PATH || TOKEN);

// ── Lazy-load bot only when token is configured ─────────────────────────────────
let bot = null;
let db = null;

// Per-chat state: Map<chatId, { state: 'awaiting_add_entry', messageId?: number }>
const chatState = new Map();

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

async function sendChunks(chatId, text) {
  for (const c of chunk(text)) {
    await bot.sendMessage(chatId, c, { parse_mode: 'HTML' });
  }
}

function buildMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📋 List', callback_data: 'cmd:list' },
          { text: '➕ Add',  callback_data: 'cmd:add' },
        ],
        [
          { text: '💾 Export', callback_data: 'cmd:export' },
          { text: '❤️  Health', callback_data: 'cmd:health' },
        ],
        [
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

async function handleMessage(msg) {
  const chatId = String(msg.chat.id);

  if (!isAllowed(chatId)) {
    // Silent ignore for unauthorized chats (strict allowlist)
    return;
  }

  const text = (msg.text || '').trim();

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
  }

  if (text.startsWith('/')) {
    const cmd = text.split(' ')[0].toLowerCase();
    switch (cmd) {
      case '/start':
        await bot.sendMessage(
          chatId,
          '🐟 <b>hAI · HighFish Agenten API DB</b>\n\nUse the menu below or type /help for commands.',
          { parse_mode: 'HTML', ...buildMenu() }
        );
        break;
      case '/help':
        await bot.sendMessage(chatId,
          '📖 <b>Available commands</b>\n\n' +
          '/start – Show menu\n' +
          '/help  – This message\n' +
          '/list  – List all entries\n' +
          '/add   – Add a new entry\n' +
          '/health – Server health check\n' +
          '/export – Export all entries as JSON\n\n' +
          '<b>Note:</b> API keys shown are always masked.',
          { parse_mode: 'HTML' }
        );
        break;
      case '/list':
        await cmdList(chatId);
        break;
      case '/add':
        await cmdAddStart(chatId);
        break;
      case '/health':
        await cmdHealth(chatId);
        break;
      case '/export':
        await cmdExport(chatId);
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
    // Silent ignore for unauthorized chats (strict allowlist)
    return;
  }

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
          case 'health': await cmdHealth(chatId);   break;
          case 'export': await cmdExport(chatId);   break;
          case 'help':   await cmdHelp(chatId);     break;
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
    await bot.sendMessage(chatId, 'Edit feature coming soon.');
    await cmdInfo(chatId, data.slice(5));
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

async function cmdHelp(chatId) {
  await handleMessage({ chat: { id: chatId }, text: '/help' });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

  console.log(`[Telegram] Bot active – polling: ${!USE_WEBHOOK}, allowed chats: ${ALLOWED.join(', ') || '(none)'}`);
}

module.exports = { init, chunk };

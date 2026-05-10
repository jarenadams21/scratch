import http from 'http';
import { config } from './config/config.js';
import { signup, login, extractUser } from './auth/auth.js';
import { createEntry, getAllEntries, deleteEntry, updateEntryVisibility, DEFAULT_VISIBILITY } from './db/db.js';
import { generateUploadUrl, createAudioEntry, getUserAudioEntries, deleteAudioEntry } from './db/audio-db.js';
import { getTraits, setTrait, upsertMealEntry, deleteMealEntry, getMealEntries } from './db/feature-db.js';

// ─── CORS Helper ────────────────────────────────────────────────────────────

function setCors(res, origin) {
  // Only allow specific origins from environment variable or config
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : config.ALLOWED_ORIGINS || ['http://localhost:8080'];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// ─── Response Helpers ───────────────────────────────────────────────────────

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function error(res, message, status = 400) {
  json(res, { error: message }, status);
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// ─── Message Handler ────────────────────────────────────────────────────────

async function handleMessage(message, userId) {
  const { command, payload } = message;
  const content = typeof payload.content === 'string' 
    ? JSON.parse(payload.content) 
    : payload.content;
  
  switch (command) {
    case 'auth_signup':
      // DISABLED: Manual account provisioning only
      throw new Error('Registration disabled. Contact administrator for account access.');
    
    case 'auth_login':
      return await login(content.email, content.password);
    
    case 'create_post':
      if (!userId) throw new Error('Unauthorized');
      return await createEntry(userId, content);

    case 'get_posts': {
      const all = await getAllEntries();
      // Authed admins see everything. Visitors only see public entries
      // (and treat missing visibility as public for back-compat).
      if (userId) return all;
      return all.filter(e => (e.visibility || DEFAULT_VISIBILITY) === 'public');
    }

    case 'update_post_visibility':
      // Any logged-in admin may flip any entry. The owner's email tells us
      // which pk to update; the auth check above ensures it's an admin doing it.
      if (!userId) throw new Error('Unauthorized');
      return await updateEntryVisibility(content.author, content.postId, content.timestamp, content.visibility);

    case 'delete_post':
      if (!userId) throw new Error('Unauthorized');
      await deleteEntry(userId, content.postId, content.timestamp);
      return { message: 'Deleted' };
    
    case 'request_upload_url':
      if (!userId) throw new Error('Unauthorized');
      return await generateUploadUrl(content.filename, content.contentType);

    case 'create_audio_post':
      if (!userId) throw new Error('Unauthorized');
      return await createAudioEntry(userId, content);

    case 'get_audio_posts':
      // Audio is private per-admin — only the owner sees their recordings.
      if (!userId) throw new Error('Unauthorized');
      return await getUserAudioEntries(userId);

    case 'delete_audio_post':
      if (!userId) throw new Error('Unauthorized');
      await deleteAudioEntry(userId, content.entryId, content.createdAt);
      return { message: 'Deleted' };

    case 'get_traits':
      if (!userId) throw new Error('Unauthorized');
      return { traits: await getTraits(userId) };

    case 'set_trait':
      if (!userId) throw new Error('Unauthorized');
      return { traits: await setTrait(userId, content.trait, content.enabled) };

    case 'get_meal_entries':
      if (!userId) throw new Error('Unauthorized');
      return await getMealEntries(content.startDate, content.endDate);

    case 'upsert_meal_entry':
      if (!userId) throw new Error('Unauthorized');
      return await upsertMealEntry(userId, content.date, content.text);

    case 'delete_meal_entry':
      if (!userId) throw new Error('Unauthorized');
      await deleteMealEntry(userId, content.date);
      return { message: 'Deleted' };

    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

// ─── Request Handler ────────────────────────────────────────────────────────

// Errors thrown from validation should return 400, not 500. Anything that
// looks like a client-input or auth problem is mapped to 400/401 here.
const CLIENT_ERROR_PATTERNS = [
  /^Invalid /i,
  /^Unknown trait/i,
  /^Meal entry/i,
  /must be /i,
  /^Date range /i,
  /^Unauthorized/i,
];

function statusForError(err) {
  if (/^Unauthorized/i.test(err.message)) return 401;
  if (CLIENT_ERROR_PATTERNS.some(rx => rx.test(err.message))) return 400;
  return 500;
}

async function handleRequest(req, res) {
  const origin = req.headers.origin;
  setCors(res, origin);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  try {
    if (path === '/msg' && req.method === 'POST') {
      const message = await parseBody(req);

      if (!message.command || !message.payload?.num) {
        return error(res, 'Invalid message format');
      }

      const userId = extractUser(req);
      const result = await handleMessage(message, userId);
      return json(res, result);
    }

    return error(res, 'Not found', 404);
  } catch (err) {
    const status = statusForError(err);
    if (status >= 500) console.error('Request error:', err);
    // Don't leak internal error messages on 500s.
    const body = status >= 500 ? 'Internal error' : err.message;
    return error(res, body, status);
  }
}

// ─── Server ─────────────────────────────────────────────────────────────────

// Export handleRequest for Lambda
export { handleRequest };

const server = http.createServer(handleRequest);

server.listen(config.PORT, () => {
  console.log('🚀 Backend: http://localhost:' + config.PORT);
  console.log(`   DEV mode: ${config.DEV_MODE ? 'ON' : 'OFF'}`);
  console.log(`   DB Table: ${config.DYNAMODB_TABLE}`);
  console.log('');
});

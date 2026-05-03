import http from 'http';
import { config } from './config/config.js';
import { signup, login, extractUser } from './auth/auth.js';
import { createEntry, getUserEntries, deleteEntry } from './db/db.js';

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
    
    case 'get_posts':
      // PUBLIC: Anyone can read posts (no auth required)
      // If userId provided, get their posts; otherwise get from a default public user
      const targetUser = content.email || userId || 'admin@harbinger.app';
      return await getUserEntries(targetUser);
    
    case 'delete_post':
      if (!userId) throw new Error('Unauthorized');
      await deleteEntry(userId, content.postId, content.timestamp);
      return { message: 'Deleted' };
    
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

// ─── Request Handler ────────────────────────────────────────────────────────

async function handleRequest(req, res) {
  const origin = req.headers.origin;
  setCors(res, origin);
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  
  try {
    // Single message endpoint
    if (path === '/msg' && req.method === 'POST') {
      const message = await parseBody(req);
      
      // Validate message structure
      if (!message.command || !message.payload?.num) {
        return error(res, 'Invalid message format');
      }
      
      // Extract user if auth token present
      const userId = extractUser(req);
      
      // Handle the message
      const result = await handleMessage(message, userId);
      
      // Auth messages return tokens
      if (message.command.startsWith('auth_')) {
        return json(res, result);
      }
      
      return json(res, result);
    }
    
    // Not found
    return error(res, 'Not found', 404);
    
  } catch (err) {
    console.error('Request error:', err);
    return error(res, err.message, 500);
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
});

import { CONFIG, devLog } from '../config/flags-runtime.js';

const API_URL = CONFIG.API_URL;

function getToken()        { return localStorage.getItem('authToken'); }
function setToken(token)   { localStorage.setItem('authToken', token); }
function clearToken()      { localStorage.removeItem('authToken'); }

// Register one handler per command. Each receives the message and returns mock data.
const devVisitor = {
  // my_command: (msg) => ({ result: 'mock' }),
};

function visitMessage(message, visitor) {
  const handler = visitor[message.command];
  return handler ? handler(message) : Promise.resolve({ success: true });
}

async function devTransport(message) {
  devLog('Mock message:', message.command);
  await new Promise(resolve => setTimeout(resolve, CONFIG.DEV_DELAY));
  return visitMessage(message, devVisitor);
}

async function httpTransport(message, requiresAuth) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (requiresAuth && token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}/msg`, {
    method: 'POST',
    headers,
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  return response.json();
}

export function sendMessage(message, requiresAuth = true) {
  return CONFIG.DEV ? devTransport(message) : httpTransport(message, requiresAuth);
}

export function isLoggedIn() { return !!getToken(); }
export function setAuth(token) { setToken(token); }
export function clearAuth() { clearToken(); }

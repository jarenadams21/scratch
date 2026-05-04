// Message-based API client using your VISITOR/Message architecture
import { 
  createPostMessage, 
  getPostsMessage, 
  deletePostMessage,
  signupMessage,
  loginMessage,
  logoutMessage 
} from '../types/journal-messages.js';
import { CONFIG, devLog } from '../config/flags-runtime.js';
import { MOCK_USER, mockDB } from '../data/mock-data.js';

const API_URL = CONFIG.API_URL;

// ─── Storage ────────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('authToken');
}

function setToken(token) {
  localStorage.setItem('authToken', token);
}

function clearToken() {
  localStorage.removeItem('authToken');
}

export function getAdminEmail() {
  return localStorage.getItem('adminEmail');
}

function setAdminEmail(email) {
  localStorage.setItem('adminEmail', email);
}

// ─── Message Sender ─────────────────────────────────────────────────────────

async function sendMessage(message, requiresAuth = true) {
  // DEV MODE: Return mock data instead of network call
  if (CONFIG.DEV) {
    devLog('Mock message:', message.command);
    await new Promise(resolve => setTimeout(resolve, CONFIG.DEV_DELAY));
    
    switch (message.command) {
      case 'auth_signup':
      case 'auth_login':
        return { token: MOCK_USER.token, user: { email: MOCK_USER.email } };
      case 'get_posts':
        return mockDB.getPosts();
      case 'create_post':
        const { title, content, mood } = message.payload.content;
        return mockDB.createPost(title, content, mood);
      case 'delete_post':
        return mockDB.deletePost(message.payload.content.postId);
      default:
        return { success: true };
    }
  }
  
  // PRODUCTION MODE: Actual network call
  const token = getToken();
  
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (requiresAuth && token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
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

// ─── Auth API ───────────────────────────────────────────────────────────────

export async function signup(email, password) {
  const message = signupMessage(email, password);
  const data = await sendMessage(message, false);
  setToken(data.token);
  return data;
}

export async function login(email, password) {
  const message = loginMessage(email, password);
  const data = await sendMessage(message, false);
  setToken(data.token);
  if (data.user?.email) setAdminEmail(data.user.email);
  return data;
}

export function logout() {
  clearToken();
}

export function isLoggedIn() {
  return !!getToken();
}

// ─── Posts API ──────────────────────────────────────────────────────────────

export async function getPosts(email = null) {
  const message = getPostsMessage(email);
  return sendMessage(message);
}

export async function createPost(title, content, mood = null) {
  const message = createPostMessage(title, content, mood);
  return sendMessage(message);
}

export async function deletePost(postId, timestamp) {
  const message = deletePostMessage(postId);
  message.payload.content.timestamp = timestamp;
  return sendMessage(message);
}

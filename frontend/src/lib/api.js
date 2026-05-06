import {
  createPostMessage,
  getPostsMessage,
  deletePostMessage,
  signupMessage,
  loginMessage,
  logoutMessage
} from '../types/journal-messages.js';
import {
  requestUploadUrlMessage,
  createAudioPostMessage,
  getAudioPostsMessage,
  deleteAudioPostMessage,
} from '../types/audio-messages.js';
import { CONFIG, devLog } from '../config/flags-runtime.js';
import { MOCK_USER, mockDB, mockAudioDB } from '../data/mock-data.js';

const API_URL = CONFIG.API_URL;

// ─── Storage ────────────────────────────────────────────────────────────────

function getToken() { return localStorage.getItem('authToken'); }
function setToken(token) { localStorage.setItem('authToken', token); }
function clearToken() { localStorage.removeItem('authToken'); }

// ─── Visitor ─────────────────────────────────────────────────────────────────
// Plain object mapping command strings to handler functions.
// Each handler receives the full message and returns the mock result.

const devVisitor = {
  auth_signup:        ()    => ({ token: MOCK_USER.token, user: { email: MOCK_USER.email } }),
  auth_login:         ()    => ({ token: MOCK_USER.token, user: { email: MOCK_USER.email } }),
  get_posts:          ()    => mockDB.getPosts(),
  create_post:        (msg) => { const { title, content, mood } = msg.payload.content; return mockDB.createPost(title, content, mood); },
  delete_post:        (msg) => mockDB.deletePost(msg.payload.content.postId),
  request_upload_url: (msg) => { const { filename, contentType } = msg.payload.content; return mockAudioDB.requestUploadUrl(filename, contentType); },
  create_audio_post:  (msg) => { const c = msg.payload.content; return mockAudioDB.createAudioPost(c.title, c.audioKey, c.audioUrl, c.duration, c.mimeType, c.fileSize); },
  get_audio_posts:    ()    => mockAudioDB.getAudioPosts(),
  delete_audio_post:  (msg) => mockAudioDB.deleteAudioPost(msg.payload.content.entryId),
};

function visitMessage(message, visitor) {
  const handler = visitor[message.command];
  return handler ? handler(message) : Promise.resolve({ success: true });
}

// ─── Transports ──────────────────────────────────────────────────────────────

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

function sendMessage(message, requiresAuth = true) {
  return CONFIG.DEV ? devTransport(message) : httpTransport(message, requiresAuth);
}

// ─── Auth API ───────────────────────────────────────────────────────────────

export async function signup(email, password) {
  const data = await sendMessage(signupMessage(email, password), false);
  setToken(data.token);
  return data;
}

export async function login(email, password) {
  const data = await sendMessage(loginMessage(email, password), false);
  setToken(data.token);
  return data;
}

export function logout() { clearToken(); }
export function isLoggedIn() { return !!getToken(); }

// ─── Posts API ──────────────────────────────────────────────────────────────

export async function getPosts(email = null) {
  return sendMessage(getPostsMessage(email));
}

export async function createPost(title, content, mood = null) {
  return sendMessage(createPostMessage(title, content, mood));
}

export async function deletePost(postId, timestamp) {
  const message = deletePostMessage(postId);
  message.payload.content.timestamp = timestamp;
  return sendMessage(message);
}

// ─── Audio API ───────────────────────────────────────────────────────────────

export async function getAudioPosts() {
  return sendMessage(getAudioPostsMessage(), false);
}

export async function requestUploadUrl(filename, contentType, duration, fileSize) {
  return sendMessage(requestUploadUrlMessage(filename, contentType, duration, fileSize));
}

export async function uploadAudioToS3(uploadUrl, blob, mimeType) {
  if (uploadUrl === 'mock://upload') return;
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': mimeType },
  });
  if (!res.ok) throw new Error('S3 upload failed: ' + res.status);
}

export async function createAudioPost(title, audioKey, audioUrl, duration, mimeType, fileSize) {
  return sendMessage(createAudioPostMessage(title, audioKey, audioUrl, duration, mimeType, fileSize));
}

export async function deleteAudioPost(entryId, createdAt) {
  return sendMessage(deleteAudioPostMessage(entryId, createdAt));
}

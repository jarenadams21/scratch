import {
  createPostMessage,
  getPostsMessage,
  deletePostMessage,
  updatePostVisibilityMessage,
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
import {
  getTraitsMessage,
  setTraitMessage,
  getMealEntriesMessage,
  upsertMealEntryMessage,
  deleteMealEntryMessage,
  getProfilesMessage,
  requestImageUploadUrlMessage,
  attachMealImageMessage,
  detachMealImageMessage,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE,
} from '../types/feature-messages.js';
import { CONFIG, devLog } from '../config/flags-runtime.js';
import { MOCK_USER, mockDB, mockAudioDB, mockFeatureDB } from '../data/mock-data.js';

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
  create_post:        (msg) => { const { title, content, mood, visibility } = msg.payload.content; return mockDB.createPost(title, content, mood, visibility); },
  delete_post:        (msg) => mockDB.deletePost(msg.payload.content.postId),
  update_post_visibility: (msg) => { const { postId, visibility } = msg.payload.content; return mockDB.updateVisibility(postId, visibility); },
  request_upload_url: (msg) => { const { filename, contentType } = msg.payload.content; return mockAudioDB.requestUploadUrl(filename, contentType); },
  create_audio_post:  (msg) => { const c = msg.payload.content; return mockAudioDB.createAudioPost(c.title, c.audioKey, c.audioUrl, c.duration, c.mimeType, c.fileSize); },
  get_audio_posts:    ()    => mockAudioDB.getAudioPosts(),
  delete_audio_post:  (msg) => mockAudioDB.deleteAudioPost(msg.payload.content.entryId),
  get_traits:         ()    => mockFeatureDB.getTraits(),
  set_trait:          (msg) => mockFeatureDB.setTrait(msg.payload.content.trait, msg.payload.content.value),
  get_meal_entries:   (msg) => mockFeatureDB.getMealEntries(msg.payload.content.startDate, msg.payload.content.endDate),
  upsert_meal_entry:  (msg) => mockFeatureDB.upsertMealEntry(MOCK_USER.email, msg.payload.content.date, msg.payload.content.text),
  delete_meal_entry:  (msg) => mockFeatureDB.deleteMealEntry(MOCK_USER.email, msg.payload.content.date),
  get_profiles:       (msg) => mockFeatureDB.getProfiles(msg.payload.content.emails),
  request_image_upload_url: (msg) => { const c = msg.payload.content; return mockFeatureDB.requestImageUploadUrl(c.filename, c.contentType); },
  attach_meal_image:  (msg) => { const c = msg.payload.content; return mockFeatureDB.attachMealImage(MOCK_USER.email, c.date, c.image); },
  detach_meal_image:  (msg) => { const c = msg.payload.content; return mockFeatureDB.detachMealImage(MOCK_USER.email, c.date, c.imageKey); },
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

export async function createPost(title, content, mood = null, visibility = 'public') {
  return sendMessage(createPostMessage(title, content, mood, visibility));
}

export async function deletePost(postId, timestamp) {
  const message = deletePostMessage(postId);
  message.payload.content.timestamp = timestamp;
  return sendMessage(message);
}

export async function updatePostVisibility(postId, timestamp, visibility, author) {
  return sendMessage(updatePostVisibilityMessage(postId, timestamp, visibility, author));
}

// ─── Audio API ───────────────────────────────────────────────────────────────

export async function getAudioPosts() {
  return sendMessage(getAudioPostsMessage());
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

// ─── Feature Traits ─────────────────────────────────────────────────────────

export async function getTraits() {
  return sendMessage(getTraitsMessage());
}

export async function setTrait(trait, value) {
  return sendMessage(setTraitMessage(trait, value));
}

// ─── Shared Meal Calendar ───────────────────────────────────────────────────

export async function getMealEntries(startDate, endDate) {
  return sendMessage(getMealEntriesMessage(startDate, endDate));
}

export async function upsertMealEntry(date, text) {
  return sendMessage(upsertMealEntryMessage(date, text));
}

export async function deleteMealEntry(date) {
  return sendMessage(deleteMealEntryMessage(date));
}

// ─── Profiles (display name + color) ────────────────────────────────────────

export async function getProfiles(emails) {
  return sendMessage(getProfilesMessage(emails), false); // public read
}

// ─── Meal Calendar Images ───────────────────────────────────────────────────

export async function requestImageUploadUrl(filename, contentType) {
  return sendMessage(requestImageUploadUrlMessage(filename, contentType));
}

export async function attachMealImage(date, image) {
  return sendMessage(attachMealImageMessage(date, image));
}

export async function detachMealImage(date, imageKey) {
  return sendMessage(detachMealImageMessage(date, imageKey));
}

// Composes the full upload flow for a single image. Validates first so we
// don't even ask the server for a presigned URL on rejected files. Returns
// the persisted metadata (or throws). Caller is responsible for triggering
// a UI refresh (e.g. mealLoader.reload()) after success.
export async function uploadMealImage(date, file) {
  if (!(file instanceof Blob)) throw new Error('Invalid file');
  const type = (file.type || '').toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(type)) {
    throw new Error('Invalid file type — pick a JPEG, PNG, WebP, GIF, or HEIC');
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error(`File too large (max ${Math.floor(MAX_IMAGE_SIZE / 1024 / 1024)}MB)`);
  }

  const filename = (file.name || `image-${Date.now()}.jpg`);
  const presigned = await requestImageUploadUrl(filename, type);

  let finalImageUrl = presigned.imageUrl;
  if (presigned.uploadUrl === 'mock://upload') {
    // Dev path: replace the placeholder with a data URL so <img src=...>
    // actually renders. Production never reaches this branch.
    finalImageUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });
  } else {
    const res = await fetch(presigned.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': type },
    });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  }

  return await attachMealImage(date, {
    imageKey: presigned.imageKey,
    imageUrl: finalImageUrl,
    mimeType: type,
    size: file.size,
  });
}

// Returns the authenticated user's email if a token is present.
// Decodes the JWT payload — used to attribute meal entries client-side.
export function currentUserEmail() {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.userId || null;
  } catch {
    return CONFIG.DEV ? MOCK_USER.email : null;
  }
}

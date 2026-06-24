// Mock data for DEV mode
// All network operations return this data when FLAGS.DEV is enabled
import { CONFIG } from '../config/flags-runtime.js';

export const MOCK_USER = {
  email: CONFIG.MOCK_USER,
  token: CONFIG.MOCK_TOKEN
};

export const MOCK_POSTS = [
  {
    entryId: 'mock-1',
    title: 'First Transmission',
    content: 'The machines hum in the darkness. Words appear on paper, one character at a time. This is how we document the present - with deliberate keystrokes and careful thought.',
    visibility: 'public',
    author: CONFIG.MOCK_USER,
    createdAt: new Date(2026, 3, 15, 10, 30).toISOString(),
    updatedAt: new Date(2026, 3, 15, 10, 30).toISOString(),
  },
  {
    entryId: 'mock-2',
    title: 'On Typography',
    content: 'Courier was designed in 1955 by Howard Kettler for IBM typewriters. Its monospaced glyphs ensure uniform horizontal spacing - a constraint that forces clarity in thought. Every letter carries equal weight.',
    visibility: 'public',
    author: CONFIG.MOCK_USER,
    createdAt: new Date(2026, 3, 20, 14, 15).toISOString(),
    updatedAt: new Date(2026, 3, 20, 14, 15).toISOString(),
  },
  {
    entryId: 'mock-3',
    title: 'Editorial Standards',
    content: 'Remove what does not serve the message. Black text on white paper. No decoration. No distraction. The content must speak for itself.',
    visibility: 'admins',
    author: CONFIG.MOCK_USER,
    createdAt: new Date(2026, 4, 1, 9, 0).toISOString(),
    updatedAt: new Date(2026, 4, 1, 9, 0).toISOString(),
  },
  {
    entryId: 'mock-4',
    title: 'Signal vs Noise',
    content: 'In an age of infinite feeds and constant updates, the journal represents a return to intentional broadcasting. One entry. One moment. One permanent record.',
    visibility: 'public',
    author: CONFIG.MOCK_USER,
    createdAt: new Date(2026, 4, 2, 11, 45).toISOString(),
    updatedAt: new Date(2026, 4, 2, 11, 45).toISOString(),
  },
  {
    entryId: 'mock-5',
    title: 'Quiet Sunday',
    content: 'Slept in, made eggs. The light through the window was the soft kind that only comes after rain.',
    visibility: 'public',  // legacy public — admin will flip this to private
    author: 'partner@example.com',
    createdAt: new Date(2026, 4, 4, 9, 30).toISOString(),
    updatedAt: new Date(2026, 4, 4, 9, 30).toISOString(),
  }
];

export const MOCK_AUDIO = [
  {
    entryId: 'mock-audio-1',
    title: 'Situation Report — April',
    audioKey: 'audio/mock-audio-1.mp3',
    audioUrl: '',
    mimeType: 'audio/mpeg',
    duration: 142,
    fileSize: 1138000,
    createdAt: new Date(2026, 3, 10, 9, 0).toISOString(),
    updatedAt: new Date(2026, 3, 10, 9, 0).toISOString(),
  },
  {
    entryId: 'mock-audio-2',
    title: 'Memorandum on Press Coverage',
    audioKey: 'audio/mock-audio-2.mp3',
    audioUrl: '',
    mimeType: 'audio/mpeg',
    duration: 87,
    fileSize: 696000,
    createdAt: new Date(2026, 3, 22, 14, 30).toISOString(),
    updatedAt: new Date(2026, 3, 22, 14, 30).toISOString(),
  },
];

let mockData = [...MOCK_POSTS];
let mockAudioData = [...MOCK_AUDIO];
let mockTraits = { calendar: true };
let mockMealEntries = [];

// In dev mode each "user" has their own traits document. Map email -> traits
// so the mock can answer get_profiles realistically.
const mockProfiles = {
  [CONFIG.MOCK_USER]: { displayName: 'Operator', displayColor: 'green' },
  'partner@example.com': { displayName: 'Partner', displayColor: 'indigo' },
};

// Mock database operations
export const mockDB = {
  getPosts: () => {
    return Promise.resolve([...mockData].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ));
  },
  
  createPost: (title, content, mood, visibility = 'public') => {
    const newPost = {
      entryId: `mock-${Date.now()}`,
      title,
      content,
      mood,
      visibility,
      author: MOCK_USER.email,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockData.unshift(newPost);
    return Promise.resolve(newPost);
  },

  deletePost: (postId) => {
    mockData = mockData.filter(post => post.entryId !== postId);
    return Promise.resolve({ message: 'Deleted' });
  },

  updateVisibility: (postId, visibility) => {
    const post = mockData.find(p => p.entryId === postId);
    if (!post) return Promise.reject(new Error('Not found'));
    post.visibility = visibility;
    post.updatedAt = new Date().toISOString();
    return Promise.resolve({ entryId: postId, visibility });
  },
  
  reset: () => {
    mockData = [...MOCK_POSTS];
  }
};

export const mockAudioDB = {
  getAudioPosts: () => {
    return Promise.resolve([...mockAudioData].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ));
  },

  createAudioPost: (title, audioKey, audioUrl, duration, mimeType, fileSize) => {
    const entry = {
      entryId: `mock-audio-${Date.now()}`,
      title,
      audioKey,
      audioUrl,
      mimeType,
      duration,
      fileSize,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockAudioData.unshift(entry);
    return Promise.resolve(entry);
  },

  deleteAudioPost: (entryId) => {
    mockAudioData = mockAudioData.filter(e => e.entryId !== entryId);
    return Promise.resolve({ message: 'Deleted' });
  },

  requestUploadUrl: (filename, contentType) => {
    return Promise.resolve({
      uploadUrl: 'mock://upload',
      audioKey: `audio/mock-${Date.now()}.${filename.split('.').pop()}`,
      audioUrl: '',
    });
  },

  reset: () => {
    mockAudioData = [...MOCK_AUDIO];
  }
};

export const mockFeatureDB = {
  getTraits: () => Promise.resolve({ traits: { ...mockTraits } }),

  setTrait: (trait, value) => {
    // Mirror the backend's per-trait shape.
    let next;
    if (trait === 'calendar') next = !!value;
    else if (trait === 'defaultVisibility' || trait === 'displayColor') next = value;
    else if (trait === 'displayName') next = String(value).trim();
    else next = value;
    mockTraits = { ...mockTraits, [trait]: next };
    // Also keep the in-memory profile for the mock user in sync so calendar
    // dots and post bylines reflect changes immediately in dev.
    if (trait === 'displayName' || trait === 'displayColor') {
      const me = MOCK_USER.email;
      mockProfiles[me] = { ...mockProfiles[me], [trait]: next };
    }
    return Promise.resolve({ traits: { ...mockTraits } });
  },

  getProfiles: (emails) => {
    const out = {};
    for (const e of (emails || [])) {
      out[e] = mockProfiles[e] || { displayName: 'Operator', displayColor: null };
    }
    return Promise.resolve({ profiles: out });
  },

  getMealEntries: (startDate, endDate) => {
    const items = mockMealEntries.filter(e => e.date >= startDate && e.date <= endDate);
    return Promise.resolve(items);
  },

  upsertMealEntry: (author, date, text) => {
    const idx = mockMealEntries.findIndex(e => e.date === date && e.author === author);
    const ts = new Date().toISOString();
    if (idx >= 0) {
      // Preserve images on text edit.
      mockMealEntries[idx] = { ...mockMealEntries[idx], text: text || '', updatedAt: ts };
    } else {
      mockMealEntries.push({ date, author, text: text || '', images: [], updatedAt: ts });
    }
    return Promise.resolve(mockMealEntries.find(e => e.date === date && e.author === author));
  },

  deleteMealEntry: (author, date) => {
    const idx = mockMealEntries.findIndex(e => e.date === date && e.author === author);
    if (idx < 0) return Promise.resolve({ message: 'Deleted' });
    const hasImages = (mockMealEntries[idx].images || []).length > 0;
    if (hasImages) {
      mockMealEntries[idx] = { ...mockMealEntries[idx], text: '', updatedAt: new Date().toISOString() };
    } else {
      mockMealEntries.splice(idx, 1);
    }
    return Promise.resolve({ message: 'Deleted' });
  },

  // ─── Mock image flow ─────────────────────────────────────────────────────
  // Caller (api.js uploadMealImage) generates a data URL from the chosen file
  // and passes it as image.imageUrl, so the dev UI can actually display the
  // photo without ever touching S3.

  requestImageUploadUrl: (filename, contentType) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const ext = String(filename || '').split('.').pop().toLowerCase().slice(0, 8) || 'jpg';
    const imageKey = `meal-images/${id}.${ext}`;
    return Promise.resolve({
      uploadUrl: 'mock://upload',
      imageKey,
      imageUrl: `mock://${imageKey}`, // overwritten by the caller in dev
    });
  },

  attachMealImage: (author, date, image) => {
    const meta = {
      imageKey: image.imageKey,
      imageUrl: image.imageUrl,
      mimeType: image.mimeType || null,
      size: typeof image.size === 'number' ? image.size : null,
      uploadedAt: new Date().toISOString(),
    };
    const idx = mockMealEntries.findIndex(e => e.date === date && e.author === author);
    if (idx >= 0) {
      mockMealEntries[idx] = {
        ...mockMealEntries[idx],
        images: [...(mockMealEntries[idx].images || []), meta],
        updatedAt: meta.uploadedAt,
      };
    } else {
      mockMealEntries.push({
        date, author, text: '', images: [meta], updatedAt: meta.uploadedAt,
      });
    }
    return Promise.resolve(meta);
  },

  detachMealImage: (author, date, imageKey) => {
    const idx = mockMealEntries.findIndex(e => e.date === date && e.author === author);
    if (idx < 0) return Promise.resolve({ removed: 0 });
    const before = mockMealEntries[idx].images || [];
    const after = before.filter(i => i.imageKey !== imageKey);
    if (after.length === before.length) return Promise.resolve({ removed: 0 });
    if (after.length === 0 && !mockMealEntries[idx].text) {
      mockMealEntries.splice(idx, 1);
    } else {
      mockMealEntries[idx] = { ...mockMealEntries[idx], images: after, updatedAt: new Date().toISOString() };
    }
    return Promise.resolve({ removed: 1 });
  },
};

// ─── Inspiration board mock ───────────────────────────────────────────────────
// Curated image boards + cross-cutting facets. Seed images are inline SVG data
// URLs so the grid renders fully offline (no network, no S3). Uploaded images
// arrive as real data URLs from the FileReader path in api.js.

function _swatch(label, bg, fg) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="520">` +
    `<rect width="400" height="520" fill="${bg}"/>` +
    `<rect x="14" y="14" width="372" height="492" fill="none" stroke="${fg}" stroke-width="2"/>` +
    `<text x="200" y="270" font-family="Courier New, monospace" font-size="26" letter-spacing="3" ` +
    `fill="${fg}" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

let _inspoSeq = 100;
function _inspoId() { return `inspo-${++_inspoSeq}`; }
function _boardId() { return `board-${++_inspoSeq}`; }

let mockInspoBoards = [
  { id: 'board-1', name: 'Summer 2026', visibility: 'public',  createdAt: new Date(2026, 4, 1).toISOString() },
  { id: 'board-2', name: 'Wedding guest', visibility: 'admins', createdAt: new Date(2026, 4, 3).toISOString() },
  { id: 'board-3', name: 'Workwear', visibility: 'public',     createdAt: new Date(2026, 4, 6).toISOString() },
];

let mockInspos = [
  {
    id: 'inspo-1', imageKey: 'inspo/seed-1.svg', imageUrl: _swatch('LINEN SET', '#c9bfa8', '#3a3527'),
    mimeType: 'image/svg+xml', size: null, title: 'Linen co-ord', note: 'For the garden venue.',
    boards: ['board-1', 'board-2'], scenarios: ['wedding guest', 'brunch'], seasons: ['hot', 'summer'],
    colors: ['neutrals', 'earth tones'], tags: ['old money', 'relaxed'],
    createdAt: new Date(2026, 4, 4).toISOString(), updatedAt: new Date(2026, 4, 4).toISOString(),
  },
  {
    id: 'inspo-2', imageKey: 'inspo/seed-2.svg', imageUrl: _swatch('SLIP DRESS', '#3b2f3a', '#d8c7d2'),
    mimeType: 'image/svg+xml', size: null, title: 'Black slip', note: '',
    boards: ['board-2'], scenarios: ['night out', 'date night'], seasons: ['warm', 'summer'],
    colors: ['black', 'monochrome'], tags: ['minimal', 'sleek'],
    createdAt: new Date(2026, 4, 5).toISOString(), updatedAt: new Date(2026, 4, 5).toISOString(),
  },
  {
    id: 'inspo-3', imageKey: 'inspo/seed-3.svg', imageUrl: _swatch('TRENCH', '#a89878', '#2c2418'),
    mimeType: 'image/svg+xml', size: null, title: 'Classic trench', note: 'Layer over knit.',
    boards: ['board-3'], scenarios: ['work', 'travel'], seasons: ['cool', 'rainy', 'fall', 'layering'],
    colors: ['neutrals', 'earth tones'], tags: ['timeless'],
    createdAt: new Date(2026, 4, 7).toISOString(), updatedAt: new Date(2026, 4, 7).toISOString(),
  },
  {
    id: 'inspo-4', imageKey: 'inspo/seed-4.svg', imageUrl: _swatch('DENIM + TEE', '#4a6076', '#e8eef2'),
    mimeType: 'image/svg+xml', size: null, title: 'Off-duty denim', note: '',
    boards: ['board-1'], scenarios: ['errands', 'lounge'], seasons: ['warm', 'spring'],
    colors: ['denim', 'neutrals'], tags: ['easy', 'casual'],
    createdAt: new Date(2026, 4, 8).toISOString(), updatedAt: new Date(2026, 4, 8).toISOString(),
  },
  {
    id: 'inspo-5', imageKey: 'inspo/seed-5.svg', imageUrl: _swatch('BOLD SUIT', '#8a2f2f', '#f2e3d0'),
    mimeType: 'image/svg+xml', size: null, title: 'Red power suit', note: 'Statement for pitches.',
    boards: ['board-3'], scenarios: ['work', 'night out'], seasons: ['cool', 'fall'],
    colors: ['bold'], tags: ['power', 'tailored'],
    createdAt: new Date(2026, 4, 9).toISOString(), updatedAt: new Date(2026, 4, 9).toISOString(),
  },
  {
    id: 'inspo-6', imageKey: 'inspo/seed-6.svg', imageUrl: _swatch('PASTEL KNIT', '#cdb4d6', '#3a2c40'),
    mimeType: 'image/svg+xml', size: null, title: 'Lilac knit', note: '',
    boards: ['board-1', 'board-3'], scenarios: ['work', 'brunch'], seasons: ['cool', 'spring', 'layering'],
    colors: ['pastel'], tags: ['soft', 'romantic'],
    createdAt: new Date(2026, 4, 10).toISOString(), updatedAt: new Date(2026, 4, 10).toISOString(),
  },
];

export const mockInspoDB = {
  getBoards: () => Promise.resolve(
    [...mockInspoBoards].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  ),

  createBoard: (name) => {
    const clean = String(name || '').trim();
    if (!clean) return Promise.reject(new Error('Board name required'));
    // New galleries start private; the owner opts them into public.
    const board = { id: _boardId(), name: clean, visibility: 'admins', createdAt: new Date().toISOString() };
    mockInspoBoards.push(board);
    return Promise.resolve(board);
  },

  updateBoard: (id, patch = {}) => {
    const idx = mockInspoBoards.findIndex(b => b.id === id);
    if (idx < 0) return Promise.reject(new Error('Not found'));
    const next = { ...mockInspoBoards[idx] };
    if (typeof patch.name === 'string' && patch.name.trim()) next.name = patch.name.trim();
    if (patch.visibility === 'public' || patch.visibility === 'admins') next.visibility = patch.visibility;
    mockInspoBoards[idx] = next;
    return Promise.resolve(next);
  },

  deleteBoard: (id) => {
    mockInspoBoards = mockInspoBoards.filter(b => b.id !== id);
    // Detach the board from any items that referenced it (items survive).
    mockInspos = mockInspos.map(it =>
      (it.boards || []).includes(id)
        ? { ...it, boards: it.boards.filter(b => b !== id) }
        : it
    );
    return Promise.resolve({ message: 'Deleted' });
  },

  getInspos: () => Promise.resolve(
    [...mockInspos].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  ),

  createInspo: (image, meta = {}) => {
    const item = {
      id: _inspoId(),
      imageKey: image.imageKey,
      imageUrl: image.imageUrl,
      mimeType: image.mimeType || null,
      size: typeof image.size === 'number' ? image.size : null,
      title: meta.title || '',
      note: meta.note || '',
      boards: Array.isArray(meta.boards) ? meta.boards : [],
      scenarios: Array.isArray(meta.scenarios) ? meta.scenarios : [],
      seasons: Array.isArray(meta.seasons) ? meta.seasons : [],
      colors: Array.isArray(meta.colors) ? meta.colors : [],
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockInspos.unshift(item);
    return Promise.resolve(item);
  },

  updateInspo: (id, patch = {}) => {
    const idx = mockInspos.findIndex(it => it.id === id);
    if (idx < 0) return Promise.reject(new Error('Not found'));
    mockInspos[idx] = { ...mockInspos[idx], ...patch, updatedAt: new Date().toISOString() };
    return Promise.resolve(mockInspos[idx]);
  },

  deleteInspo: (id) => {
    mockInspos = mockInspos.filter(it => it.id !== id);
    return Promise.resolve({ message: 'Deleted' });
  },
};

// ─── Outfit builder mock ──────────────────────────────────────────────────────
// Outfits reference inspo images by slot. Refs snapshot {imageId, imageUrl,
// title} so a saved outfit still renders even if the source image is later
// retagged or removed.

function _refOf(id) {
  const it = mockInspos.find(x => x.id === id);
  return it ? { imageId: it.id, imageUrl: it.imageUrl, title: it.title || '' } : null;
}

let _outfitSeq = 200;
function _outfitId() { return `outfit-${++_outfitSeq}`; }

function _cloneSlots(slots = {}) {
  const out = { accessories: [...(slots.accessories || [])] };
  for (const k of Object.keys(slots)) {
    if (k !== 'accessories') out[k] = slots[k] || null;
  }
  return out;
}

let mockOutfits = [
  {
    id: 'outfit-1',
    name: 'Garden party',
    visibility: 'public',
    slots: {
      head: null, eyewear: _refOf('inspo-2'), outerwear: null,
      top: _refOf('inspo-1'), belt: null, bottom: _refOf('inspo-4'),
      sock: null, shoe: _refOf('inspo-3'),
      accessories: [_refOf('inspo-6')].filter(Boolean),
    },
    createdAt: new Date(2026, 4, 12).toISOString(),
    updatedAt: new Date(2026, 4, 12).toISOString(),
  },
];

export const mockOutfitDB = {
  getOutfits: () => Promise.resolve(
    [...mockOutfits].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  ),

  createOutfit: (name, slots) => {
    const outfit = {
      id: _outfitId(),
      name: String(name || '').trim() || 'Untitled outfit',
      visibility: 'admins',          // new outfits start private
      slots: _cloneSlots(slots),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockOutfits.unshift(outfit);
    return Promise.resolve(outfit);
  },

  updateOutfit: (id, patch = {}) => {
    const idx = mockOutfits.findIndex(o => o.id === id);
    if (idx < 0) return Promise.reject(new Error('Not found'));
    const next = { ...mockOutfits[idx], updatedAt: new Date().toISOString() };
    if (typeof patch.name === 'string') next.name = patch.name.trim() || next.name;
    if (patch.visibility === 'public' || patch.visibility === 'admins') next.visibility = patch.visibility;
    if (patch.slots) next.slots = _cloneSlots(patch.slots);
    mockOutfits[idx] = next;
    return Promise.resolve(next);
  },

  deleteOutfit: (id) => {
    mockOutfits = mockOutfits.filter(o => o.id !== id);
    return Promise.resolve({ message: 'Deleted' });
  },
};

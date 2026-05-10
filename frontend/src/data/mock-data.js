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
    const entry = { date, author, text: text || '', updatedAt: new Date().toISOString() };
    if (idx >= 0) mockMealEntries[idx] = entry;
    else mockMealEntries.push(entry);
    return Promise.resolve(entry);
  },

  deleteMealEntry: (author, date) => {
    mockMealEntries = mockMealEntries.filter(e => !(e.date === date && e.author === author));
    return Promise.resolve({ message: 'Deleted' });
  },
};

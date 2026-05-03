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
    createdAt: new Date(2026, 3, 15, 10, 30).toISOString(),
    updatedAt: new Date(2026, 3, 15, 10, 30).toISOString(),
  },
  {
    entryId: 'mock-2',
    title: 'On Typography',
    content: 'Courier was designed in 1955 by Howard Kettler for IBM typewriters. Its monospaced glyphs ensure uniform horizontal spacing - a constraint that forces clarity in thought. Every letter carries equal weight.',
    createdAt: new Date(2026, 3, 20, 14, 15).toISOString(),
    updatedAt: new Date(2026, 3, 20, 14, 15).toISOString(),
  },
  {
    entryId: 'mock-3',
    title: 'Editorial Standards',
    content: 'Remove what does not serve the message. Black text on white paper. No decoration. No distraction. The content must speak for itself.',
    createdAt: new Date(2026, 4, 1, 9, 0).toISOString(),
    updatedAt: new Date(2026, 4, 1, 9, 0).toISOString(),
  },
  {
    entryId: 'mock-4',
    title: 'Signal vs Noise',
    content: 'In an age of infinite feeds and constant updates, the journal represents a return to intentional broadcasting. One entry. One moment. One permanent record.',
    createdAt: new Date(2026, 4, 2, 11, 45).toISOString(),
    updatedAt: new Date(2026, 4, 2, 11, 45).toISOString(),
  }
];

let mockData = [...MOCK_POSTS];

// Mock database operations
export const mockDB = {
  getPosts: () => {
    return Promise.resolve([...mockData].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ));
  },
  
  createPost: (title, content, mood) => {
    const newPost = {
      entryId: `mock-${Date.now()}`,
      title,
      content,
      mood,
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
  
  reset: () => {
    mockData = [...MOCK_POSTS];
  }
};

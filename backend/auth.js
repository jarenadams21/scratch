import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createUser, getUserByEmail } from './db.js';
import { config } from './config.js';

const SALT_ROUNDS = 10;

// ─── User Registration ──────────────────────────────────────────────────────

export async function signup(email, password) {
  // Check if user exists
  const existing = await getUserByEmail(email);
  if (existing) {
    throw new Error('User already exists');
  }
  
  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  
  // Create user
  const user = await createUser(email, passwordHash);
  
  // Generate token
  const token = jwt.sign(
    { userId: email },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );
  
  return { token, user: { email } };
}

// ─── User Login ─────────────────────────────────────────────────────────────

export async function login(email, password) {
  // Get user
  const user = await getUserByEmail(email);
  if (!user) {
    throw new Error('Invalid credentials');
  }
  
  // Verify password
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new Error('Invalid credentials');
  }
  
  // Generate token
  const token = jwt.sign(
    { userId: email },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );
  
  return { token, user: { email } };
}

// ─── Token Verification ─────────────────────────────────────────────────────

export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    return decoded.userId;
  } catch (error) {
    return null;
  }
}

// ─── Middleware Helper ──────────────────────────────────────────────────────

export function extractUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.slice(7);
  return verifyToken(token);
}

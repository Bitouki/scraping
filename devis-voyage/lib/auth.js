import { randomBytes, timingSafeEqual } from 'node:crypto';

const EMAIL = process.env.APP_EMAIL || 'info@grainedevoyageur.com';
const PASSWORD = process.env.APP_PASSWORD || 'GraineDeVoyageur2026';
const SESSION_MS = 12 * 60 * 60 * 1000;
const COOKIE = 'gdv_session';

const sessions = new Map();

function equals(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function login(email, password) {
  if (!equals(String(email).trim().toLowerCase(), EMAIL.toLowerCase())) return null;
  if (!equals(password, PASSWORD)) return null;
  const token = randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_MS);
  return token;
}

export function logout(token) {
  sessions.delete(token);
}

export function readToken(req) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function isAuthenticated(req) {
  const token = readToken(req);
  if (!token) return false;
  const expiry = sessions.get(token);
  if (!expiry) return false;
  if (expiry < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export function sessionCookie(token) {
  const maxAge = Math.floor(SESSION_MS / 1000);
  return `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function clearCookie() {
  return `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

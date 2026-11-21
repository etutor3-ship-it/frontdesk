import bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { db } from "./db";

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}

const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateSessionId(): string {
  return crypto.randomBytes(32).toString("hex");
}

export interface SessionUser {
  id: number;
  username: string;
}

export function createSession(userId: number): { sessionId: string; expiresAt: string } {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
  ).run(sessionId, userId, expiresAt);
  return { sessionId, expiresAt };
}

export function getSession(sessionId: string): SessionUser | null {
  const row = db.prepare(
    `SELECT s.id, s.user_id, s.expires_at, u.username
     FROM sessions s
     JOIN staff_users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > datetime('now')`
  ).get(sessionId) as { user_id: number; username: string } | undefined;

  if (!row) return null;
  return { id: row.user_id, username: row.username };
}

export function destroySession(sessionId: string): void {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

export function cleanupExpiredSessions(): void {
  db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
}

export function createStaffUser(username: string, password: string): void {
  const existing = db.prepare("SELECT id FROM staff_users WHERE username = ?").get(username);
  if (existing) {
    throw new Error("Staff user already exists");
  }
  const passwordHash = hashPasswordSync(password);
  db.prepare("INSERT INTO staff_users (username, password_hash) VALUES (?, ?)").run(
    username,
    passwordHash
  );
}

export function verifyStaffUser(username: string, password: string): SessionUser | null {
  const row = db.prepare(
    "SELECT id, username, password_hash FROM staff_users WHERE username = ?"
  ).get(username) as { id: number; username: string; password_hash: string } | undefined;

  if (!row) return null;
  const valid = bcrypt.compareSync(password, row.password_hash);
  if (!valid) return null;
  return { id: row.id, username: row.username };
}

// Synchronous wrapper for bcrypt.hash (used during setup)
function hashPasswordSync(password: string): string {
  return bcrypt.hashSync(password, 12);
}

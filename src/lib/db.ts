import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "frontdesk.db");

// Ensure data directory exists
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent access and data integrity
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Initialize database schema
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS staff_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES staff_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      question TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'needs human',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ticket_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT NOT NULL,
      from_role TEXT NOT NULL CHECK (from_role IN ('staff', 'patient')),
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_id ON sessions(id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_patient ON tickets(patient_id);
    CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket ON ticket_replies(ticket_id);
  `);
}

type JsonTicket = {
  id?: string;
  patientId?: string;
  question?: string;
  status?: string;
  createdAt?: string;
  replies?: Array<{ from?: string; text?: string; at?: string }>;
};

// Migration: import existing tickets.json into the database
export function migrateTicketsFromJson() {
  const jsonPath = path.join(process.cwd(), "data", "tickets.json");
  let existing: JsonTicket[] = [];
  try {
    existing = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  } catch {
    return { migrated: 0, skipped: 0 };
  }

  if (!Array.isArray(existing) || existing.length === 0) {
    return { migrated: 0, skipped: 0 };
  }

  const count = db.prepare(
    "SELECT COUNT(*) as c FROM tickets"
  ).get() as { c: number };
  if (count.c > 0) {
    return { migrated: 0, skipped: existing.length };
  }

  const insertTicket = db.prepare(
    "INSERT OR IGNORE INTO tickets (id, patient_id, question, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const insertReply = db.prepare(
    "INSERT OR IGNORE INTO ticket_replies (ticket_id, from_role, text, created_at) VALUES (?, ?, ?, ?)"
  );

  const transaction = db.transaction((tickets: JsonTicket[]) => {
    let migrated = 0;
    for (const t of tickets) {
      insertTicket.run(
        t.id,
        t.patientId || "anon",
        t.question,
        t.status,
        t.createdAt || new Date().toISOString(),
        t.createdAt || new Date().toISOString()
      );
      migrated++;
      for (const r of (t.replies || [])) {
        insertReply.run(t.id, r.from, r.text, r.at || new Date().toISOString());
      }
    }
    return migrated;
  });

  const migrated = transaction(existing);
  return { migrated, skipped: 0 };
}

export function closeDb() {
  db.close();
}

// Auto-initialize on first import
initDb();
migrateTicketsFromJson();

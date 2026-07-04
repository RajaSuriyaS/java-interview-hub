/* ============================================================
   SQLite persistence (built-in node:sqlite — no native deps).
   Stores users and their per-module progress (status + notes).
   DB file lives at $DATA_DIR/jih.db (default ./data) — mount a
   volume there in production so progress survives redeploys.
   ============================================================ */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const STATUSES = new Set(['not_started', 'in_progress', 'completed']);

let db = null;

export function initDb() {
  mkdirSync(DATA_DIR, { recursive: true });
  const file = join(DATA_DIR, 'jih.db');
  db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      email      TEXT,
      name       TEXT,
      picture    TEXT,
      created_at INTEGER,
      last_login INTEGER
    );
    CREATE TABLE IF NOT EXISTS module_status (
      user_id    TEXT NOT NULL,
      module_id  TEXT NOT NULL,
      status     TEXT NOT NULL,
      updated_at INTEGER,
      PRIMARY KEY (user_id, module_id)
    );
    CREATE TABLE IF NOT EXISTS module_notes (
      user_id    TEXT NOT NULL,
      module_id  TEXT NOT NULL,
      note       TEXT NOT NULL,
      updated_at INTEGER,
      PRIMARY KEY (user_id, module_id)
    );
    CREATE TABLE IF NOT EXISTS card_marks (
      user_id    TEXT NOT NULL,
      card_key   TEXT NOT NULL,   -- '<moduleId>:<hash-of-question>'
      mark       TEXT NOT NULL,   -- 'again' (review queue) | 'known'
      updated_at INTEGER,
      PRIMARY KEY (user_id, card_key)
    );
  `);
  return file;
}

export function dbReady() { return !!db; }

export function upsertUser(u) {
  const now = Date.now();
  db.prepare(`
    INSERT INTO users (id, email, name, picture, created_at, last_login)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email, name = excluded.name,
      picture = excluded.picture, last_login = excluded.last_login
  `).run(u.id, u.email || '', u.name || '', u.picture || '', now, now);
}

const MARKS = new Set(['again', 'known']);

// Returns { status: { moduleId: status }, notes: { moduleId: note }, cards: { cardKey: mark } }
export function getState(userId) {
  const status = {}, notes = {}, cards = {};
  for (const r of db.prepare('SELECT module_id, status FROM module_status WHERE user_id = ?').all(userId)) {
    status[r.module_id] = r.status;
  }
  for (const r of db.prepare('SELECT module_id, note FROM module_notes WHERE user_id = ?').all(userId)) {
    notes[r.module_id] = r.note;
  }
  for (const r of db.prepare('SELECT card_key, mark FROM card_marks WHERE user_id = ?').all(userId)) {
    cards[r.card_key] = r.mark;
  }
  return { status, notes, cards };
}

// Full replace of a user's progress (the client always posts its complete state).
export function replaceState(userId, { status = {}, notes = {}, cards = {} } = {}) {
  const now = Date.now();
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM module_status WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM module_notes  WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM card_marks    WHERE user_id = ?').run(userId);

    const insStatus = db.prepare('INSERT INTO module_status (user_id, module_id, status, updated_at) VALUES (?, ?, ?, ?)');
    for (const [moduleId, st] of Object.entries(status)) {
      if (STATUSES.has(st) && st !== 'not_started') insStatus.run(userId, moduleId, st, now);
    }
    const insNote = db.prepare('INSERT INTO module_notes (user_id, module_id, note, updated_at) VALUES (?, ?, ?, ?)');
    for (const [moduleId, note] of Object.entries(notes)) {
      if (typeof note === 'string' && note.trim()) insNote.run(userId, moduleId, note, now);
    }
    const insCard = db.prepare('INSERT INTO card_marks (user_id, card_key, mark, updated_at) VALUES (?, ?, ?, ?)');
    for (const [key, mark] of Object.entries(cards)) {
      if (MARKS.has(mark)) insCard.run(userId, key, mark, now);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

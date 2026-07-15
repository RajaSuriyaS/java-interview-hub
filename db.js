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
      id              TEXT PRIMARY KEY,
      email           TEXT,
      name            TEXT,
      picture         TEXT,
      approval_status TEXT DEFAULT 'pending',   -- 'pending' | 'approved' | 'rejected'
      created_at      INTEGER,
      last_login      INTEGER
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

  // ---- migration: add approval_status to pre-existing DBs, grandfathering
  //      everyone who was already a user so nobody is locked out on upgrade.
  const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!cols.includes('approval_status')) {
    db.exec("ALTER TABLE users ADD COLUMN approval_status TEXT DEFAULT 'pending'");
    db.exec("UPDATE users SET approval_status = 'approved'"); // one-time: grandfather existing users
    console.log('[db] migrated users.approval_status (existing users grandfathered as approved)');
  }
  // ---- migration: subscription/entitlement columns (Wave 1 monetization) ----
  const addCol = (name, ddl) => { if (!cols.includes(name)) db.exec(`ALTER TABLE users ADD COLUMN ${ddl}`); };
  if (!cols.includes('sub_status')) {
    addCol('sub_status',   "sub_status   TEXT DEFAULT 'none'");   // 'none' | 'active' | 'canceled' | 'past_due'
    addCol('sub_plan',     "sub_plan     TEXT");                  // e.g. 'monthly' | 'yearly' | 'comp'
    addCol('sub_until',    "sub_until    INTEGER");               // epoch ms; null = no expiry (comped)
    addCol('sub_provider', "sub_provider TEXT");                  // 'stripe' | 'razorpay' | 'admin'
    console.log('[db] migrated users subscription columns');
  }
  return file;
}

const APPROVALS = new Set(['pending', 'approved', 'rejected']);

// Admin console: list all users with their approval + subscription status.
export function listUsers() {
  return db.prepare(`
    SELECT id, email, name, picture, approval_status AS status,
           sub_status, sub_plan, sub_until, sub_provider, created_at, last_login
    FROM users ORDER BY created_at DESC
  `).all();
}

// ---- Subscription / entitlement ----
const SUB_STATUSES = new Set(['none', 'active', 'canceled', 'past_due']);

export function getEntitlement(userId) {
  const r = db.prepare('SELECT sub_status AS status, sub_plan AS plan, sub_until AS until, sub_provider AS provider FROM users WHERE id = ?').get(userId);
  return r || { status: 'none', plan: null, until: null, provider: null };
}

// A user is premium when their subscription is active and not expired.
export function isPremium(userId) {
  const e = getEntitlement(userId);
  if (e.status !== 'active') return false;
  return e.until == null || e.until > Date.now();
}

export function setSubscription(userId, { status, plan = null, until = null, provider = null } = {}) {
  if (!SUB_STATUSES.has(status)) throw new Error('invalid subscription status: ' + status);
  const info = db.prepare(
    'UPDATE users SET sub_status = ?, sub_plan = ?, sub_until = ?, sub_provider = ? WHERE id = ?'
  ).run(status, plan, until, provider, userId);
  return info.changes > 0;
}

export function getApproval(userId) {
  const r = db.prepare('SELECT approval_status AS status FROM users WHERE id = ?').get(userId);
  return r ? r.status : null;
}

export function setApproval(userId, status) {
  if (!APPROVALS.has(status)) throw new Error('invalid approval status: ' + status);
  const info = db.prepare('UPDATE users SET approval_status = ? WHERE id = ?').run(status, userId);
  return info.changes > 0;
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

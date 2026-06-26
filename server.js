import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { initDb, dbReady, upsertUser, getState, replaceState } from './db.js';
import { mountAuth, requireAuth, authConfigured, currentUser, loginWallEnabled } from './auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3030;

// ---- Database (progress persistence) — non-fatal: the study content still
//      works without it (clients fall back to localStorage-only). ----
let DB_OK = false;
try {
  const file = initDb();
  DB_OK = true;
  console.log(`[db] SQLite ready at ${file}`);
} catch (e) {
  console.error('[db] init failed — server-side progress sync disabled:', e.message);
}
console.log(`[auth] Google login ${authConfigured() ? 'enabled' : 'NOT configured (localStorage-only mode)'}`);
console.log(`[auth] Login wall ${loginWallEnabled() ? 'ON — sign-in required to use the app' : 'off (open access)'}`);

// Login page shown to signed-out visitors when the wall is on.
const loginPath = join(__dirname, 'public', 'login.html');

// Cache-busting version: git short hash of THIS repo, else mtime of curriculum.js
// cwd must be __dirname so git reads the right repo (not the shell's CWD)
function buildVersion() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: __dirname, stdio: ['pipe','pipe','ignore'] })
      .toString().trim();
  } catch {
    return String(statSync(join(__dirname, 'public/js/curriculum.js')).mtimeMs | 0);
  }
}
const VERSION = buildVersion();

// Execution provider: 'wandbox' (public, zero-infra, default) or 'piston' (self-hosted).
const PROVIDER = (process.env.EXEC_PROVIDER || 'wandbox').toLowerCase();
const PISTON_URL = process.env.PISTON_URL || 'http://localhost:2000';

app.set('trust proxy', true); // honour X-Forwarded-* behind Caddy/nginx (correct cookie Secure flag)
app.use(cors());
app.use(express.json({ limit: '256kb' }));

// ---- Auth (Google OAuth2) ----
mountAuth(app, {
  onLogin: (user) => { if (DB_OK) { try { upsertUser(user); } catch (e) { console.error('[db] upsertUser:', e.message); } } },
});

// ---- Login wall ----------------------------------------------------------
// When enabled, every request except auth/health requires a valid session.
// Static assets (curriculum, app.js, …) and APIs are gated server-side, so the
// content can't be scraped without signing in. /auth/* routes are registered
// above this middleware, so they remain reachable for signing in.
app.use((req, res, next) => {
  if (!loginWallEnabled()) return next();
  if (req.path === '/health' || req.path.startsWith('/auth/')) return next();
  if (currentUser(req)) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'login required' });
  res.set('Cache-Control', 'no-store');
  return res.type('html').sendFile(loginPath);
});

// ---- Progress sync API (requires a logged-in session) ----
const VALID_STATUS = new Set(['not_started', 'in_progress', 'completed']);

app.get('/api/state', requireAuth, (req, res) => {
  if (!DB_OK) return res.status(503).json({ error: 'persistence unavailable' });
  try {
    res.json(getState(req.user.sub));
  } catch (e) {
    console.error('[db] getState:', e.message);
    res.status(500).json({ error: 'load failed' });
  }
});

app.post('/api/state', requireAuth, (req, res) => {
  if (!DB_OK) return res.status(503).json({ error: 'persistence unavailable' });
  const { status = {}, notes = {} } = req.body || {};
  if (typeof status !== 'object' || typeof notes !== 'object') {
    return res.status(400).json({ error: 'status and notes must be objects' });
  }
  if (Object.keys(status).length > 2000 || Object.keys(notes).length > 2000) {
    return res.status(413).json({ error: 'too many entries' });
  }
  // Sanitise: only known statuses, cap note size.
  const safeStatus = {};
  for (const [k, v] of Object.entries(status)) if (VALID_STATUS.has(v)) safeStatus[k] = v;
  const safeNotes = {};
  for (const [k, v] of Object.entries(notes)) if (typeof v === 'string') safeNotes[k] = v.slice(0, 20000);
  try {
    replaceState(req.user.sub, { status: safeStatus, notes: safeNotes });
    res.json({ ok: true });
  } catch (e) {
    console.error('[db] replaceState:', e.message);
    res.status(500).json({ error: 'save failed' });
  }
});

// Serve index.html with ?v= cache-busting stamp injected into script tags
const indexPath = join(__dirname, 'public', 'index.html');

function serveIndex(res) {
  const html = readFileSync(indexPath, 'utf8')
    .replace('/js/curriculum.js"',          `/js/curriculum.js?v=${VERSION}"`)
    .replace('/js/interview-questions.js"', `/js/interview-questions.js?v=${VERSION}"`)
    .replace('/js/app.js"',                 `/js/app.js?v=${VERSION}"`);
  // HTML must never be cached — browser must always re-fetch so the ?v= hash stays fresh
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.type('html').send(html);
}

app.get('/', (_req, res) => serveIndex(res));

app.use(express.static(join(__dirname, 'public'), { extensions: ['html'] }));

/* ---------- Wandbox provider (https://wandbox.org) ----------
   Free public API, no auth. Compiles the main file as prog.<ext>, so a
   top-level `public class X` must drop the `public` modifier to satisfy
   Java's "public class must match filename" rule — we rewrite it. */
const WANDBOX_COMPILER = {
  java: 'openjdk-jdk-21+35',
  python: 'cpython-3.13.8',
  javascript: 'nodejs-head',
};

function prepForWandbox(language, code) {
  if (language === 'java') {
    // Drop `public` only from the top-level class/interface/record/enum declarations.
    return code.replace(/^(\s*)public\s+(class|interface|enum|record|abstract\s+class|final\s+class)\b/gm, '$1$2');
  }
  return code;
}

async function runWandbox(language, code, stdin) {
  const compiler = WANDBOX_COMPILER[language];
  if (!compiler) {
    return { output: '', error: `-- ${language} is illustrative only (not executed) --` };
  }
  const res = await fetch('https://wandbox.org/api/compile.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: prepForWandbox(language, code), compiler, stdin: stdin || '' }),
  });
  if (!res.ok) throw new Error(`Wandbox HTTP ${res.status}`);
  const d = await res.json();
  const compileErr = d.compiler_error || '';
  const runOut = d.program_output || '';
  const runErr = d.program_error || '';
  return {
    output: runOut,
    error: [compileErr, runErr].filter(Boolean).join('\n'),
    exitCode: d.status,
  };
}

/* ---------- Piston provider (self-hosted) ---------- */
const PISTON_VERSION = { java: '15.0.2', python: '3.10.0', bash: '5.2.0', javascript: '18.15.0' };

async function runPiston(language, code, stdin) {
  const version = PISTON_VERSION[language];
  if (!version) return { output: '', error: `-- ${language} not supported --` };
  const res = await fetch(`${PISTON_URL}/api/v2/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, version, files: [{ content: code }], stdin: stdin || '' }),
  });
  if (!res.ok) throw new Error(`Piston HTTP ${res.status}`);
  const d = await res.json();
  const run = d.run || {};
  return { output: run.stdout || '', error: run.stderr || '', exitCode: run.code };
}

app.post('/api/execute', async (req, res) => {
  const { language, code, stdin = '' } = req.body || {};
  if (!language || typeof code !== 'string') {
    return res.status(400).json({ output: '', error: 'language and code are required' });
  }
  // SQL / bash are illustrative in the default (wandbox) provider.
  if (PROVIDER === 'wandbox' && !WANDBOX_COMPILER[language]) {
    return res.json({ output: '', error: `-- ${language} is shown for reference and is not executed here --` });
  }
  try {
    const result = PROVIDER === 'piston'
      ? await runPiston(language, code, stdin)
      : await runWandbox(language, code, stdin);
    res.json(result);
  } catch (err) {
    res.status(502).json({ output: '', error: `Execution failed: ${err.message}` });
  }
});

app.get('/health', (_req, res) => res.json({
  status: 'ok', provider: PROVIDER, db: dbReady(), googleAuth: authConfigured(),
}));

// Debug: shows exactly what curriculum is loaded on this server instance
app.get('/api/stats', (_req, res) => {
  const src = readFileSync(join(__dirname, 'public/js/curriculum.js'), 'utf8')
    .replace('const CURRICULUM', 'var __CURRICULUM');
  const curriculum = new Function(src + '; return __CURRICULUM;')();
  const stats = curriculum.map(p => ({
    phase: p.title,
    modules: p.modules.map(m => ({
      id: m.id,
      title: m.title,
      sections: m.sections ? m.sections.length : null,
      words: m.sections
        ? m.sections.reduce((s, sec) => s + sec.notes.trim().split(/\s+/).length, 0)
        : (m.notes || '').trim().split(/\s+/).length
    }))
  }));
  res.json({ version: VERSION, stats });
});

// SPA fallback — serve the same versioned HTML
app.get('*', (_req, res) => serveIndex(res));

app.listen(PORT, () =>
  console.log(`Java Interview Hub on http://localhost:${PORT} (exec provider: ${PROVIDER})`)
);

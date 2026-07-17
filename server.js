import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { initDb, dbReady, upsertUser, getState, replaceState, listUsers, getApproval, setApproval,
         getEntitlement, isPremium, setSubscription, findUserBySubRef } from './db.js';
import { mountAuth, requireAuth, authConfigured, currentUser, loginWallEnabled, isAdminEmail } from './auth.js';
import { billingConfig, stripeReady, razorpayReady, createStripeCheckout, createRazorpaySubscription,
         mountBillingWebhooks } from './billing.js';
import { computeStats } from './scripts/stats.mjs';
import { CHALLENGES } from './challenges.mjs';
import { aiConfig, aiReady, interviewTurn } from './ai.mjs';

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
// Page shown to signed-in visitors whose account is not yet approved by an admin.
const pendingPath = join(__dirname, 'public', 'pending.html');

// Approval helpers (DB-backed). Admins are always effectively approved.
function approvalOf(user) {
  if (!user) return null;
  if (isAdminEmail(user.email)) return 'approved';
  if (!DB_OK) return 'approved';               // no DB -> can't gate; fail open
  return getApproval(user.sub) || 'pending';
}
function requireAdmin(req, res, next) {
  const u = currentUser(req);
  if (!u || !isAdminEmail(u.email)) return res.status(403).json({ error: 'admin only' });
  req.user = u;
  next();
}

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

/* ===================== MONETIZATION / CONTENT GATING =====================
   When MONETIZATION is on, the server sends FREE users only the free-tier
   modules; premium modules arrive as a locked stub (title kept, body stripped)
   so the real content never reaches a non-subscriber's browser. Premium users
   (active subscription) and admins get the full content. ON by default; set
   MONETIZATION=off (or false/0) to open all content to every signed-in user. */
const monetizationOn = () => !['off', 'false', '0', 'no'].includes(String(process.env.MONETIZATION ?? 'on').toLowerCase());

const CURRICULUM_FILE = join(__dirname, 'public/js/curriculum.js');
const IQ_FILE = join(__dirname, 'public/js/interview-questions.js');
const RAW_CURRICULUM = readFileSync(CURRICULUM_FILE, 'utf8');
const RAW_IQ = readFileSync(IQ_FILE, 'utf8');
const CURRICULUM_OBJ = new Function(RAW_CURRICULUM.replace('const CURRICULUM', 'var __C') + '\n;return __C;')();
const IQ_OBJ = new Function(RAW_IQ.replace('const INTERVIEW_QUESTIONS', 'var __I') + '\n;return __I;')();

// Free-tier module ids: FREE_MODULE_IDS env (comma-list) overrides the default
// policy of "all of Phase 0 + the first module of every other phase (preview)".
const FREE_IDS = (() => {
  const env = String(process.env.FREE_MODULE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (env.length) return new Set(env);
  const ids = new Set();
  for (const p of CURRICULUM_OBJ) {
    if (p.id === 'p0') p.modules.forEach(m => ids.add(m.id));
    else if (p.modules[0]) ids.add(p.modules[0].id);
  }
  return ids;
})();

// Pre-render the free-tier JS bundles once (same for every free user).
const FREE_CURRICULUM_JS = 'const CURRICULUM = ' + JSON.stringify(CURRICULUM_OBJ.map(p => ({
  ...p,
  modules: p.modules.map(m => FREE_IDS.has(m.id) ? m : {
    id: m.id, title: m.title, hours: m.hours, locked: true,
    sections: [{
      title: 'Premium — unlock this module',
      notes: '## ' + m.title + '\n\n> [!NOTE]\n> This module is part of **Premium**. Upgrade to unlock the full study guide, runnable code, flashcards and interview questions.',
      code: [], flashcards: [],
    }],
  }),
}))) + ';\n';
const FREE_IQ_JS = 'const INTERVIEW_QUESTIONS = ' + JSON.stringify(
  Object.fromEntries(Object.entries(IQ_OBJ).filter(([k]) => FREE_IDS.has(k)))
) + ';\n';

function requesterIsPremium(req) {
  const u = currentUser(req);
  if (!u) return false;
  if (isAdminEmail(u.email)) return true;
  return DB_OK ? isPremium(u.sub) : true;
}
// Full content for premium/admin (or when monetization is off); free stub otherwise.
function gatedJs(req, res, rawFull, freeJs) {
  res.type('application/javascript');
  if (!monetizationOn() || requesterIsPremium(req)) {
    res.set('Cache-Control', 'private, max-age=300');
    return res.send(rawFull);
  }
  res.set('Cache-Control', 'private, no-store');
  return res.send(freeJs);
}

// Execution provider: 'wandbox' (public, zero-infra, default) or 'piston' (self-hosted).
const PROVIDER = (process.env.EXEC_PROVIDER || 'wandbox').toLowerCase();
const PISTON_URL = process.env.PISTON_URL || 'http://localhost:2000';

app.set('trust proxy', true); // honour X-Forwarded-* behind Caddy/nginx (correct cookie Secure flag)
app.use(cors());

// Payment webhooks need the RAW request body for signature verification, so they
// are mounted (with express.raw) before the JSON parser, and the JSON parser skips
// their paths.
mountBillingWebhooks(app, express, {
  setSub: (userId, ent) => { if (DB_OK) { try { setSubscription(userId, ent); } catch (e) { console.error('[billing] setSub:', e.message); } } },
  findUserByRef: (ref) => (DB_OK ? findUserBySubRef(ref) : null),
});
app.use((req, res, next) => (req.path.startsWith('/api/billing/webhook') ? next() : express.json({ limit: '256kb' })(req, res, next)));

// ---- Auth (Google OAuth2) ----
mountAuth(app, {
  onLogin: (user) => {
    if (!DB_OK) return;
    try {
      upsertUser(user);
      // Admins are auto-approved on login; everyone else stays 'pending' until
      // an admin approves them from the console.
      if (isAdminEmail(user.email)) setApproval(user.id, 'approved');
    } catch (e) { console.error('[db] onLogin:', e.message); }
  },
  approvalStatus: (userId) => (DB_OK ? getApproval(userId) : null),
  entitlement: (userId) => {
    if (!DB_OK) return { premium: false, status: 'none' };
    const e = getEntitlement(userId);
    return { premium: isPremium(userId), plan: e.plan, status: e.status, until: e.until };
  },
});

// ---- Login wall ----------------------------------------------------------
// When enabled, every request except auth/health requires a valid session.
// Static assets (curriculum, app.js, …) and APIs are gated server-side, so the
// content can't be scraped without signing in. /auth/* routes are registered
// above this middleware, so they remain reachable for signing in.
app.use((req, res, next) => {
  if (!loginWallEnabled()) return next();
  if (req.path === '/health' || req.path.startsWith('/auth/')) return next();
  const user = currentUser(req);
  // Not signed in -> login page (or 401 for APIs).
  if (!user) {
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'login required' });
    res.set('Cache-Control', 'no-store');
    return res.type('html').sendFile(loginPath);
  }
  // Signed in but not yet approved by an admin -> blocked from all content.
  if (approvalOf(user) !== 'approved') {
    if (req.path.startsWith('/api/')) return res.status(403).json({ error: 'account pending approval' });
    res.set('Cache-Control', 'no-store');
    return res.type('html').sendFile(pendingPath);
  }
  return next();
});

// ---- Admin API (approve/reject users) — admin-only ----
app.get('/api/admin/users', requireAdmin, (_req, res) => {
  if (!DB_OK) return res.status(503).json({ error: 'persistence unavailable' });
  try { res.json({ users: listUsers() }); }
  catch (e) { console.error('[db] listUsers:', e.message); res.status(500).json({ error: 'load failed' }); }
});

app.post('/api/admin/users/approve', requireAdmin, (req, res) => setUserApproval(req, res, 'approved'));
app.post('/api/admin/users/reject',  requireAdmin, (req, res) => setUserApproval(req, res, 'rejected'));

function setUserApproval(req, res, status) {
  if (!DB_OK) return res.status(503).json({ error: 'persistence unavailable' });
  const id = (req.body && req.body.id) || '';
  if (typeof id !== 'string' || !id) return res.status(400).json({ error: 'user id required' });
  // Guard: an admin cannot lock themselves (or another admin) out.
  const target = listUsers().find(u => u.id === id);
  if (target && isAdminEmail(target.email) && status !== 'approved') {
    return res.status(400).json({ error: 'cannot change an admin account' });
  }
  try {
    const ok = setApproval(id, status);
    if (!ok) return res.status(404).json({ error: 'user not found' });
    res.json({ ok: true, id, status });
  } catch (e) { console.error('[db] setApproval:', e.message); res.status(500).json({ error: 'update failed' }); }
}

// Admin: grant or revoke premium (comp) access. `days` optional (default: no expiry).
app.post('/api/admin/users/subscription', requireAdmin, (req, res) => {
  if (!DB_OK) return res.status(503).json({ error: 'persistence unavailable' });
  const { id, action, days } = req.body || {};
  if (typeof id !== 'string' || !id) return res.status(400).json({ error: 'user id required' });
  try {
    if (action === 'grant') {
      const until = Number(days) > 0 ? Date.now() + Number(days) * 86400000 : null;
      setSubscription(id, { status: 'active', plan: 'comp', until, provider: 'admin' });
      return res.json({ ok: true, id, status: 'active', until });
    }
    if (action === 'revoke') {
      setSubscription(id, { status: 'none', plan: null, until: null, provider: 'admin' });
      return res.json({ ok: true, id, status: 'none' });
    }
    return res.status(400).json({ error: 'action must be grant or revoke' });
  } catch (e) { console.error('[db] subscription:', e.message); res.status(500).json({ error: 'update failed' }); }
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

const VALID_MARK = new Set(['again', 'known']);

app.post('/api/state', requireAuth, (req, res) => {
  if (!DB_OK) return res.status(503).json({ error: 'persistence unavailable' });
  const { status = {}, notes = {}, cards = {} } = req.body || {};
  if (typeof status !== 'object' || typeof notes !== 'object' || typeof cards !== 'object') {
    return res.status(400).json({ error: 'status, notes and cards must be objects' });
  }
  if (Object.keys(status).length > 2000 || Object.keys(notes).length > 2000 || Object.keys(cards).length > 20000) {
    return res.status(413).json({ error: 'too many entries' });
  }
  // Sanitise: only known statuses/marks, cap sizes.
  const safeStatus = {};
  for (const [k, v] of Object.entries(status)) if (VALID_STATUS.has(v)) safeStatus[k] = v;
  const safeNotes = {};
  for (const [k, v] of Object.entries(notes)) if (typeof v === 'string') safeNotes[k] = v.slice(0, 20000);
  const safeCards = {};
  for (const [k, v] of Object.entries(cards)) if (typeof k === 'string' && k.length <= 120 && VALID_MARK.has(v)) safeCards[k] = v;
  try {
    replaceState(req.user.sub, { status: safeStatus, notes: safeNotes, cards: safeCards });
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
    .replace('/js/app/main.js"',            `/js/app/main.js?v=${VERSION}"`);
  // HTML must never be cached — browser must always re-fetch so the ?v= hash stays fresh
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.type('html').send(html);
}

app.get('/', (_req, res) => serveIndex(res));

// ---- Entitlement-gated content bundles (must precede express.static) ----
app.get('/js/curriculum.js', (req, res) => gatedJs(req, res, RAW_CURRICULUM, FREE_CURRICULUM_JS));
app.get('/js/interview-questions.js', (req, res) => gatedJs(req, res, RAW_IQ, FREE_IQ_JS));

// ---- Billing: provider config + checkout ----
app.get('/api/billing/config', (req, res) => {
  res.json({ monetization: monetizationOn(), premium: requesterIsPremium(req), ...billingConfig() });
});

app.post('/api/billing/checkout', requireAuth, async (req, res) => {
  const plan = (req.body && req.body.plan) === 'yearly' ? 'yearly' : 'monthly';
  // Provider: honour an explicit choice, else prefer whichever is configured.
  let provider = req.body && req.body.provider;
  if (provider !== 'stripe' && provider !== 'razorpay') provider = stripeReady() ? 'stripe' : (razorpayReady() ? 'razorpay' : null);
  if (!provider) return res.status(501).json({ error: 'payments-not-configured' });
  const user = { id: req.user.sub, email: req.user.email };
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host  = req.headers['x-forwarded-host'] || req.headers.host;
  const origin = `${proto}://${host}`;
  try {
    if (provider === 'stripe') {
      if (!stripeReady()) return res.status(501).json({ error: 'stripe-not-configured' });
      const out = await createStripeCheckout({ plan, user, origin });
      return res.json(out); // { url }
    }
    if (!razorpayReady()) return res.status(501).json({ error: 'razorpay-not-configured' });
    const out = await createRazorpaySubscription({ plan, user });
    // Store the subscription id up front so the webhook can map back to this user.
    if (DB_OK && out.ref) { try { setSubscription(user.id, { status: 'none', plan: null, until: null, provider: 'razorpay', ref: out.ref }); } catch {} }
    return res.json(out); // { razorpay: {...} }
  } catch (e) {
    console.error('[billing] checkout:', e.message);
    return res.status(502).json({ error: 'checkout-failed', message: e.message });
  }
});

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
    compileError: compileErr,
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

// Simple in-memory sliding-window rate limiter (per client IP).
function makeRateLimiter({ windowMs, max }) {
  const hits = new Map(); // ip -> [timestamps]
  return (req, res, next) => {
    const now = Date.now();
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'unknown';
    const arr = (hits.get(ip) || []).filter(t => now - t < windowMs);
    if (arr.length >= max) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ output: '', error: 'Rate limit exceeded — please wait a moment before running more code.' });
    }
    arr.push(now); hits.set(ip, arr);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k); // cleanup
    next();
  };
}
const executeLimiter = makeRateLimiter({ windowMs: 60_000, max: 30 }); // 30 runs/min/IP
const MAX_CODE_BYTES = 60_000, MAX_STDIN_BYTES = 10_000;

app.post('/api/execute', executeLimiter, async (req, res) => {
  const { language, code, stdin = '' } = req.body || {};
  if (!language || typeof code !== 'string') {
    return res.status(400).json({ output: '', error: 'language and code are required' });
  }
  // When the site is monetized, don't offer free anonymous compute.
  if (monetizationOn() && !currentUser(req)) {
    return res.status(401).json({ output: '', error: 'Please sign in to run code.' });
  }
  if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) {
    return res.status(413).json({ output: '', error: 'Code is too large to run here.' });
  }
  if (typeof stdin === 'string' && Buffer.byteLength(stdin, 'utf8') > MAX_STDIN_BYTES) {
    return res.status(413).json({ output: '', error: 'stdin is too large.' });
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

/* ===================== GRADED CODING CHALLENGES =====================
   Challenges + test cases live server-side (challenges.mjs). Clients get
   the prompt, starter code and SAMPLE tests only; hidden test inputs and
   all expected outputs stay on the server and grading runs here, so
   answers can never be scraped from the browser. */
const CHALLENGE_BY_ID = (() => {
  const map = new Map();
  for (const [mod, list] of Object.entries(CHALLENGES))
    for (const c of list) map.set(c.id, { ...c, moduleId: mod });
  return map;
})();

// Normalize stdout for comparison: unify newlines, strip trailing whitespace
// per line, drop trailing blank lines.
const normOut = (s) => String(s == null ? '' : s)
  .replace(/\r\n/g, '\n').split('\n').map(l => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');

// Viewing a challenge (prompt/starter/sample tests): free modules are open to
// everyone; premium modules require an active subscription (or admin).
function challengeViewAllowed(req, moduleId) {
  if (!monetizationOn() || FREE_IDS.has(moduleId)) return true;
  if (!currentUser(req)) return { code: 401, error: 'Please sign in.' };
  if (requesterIsPremium(req)) return true;
  return { code: 403, error: 'This module is part of Premium.' };
}
// Grading runs code on the JDK, so it always needs a signed-in user when
// monetized (same policy as the sandbox), plus premium for premium modules.
function challengeGradeAllowed(req, moduleId) {
  if (!monetizationOn()) return true;
  if (!currentUser(req)) return { code: 401, error: 'Please sign in to run tests.' };
  if (FREE_IDS.has(moduleId) || requesterIsPremium(req)) return true;
  return { code: 403, error: 'This module is part of Premium.' };
}

// List the module ids that have challenges (cheap; lets the client show the tab).
app.get('/api/challenges', (_req, res) => {
  res.set('Cache-Control', 'private, max-age=120');
  res.json({ moduleIds: Object.keys(CHALLENGES) });
});

// Challenges for a module — solutions removed, hidden tests reduced to a count.
app.get('/api/challenges/:moduleId', (req, res) => {
  const moduleId = req.params.moduleId;
  const gate = challengeViewAllowed(req, moduleId);
  if (gate !== true) return res.status(gate.code).json({ error: gate.error, challenges: [] });
  const list = (CHALLENGES[moduleId] || []).map(c => ({
    id: c.id, title: c.title, difficulty: c.difficulty, lang: c.lang,
    prompt: c.prompt, starter: c.starter,
    sampleTests: c.tests.filter(t => t.sample).map(t => ({ name: t.name, stdin: t.stdin, expected: t.expected })),
    hiddenCount: c.tests.filter(t => !t.sample).length,
    total: c.tests.length,
  }));
  res.set('Cache-Control', 'private, max-age=120');
  res.json({ moduleId, challenges: list });
});

// Grade a submission: run the code against every test server-side, compare.
const gradeLimiter = makeRateLimiter({ windowMs: 60_000, max: 12 }); // each grade = several runs
app.post('/api/grade', gradeLimiter, async (req, res) => {
  const { challengeId, code } = req.body || {};
  const ch = CHALLENGE_BY_ID.get(String(challengeId || ''));
  if (!ch || typeof code !== 'string') return res.status(400).json({ error: 'challengeId and code are required' });
  const gate = challengeGradeAllowed(req, ch.moduleId);
  if (gate !== true) return res.status(gate.code).json({ error: gate.error });
  if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) return res.status(413).json({ error: 'Code is too large.' });
  if (PROVIDER === 'wandbox' && !WANDBOX_COMPILER[ch.lang]) {
    return res.status(400).json({ error: `${ch.lang} cannot be graded here.` });
  }
  try {
    const run = (stdin) => (PROVIDER === 'piston' ? runPiston(ch.lang, code, stdin) : runWandbox(ch.lang, code, stdin));
    // Probe compile once with the first test's input; a compile error fails all.
    const first = await run(ch.tests[0].stdin);
    if (first.compileError) {
      return res.json({ passed: false, passedCount: 0, total: ch.tests.length, compileError: first.compileError,
        results: ch.tests.map(t => ({ name: t.name, sample: !!t.sample, passed: false })) });
    }
    const results = [];
    for (let i = 0; i < ch.tests.length; i++) {
      const t = ch.tests[i];
      const out = i === 0 ? first : await run(t.stdin);
      const passed = normOut(out.output) === normOut(t.expected);
      const row = { name: t.name, sample: !!t.sample, passed };
      if (t.sample) { row.expected = t.expected; row.got = normOut(out.output).slice(0, 2000); }
      else if (!passed && out.error) row.hint = 'runtime error';
      results.push(row);
    }
    const passedCount = results.filter(r => r.passed).length;
    res.json({ passed: passedCount === ch.tests.length, passedCount, total: ch.tests.length, results });
  } catch (err) {
    res.status(502).json({ error: `Grading failed: ${err.message}` });
  }
});

/* ===================== AI MOCK INTERVIEWER =====================
   Premium-only, rate-limited, cost-capped Anthropic-powered interviewer.
   DORMANT until ANTHROPIC_API_KEY is set (aiReady()): /api/ai/config reports
   { enabled:false } and /api/ai/interview returns 503, so the whole feature
   stays invisible/inert with no key. See ai.mjs. */

// Public config so the client can reveal (or keep hidden) the AI card.
app.get('/api/ai/config', (_req, res) => {
  res.set('Cache-Control', 'private, max-age=60');
  res.json(aiConfig());
});

const aiLimiter = makeRateLimiter({ windowMs: 60_000, max: 20 }); // 20 turns/min/IP
const AI_MAX_MESSAGES = 24;      // cap conversation length
const AI_MAX_CONTENT = 4000;     // cap each message's characters
const AI_MAX_PAYLOAD = 60_000;   // cap total request body size
const AI_TOPICS = new Set(['Core Java', 'Spring', 'System Design', 'Concurrency', 'Data Structures', 'Databases', 'Microservices']);

app.post('/api/ai/interview', aiLimiter, async (req, res) => {
  // Premium gate (same policy as challenge grading): signed-in + premium.
  if (monetizationOn()) {
    if (!currentUser(req)) return res.status(401).json({ error: 'Please sign in to start an AI interview.' });
    if (!requesterIsPremium(req)) return res.status(403).json({ error: 'AI interviews are part of Premium.' });
  }
  // Dormant until an API key is configured.
  if (!aiReady()) return res.status(503).json({ error: 'AI interviews are not configured yet.' });

  const { history, topic } = req.body || {};
  if (!Array.isArray(history)) return res.status(400).json({ error: 'history must be an array' });
  if (history.length > AI_MAX_MESSAGES) return res.status(413).json({ error: 'conversation too long' });
  for (const m of history) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') {
      return res.status(400).json({ error: 'each message needs role user|assistant and string content' });
    }
    if (m.content.length > AI_MAX_CONTENT) return res.status(413).json({ error: 'message too long' });
  }
  const topicStr = typeof topic === 'string' ? topic.slice(0, 60) : '';
  const safeTopic = AI_TOPICS.has(topicStr) ? topicStr : '';
  if (Buffer.byteLength(JSON.stringify(history), 'utf8') > AI_MAX_PAYLOAD) {
    return res.status(413).json({ error: 'payload too large' });
  }
  try {
    const reply = await interviewTurn({ history, topic: safeTopic });
    res.json({ reply });
  } catch (err) {
    console.error('[ai] interview:', err.message);
    res.status(502).json({ error: 'The interviewer is unavailable right now. Please try again.' });
  }
});

app.get('/health', (_req, res) => res.json({
  status: 'ok', provider: PROVIDER, db: dbReady(), googleAuth: authConfigured(),
}));

// Public product-stats summary — single source of truth (computed from the
// curriculum) so the login page, README and dashboard never disagree.
let STATS_CACHE = null;
try { STATS_CACHE = computeStats(); console.log('[stats]', JSON.stringify(STATS_CACHE)); }
catch (e) { console.error('[stats] compute failed:', e.message); }
app.get('/api/summary', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json(STATS_CACHE || {});
});

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

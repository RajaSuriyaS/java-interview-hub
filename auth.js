/* ============================================================
   Google OAuth2 (authorization-code flow) + stateless sessions.
   - No external auth libraries: token/userinfo via fetch, session
     held in an HMAC-signed httpOnly cookie (node:crypto).
   - Degrades gracefully: if GOOGLE_CLIENT_ID/SECRET are unset, the
     app stays in localStorage-only mode (authConfigured() === false).

   Required env for login:  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
   Recommended:             SESSION_SECRET (stable secret to sign cookies)
   Optional:                GOOGLE_CALLBACK_URL (else derived from request)
   ============================================================ */
import crypto from 'node:crypto';

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const CALLBACK_URL  = process.env.GOOGLE_CALLBACK_URL || '';

const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.warn('[auth] SESSION_SECRET not set — using an ephemeral secret; sessions reset on restart. Set SESSION_SECRET in production.');
}

const SESSION_COOKIE = 'jih_session';
const STATE_COOKIE   = 'jih_oauth_state';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days
const STATE_MAX_AGE   = 10 * 60 * 1000;           // 10 minutes

export const authConfigured = () => !!(CLIENT_ID && CLIENT_SECRET);

/* ---------- signed-cookie session (HMAC-SHA256) ---------- */
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}
function verify(token) {
  if (!token || token.indexOf('.') < 0) return null;
  const [body, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (obj.exp && Date.now() > obj.exp) return null;
    return obj;
  } catch { return null; }
}

/* ---------- cookie helpers (express provides res.cookie) ---------- */
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}
function isSecure(req) {
  return (req.headers['x-forwarded-proto'] || req.protocol) === 'https';
}
function setCookie(res, req, name, value, maxAge) {
  res.cookie(name, value, { httpOnly: true, sameSite: 'lax', secure: isSecure(req), maxAge, path: '/' });
}

export function currentUser(req) {
  return verify(parseCookies(req)[SESSION_COOKIE]);
}

export function requireAuth(req, res, next) {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: 'not authenticated' });
  req.user = u;
  next();
}

function callbackUrl(req) {
  if (CALLBACK_URL) return CALLBACK_URL;
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host  = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}/auth/google/callback`;
}

/* ---------- routes ---------- */
export function mountAuth(app, { onLogin } = {}) {
  // Begin login — redirect to Google's consent screen.
  app.get('/auth/google', (req, res) => {
    if (!authConfigured()) return res.status(503).send('Google login is not configured on this server.');
    const state = crypto.randomBytes(16).toString('hex');
    setCookie(res, req, STATE_COOKIE, state, STATE_MAX_AGE);
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: callbackUrl(req),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
      prompt: 'select_account',
    });
    res.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + params.toString());
  });

  // OAuth callback — verify state, exchange code, fetch profile, set session.
  app.get('/auth/google/callback', async (req, res) => {
    try {
      if (!authConfigured()) return res.status(503).send('Google login is not configured on this server.');
      const { code, state } = req.query;
      const cookies = parseCookies(req);
      if (!code || !state || state !== cookies[STATE_COOKIE]) {
        return res.status(400).send('Invalid OAuth state. Please try signing in again.');
      }
      res.clearCookie(STATE_COOKIE, { path: '/' });

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: callbackUrl(req),
          grant_type: 'authorization_code',
        }),
      });
      if (!tokenRes.ok) return res.status(502).send('Token exchange with Google failed.');
      const tok = await tokenRes.json();

      const uiRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: 'Bearer ' + tok.access_token },
      });
      if (!uiRes.ok) return res.status(502).send('Could not fetch Google profile.');
      const ui = await uiRes.json();

      const user = {
        id: 'google:' + ui.sub,
        email: ui.email || '',
        name: ui.name || ui.email || 'User',
        picture: ui.picture || '',
      };
      if (onLogin) { try { onLogin(user); } catch (e) { console.error('[auth] onLogin', e.message); } }

      const session = sign({
        sub: user.id, email: user.email, name: user.name, picture: user.picture,
        iat: Date.now(), exp: Date.now() + SESSION_MAX_AGE,
      });
      setCookie(res, req, SESSION_COOKIE, session, SESSION_MAX_AGE);
      res.redirect('/');
    } catch (e) {
      console.error('[auth] callback error:', e.message);
      res.status(500).send('Sign-in failed. Please try again.');
    }
  });

  // Who am I — drives the frontend UI.
  app.get('/auth/me', (req, res) => {
    const u = currentUser(req);
    res.json({
      configured: authConfigured(),
      user: u ? { id: u.sub, email: u.email, name: u.name, picture: u.picture } : null,
    });
  });

  // Logout — clear the session cookie.
  app.post('/auth/logout', (req, res) => {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  });
}

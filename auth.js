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

// trim() kills the classic "invalid client secret" caused by a trailing
// space/CR that sneaks into deploy/.env when values are pasted.
const clean = (v) => String(v || '').trim();
const CLIENT_ID     = clean(process.env.GOOGLE_CLIENT_ID);
const CLIENT_SECRET = clean(process.env.GOOGLE_CLIENT_SECRET);
const CALLBACK_URL  = clean(process.env.GOOGLE_CALLBACK_URL);

const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.warn('[auth] SESSION_SECRET not set — using an ephemeral secret; sessions reset on restart. Set SESSION_SECRET in production.');
}

const SESSION_COOKIE = 'jih_session';
const STATE_COOKIE   = 'jih_oauth_state';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days
const STATE_MAX_AGE   = 10 * 60 * 1000;           // 10 minutes

export const authConfigured = () => !!(CLIENT_ID && CLIENT_SECRET);

// ---- Admin identity ----
// Admins are matched by email (case-insensitive). Configure via ADMIN_EMAILS
// (comma-separated); defaults to the site owner. Admins are auto-approved and
// can see the admin console to approve/reject other users.
const ADMIN_EMAILS = new Set(
  String(process.env.ADMIN_EMAILS || 'rajasuriyas@gmail.com')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
);
export const isAdminEmail = (email) => ADMIN_EMAILS.has(String(email || '').trim().toLowerCase());

// Login wall: when REQUIRE_AUTH=true AND Google is configured, the whole app
// requires sign-in. Guarded by authConfigured() so a missing client id can
// never lock everyone out.
export const loginWallEnabled = () =>
  String(process.env.REQUIRE_AUTH || '').toLowerCase() === 'true' && authConfigured();

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
export function mountAuth(app, { onLogin, approvalStatus } = {}) {
  // Begin login — redirect to Google's consent screen.
  app.get('/auth/google', (req, res) => {
    if (!authConfigured()) return res.status(503).send('Google login is not configured on this server (set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).');
    const redirectUri = callbackUrl(req);
    const state = crypto.randomBytes(16).toString('hex');
    setCookie(res, req, STATE_COOKIE, state, STATE_MAX_AGE);
    console.log('[auth] start login → redirect_uri=%s (this must be an Authorised redirect URI in Google)', redirectUri);
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
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
      const { code, state, error } = req.query;
      const cookies = parseCookies(req);

      // Google can bounce back with ?error=access_denied etc.
      if (error) return res.status(400).send('Google declined the sign-in: ' + String(error));
      if (!code) return res.status(400).send('Missing authorization code from Google.');
      if (!cookies[STATE_COOKIE]) {
        // The state cookie we set on /auth/google never came back — almost always a
        // cookie/proxy issue (Secure/SameSite, or the proxy not forwarding cookies).
        return res.status(400).send('Login state cookie was not received. Check that the site is served over HTTPS and cookies are not blocked, then try again.');
      }
      if (state !== cookies[STATE_COOKIE]) {
        return res.status(400).send('OAuth state mismatch (possible CSRF or a stale tab). Please start sign-in again.');
      }
      res.clearCookie(STATE_COOKIE, { path: '/' });

      const redirectUri = callbackUrl(req);
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const tok = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok || !tok.access_token) {
        // Surface Google's actual reason with a hint matched to THAT reason.
        const reason = tok.error_description || tok.error || ('HTTP ' + tokenRes.status);
        console.error('[auth] token exchange failed:', reason, '| redirect_uri used:', redirectUri);
        let hint;
        if (/client secret|invalid_client|unauthorized_client/i.test(reason)) {
          hint = 'The CLIENT SECRET stored on this server does not match this client id.\n' +
            'Fix: in Google Cloud console open this exact OAuth client, copy the CURRENT secret\n' +
            '(or click "Reset secret" and copy the new one), then on the VPS re-run\n' +
            '  ./deploy/google-auth-doctor.sh --reset\n' +
            'and paste BOTH values again. Check /auth/debug: clientIdPreview must match the\n' +
            'client you edited, and clientSecret.prefix should be "GOCSPX-".';
        } else if (/redirect_uri/i.test(reason)) {
          hint = 'The redirect_uri this server used is:\n  ' + redirectUri +
            '\nIt must be listed EXACTLY as an "Authorised redirect URI" on your Google OAuth client.';
        } else if (/invalid_grant/i.test(reason)) {
          hint = 'The authorization code expired or was reused — just try signing in again.';
        } else {
          hint = 'redirect_uri used: ' + redirectUri + ' — see /auth/debug for full config state.';
        }
        return res.status(502).send('Google token exchange failed: ' + reason + '\n\n' + hint);
      }

      const uiRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: 'Bearer ' + tok.access_token },
      });
      if (!uiRes.ok) {
        console.error('[auth] userinfo failed: HTTP', uiRes.status);
        return res.status(502).send('Could not fetch your Google profile (HTTP ' + uiRes.status + ').');
      }
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
    const admin = u ? isAdminEmail(u.email) : false;
    // Approval status reflects the live DB (an admin may approve after login);
    // admins are always effectively approved.
    let approval = null;
    if (u) approval = admin ? 'approved' : (approvalStatus ? approvalStatus(u.sub) : 'approved');
    res.json({
      configured: authConfigured(),
      requireLogin: loginWallEnabled(),
      admin,
      approvalStatus: approval,
      user: u ? { id: u.sub, email: u.email, name: u.name, picture: u.picture } : null,
    });
  });

  // Logout — clear the session cookie.
  app.post('/auth/logout', (req, res) => {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  // Safe diagnostics (no secrets) — open this in a browser to debug sign-in.
  // The #1 thing to verify: `derivedCallbackUrl` must EXACTLY match an
  // "Authorised redirect URI" on your Google OAuth client.
  app.get('/auth/debug', (req, res) => {
    const cookies = parseCookies(req);
    // A human-readable verdict so anyone opening this URL knows the next move.
    let nextStep;
    if (!CLIENT_ID && !CLIENT_SECRET) {
      nextStep = 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are NOT reaching the app. ' +
        'On the VPS run: cd /root/java-interview-hub && git pull && sudo ./deploy/google-auth-doctor.sh ' +
        '— it writes the creds into deploy/.env, force-recreates the container, and prints what the container sees.';
    } else if (!CLIENT_ID || !CLIENT_SECRET) {
      nextStep = 'Only ONE of GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET is set — the other is empty in deploy/.env. Re-run ./deploy/google-auth-doctor.sh and enter both.';
    } else if (!loginWallEnabled() && String(process.env.REQUIRE_AUTH || '').toLowerCase() === 'true') {
      nextStep = 'Credentials are set and REQUIRE_AUTH=true — this state should not occur; restart the container (docker restart jih-app).';
    } else if (!loginWallEnabled()) {
      nextStep = 'Google sign-in is ENABLED (optional mode). To force login for everyone, set REQUIRE_AUTH=true in deploy/.env and redeploy.';
    } else {
      nextStep = 'Fully configured: sign-in enabled and the login wall is ON. If sign-in still fails, register the derivedCallbackUrl below as an Authorised redirect URI on the Google OAuth client.';
    }
    res.json({
      configured: authConfigured(),
      clientIdSet: !!CLIENT_ID,
      clientSecretSet: !!CLIENT_SECRET,
      // Fingerprints (safe): compare these against the Google console client.
      // The client id is public by design; for the secret we expose only the
      // standard "GOCSPX-" prefix, its length, and whether trimming was needed.
      clientIdPreview: CLIENT_ID ? CLIENT_ID.slice(0, 20) + '…' : null,
      clientSecret: CLIENT_SECRET ? {
        prefix: CLIENT_SECRET.slice(0, 7),
        length: CLIENT_SECRET.length,
        hadWhitespaceTrimmed: (process.env.GOOGLE_CLIENT_SECRET || '') !== CLIENT_SECRET,
      } : null,
      sessionSecretFromEnv: !!process.env.SESSION_SECRET,
      requireAuthEnv: process.env.REQUIRE_AUTH || null,
      loginWallActive: loginWallEnabled(),
      nextStep,
      derivedCallbackUrl: callbackUrl(req),
      callbackOverride: CALLBACK_URL || null,
      proxySees: {
        xForwardedProto: req.headers['x-forwarded-proto'] || null,
        xForwardedHost: req.headers['x-forwarded-host'] || null,
        host: req.headers.host || null,
        treatedAsSecure: isSecure(req),
      },
      cookies: {
        sessionPresent: !!cookies[SESSION_COOKIE],
        sessionValid: !!currentUser(req),
        statePresent: !!cookies[STATE_COOKIE],
      },
      expectedRedirectUriToRegister: callbackUrl(req),
    });
  });
}

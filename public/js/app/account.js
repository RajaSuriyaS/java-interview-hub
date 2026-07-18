/* account.js — part of the Java Interview Hub app engine (split from the original app.js).
   ES module. Shared state + helpers live in core.js (live bindings). */
'use strict';
import { STORAGE_KEY, STATUSES, STATUS_LABEL, STATUS_NEXT, defaultState, state, setState, cardKey, reviewQueue, dayKey, markActivity, studyStreak, auth, setAuth, load, save, allModules, findModule, statusOf, phaseProgress, globalProgress, $, el, icons, esc, openSidebarMobile, closeSidebarMobile } from './core.js';
import { renderNav, renderGlobalProgress, renderDashboard } from './nav-dashboard.js';
import { openModule } from './module-view.js';
import { renderUpgrade } from './billing.js';
let _syncTimer = null;

// Compact "time left" label for a trial expiry (epoch ms): "47h" or "45m".
function trialLeft(until) {
  const ms = until - Date.now();
  if (ms <= 0) return '0m';
  const h = Math.floor(ms / 3600000);
  return h >= 1 ? h + 'h' : Math.max(1, Math.floor(ms / 60000)) + 'm';
}

  async function refreshAuth() {
    try {
      const r = await fetch('/auth/me', { credentials: 'same-origin' });
      setAuth(await r.json());
    } catch { setAuth({ configured: false, user: null }); }
    renderAccount();
  }

  // On login, pull the server's saved progress and merge it with whatever is in
  // localStorage (server wins on conflicts; local-only entries are kept and then
  // uploaded so nothing is lost on first sign-in from a device).
  async function syncFromServer() {
    if (!auth.user) return;
    try {
      const r = await fetch('/api/state', { credentials: 'same-origin' });
      if (!r.ok) return;
      const remote = await r.json();
      state.status = { ...state.status, ...(remote.status || {}) };
      state.notes  = { ...state.notes,  ...(remote.notes  || {}) };
      state.cards  = { ...(state.cards || {}), ...(remote.cards || {}) };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
      pushToServer(); // upload the merged result (captures any local-only progress)
      // refresh the UI with merged data
      renderNav($('#search') ? $('#search').value : '');
      renderGlobalProgress();
      if (state.lastModule && findModule(state.lastModule)) openModule(state.lastModule);
      else renderDashboard();
    } catch { /* offline / not signed in — stay on local copy */ }
  }

  // Debounced upload of the full progress state. No-op when signed out.
  function pushToServer() {
    if (!auth.user) return;
    setSyncDot('saving');
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(async () => {
      try {
        const r = await fetch('/api/state', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: state.status, notes: state.notes, cards: state.cards || {} }),
        });
        if (r.status === 401 && auth.requireLogin) { location.reload(); return; } // session expired → login wall
        setSyncDot(r.ok ? 'ok' : 'err');
      } catch { setSyncDot('err'); }
    }, 600);
  }

  function setSyncDot(stateName) {
    const dot = document.getElementById('sync-dot');
    if (!dot) return;
    const map = { ok: 'bg-success', saving: 'bg-amber-400', err: 'bg-red-400' };
    dot.className = 'w-1.5 h-1.5 rounded-full ' + (map[stateName] || 'bg-success');
    const label = document.getElementById('sync-label');
    if (label) label.textContent = stateName === 'saving' ? 'Saving…' : stateName === 'err' ? 'Sync error' : 'Progress synced';
  }

  async function logout() {
    try { await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch {}
    // Reload so the view resets — if the login wall is on, this lands on the sign-in page.
    location.reload();
  }

  const GOOGLE_G = '<svg class="w-4 h-4 shrink-0" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>';

  // ---- Admin console: approve / reject users who signed in with Google ----
  async function renderAdminConsole() {
    if (!auth.admin) return;
    const content = $('#content');
    content.scrollTop = 0;
    content.innerHTML = `
      <div class="w-full px-4 sm:px-8 lg:px-12 xl:px-16 py-7 fade-up">
        <div class="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <button id="admin-bc-dash" class="hover:text-brand transition">Dashboard</button>
          <i data-lucide="chevron-right" class="w-3 h-3"></i><span class="text-brand">Admin</span>
        </div>
        <div class="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <i data-lucide="shield-check" class="w-6 h-6 text-brand"></i> User Access
            </h1>
            <p class="text-slate-400 mt-1.5 text-sm">Approve or reject people who have signed in with Google. Only approved users can access the site.</p>
          </div>
          <button id="admin-refresh" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition">
            <i data-lucide="refresh-cw" class="w-4 h-4"></i> Refresh
          </button>
        </div>
        <div id="admin-users" class="text-slate-400 text-sm">Loading users…</div>
      </div>`;
    icons();
    document.getElementById('admin-bc-dash').addEventListener('click', renderDashboard);
    document.getElementById('admin-refresh').addEventListener('click', loadAdminUsers);
    loadAdminUsers();
  }

  async function loadAdminUsers() {
    const host = document.getElementById('admin-users');
    if (!host) return;
    let data;
    try {
      const r = await fetch('/api/admin/users', { credentials: 'same-origin' });
      if (r.status === 403) { host.innerHTML = '<div class="text-red-400">Not authorized.</div>'; return; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      data = await r.json();
    } catch (e) { host.innerHTML = `<div class="text-red-400">Could not load users (${esc(String(e.message))}).</div>`; return; }
    const users = data.users || [];
    const badge = (s) => {
      const map = {
        approved: 'bg-success/15 text-emerald-300 ring-1 ring-success/40',
        pending:  'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40',
        rejected: 'bg-red-500/15 text-red-300 ring-1 ring-red-500/40',
      };
      return `<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold ${map[s] || 'bg-slate-800 text-slate-300'}">${esc(s)}</span>`;
    };
    const counts = users.reduce((a, u) => { a[u.status] = (a[u.status] || 0) + 1; return a; }, {});
    const when = (ms) => ms ? new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
    host.innerHTML = `
      <div class="flex flex-wrap gap-2 mb-4 text-[11px]">
        <span class="px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-800">Total: <b class="text-slate-200">${users.length}</b></span>
        <span class="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">Pending: <b>${counts.pending || 0}</b></span>
        <span class="px-2.5 py-1 rounded-lg bg-success/10 border border-success/30 text-emerald-300">Approved: <b>${counts.approved || 0}</b></span>
        <span class="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300">Rejected: <b>${counts.rejected || 0}</b></span>
      </div>
      <div class="overflow-x-auto custom-scroll rounded-xl border border-slate-800">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-800">
              <th class="px-4 py-3 font-semibold">User</th>
              <th class="px-4 py-3 font-semibold">Status</th>
              <th class="px-4 py-3 font-semibold hidden sm:table-cell">Joined</th>
              <th class="px-4 py-3 font-semibold hidden md:table-cell">Last login</th>
              <th class="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${users.length ? users.map(u => `
              <tr class="border-b border-slate-800/70 hover:bg-slate-800/30" data-uid="${esc(u.id)}">
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2.5 min-w-0">
                    ${u.picture ? `<img src="${esc(u.picture)}" referrerpolicy="no-referrer" class="w-8 h-8 rounded-full object-cover shrink-0" alt="">`
                      : `<span class="grid place-items-center w-8 h-8 rounded-full bg-brand text-white text-xs font-bold shrink-0">${esc((u.name || u.email || '?').charAt(0).toUpperCase())}</span>`}
                    <div class="min-w-0">
                      <div class="text-slate-200 font-medium truncate">${esc(u.name || '—')}</div>
                      <div class="text-slate-500 text-[12px] truncate">${esc(u.email || '')}</div>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-col gap-1">
                    ${badge(u.status)}
                    ${u.sub_status === 'active'
                      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-400/15 text-amber-300 w-fit"><i data-lucide="crown" class="w-2.5 h-2.5"></i>${esc(u.sub_plan || 'premium')}</span>`
                      : `<span class="text-[10px] text-slate-600">free</span>`}
                  </div>
                </td>
                <td class="px-4 py-3 text-slate-400 hidden sm:table-cell">${when(u.created_at)}</td>
                <td class="px-4 py-3 text-slate-400 hidden md:table-cell">${when(u.last_login)}</td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2 justify-end flex-wrap">
                    <button data-act="approve" class="admin-act px-2.5 py-1 rounded-lg text-[12px] font-semibold bg-success/15 hover:bg-success/25 text-emerald-300 transition ${u.status === 'approved' ? 'opacity-40 pointer-events-none' : ''}">Approve</button>
                    <button data-act="reject" class="admin-act px-2.5 py-1 rounded-lg text-[12px] font-semibold bg-red-500/15 hover:bg-red-500/25 text-red-300 transition ${u.status === 'rejected' ? 'opacity-40 pointer-events-none' : ''}">Reject</button>
                    ${u.sub_status === 'active'
                      ? `<button data-sub="revoke" class="admin-sub px-2.5 py-1 rounded-lg text-[12px] font-semibold bg-slate-700/60 hover:bg-slate-700 text-slate-300 transition">Revoke PRO</button>`
                      : `<button data-sub="grant" class="admin-sub px-2.5 py-1 rounded-lg text-[12px] font-semibold bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 transition">Grant PRO</button>`}
                  </div>
                </td>
              </tr>`).join('') : `<tr><td colspan="5" class="px-4 py-8 text-center text-slate-500">No users have signed in yet.</td></tr>`}
          </tbody>
        </table>
      </div>`;
    icons();
    host.querySelectorAll('.admin-act').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tr = btn.closest('tr'); const id = tr.getAttribute('data-uid');
        const act = btn.getAttribute('data-act');
        btn.disabled = true;
        try {
          const r = await fetch('/api/admin/users/' + act, {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          });
          if (!r.ok) { const e = await r.json().catch(() => ({})); alert(e.error || 'Action failed'); btn.disabled = false; return; }
          loadAdminUsers();
        } catch { alert('Action failed'); btn.disabled = false; }
      });
    });
    host.querySelectorAll('.admin-sub').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tr = btn.closest('tr'); const id = tr.getAttribute('data-uid');
        const action = btn.getAttribute('data-sub'); // grant | revoke
        btn.disabled = true;
        try {
          const r = await fetch('/api/admin/users/subscription', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, action }),
          });
          if (!r.ok) { const e = await r.json().catch(() => ({})); alert(e.error || 'Action failed'); btn.disabled = false; return; }
          loadAdminUsers();
        } catch { alert('Action failed'); btn.disabled = false; }
      });
    });
  }

  function renderAccount() {
    const host = document.getElementById('account');
    if (!host) return;
    if (auth.user) {
      const name = auth.user.name || auth.user.email || 'Account';
      const initial = name.trim().charAt(0).toUpperCase() || '?';
      const avatar = auth.user.picture
        ? `<img src="${esc(auth.user.picture)}" referrerpolicy="no-referrer" class="w-7 h-7 rounded-full shrink-0 object-cover" alt="">`
        : `<span class="grid place-items-center w-7 h-7 rounded-full bg-brand text-white text-xs font-bold shrink-0">${esc(initial)}</span>`;
      host.innerHTML = `
        <div class="flex items-center gap-2 min-w-0">
          ${avatar}
          <div class="min-w-0 leading-tight flex-1">
            <div class="text-[12px] font-semibold text-slate-200 truncate">${esc(name)}</div>
            <div class="text-[10px] text-slate-500 flex items-center gap-1">
              <span id="sync-dot" class="w-1.5 h-1.5 rounded-full bg-success"></span>
              <span id="sync-label">Progress synced</span>
            </div>
          </div>
          ${auth.premium
            ? (auth.plan === 'trial' && auth.until
              ? `<span title="Free trial — ${trialLeft(auth.until)} left" class="shrink-0 inline-flex items-center gap-1 px-2 h-7 rounded-lg bg-emerald-500/15 text-emerald-300 text-[10px] font-bold"><i data-lucide="gift" class="w-3 h-3"></i>TRIAL ${trialLeft(auth.until)}</span>`
              : `<span title="Premium member" class="shrink-0 inline-flex items-center gap-1 px-2 h-7 rounded-lg bg-amber-400/15 text-amber-300 text-[10px] font-bold"><i data-lucide="crown" class="w-3 h-3"></i>PRO</span>`)
            : (allModules().some(x => x.module.locked)
              ? `<button id="upgrade-btn" title="Unlock all premium modules" class="shrink-0 inline-flex items-center gap-1 px-2 h-7 rounded-lg bg-brand hover:bg-brand-dark text-white text-[10px] font-bold transition"><i data-lucide="sparkles" class="w-3 h-3"></i>Premium</button>`
              : '')}
          ${auth.admin ? `<button id="admin-btn" title="Admin — manage user access" class="shrink-0 grid place-items-center w-7 h-7 rounded-lg bg-brand/15 hover:bg-brand/25 text-brand transition">
            <i data-lucide="shield-check" class="w-3.5 h-3.5"></i>
          </button>` : ''}
          <button id="logout-btn" title="Sign out" class="shrink-0 grid place-items-center w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition">
            <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
          </button>
        </div>`;
      const lo = document.getElementById('logout-btn');
      if (lo) lo.addEventListener('click', logout);
      const adminBtn = document.getElementById('admin-btn');
      if (adminBtn) adminBtn.addEventListener('click', renderAdminConsole);
      const upBtn = document.getElementById('upgrade-btn');
      if (upBtn) upBtn.addEventListener('click', () => renderUpgrade(null, null));
    } else if (auth.configured) {
      host.innerHTML = `
        <a href="/auth/google" title="Sign in to save your progress across devices"
           class="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 text-[12px] font-semibold transition shadow-sm">
          ${GOOGLE_G} Sign in with Google
        </a>`;
    } else {
      host.innerHTML = `
        <div class="text-[10px] text-slate-600 flex items-center gap-1.5" title="Sign-in is not configured on this server; progress is saved in this browser.">
          <i data-lucide="hard-drive" class="w-3 h-3"></i> Saved on this device
        </div>`;
    }
    icons();
  }

export { refreshAuth, syncFromServer, pushToServer, setSyncDot, logout,
  renderAdminConsole, loadAdminUsers, renderAccount };

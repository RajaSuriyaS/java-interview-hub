/* ============================================================
   Java Interview Hub — app engine
   Rendering, navigation, localStorage progress, flashcards,
   markdown+callouts, and the Monaco-based live code sandbox.
   ============================================================ */
(function () {
  'use strict';

  const STORAGE_KEY = 'jih.v1';
  const STATUSES = ['not_started', 'in_progress', 'completed'];
  const STATUS_LABEL = { not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed' };
  const STATUS_NEXT = { not_started: 'in_progress', in_progress: 'completed', completed: 'not_started' };

  // ---- persistent state ----
  // activity: { 'YYYY-MM-DD': 1 } study-day log (drives the streak); resumeModule
  // survives dashboard visits (lastModule is nulled there for restore-on-reload).
  const defaultState = () => ({ status: {}, notes: {}, openPhases: {}, lastModule: null, resumeModule: null, activity: {}, cards: {}, mockHistory: [] });
  let state = load();

  // Stable key for a flashcard: moduleId + short hash of the question text.
  // Marks ('again' | 'known') persist across sessions and sync to the server.
  function cardKey(modId, q) {
    let h = 5381;
    for (let i = 0; i < q.length; i++) h = ((h << 5) + h + q.charCodeAt(i)) | 0;
    return modId + ':' + (h >>> 0).toString(36);
  }
  // All cards currently marked 'again' → the cross-module review queue.
  function reviewQueue() {
    const out = [];
    for (const p of CURRICULUM) for (const m of p.modules) for (const s of (m.sections || [m])) {
      for (const c of (s.flashcards || [])) {
        if (typeof c.q !== 'string') continue;
        if ((state.cards || {})[cardKey(m.id, c.q)] === 'again') {
          out.push({ q: c.q, a: c.a, modId: m.id, modTitle: m.title, phaseTitle: p.title });
        }
      }
    }
    return out;
  }

  // ---- study streak ----
  const dayKey = (d = new Date()) => {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  function markActivity() {
    if (!state.activity) state.activity = {};
    const k = dayKey();
    if (state.activity[k]) return false;
    state.activity[k] = 1;
    // keep the log bounded (~13 months)
    const keys = Object.keys(state.activity).sort();
    while (keys.length > 400) delete state.activity[keys.shift()];
    return true;
  }
  function studyStreak() {
    const act = state.activity || {};
    let streak = 0;
    const d = new Date();
    if (!act[dayKey(d)]) d.setDate(d.getDate() - 1); // allow "yesterday" so a morning visit doesn't show 0
    while (act[dayKey(d)]) { streak++; d.setDate(d.getDate() - 1); }
    return streak;
  }

  // ---- auth / cloud sync state ----
  let auth = { configured: false, user: null }; // populated from /auth/me
  let _syncTimer = null;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      return Object.assign(defaultState(), JSON.parse(raw));
    } catch (e) {
      console.warn('Failed to load state', e);
      return defaultState();
    }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { console.warn('Failed to save state', e); }
    pushToServer(); // no-op unless signed in
  }

  // ---- lookups ----
  const allModules = () => CURRICULUM.flatMap(p => p.modules.map(m => ({ phase: p, module: m })));
  const findModule = (id) => allModules().find(x => x.module.id === id);
  const statusOf = (id) => state.status[id] || 'not_started';

  // ---- progress maths ----
  function phaseProgress(phase) {
    const mods = phase.modules;
    const completed = mods.filter(m => statusOf(m.id) === 'completed').length;
    const inProgress = mods.filter(m => statusOf(m.id) === 'in_progress').length;
    const totalHours = mods.reduce((s, m) => s + m.hours, 0);
    const doneHours = mods.filter(m => statusOf(m.id) === 'completed').reduce((s, m) => s + m.hours, 0);
    // in-progress counts as half for the % ring
    const pct = mods.length ? Math.round(((completed + inProgress * 0.5) / mods.length) * 100) : 0;
    return { completed, inProgress, total: mods.length, pct, totalHours, doneHours };
  }
  function globalProgress() {
    const mods = allModules().map(x => x.module);
    const completed = mods.filter(m => statusOf(m.id) === 'completed').length;
    const inProgress = mods.filter(m => statusOf(m.id) === 'in_progress').length;
    const totalHours = mods.reduce((s, m) => s + m.hours, 0);
    const doneHours = mods.filter(m => statusOf(m.id) === 'completed').reduce((s, m) => s + m.hours, 0);
    const pct = mods.length ? Math.round(((completed + inProgress * 0.5) / mods.length) * 100) : 0;
    return { completed, inProgress, total: mods.length, pct, totalHours, doneHours };
  }

  // ---- DOM helpers ----
  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, attrs = {}, html) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') n.className = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) n.setAttribute(k, v);
    });
    if (html !== undefined) n.innerHTML = html;
    return n;
  };
  const icons = () => window.lucide && window.lucide.createIcons();
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ===================== SIDEBAR NAV ===================== */
  const anyPhaseOpen = () => CURRICULUM.some(p => state.openPhases[p.id]);
  function refreshCollapseAllBtn() {
    const label = document.getElementById('collapse-all-label');
    const btn = document.getElementById('collapse-all');
    if (!label || !btn) return;
    const open = anyPhaseOpen();
    label.textContent = open ? 'Collapse all' : 'Expand all';
    const ico = btn.querySelector('[data-lucide]');
    if (ico) { ico.setAttribute('data-lucide', open ? 'chevrons-down-up' : 'chevrons-up-down'); icons(); }
  }

  function renderNav(filter = '') {
    const nav = $('#nav');
    nav.innerHTML = '';
    const q = filter.trim().toLowerCase();

    CURRICULUM.forEach((phase, idx) => {
      // Deep search: match section titles, and (for queries of 3+ chars) the notes
      // body when a term appears repeatedly — so topics buried inside modules
      // (Predicate, producer-consumer, wait/notify…) are findable.
      const secMatch = (m) => q ? (m.sections || []).findIndex(s => (s.title || '').toLowerCase().includes(q)) : -1;
      const notesMatch = (m) => {
        if (!q || q.length < 3) return -1;
        return (m.sections || []).findIndex(s => {
          const n = (s.notes || '').toLowerCase();
          let c = 0, i = -1;
          while ((i = n.indexOf(q, i + 1)) !== -1 && c < 3) c++;
          return c >= 3; // repeated mentions = the section actually teaches it
        });
      };
      const matches = (m) => !q ||
        m.title.toLowerCase().includes(q) || m.id.includes(q) ||
        phase.title.toLowerCase().includes(q) || secMatch(m) >= 0 || notesMatch(m) >= 0;
      const visibleMods = phase.modules.filter(matches);
      if (q && visibleMods.length === 0) return;

      const pp = phaseProgress(phase);
      // Default: all phases collapsed — show the main topics only until expanded.
      const isOpen = q ? true : (state.openPhases[phase.id] ?? false);

      const phaseEl = el('div', { class: 'nav-phase' + (isOpen ? ' open' : '') });

      const header = el('button', {
        class: 'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-slate-800/70 transition text-left group'
      });
      header.innerHTML = `
        <i data-lucide="chevron-right" class="chevron w-4 h-4 text-slate-500 shrink-0"></i>
        <i data-lucide="${phase.icon}" class="w-4 h-4 text-brand shrink-0"></i>
        <span class="flex-1 text-sm font-semibold text-slate-200 truncate">${esc(phase.title)}</span>
        <span class="text-[10px] font-bold ${pp.pct === 100 ? 'text-success' : 'text-slate-500'} shrink-0">${pp.pct}%</span>`;
      header.addEventListener('click', () => {
        if (!q) { state.openPhases[phase.id] = !isOpen; save(); }
        phaseEl.classList.toggle('open');
        refreshCollapseAllBtn();
      });

      const body = el('div', { class: 'nav-phase-body' });
      const list = el('div', { class: 'pl-3 pr-1 py-1 space-y-0.5' });

      // mini progress bar under header
      const bar = el('div', { class: 'mx-3 mb-1 h-1 rounded-full bg-slate-800 overflow-hidden' });
      bar.innerHTML = `<div class="h-full ${pp.pct === 100 ? 'bg-success' : 'bg-brand'}" style="width:${pp.pct}%"></div>`;
      list.appendChild(bar);

      visibleMods.forEach(m => {
        const st = statusOf(m.id);
        const active = state.lastModule === m.id;
        // If only a SECTION matched the search, show it and open it directly.
        let mi = secMatch(m);
        if (mi < 0) mi = notesMatch(m);
        const moduleHit = q && (m.title.toLowerCase().includes(q) || m.id.includes(q));
        const secHint = (mi >= 0 && !moduleHit) ? m.sections[mi].title : null;
        const item = el('button', {
          class: 'w-full flex flex-wrap items-center gap-x-2.5 gap-y-0.5 px-3 py-2 rounded-lg text-left transition ' +
                 (active ? 'bg-brand/20 ring-1 ring-brand/40' : 'hover:bg-slate-800/60')
        });
        item.innerHTML = `
          <span class="status-dot status-${st}"></span>
          <span class="text-[11px] font-mono text-slate-500 shrink-0">${esc(m.id)}</span>
          <span class="flex-1 text-[13px] ${st === 'completed' ? 'text-slate-400 line-through decoration-slate-600' : 'text-slate-300'} truncate">${esc(m.title)}</span>
          ${m.locked
            ? `<i data-lucide="lock" class="w-3 h-3 text-brand/70 shrink-0" title="Premium"></i>`
            : `<span class="text-[10px] text-slate-600 shrink-0">${m.hours}h</span>`}
          ${secHint ? `<span class="basis-full pl-6 text-[11px] text-brand truncate">↳ ${esc(secHint)}</span>` : ''}`;
        item.addEventListener('click', () => openModule(m.id, mi >= 0 ? mi : undefined));
        list.appendChild(item);
      });

      body.appendChild(list);
      phaseEl.appendChild(header);
      phaseEl.appendChild(body);
      nav.appendChild(phaseEl);
    });
    icons();
    refreshCollapseAllBtn();
    // keep the active module visible in a 57-module sidebar (skip while searching)
    if (!q) {
      const activeEl = nav.querySelector('.ring-brand\\/40');
      if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    }
  }

  /* ===================== SIDEBAR GLOBAL PROGRESS ===================== */
  function renderGlobalProgress() {
    const g = globalProgress();
    $('#global-pct').textContent = g.pct + '%';
    $('#global-bar').style.width = g.pct + '%';
    $('#global-hours').textContent = `${g.doneHours} / ${g.totalHours} hrs`;
    $('#global-modules').textContent = `${g.completed} / ${g.total} modules`;
  }

  /* ===================== DASHBOARD ===================== */
  function ring(pct, label, sub) {
    const r = 34, circ = 2 * Math.PI * r;
    const off = circ * (1 - pct / 100);
    const color = pct === 100 ? '#10b981' : pct > 0 ? '#8b5cf6' : '#334155';
    return `
      <div class="flex flex-col items-center gap-2">
        <div class="relative w-24 h-24">
          <svg class="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
            <circle class="ring-bg" cx="40" cy="40" r="${r}" fill="none" stroke-width="7"></circle>
            <circle cx="40" cy="40" r="${r}" fill="none" stroke-width="7"
              stroke="${color}" stroke-linecap="round"
              stroke-dasharray="${circ}" stroke-dashoffset="${off}"
              style="transition:stroke-dashoffset .6s ease"></circle>
          </svg>
          <div class="absolute inset-0 grid place-items-center">
            <span class="text-lg font-bold ${pct === 100 ? 'text-success' : 'text-white'}">${pct}%</span>
          </div>
        </div>
        <div class="text-center">
          <div class="text-xs font-semibold text-slate-200 leading-tight max-w-[120px]">${esc(label)}</div>
          <div class="text-[10px] text-slate-500">${esc(sub)}</div>
        </div>
      </div>`;
  }

  function renderDashboard() {
    state.lastModule = null; save();
    const g = globalProgress();
    const content = $('#content');
    const remainingHours = g.totalHours - g.doneHours;

    // ---- "continue studying" hero data ----
    const flat = allModules();
    const resume = state.resumeModule ? flat.find(x => x.module.id === state.resumeModule) : null;
    // next module worth studying: first not-completed after the resume point (wrapping), else first not-completed
    let next = null;
    if (flat.length) {
      const startIdx = resume ? flat.findIndex(x => x.module.id === resume.module.id) + 1 : 0;
      for (let i = 0; i < flat.length; i++) {
        const cand = flat[(startIdx + i) % flat.length];
        if (statusOf(cand.module.id) !== 'completed' && (!resume || cand.module.id !== resume.module.id)) { next = cand; break; }
      }
    }
    const streak = studyStreak();
    const rq = reviewQueue();
    const lastMock = (state.mockHistory || [])[0];

    const heroCard = (kicker, item, primary) => item ? `
      <button data-open="${esc(item.module.id)}" class="hero-open flex-1 min-w-[240px] text-left rounded-xl p-5 transition group border ${primary
        ? 'bg-gradient-to-br from-brand/25 to-indigo-900/30 border-brand/50 hover:border-brand shadow-lg shadow-brand/10'
        : 'bg-slate-900/50 border-slate-800 hover:border-slate-600'}">
        <div class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider ${primary ? 'text-brand' : 'text-slate-500'} mb-2">
          <i data-lucide="${primary ? 'play-circle' : 'arrow-right-circle'}" class="w-4 h-4"></i> ${kicker}
        </div>
        <div class="font-semibold ${primary ? 'text-white' : 'text-slate-200'} leading-snug group-hover:text-brand transition">
          <span class="font-mono text-[12px] opacity-60 mr-1.5">${esc(item.module.id)}</span>${esc(item.module.title)}
        </div>
        <div class="text-[11px] text-slate-500 mt-1.5 flex items-center gap-2">
          <span>${esc(item.phase.title)}</span>
          <span class="status-dot status-${statusOf(item.module.id)}"></span>
        </div>
      </button>` : '';

    const statCard = (icon, value, label, accent) => `
      <div class="rounded-xl border border-slate-800 bg-slate-900/50 p-5 flex items-center gap-4">
        <div class="grid place-items-center w-12 h-12 rounded-lg ${accent}">
          <i data-lucide="${icon}" class="w-6 h-6"></i>
        </div>
        <div>
          <div class="text-2xl font-bold text-white leading-none">${value}</div>
          <div class="text-xs text-slate-400 mt-1">${label}</div>
        </div>
      </div>`;

    content.innerHTML = `
      <div class="w-full px-4 sm:px-8 lg:px-12 xl:px-16 py-8 fade-up">
        <div class="flex items-start justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 class="text-3xl font-extrabold text-white tracking-tight">Senior Java Backend Study Hub</h1>
            <p class="text-slate-400 mt-1.5">Deep-dive prep for senior backend interviews. Track progress, run code, drill flashcards.</p>
          </div>
          <div class="text-right shrink-0">
            <div class="text-4xl font-extrabold text-brand leading-none">${g.pct}%</div>
            <div class="text-xs text-slate-500 mt-1">overall ready</div>
          </div>
        </div>

        <!-- continue studying / streak hero -->
        <div class="flex flex-wrap items-stretch gap-4 mb-8">
          ${heroCard(resume ? 'Continue studying' : 'Start here', resume || next, true)}
          ${resume ? heroCard('Up next', next, false) : ''}
          <div class="rounded-xl border border-slate-800 bg-slate-900/50 px-5 py-4 flex flex-col items-center justify-center min-w-[120px]">
            <div class="text-2xl leading-none mb-1">${streak > 0 ? '🔥' : '🌱'}</div>
            <div class="text-2xl font-extrabold ${streak > 0 ? 'text-amber-400' : 'text-slate-500'} leading-none">${streak}</div>
            <div class="text-[10px] text-slate-500 mt-1 text-center leading-tight">day streak<br/>${streak > 0 ? 'keep it up!' : 'study today'}</div>
          </div>
        </div>

        <!-- study tools: review queue / mock interview / stats -->
        <div class="grid sm:grid-cols-3 gap-4 mb-8">
          <button id="go-review" class="text-left rounded-xl border ${rq.length ? 'border-amber-500/40 bg-amber-500/[0.06] hover:border-amber-400' : 'border-slate-800 bg-slate-900/40 hover:border-slate-600'} p-4 transition group">
            <div class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider ${rq.length ? 'text-amber-400' : 'text-slate-500'} mb-1.5">
              <i data-lucide="rotate-cw" class="w-4 h-4"></i> Review queue
            </div>
            <div class="text-sm ${rq.length ? 'text-slate-200' : 'text-slate-500'}">${rq.length ? `<strong class="text-amber-300">${rq.length}</strong> card${rq.length === 1 ? '' : 's'} waiting — clear them!` : 'Empty — mark cards ↻ Review while studying'}</div>
          </button>
          <button id="go-mock" class="text-left rounded-xl border border-slate-800 bg-slate-900/40 hover:border-brand/60 p-4 transition group">
            <div class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-brand mb-1.5">
              <i data-lucide="mic" class="w-4 h-4"></i> Mock interview
            </div>
            <div class="text-sm text-slate-300">10 random questions, timed${lastMock ? ` · last: <strong class="text-white">${lastMock.pts}/${lastMock.max}</strong>` : ''}</div>
          </button>
          <button id="go-stats" class="text-left rounded-xl border border-slate-800 bg-slate-900/40 hover:border-sky-500/60 p-4 transition group">
            <div class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-sky-400 mb-1.5">
              <i data-lucide="bar-chart-3" class="w-4 h-4"></i> Detailed stats
            </div>
            <div class="text-sm text-slate-300">Per-phase progress &amp; what to focus on next</div>
          </button>
        </div>

        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          ${statCard('check-circle-2', `${g.completed}/${g.total}`, 'Modules completed', 'bg-success/15 text-success')}
          ${statCard('clock', `${g.doneHours}h`, 'Hours studied', 'bg-brand/15 text-brand')}
          ${statCard('hourglass', `${remainingHours}h`, 'Hours remaining', 'bg-amber-500/15 text-amber-400')}
          ${statCard('layers', `${CURRICULUM.length}`, 'Phases', 'bg-sky-500/15 text-sky-400')}
        </div>

        <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-6 mb-8">
          <h2 class="text-sm font-semibold text-slate-300 mb-5 flex items-center gap-2">
            <i data-lucide="target" class="w-4 h-4 text-brand"></i> Progress by phase
          </h2>
          <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-y-6 gap-x-2">
            ${CURRICULUM.map(p => {
              const pp = phaseProgress(p);
              return ring(pp.pct, p.title, `${pp.completed}/${pp.total} · ${pp.totalHours}h`);
            }).join('')}
          </div>
        </div>

        <h2 class="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <i data-lucide="book-open" class="w-4 h-4 text-brand"></i> Phases
        </h2>
        <div class="grid sm:grid-cols-2 gap-4">
          ${CURRICULUM.map(p => {
            const pp = phaseProgress(p);
            return `
            <button data-phase="${p.id}" class="phase-card text-left rounded-xl border border-slate-800 bg-slate-900/40 hover:border-brand/50 hover:bg-slate-900/70 transition p-5 group">
              <div class="flex items-center gap-3 mb-2">
                <div class="grid place-items-center w-9 h-9 rounded-lg bg-brand/15 text-brand">
                  <i data-lucide="${p.icon}" class="w-5 h-5"></i>
                </div>
                <h3 class="font-semibold text-white group-hover:text-brand transition">${esc(p.title)}</h3>
              </div>
              <p class="text-xs text-slate-400 leading-relaxed mb-3">${esc(p.blurb)}</p>
              <div class="flex items-center gap-3">
                <div class="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div class="h-full ${pp.pct === 100 ? 'bg-success' : 'bg-brand'}" style="width:${pp.pct}%"></div>
                </div>
                <span class="text-[11px] text-slate-500 shrink-0">${pp.total} modules</span>
              </div>
            </button>`;
          }).join('')}
        </div>
        <div class="h-8"></div>
      </div>`;

    content.querySelectorAll('.hero-open').forEach(btn =>
      btn.addEventListener('click', () => openModule(btn.getAttribute('data-open'))));
    const on = (id, fn) => { const b = document.getElementById(id); if (b) b.addEventListener('click', fn); };
    on('go-review', renderReviewQueue);
    on('go-mock', renderMockInterview);
    on('go-stats', renderStatsPage);

    content.querySelectorAll('.phase-card').forEach(card => {
      card.addEventListener('click', () => {
        const pid = card.getAttribute('data-phase');
        const phase = CURRICULUM.find(p => p.id === pid);
        state.openPhases[pid] = true; save();
        renderNav($('#search').value);
        if (phase && phase.modules[0]) openModule(phase.modules[0].id);
      });
    });
    icons();
    renderGlobalProgress();
  }

  /* ===================== REVIEW QUEUE (spaced repetition) ===================== */
  function renderReviewQueue() {
    state.lastModule = null; save();
    const content = $('#content');
    content.scrollTop = 0;
    const items = reviewQueue();

    const backBtn = `<button id="rq-back" class="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand transition mb-4"><i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> Dashboard</button>`;

    if (!items.length) {
      content.innerHTML = `<div class="w-full max-w-2xl mx-auto px-6 py-12 text-center fade-up">${backBtn}
        <div class="text-5xl mb-4">🎉</div>
        <h1 class="text-2xl font-extrabold text-white mb-2">Review queue is empty</h1>
        <p class="text-slate-400 text-sm leading-relaxed">While drilling flashcards, mark tough ones <strong class="text-amber-300">↻ Review</strong> — they'll collect here so you can clear them in one focused session.</p>
      </div>`;
      document.getElementById('rq-back').addEventListener('click', renderDashboard);
      icons();
      return;
    }

    content.innerHTML = `
      <div class="w-full px-4 sm:px-8 lg:px-12 xl:px-16 py-7 fade-up">
        ${backBtn}
        <div class="flex items-center justify-between flex-wrap gap-3 mb-1">
          <h1 class="text-2xl font-extrabold text-white">🔁 Review queue</h1>
          <span class="text-sm text-slate-400"><strong id="rq-count" class="text-amber-300">${items.length}</strong> to clear</span>
        </div>
        <p class="text-[13px] text-slate-500 mb-6">Cards you marked ↻ Review, from every module. Flip, answer out loud, then <strong class="text-emerald-300">✓ Got it</strong> to clear — or keep it for next time.</p>
        <div class="grid sm:grid-cols-2 gap-4" id="rq-grid">
          ${items.map((c, i) => `
            <div class="flip-card" data-i="${i}">
              <div class="flip-inner">
                <div class="flip-face flip-front">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-[10px] uppercase tracking-wider text-amber-400 font-bold">Review</span>
                    <button class="rq-mod text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-brand transition" data-mod="${esc(c.modId)}" title="${esc(c.modTitle)}">${esc(c.modId)}</button>
                  </div>
                  <div class="text-[15px] text-slate-100 font-medium leading-snug">${esc(c.q)}</div>
                  <div class="mt-auto pt-3 text-[10px] text-slate-500">click to flip</div>
                </div>
                <div class="flip-face flip-back">
                  <div class="text-[10px] uppercase tracking-wider text-success font-bold mb-2">Answer</div>
                  <div class="text-[13.5px] text-slate-200 leading-relaxed">${esc(c.a)}</div>
                  <div class="mt-auto pt-3 flex items-center gap-2">
                    <button class="rq-known flex-1 text-[11px] font-bold px-2 py-1.5 rounded-lg bg-success/15 text-emerald-300 ring-1 ring-success/40 hover:bg-success/30 transition">✓ Got it — clear</button>
                    <button class="rq-keep flex-1 text-[11px] font-bold px-2 py-1.5 rounded-lg bg-slate-800 text-slate-400 ring-1 ring-slate-700 hover:text-slate-200 transition">Keep for later</button>
                  </div>
                </div>
              </div>
            </div>`).join('')}
        </div>
        <div class="h-8"></div>
      </div>`;

    document.getElementById('rq-back').addEventListener('click', renderDashboard);
    const grid = document.getElementById('rq-grid');
    grid.querySelectorAll('.flip-card').forEach((card) => {
      const item = items[parseInt(card.getAttribute('data-i'))];
      card.addEventListener('click', () => card.classList.toggle('flipped'));
      card.querySelector('.rq-mod').addEventListener('click', (e) => { e.stopPropagation(); openModule(item.modId); });
      card.querySelector('.rq-known').addEventListener('click', (e) => {
        e.stopPropagation();
        state.cards[cardKey(item.modId, item.q)] = 'known';
        markActivity(); save();
        card.style.transition = 'opacity .25s, transform .25s';
        card.style.opacity = '0'; card.style.transform = 'scale(.95)';
        setTimeout(() => {
          card.remove();
          const left = grid.querySelectorAll('.flip-card').length;
          const cnt = document.getElementById('rq-count');
          if (cnt) cnt.textContent = left;
          if (!left) renderReviewQueue(); // show the empty-state celebration
        }, 250);
      });
      card.querySelector('.rq-keep').addEventListener('click', (e) => { e.stopPropagation(); card.classList.remove('flipped'); });
    });
    icons();
  }

  /* ===================== MOCK INTERVIEW MODE ===================== */
  let _mockTimer = null;
  function renderMockInterview() {
    state.lastModule = null; save();
    const content = $('#content');
    content.scrollTop = 0;
    clearInterval(_mockTimer);

    // question pool from every module's interview bank
    const pool = [];
    if (typeof INTERVIEW_QUESTIONS !== 'undefined') {
      for (const [modId, qs] of Object.entries(INTERVIEW_QUESTIONS)) {
        (qs || []).forEach(x => pool.push({ modId, q: x.q, a: x.a }));
      }
    }
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const QN = Math.min(10, pool.length);
    const deck = pool.slice(0, QN);

    content.innerHTML = `
      <div class="w-full max-w-3xl mx-auto px-6 py-10 fade-up">
        <button id="mi-back" class="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand transition mb-6"><i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> Dashboard</button>
        <div class="text-center rounded-2xl border border-slate-800 bg-slate-900/50 p-10">
          <div class="text-5xl mb-4">🎤</div>
          <h1 class="text-2xl font-extrabold text-white mb-3">Mock interview</h1>
          <p class="text-slate-400 text-sm leading-relaxed max-w-md mx-auto mb-2">${QN} random questions drawn from all ${pool.length} across the curriculum. For each one:</p>
          <ol class="text-slate-300 text-sm text-left max-w-sm mx-auto mb-6 space-y-1.5 list-decimal pl-5">
            <li><strong>Answer OUT LOUD</strong> — 2–3 minutes, as if a panel is listening.</li>
            <li>Reveal the model answer and compare honestly.</li>
            <li>Score yourself: Nailed it / Partial / Missed.</li>
          </ol>
          <button id="mi-start" class="px-6 py-3 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold text-sm transition shadow-lg shadow-brand/30">Start — the clock runs ⏱</button>
        </div>
      </div>`;
    document.getElementById('mi-back').addEventListener('click', renderDashboard);
    icons();

    document.getElementById('mi-start').addEventListener('click', () => {
      const t0 = Date.now();
      const scores = []; // 2 nailed / 1 partial / 0 missed
      let idx = 0;

      _mockTimer = setInterval(() => {
        const elT = document.getElementById('mi-clock');
        if (!elT) { clearInterval(_mockTimer); return; }
        const s = Math.floor((Date.now() - t0) / 1000);
        elT.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      }, 1000);

      function question() {
        const item = deck[idx];
        content.scrollTop = 0;
        content.innerHTML = `
          <div class="w-full max-w-3xl mx-auto px-6 py-8 fade-up">
            <div class="flex items-center justify-between mb-6 text-xs text-slate-500">
              <span>Question <strong class="text-white">${idx + 1}</strong> / ${QN}</span>
              <span class="font-mono text-amber-400" id="mi-clock">--:--</span>
            </div>
            <div class="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden mb-8"><div class="h-full bg-brand transition-all" style="width:${(idx / QN * 100).toFixed(0)}%"></div></div>
            <div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-8">
              <div class="text-[10px] font-mono text-slate-500 mb-3">from module ${esc(item.modId)}</div>
              <div class="text-xl font-semibold text-white leading-snug mb-6">${esc(item.q)}</div>
              <div id="mi-answer" class="hidden rounded-xl bg-slate-950/60 border border-slate-800 p-5 text-[14px] text-slate-300 leading-relaxed mb-6"></div>
              <div id="mi-actions" class="flex flex-wrap gap-3">
                <button id="mi-reveal" class="px-5 py-2.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-bold transition">Reveal model answer</button>
              </div>
            </div>
            <p class="text-center text-[11px] text-slate-600 mt-4">Answer out loud first — that's the whole point.</p>
          </div>`;
        document.getElementById('mi-reveal').addEventListener('click', () => {
          const a = document.getElementById('mi-answer');
          a.textContent = item.a;
          a.classList.remove('hidden');
          document.getElementById('mi-actions').innerHTML = `
            <button data-s="2" class="mi-score flex-1 px-4 py-2.5 rounded-lg bg-success/15 text-emerald-300 ring-1 ring-success/40 hover:bg-success/30 text-sm font-bold transition">✓ Nailed it</button>
            <button data-s="1" class="mi-score flex-1 px-4 py-2.5 rounded-lg bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40 hover:bg-amber-500/30 text-sm font-bold transition">~ Partial</button>
            <button data-s="0" class="mi-score flex-1 px-4 py-2.5 rounded-lg bg-red-500/10 text-red-300 ring-1 ring-red-500/40 hover:bg-red-500/25 text-sm font-bold transition">✗ Missed</button>`;
          document.querySelectorAll('.mi-score').forEach(b => b.addEventListener('click', () => {
            scores.push(parseInt(b.getAttribute('data-s')));
            idx++;
            if (idx < QN) question(); else summary();
          }));
        });
      }

      function summary() {
        clearInterval(_mockTimer);
        const dur = Math.floor((Date.now() - t0) / 1000);
        const pts = scores.reduce((a, b) => a + b, 0), max = QN * 2;
        const nailed = scores.filter(s => s === 2).length, partial = scores.filter(s => s === 1).length, missed = scores.filter(s => s === 0).length;
        state.mockHistory = [{ when: new Date().toISOString(), pts, max, dur }, ...(state.mockHistory || [])].slice(0, 10);
        markActivity(); save();
        const durStr = Math.floor(dur / 60) + 'm ' + (dur % 60) + 's';
        const verdict = pts >= max * 0.8 ? 'Interview-ready on this sample. 🏆' : pts >= max * 0.5 ? 'Solid — drill the misses below and rerun.' : 'Good practice — the misses show you exactly what to study.';
        const missedItems = deck.filter((_, i) => scores[i] === 0);
        content.scrollTop = 0;
        content.innerHTML = `
          <div class="w-full max-w-3xl mx-auto px-6 py-10 fade-up">
            <div class="text-center mb-8">
              <div class="text-5xl mb-3">${pts >= max * 0.8 ? '🏆' : pts >= max * 0.5 ? '💪' : '📚'}</div>
              <h1 class="text-3xl font-extrabold text-white mb-1">${pts} / ${max}</h1>
              <p class="text-slate-400 text-sm">${verdict}</p>
              <div class="flex items-center justify-center gap-5 mt-4 text-[13px]">
                <span class="text-emerald-300">✓ ${nailed} nailed</span>
                <span class="text-amber-300">~ ${partial} partial</span>
                <span class="text-red-300">✗ ${missed} missed</span>
                <span class="text-slate-500">⏱ ${durStr}</span>
              </div>
            </div>
            ${missedItems.length ? `
            <h2 class="text-sm font-bold text-slate-300 mb-3">Study these before your next run:</h2>
            <div class="space-y-2.5 mb-8">
              ${missedItems.map(mi => `
                <button class="mi-open w-full text-left rounded-lg border border-slate-800 bg-slate-900/40 hover:border-brand/50 px-4 py-3 transition" data-mod="${esc(mi.modId)}">
                  <div class="text-[13px] text-slate-200 leading-snug">${esc(mi.q)}</div>
                  <div class="text-[10px] font-mono text-brand mt-1">open module ${esc(mi.modId)} →</div>
                </button>`).join('')}
            </div>` : ''}
            <div class="flex items-center justify-center gap-3">
              <button id="mi-again" class="px-5 py-2.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-bold transition">Run another 10</button>
              <button id="mi-done" class="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition">Back to dashboard</button>
            </div>
          </div>`;
        document.querySelectorAll('.mi-open').forEach(b => b.addEventListener('click', () => openModule(b.getAttribute('data-mod'))));
        document.getElementById('mi-again').addEventListener('click', renderMockInterview);
        document.getElementById('mi-done').addEventListener('click', renderDashboard);
      }

      question();
    });
  }

  /* ===================== STATS PAGE ===================== */
  function renderStatsPage() {
    state.lastModule = null; save();
    const content = $('#content');
    content.scrollTop = 0;
    const g = globalProgress();
    const rq = reviewQueue();
    const knownCount = Object.values(state.cards || {}).filter(v => v === 'known').length;
    const streak = studyStreak();

    // per-phase rows + weakest-area suggestions
    const rows = CURRICULUM.map(p => {
      const pp = phaseProgress(p);
      const again = rq.filter(c => c.phaseTitle === p.title).length;
      return { p, pp, again };
    });
    const focus = rows.filter(r => r.pp.pct < 100).sort((a, b) => a.pp.pct - b.pp.pct).slice(0, 3);

    content.innerHTML = `
      <div class="w-full px-4 sm:px-8 lg:px-12 xl:px-16 py-7 fade-up">
        <button id="st-back" class="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand transition mb-4"><i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> Dashboard</button>
        <h1 class="text-2xl font-extrabold text-white mb-6">📊 Your stats</h1>

        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          ${[
            [g.pct + '%', 'overall ready', 'text-brand'],
            [g.completed + '/' + g.total, 'modules done', 'text-white'],
            [g.doneHours + 'h', 'hours studied', 'text-white'],
            [String(knownCount), 'cards mastered', 'text-emerald-300'],
            [String(rq.length), 'cards to review', rq.length ? 'text-amber-300' : 'text-slate-500'],
            [streak + 'd', 'study streak', streak ? 'text-amber-400' : 'text-slate-500'],
          ].map(([v, l, c]) => `
            <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-center">
              <div class="text-xl font-extrabold ${c} leading-none">${v}</div>
              <div class="text-[10px] text-slate-500 mt-1.5">${l}</div>
            </div>`).join('')}
        </div>

        ${focus.length ? `
        <div class="rounded-xl border border-brand/40 bg-brand/[0.06] p-5 mb-8">
          <h2 class="text-sm font-bold text-brand mb-3 flex items-center gap-2"><i data-lucide="crosshair" class="w-4 h-4"></i> Focus next</h2>
          <div class="grid sm:grid-cols-3 gap-3">
            ${focus.map(f => `
              <button class="st-focus text-left rounded-lg bg-slate-900/60 border border-slate-800 hover:border-brand/60 px-4 py-3 transition" data-phase="${esc(f.p.id)}">
                <div class="text-[13px] font-semibold text-slate-200">${esc(f.p.title)}</div>
                <div class="text-[11px] text-slate-500 mt-0.5">${f.pp.pct}% done · ${f.pp.total - f.pp.completed} modules left${f.again ? ` · ${f.again} cards to review` : ''}</div>
              </button>`).join('')}
          </div>
        </div>` : `<div class="rounded-xl border border-success/40 bg-success/[0.06] p-5 mb-8 text-emerald-300 text-sm font-semibold">🏆 Every phase complete — you're ready. Keep the review queue empty and run mocks.</div>`}

        <h2 class="text-sm font-bold text-slate-300 mb-3">Progress by phase</h2>
        <div class="space-y-2 mb-8">
          ${rows.map(({ p, pp, again }) => `
            <button class="st-phase w-full flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 hover:border-slate-600 px-4 py-2.5 transition text-left" data-phase="${esc(p.id)}">
              <span class="w-56 shrink-0 text-[12.5px] ${pp.pct === 100 ? 'text-slate-500' : 'text-slate-300'} truncate">${esc(p.title)}</span>
              <span class="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden"><span class="block h-full ${pp.pct === 100 ? 'bg-success' : 'bg-brand'}" style="width:${pp.pct}%"></span></span>
              <span class="w-10 text-right text-[11px] font-bold ${pp.pct === 100 ? 'text-success' : 'text-slate-400'}">${pp.pct}%</span>
              <span class="w-20 text-right text-[10px] text-slate-600">${pp.completed}/${pp.total} · ${pp.totalHours}h</span>
              <span class="w-16 text-right text-[10px] ${again ? 'text-amber-400' : 'text-slate-700'}">${again ? again + ' ↻' : ''}</span>
            </button>`).join('')}
        </div>

        ${(state.mockHistory || []).length ? `
        <h2 class="text-sm font-bold text-slate-300 mb-3">Mock interview history</h2>
        <div class="space-y-1.5 mb-8">
          ${(state.mockHistory || []).slice(0, 5).map(h => {
            const pct = Math.round(h.pts / h.max * 100);
            return `<div class="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2 text-[12px]">
              <span class="text-slate-500 w-24">${new Date(h.when).toLocaleDateString()}</span>
              <span class="font-bold ${pct >= 80 ? 'text-emerald-300' : pct >= 50 ? 'text-amber-300' : 'text-red-300'} w-14">${h.pts}/${h.max}</span>
              <span class="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden"><span class="block h-full ${pct >= 80 ? 'bg-success' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}" style="width:${pct}%"></span></span>
              <span class="text-slate-600">${Math.floor(h.dur / 60)}m ${h.dur % 60}s</span>
            </div>`;
          }).join('')}
        </div>` : ''}
        <div class="h-8"></div>
      </div>`;

    document.getElementById('st-back').addEventListener('click', renderDashboard);
    content.querySelectorAll('.st-focus, .st-phase').forEach(b => b.addEventListener('click', () => {
      const phase = CURRICULUM.find(p => p.id === b.getAttribute('data-phase'));
      // jump to the first unfinished module of that phase
      const target = phase && (phase.modules.find(m => statusOf(m.id) !== 'completed') || phase.modules[0]);
      if (target) { state.openPhases[phase.id] = true; save(); renderNav(''); openModule(target.id); }
    }));
    icons();
  }

  /* ===================== MARKDOWN + CALLOUTS ===================== */
  function renderMarkdown(md) {
    // Degrade gracefully if the marked CDN failed to load: show readable plain text.
    if (typeof marked === 'undefined') {
      return '<pre class="whitespace-pre-wrap text-[13.5px] leading-relaxed font-sans">' + esc(md) + '</pre>';
    }
    const calloutMap = {
      TIP:     { cls: 'callout-tip',     icon: 'lightbulb',     title: 'Tip' },
      WARNING: { cls: 'callout-warning', icon: 'alert-triangle', title: 'Watch out' },
      DANGER:  { cls: 'callout-danger',  icon: 'octagon-alert',  title: 'Danger' },
      SUCCESS: { cls: 'callout-success', icon: 'check-circle-2', title: 'Strong answer' },
      EU:      { cls: 'callout-eu',      icon: 'star',           title: 'Interview tip' },
    };

    const lines = md.split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const m = lines[i].match(/^>\s*\[!(\w+)\]\s*(.*)$/);
      const type = m ? m[1].toUpperCase() : null;

      // ── JOURNEY: interactive step-through widget ──────────────────
      if (type === 'JOURNEY') {
        const titleMatch = m[2].match(/title="([^"]+)"/);
        const widgetTitle = titleMatch ? titleMatch[1] : 'Interactive Journey';
        const buf = [];
        i++;
        while (i < lines.length && lines[i].startsWith('>')) {
          buf.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        // Parse steps: lines starting with "## " begin a new step
        const steps = [];
        let cur = null;
        buf.forEach(line => {
          if (line.startsWith('## ')) {
            if (cur) steps.push(cur);
            cur = { title: line.replace(/^##\s+/, ''), body: [] };
          } else if (cur) {
            cur.body.push(line);
          }
        });
        if (cur) steps.push(cur);
        // Build widget HTML
        const dots = steps.map((s, idx) =>
          `<button class="jdot${idx === 0 ? ' active' : ''}" data-jidx="${idx}" title="${esc(s.title)}">${idx + 1}</button>`
        ).join('');
        const panels = steps.map((s, idx) => {
          const bodyHtml = marked.parse(s.body.join('\n'));
          return `<div class="jpanel${idx === 0 ? ' active' : ''}" data-jidx="${idx}">
            <div class="jpanel-header"><span class="jstep-num">${idx + 1}</span><strong>${esc(s.title)}</strong></div>
            <div class="jpanel-body">${bodyHtml}</div>
          </div>`;
        }).join('');
        out.push(`
<div class="journey-widget" data-journey-id="${Date.now()}">
  <div class="journey-title-bar">
    <i data-lucide="route" class="w-4 h-4 text-brand"></i>
    <span>${esc(widgetTitle)}</span>
    <span class="journey-counter"><span class="jcur">1</span> / ${steps.length}</span>
  </div>
  <div class="journey-dots">${dots}</div>
  <div class="journey-panels">${panels}</div>
  <div class="journey-nav">
    <button class="jbtn jprev" disabled>← Prev</button>
    <div class="journey-progress-track"><div class="journey-progress-fill" style="width:${(1/steps.length*100).toFixed(1)}%"></div></div>
    <button class="jbtn jnext">Next →</button>
  </div>
</div>`);
        continue;
      }

      // ── Standard callouts ─────────────────────────────────────────
      if (m && calloutMap[type]) {
        const cfg = calloutMap[type];
        const buf = [];
        if (m[2]) buf.push(m[2]);
        i++;
        while (i < lines.length && lines[i].startsWith('>')) {
          buf.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        const inner = marked.parse(buf.join('\n'));
        out.push(
          `<div class="callout ${cfg.cls}"><i data-lucide="${cfg.icon}" class="callout-icon w-5 h-5"></i>` +
          `<div><strong class="block mb-1">${cfg.title}</strong>${inner}</div></div>`
        );
        continue;
      }

      out.push(lines[i]);
      i++;
    }
    return marked.parse(out.join('\n'));
  }

  /* ── Wire interactive journey widgets after DOM is set ───────────── */
  function initJourneyWidgets(root) {
    root.querySelectorAll('.journey-widget').forEach(widget => {
      const dots   = widget.querySelectorAll('.jdot');
      const panels = widget.querySelectorAll('.jpanel');
      const prev   = widget.querySelector('.jprev');
      const next   = widget.querySelector('.jnext');
      const cur    = widget.querySelector('.jcur');
      const fill   = widget.querySelector('.journey-progress-fill');
      let idx = 0;

      function go(n) {
        dots[idx].classList.remove('active');
        panels[idx].classList.remove('active');
        idx = Math.max(0, Math.min(n, dots.length - 1));
        dots[idx].classList.add('active');
        panels[idx].classList.add('active');
        cur.textContent = idx + 1;
        fill.style.width = ((idx + 1) / dots.length * 100).toFixed(1) + '%';
        prev.disabled = idx === 0;
        next.disabled = idx === dots.length - 1;
      }

      dots.forEach((d, di) => d.addEventListener('click', () => go(di)));
      prev.addEventListener('click', () => go(idx - 1));
      next.addEventListener('click', () => go(idx + 1));
    });
  }

  /* ── Copy buttons on study-guide code blocks ─────────────────────── */
  function addCopyButtons(root) {
    root.querySelectorAll('pre').forEach(pre => {
      if (pre.querySelector('.pre-copy') || pre.querySelector('code.language-mermaid')) return;
      const btn = el('button', { class: 'pre-copy', title: 'Copy code' }, 'Copy');
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const code = pre.querySelector('code');
        try {
          await navigator.clipboard.writeText(code ? code.innerText : pre.innerText);
          btn.textContent = '✓ Copied';
          btn.classList.add('copied');
          setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1400);
        } catch (err) {}
      });
      pre.appendChild(btn);
    });
  }

  /* ── Mermaid diagram rendering after DOM is set ──────────────────── */
  function renderMermaidIn(root) {
    if (typeof mermaid === 'undefined') return;
    const blocks = root.querySelectorAll('pre code.language-mermaid');
    if (!blocks.length) return;
    blocks.forEach((block, n) => {
      const pre = block.parentElement;
      const div = document.createElement('div');
      div.className = 'mermaid';
      div.id = 'mmd-' + Date.now() + '-' + n;
      div.textContent = block.textContent;
      pre.replaceWith(div);
    });
    try { mermaid.run({ nodes: root.querySelectorAll('.mermaid') }); } catch (e) {}
  }

  /* ===================== MODULE NOTEBOOK ===================== */
  let editors = []; // active monaco editors on the page

  // ---- Paywall / upgrade page (shown for premium-locked modules) ----
  function renderUpgrade(module, phase) {
    const content = $('#content');
    content.scrollTop = 0;
    const lockedCount = allModules().filter(x => x.module.locked).length;
    content.innerHTML = `
      <div class="w-full px-4 sm:px-8 lg:px-12 xl:px-16 py-7 fade-up">
        <div class="flex items-center gap-2 text-xs text-slate-500 mb-6">
          <button id="up-bc-dash" class="hover:text-brand transition">Dashboard</button>
          <i data-lucide="chevron-right" class="w-3 h-3"></i><span class="text-brand">Premium</span>
        </div>
        <div class="max-w-2xl mx-auto text-center">
          <div class="grid place-items-center w-16 h-16 mx-auto mb-5 rounded-2xl bg-brand/15 text-brand">
            <i data-lucide="lock" class="w-8 h-8"></i>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">${module ? esc(module.title) : 'Premium content'}</h1>
          <p class="text-slate-400 mb-8">This module is part of <b class="text-brand">Premium</b>. Unlock ${lockedCount}+ advanced modules — full study guides, runnable code, flashcards and interview Q&amp;A.</p>
          <div class="grid sm:grid-cols-2 gap-4 text-left mb-8">
            <div class="rounded-2xl border border-brand/40 bg-brand/[0.06] p-6">
              <div class="text-xs font-bold uppercase tracking-wider text-brand mb-1">Monthly</div>
              <div class="text-3xl font-extrabold text-white mb-1">$9<span class="text-base font-medium text-slate-400">/mo</span></div>
              <div class="text-[12px] text-slate-500 mb-4">Cancel anytime</div>
              <button data-plan="monthly" class="up-buy w-full py-2.5 rounded-lg bg-brand hover:bg-brand-dark text-white font-bold text-sm transition">Get Premium</button>
            </div>
            <div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
              <div class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Yearly <span class="text-emerald-400">save 30%</span></div>
              <div class="text-3xl font-extrabold text-white mb-1">$75<span class="text-base font-medium text-slate-400">/yr</span></div>
              <div class="text-[12px] text-slate-500 mb-4">Best value</div>
              <button data-plan="yearly" class="up-buy w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition">Get Premium</button>
            </div>
          </div>
          <ul class="text-left text-sm text-slate-300 space-y-2 max-w-md mx-auto mb-6">
            ${['All ' + lockedCount + '+ premium modules across JVM, Spring, System Design, Kafka, Elasticsearch, Terraform & more',
               'Runnable code sandbox, flashcards with spaced repetition, mock interviews',
               'Curated rapid-fire interview Q&A with answers'].map(f =>
              `<li class="flex gap-2"><i data-lucide="check" class="w-4 h-4 text-emerald-400 mt-0.5 shrink-0"></i> ${esc(f)}</li>`).join('')}
          </ul>
          <p id="up-msg" class="text-[13px] text-slate-500"></p>
        </div>
      </div>`;
    icons();
    document.getElementById('up-bc-dash').addEventListener('click', renderDashboard);
    content.querySelectorAll('.up-buy').forEach(btn => btn.addEventListener('click', async () => {
      const plan = btn.getAttribute('data-plan');
      const msg = document.getElementById('up-msg');
      if (!auth.user) { location.href = '/auth/google'; return; }
      msg.textContent = 'Starting checkout…';
      try {
        const r = await fetch('/api/billing/checkout', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan }),
        });
        if (r.ok) { const d = await r.json(); if (d.url) { location.href = d.url; return; } }
        if (r.status === 501) { msg.innerHTML = 'Online payments are being set up. For early access, contact the site owner and you\'ll be upgraded manually.'; return; }
        msg.textContent = 'Could not start checkout. Please try again later.';
      } catch { msg.textContent = 'Could not start checkout. Please try again later.'; }
    }));
  }

  function openModule(id, startSec) {
    const found = findModule(id);
    if (!found) return;
    const { phase, module } = found;
    // Premium-locked module (server stripped its body for free users) -> paywall.
    if (module.locked) { state.lastModule = id; save(); closeSidebarMobile(); return renderUpgrade(module, phase); }
    state.lastModule = id;
    state.resumeModule = id;
    markActivity();
    save();
    closeSidebarMobile();

    const flat = allModules();
    const idx = flat.findIndex(x => x.module.id === id);
    const prev = idx > 0 ? flat[idx - 1] : null;
    const next = idx < flat.length - 1 ? flat[idx + 1] : null;

    const hasSections = Array.isArray(module.sections) && module.sections.length > 0;

    const content = $('#content');
    content.scrollTop = 0;
    content.innerHTML = `
      <div class="w-full px-4 sm:px-8 lg:px-12 xl:px-16 py-7 fade-up">
        <!-- breadcrumb -->
        <div class="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <button id="bc-dash" class="hover:text-brand transition">Dashboard</button>
          <i data-lucide="chevron-right" class="w-3 h-3"></i>
          <span class="text-slate-400">${esc(phase.title)}</span>
          <i data-lucide="chevron-right" class="w-3 h-3"></i>
          <span class="text-brand font-mono">${esc(module.id)}</span>
        </div>

        <!-- title + status control -->
        <div class="flex items-start justify-between flex-wrap gap-4 mb-5">
          <div>
            <h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">${esc(module.title)}</h1>
            <div class="flex items-center gap-3 mt-2 text-xs text-slate-400">
              <span class="inline-flex items-center gap-1"><i data-lucide="clock" class="w-3.5 h-3.5"></i> ${module.hours}h est.</span>
              <span class="inline-flex items-center gap-1"><i data-lucide="layers" class="w-3.5 h-3.5"></i> ${esc(phase.title)}</span>
              ${hasSections ? `<span class="inline-flex items-center gap-1 text-brand"><i data-lucide="layout-list" class="w-3.5 h-3.5"></i> ${module.sections.length} sections</span>` : ''}
            </div>
          </div>
          <button id="status-btn" class="status-btn inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition"></button>
        </div>

        ${hasSections ? `
        <!-- section pill nav -->
        <div class="mb-5 p-3 rounded-xl bg-slate-900/50 border border-slate-800">
          <div class="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2.5 flex items-center gap-1.5">
            <i data-lucide="map" class="w-3 h-3"></i> Sections — pick a topic
          </div>
          <div class="flex flex-wrap gap-2" id="sec-pills">
            ${module.sections.map((s, i) => `
              <button data-sec="${i}" class="sec-pill px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${i === 0 ? 'bg-brand border-brand text-white shadow-sm' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-600'}">
                <span class="text-[9px] opacity-60 mr-1">${i + 1}.</span>${esc(s.title)}
              </button>`).join('')}
          </div>
        </div>` : ''}

        <!-- content tabs -->
        <div class="flex items-center gap-0.5 border-b border-slate-800 mb-6 text-sm overflow-x-auto custom-scroll pb-px">
          <button data-tab="notes"     class="tab-btn active shrink-0 whitespace-nowrap px-3 sm:px-4 py-2.5 font-medium text-slate-400">📘 <span class="hidden xs:inline">Study </span>Guide</button>
          <button data-tab="sandbox"   class="tab-btn shrink-0 whitespace-nowrap px-3 sm:px-4 py-2.5 font-medium text-slate-400">⚡ Code</button>
          <button data-tab="cards"     class="tab-btn shrink-0 whitespace-nowrap px-3 sm:px-4 py-2.5 font-medium text-slate-400">🃏 Flashcards</button>
          <button data-tab="interview" class="tab-btn shrink-0 whitespace-nowrap px-3 sm:px-4 py-2.5 font-medium text-slate-400">🎯 Interview</button>
          <button data-tab="mynotes"   class="tab-btn shrink-0 whitespace-nowrap px-3 sm:px-4 py-2.5 font-medium text-slate-400">✎ My Notes</button>
        </div>

        <div id="tab-notes" class="tab-pane prose-notes"></div>
        <div id="tab-sandbox" class="tab-pane hidden"></div>
        <div id="tab-cards" class="tab-pane hidden"></div>
        <div id="tab-interview" class="tab-pane hidden"></div>
        <div id="tab-mynotes" class="tab-pane hidden"></div>

        <!-- bottom nav — filled dynamically by renderBottomNav() -->
        <div id="bottom-nav-wrap"></div>
        <div class="h-8"></div>
      </div>`;

    // ---- helper: fill Study Guide / Code Sandbox / Flashcards from any src object ----
    function fillContent(src) {
      const notesEl = $('#tab-notes');
      if (src.notes && src.notes.trim()) {
        notesEl.innerHTML = renderMarkdown(src.notes);
      } else {
        notesEl.innerHTML = placeholderNotes(module, phase);
      }
      // Syntax-highlight code blocks (skip mermaid — those get diagram treatment)
      notesEl.querySelectorAll('pre code:not(.language-mermaid)').forEach(b => {
        try { hljs.highlightElement(b); } catch (e) {}
      });
      addCopyButtons(notesEl);
      renderMermaidIn(notesEl);
      initJourneyWidgets(notesEl);
      icons(); // re-run lucide for icons inside callouts / journey
      renderSandbox(src);
      renderFlashcards(src, module.id);
      renderInterviewTab(module, src);
    }

    // ---- section navigation helpers ----
    const pills = hasSections ? content.querySelectorAll('.sec-pill') : [];
    const activePillClass = 'sec-pill px-3 py-1.5 rounded-lg text-xs font-semibold border transition bg-brand border-brand text-white shadow-sm';
    const idlePillClass   = 'sec-pill px-3 py-1.5 rounded-lg text-xs font-semibold border transition bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-600';

    function goSec(i) {
      pills.forEach(p => { p.className = idlePillClass; });
      if (pills[i]) pills[i].className = activePillClass;
      content.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'));
      content.querySelectorAll('.tab-pane').forEach(x => x.classList.add('hidden'));
      content.querySelector('[data-tab="notes"]').classList.add('active');
      $('#tab-notes').classList.remove('hidden');
      fillContent(module.sections[i]);
      content.scrollTop = 0;
      renderBottomNav(i);
    }

    function renderBottomNav(secIdx) {
      const wrap = document.getElementById('bottom-nav-wrap');
      if (!wrap) return;
      const totalSecs = hasSections ? module.sections.length : 0;

      // Left — prev section (primary) or prev module (subtle)
      let leftHtml = '<div></div>';
      if (hasSections && secIdx > 0) {
        leftHtml = `<button id="bnav-sec-prev" class="flex-1 sm:flex-none text-left rounded-lg border border-slate-700 hover:border-brand/60 bg-slate-900/40 px-4 py-3 transition group">
          <div class="text-[10px] text-slate-500 mb-0.5">← Prev section</div>
          <div class="text-sm text-slate-300 group-hover:text-brand font-medium leading-snug">${esc(module.sections[secIdx - 1].title)}</div>
        </button>`;
      } else if (prev) {
        leftHtml = `<button id="bnav-mod-prev" class="flex-1 sm:flex-none text-left rounded-lg border border-slate-800 hover:border-slate-600 px-4 py-3 transition group opacity-60 hover:opacity-100">
          <div class="text-[10px] text-slate-500 mb-0.5">← Prev module</div>
          <div class="text-xs text-slate-400 group-hover:text-slate-200 leading-snug"><span class="font-mono">${esc(prev.module.id)}</span> ${esc(prev.module.title)}</div>
        </button>`;
      }

      // Right — next section (bold/brand) or next module (subtle)
      let rightHtml = '<div></div>';
      if (hasSections && secIdx < totalSecs - 1) {
        rightHtml = `<button id="bnav-sec-next" class="flex-1 sm:flex-none text-right rounded-lg border border-brand bg-brand/10 hover:bg-brand/20 px-4 py-3 transition group">
          <div class="text-[10px] text-brand/70 mb-0.5">Next section →</div>
          <div class="text-sm text-white group-hover:text-brand font-semibold leading-snug">${esc(module.sections[secIdx + 1].title)}</div>
        </button>`;
      } else if (next) {
        rightHtml = `<button id="bnav-mod-next" class="flex-1 sm:flex-none text-right rounded-lg border border-slate-700 hover:border-brand/60 bg-slate-900/40 px-4 py-3 transition group">
          <div class="text-[10px] text-slate-500 mb-0.5">Next module →</div>
          <div class="text-xs text-slate-300 group-hover:text-brand leading-snug"><span class="font-mono">${esc(next.module.id)}</span> ${esc(next.module.title)}</div>
        </button>`;
      }

      // Skip-to-module link — shown mid-module so you can always escape
      const skipHtml = (hasSections && secIdx < totalSecs - 1 && next)
        ? `<div class="text-center mt-3">
            <button id="bnav-skip" class="text-xs text-slate-600 hover:text-slate-400 transition">
              Jump to next module: <span class="font-mono">${esc(next.module.id)}</span> ${esc(next.module.title)} →
            </button>
           </div>`
        : '';

      wrap.innerHTML = `
        <div class="flex items-stretch justify-between gap-3 mt-10 pt-6 border-t border-slate-800">
          ${leftHtml}
          ${rightHtml}
        </div>${skipHtml}`;

      const el = id => document.getElementById(id);
      if (el('bnav-sec-prev'))  el('bnav-sec-prev').addEventListener('click', () => goSec(secIdx - 1));
      if (el('bnav-sec-next'))  el('bnav-sec-next').addEventListener('click', () => goSec(secIdx + 1));
      if (el('bnav-mod-prev'))  el('bnav-mod-prev').addEventListener('click', () => openModule(prev.module.id));
      if (el('bnav-mod-next'))  el('bnav-mod-next').addEventListener('click', () => openModule(next.module.id));
      if (el('bnav-skip'))      el('bnav-skip').addEventListener('click', () => openModule(next.module.id));
    }

    // ---- section pill wiring (only when module has sections) ----
    if (hasSections) {
      pills.forEach(pill => {
        pill.addEventListener('click', () => goSec(parseInt(pill.getAttribute('data-sec'))));
      });
      // Land on a specific section when arriving from deep search.
      const s0 = (Number.isInteger(startSec) && startSec >= 0 && startSec < module.sections.length) ? startSec : 0;
      goSec(s0);
    } else {
      fillContent(module);
      renderBottomNav(0);
    }

    renderMyNotes(module);

    // ---- status button ----
    const updateStatusBtn = () => {
      const s = statusOf(id);
      const btn = $('#status-btn');
      const styles = {
        not_started: 'bg-slate-800 text-slate-300 hover:bg-slate-700',
        in_progress: 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40 hover:bg-amber-500/30',
        completed: 'bg-success/20 text-emerald-300 ring-1 ring-success/40 hover:bg-success/30'
      };
      const ico = { not_started: 'circle', in_progress: 'loader', completed: 'check-circle-2' };
      btn.className = 'status-btn inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ' + styles[s];
      btn.innerHTML = `<i data-lucide="${ico[s]}" class="w-4 h-4"></i> ${STATUS_LABEL[s]} <span class="text-[10px] opacity-60 ml-1">click to advance</span>`;
      icons();
    };
    updateStatusBtn();
    $('#status-btn').addEventListener('click', () => {
      state.status[id] = STATUS_NEXT[statusOf(id)];
      markActivity();
      save();
      updateStatusBtn();
      renderNav($('#search').value);
      renderGlobalProgress();
    });

    // ---- tab switching ----
    content.querySelectorAll('.tab-btn').forEach(tb => {
      tb.addEventListener('click', () => {
        content.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active', 'text-white'));
        content.querySelectorAll('.tab-pane').forEach(x => x.classList.add('hidden'));
        tb.classList.add('active');
        const pane = $('#tab-' + tb.getAttribute('data-tab'));
        pane.classList.remove('hidden');
        if (tb.getAttribute('data-tab') === 'sandbox') setTimeout(() => editors.forEach(e => e.ed && e.ed.layout()), 30);
      });
    });

    $('#bc-dash').addEventListener('click', renderDashboard);

    // Keyboard navigation — ← → between modules (skip if focus is in textarea/input/Monaco)
    const _keyNav = (e) => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      if (document.activeElement && document.activeElement.closest('.monaco-wrap')) return;
      if (e.key === 'ArrowLeft'  && prev) { document.removeEventListener('keydown', _keyNav); openModule(prev.module.id); }
      if (e.key === 'ArrowRight' && next) { document.removeEventListener('keydown', _keyNav); openModule(next.module.id); }
    };
    document.addEventListener('keydown', _keyNav);

    icons();
    renderNav($('#search').value);
  }

  /* ===================== INTERVIEW QUESTIONS (bottom of Study Guide) ===================== */
  // Pull the curated "most likely to be asked" questions for a module/section.
  // Section-level `interview` arrays win; otherwise the module-level map is used.
  function interviewQsFor(module, src) {
    if (src && Array.isArray(src.interview) && src.interview.length) return src.interview;
    if (typeof INTERVIEW_QUESTIONS !== 'undefined' && INTERVIEW_QUESTIONS[module.id]) {
      return INTERVIEW_QUESTIONS[module.id];
    }
    return [];
  }

  // Render the click-to-reveal "Likely interview questions" panel into its own tab.
  function renderInterviewTab(module, src) {
    const pane = document.getElementById('tab-interview');
    if (!pane) return;
    const qs = interviewQsFor(module, src);

    // live count in the tab label
    const tabBtn = document.querySelector('[data-tab="interview"]');
    if (tabBtn) tabBtn.textContent = `🎯 Interview${qs.length ? ' (' + qs.length + ')' : ''}`;

    pane.innerHTML = '';
    if (!qs.length) {
      pane.innerHTML = '<p class="text-slate-400">No curated interview questions for this module yet — drill the Flashcards tab instead.</p>';
      return;
    }

    const block = el('div', { class: 'iq-block' });
    const items = qs.map((qa, i) => `
      <li class="iq-item rounded-lg border border-slate-800 bg-slate-900/40 overflow-hidden">
        <button class="iq-q w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-slate-800/50 transition" data-i="${i}">
          <span class="shrink-0 grid place-items-center w-5 h-5 rounded bg-brand/20 text-brand text-[11px] font-bold mt-px">${i + 1}</span>
          <span class="flex-1 text-[14px] text-slate-200 font-medium leading-snug">${esc(qa.q)}</span>
          <i data-lucide="chevron-down" class="iq-chev w-4 h-4 text-slate-500 shrink-0 mt-0.5 transition-transform"></i>
        </button>
        <div class="iq-a hidden px-4 pb-3.5 pt-0 pl-12 text-[13.5px] text-slate-300 leading-relaxed">${esc(qa.a)}</div>
      </li>`).join('');

    block.innerHTML = `
      <div class="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4 sm:p-5">
        <div class="flex items-center gap-2 mb-1">
          <i data-lucide="target" class="w-4 h-4 text-amber-400"></i>
          <h3 class="text-sm font-bold text-amber-300 tracking-wide uppercase">Likely interview questions</h3>
          <span class="ml-auto text-[11px] text-slate-500">${qs.length} · click to reveal</span>
        </div>
        <p class="text-[12.5px] text-slate-500 mb-4 leading-relaxed">The questions a panel is most likely to ask on this topic. Try to answer each one out loud first — then reveal the model answer.</p>
        <ol class="space-y-2.5">${items}</ol>
        <div class="mt-3 text-right">
          <button class="iq-toggle-all text-[11px] text-slate-500 hover:text-amber-300 transition">Reveal all answers</button>
        </div>
      </div>`;

    pane.appendChild(block);
    icons();

    const aEls = () => block.querySelectorAll('.iq-a');
    block.querySelectorAll('.iq-q').forEach(btn => {
      btn.addEventListener('click', () => {
        const a = btn.parentElement.querySelector('.iq-a');
        const chev = btn.querySelector('.iq-chev');
        a.classList.toggle('hidden');
        if (chev) chev.style.transform = a.classList.contains('hidden') ? '' : 'rotate(180deg)';
      });
    });
    const toggleAll = block.querySelector('.iq-toggle-all');
    toggleAll.addEventListener('click', () => {
      const anyHidden = [...aEls()].some(a => a.classList.contains('hidden'));
      aEls().forEach(a => a.classList.toggle('hidden', !anyHidden));
      block.querySelectorAll('.iq-chev').forEach(c => c.style.transform = anyHidden ? 'rotate(180deg)' : '');
      toggleAll.textContent = anyHidden ? 'Hide all answers' : 'Reveal all answers';
    });
  }

  function placeholderNotes(module, phase) {
    return renderMarkdown(`
# ${module.title}

> [!TIP]
> Deep-dive notes for this module are being expanded. Use the **Code Sandbox**, **Flashcards**, and **My Notes** tabs now — and add your own summary as you study.

This module belongs to **${phase.title}**. Estimated **${module.hours} hours** of focused revision.

## How to study this module

- Skim the flashcards first to map the territory.
- Write your own explanation in **My Notes** (the Feynman technique — if you can't explain it simply, you don't know it yet).
- Run and modify any code in the sandbox to build intuition.

> [!TIP]
> Always tie a concept back to a **trade-off** and a **real production scenario** — that's what senior interview panels reward.
`);
  }

  /* ===================== CODE SANDBOX (Monaco + Piston) ===================== */
  const LANG_MAP = { java: 'java', javascript: 'javascript', python: 'python', bash: 'shell', sql: 'sql' };

  function renderSandbox(module) {
    editors = [];
    const pane = $('#tab-sandbox');
    // Normalise: code can be plain strings (older format) or {lang,title,code} objects
    const samples = (module.code || []).map((s, i) =>
      typeof s === 'string' ? { lang: 'java', title: 'Example ' + (i + 1), code: s } : s
    );
    if (samples.length === 0) {
      pane.innerHTML = `<div class="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-400">
        <i data-lucide="code-2" class="w-8 h-8 mx-auto mb-3 text-slate-600"></i>
        <p>No code sample for this module yet — try the <strong>blank Java scratchpad</strong> below.</p>
      </div>
      <div class="mt-4" id="scratch-host"></div>`;
      icons();
      mountEditor($('#scratch-host'), {
        lang: 'java', title: 'Java scratchpad',
        code: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from the JVM!");\n    }\n}'
      });
      return;
    }

    pane.innerHTML = `<p class="text-sm text-slate-400 mb-4 flex items-center gap-2">
      <i data-lucide="zap" class="w-4 h-4 text-amber-400"></i>
      Edit and <strong class="text-slate-300">Run</strong> self-contained Java on a real JDK compiler. Framework code (Spring, JPA, Kafka…), SQL &amp; shell are marked <strong class="text-slate-300">Reference only</strong> — the public sandbox has no Maven dependencies, so they're for reading, not running.
    </p><div class="space-y-6" id="sandbox-host"></div>`;
    const host = $('#sandbox-host');
    samples.forEach(s => mountEditor(host, s));
    icons();
  }

  const RUNNABLE_LANGS = ['java', 'python', 'javascript'];

  // Frameworks/libraries the public JDK sandbox (Wandbox, bare JDK — no Maven deps)
  // cannot resolve. Java code referencing these is shown for reference rather than
  // pretending it will compile and run.
  const NON_RUNNABLE_HINTS = [
    'org.springframework', 'jakarta.persistence', 'jakarta.transaction', 'jakarta.validation',
    'jakarta.servlet', 'jakarta.annotation', 'javax.persistence', 'javax.servlet',
    'org.hibernate', 'org.apache.kafka', 'io.camunda', 'org.camunda', 'reactor.core',
    'lombok', 'org.junit', 'org.mockito', 'com.fasterxml.jackson', 'org.slf4j',
    '@SpringBootApplication', '@RestController', '@Controller', '@Service', '@Repository',
    '@Component', '@Configuration', '@Autowired', '@Bean', '@Entity', '@Transactional',
    '@RequestMapping', '@GetMapping', '@PostMapping', '@PutMapping', '@DeleteMapping',
    '@Async', '@Cacheable', '@Scheduled', '@EnableAutoConfiguration', '@ConfigurationProperties',
    '@SpringBootTest', '@WebMvcTest', '@Test ', '@Test\n'
  ];

  // Decide whether a Java sample can actually execute on the bare JDK sandbox.
  function javaRunnability(code) {
    const hasMain = /\bstatic\s+void\s+main\s*\(/.test(code);
    if (!hasMain) {
      return { runnable: false, reason: 'Snippet only — no runnable main() method. Shown for reference.' };
    }
    if (NON_RUNNABLE_HINTS.some(h => code.includes(h))) {
      return { runnable: false, reason: 'Needs Spring / a framework runtime (not on the bare JDK sandbox) — shown for reference.' };
    }
    return { runnable: true, reason: '' };
  }

  // Resolve runnability + a human reason for any sample.
  function sampleRunInfo(sample) {
    if (sample.runnable === false) {
      return { runnable: false, reason: sample.note || 'Shown for reference — not executed here.' };
    }
    if (!RUNNABLE_LANGS.includes(sample.lang)) {
      const kind = sample.lang === 'sql' ? 'SQL' : sample.lang === 'bash' ? 'Shell' : (sample.lang || 'This');
      return { runnable: false, reason: `${kind} is shown for reference — not executed here.` };
    }
    if (sample.lang === 'java') return javaRunnability(sample.code);
    return { runnable: true, reason: '' };
  }

  function mountEditor(host, sample) {
    const runInfo = sampleRunInfo(sample);
    const runnable = runInfo.runnable;
    const wrap = el('div', { class: 'rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden' });
    wrap.innerHTML = `
      <div class="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/70">
        <div class="flex items-center gap-2 min-w-0">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-brand/20 text-brand shrink-0">${esc(sample.lang)}</span>
          <span class="text-sm text-slate-300 font-medium truncate">${esc(sample.title || 'Example')}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button class="copy-btn text-xs text-slate-400 hover:text-white inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 transition">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i> Copy
          </button>
          ${runnable ? `<button class="run-btn text-xs font-semibold inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/90 hover:bg-success text-white transition">
            <i data-lucide="play" class="w-3.5 h-3.5"></i> Run
          </button>` : `<span class="ref-badge inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md bg-slate-800 text-slate-400 border border-slate-700" title="${esc(runInfo.reason)}">
            <i data-lucide="book-open-text" class="w-3 h-3"></i> Reference only
          </span>`}
        </div>
      </div>
      <div class="monaco-wrap"></div>
      ${!runnable ? `<div class="flex items-start gap-2 px-4 py-2 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-500">
        <i data-lucide="info" class="w-3.5 h-3.5 mt-px shrink-0 text-slate-600"></i>
        <span>${esc(runInfo.reason)} You can still read, copy, and adapt it for a real project.</span>
      </div>` : ''}
      <div class="output-area hidden border-t border-slate-800">
        <div class="flex items-center justify-between px-4 py-1.5 bg-slate-950/80">
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Output</span>
          <button class="clear-out text-[10px] text-slate-500 hover:text-slate-300">clear</button>
        </div>
        <pre class="output-pre px-4 py-3 text-[13px] font-mono text-slate-300 whitespace-pre-wrap max-h-72 overflow-auto"></pre>
      </div>`;
    host.appendChild(wrap);

    const editorHost = wrap.querySelector('.monaco-wrap');
    const rec = { ed: null, sample };
    editors.push(rec);

    if (typeof require === 'undefined') {
      // Monaco CDN unavailable — read-only code fallback (copy/run still work off sample.code)
      editorHost.innerHTML = '<pre class="p-4 text-[13px] font-mono whitespace-pre-wrap overflow-auto h-full">' + esc(sample.code) + '</pre>';
    }
    ensureMonaco(() => {
      rec.ed = monaco.editor.create(editorHost, {
        value: sample.code,
        language: LANG_MAP[sample.lang] || 'plaintext',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 13.5,
        fontFamily: 'JetBrains Mono, monospace',
        fontLigatures: false,
        scrollBeyondLastLine: false,
        padding: { top: 12, bottom: 12 },
        lineNumbers: 'on',
        renderLineHighlight: 'none',
        scrollbar: { alwaysConsumeMouseWheel: false }
      });
    });

    // copy
    wrap.querySelector('.copy-btn').addEventListener('click', async (e) => {
      const code = rec.ed ? rec.ed.getValue() : sample.code;
      try {
        await navigator.clipboard.writeText(code);
        const btn = e.currentTarget;
        btn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i> Copied';
        icons();
        setTimeout(() => { btn.innerHTML = '<i data-lucide="copy" class="w-3.5 h-3.5"></i> Copy'; icons(); }, 1500);
      } catch (err) {}
    });

    // run
    const runBtn = wrap.querySelector('.run-btn');
    if (runBtn) {
      const outArea = wrap.querySelector('.output-area');
      const outPre = wrap.querySelector('.output-pre');
      wrap.querySelector('.clear-out').addEventListener('click', () => { outArea.classList.add('hidden'); outPre.textContent = ''; });
      runBtn.addEventListener('click', async () => {
        const code = rec.ed ? rec.ed.getValue() : sample.code;
        outArea.classList.remove('hidden');
        outPre.textContent = '';
        outPre.innerHTML = '<span class="text-amber-400">⏳ Compiling &amp; running…</span>';
        runBtn.disabled = true;
        runBtn.classList.add('opacity-60');
        try {
          const res = await fetch('/api/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: sample.lang, code })
          });
          const data = await res.json();
          let html = '';
          if (data.output) html += `<span class="text-slate-200">${esc(data.output)}</span>`;
          if (data.error) html += `<span class="text-red-400">${esc(data.error)}</span>`;
          if (!data.output && !data.error) html = '<span class="text-slate-500">(no output)</span>';
          outPre.innerHTML = html;
        } catch (err) {
          outPre.innerHTML = `<span class="text-red-400">Run failed: ${esc(err.message)}.\nIs the server running? (npm start)</span>`;
        } finally {
          runBtn.disabled = false;
          runBtn.classList.remove('opacity-60');
        }
      });
    }
    icons();
  }

  let monacoReady = false, monacoQueue = [];
  function ensureMonaco(cb) {
    if (typeof require === 'undefined') return; // Monaco CDN unavailable — plain fallback is rendered by caller
    if (monacoReady) return cb();
    monacoQueue.push(cb);
    if (monacoQueue.length > 1) return;
    require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
    require(['vs/editor/editor.main'], () => {
      monacoReady = true;
      monacoQueue.forEach(fn => fn());
      monacoQueue = [];
    });
  }

  /* ===================== FLASHCARDS (study mode) ===================== */
  function renderFlashcards(src, modId) {
    const pane = $('#tab-cards');
    const allCards = src.flashcards || [];
    if (allCards.length === 0) { pane.innerHTML = '<p class="text-slate-400">No flashcards for this module yet.</p>'; return; }

    // marks: q -> 'known' | 'again' — seeded from persisted state so your
    // review queue survives reloads and syncs across devices.
    const marks = new Map();
    if (modId) {
      for (const c of allCards) {
        const persisted = (state.cards || {})[cardKey(modId, c.q)];
        if (persisted) marks.set(c.q, persisted);
      }
    }
    const persistMark = (q, val) => {
      if (!modId) return;
      if (!state.cards) state.cards = {};
      state.cards[cardKey(modId, q)] = val;
      save();
    };

    const shuffled = (arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    };

    function renderDeck(deck, label) {
      pane.innerHTML = `
        <div class="flex items-center justify-between flex-wrap gap-3 mb-3">
          <p class="text-sm text-slate-400 flex items-center gap-2"><i data-lucide="brain" class="w-4 h-4 text-brand"></i>
            Active recall — flip, then mark <strong class="text-emerald-300">Got it</strong> or <strong class="text-amber-300">Review</strong>.
            ${label ? `<span class="text-amber-400 font-semibold">${esc(label)}</span>` : ''}</p>
          <div class="flex items-center gap-2">
            <button id="shuffle-cards" class="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition inline-flex items-center gap-1.5"><i data-lucide="shuffle" class="w-3.5 h-3.5"></i> Shuffle</button>
            <button id="flip-all" class="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition">Flip all</button>
          </div>
        </div>

        <!-- session score -->
        <div class="flex items-center gap-3 mb-4 text-[12px]">
          <div class="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden flex">
            <div id="score-known" class="h-full bg-success transition-all duration-300" style="width:0%"></div>
            <div id="score-again" class="h-full bg-amber-400 transition-all duration-300" style="width:0%"></div>
          </div>
          <span class="text-slate-500 shrink-0"><span id="score-text">0 / ${deck.length} marked</span></span>
          <button id="review-missed" class="hidden shrink-0 text-xs px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40 hover:bg-amber-500/30 transition font-semibold"></button>
        </div>

        <div class="grid sm:grid-cols-2 gap-4" id="cards-grid">
          ${deck.map((c, i) => `
            <div class="flip-card" data-q="${esc(c.q)}">
              <div class="flip-inner">
                <div class="flip-face flip-front">
                  <div class="text-[10px] uppercase tracking-wider text-brand font-bold mb-2">Question ${i + 1}</div>
                  <div class="text-[15px] text-slate-100 font-medium leading-snug">${esc(c.q)}</div>
                  <div class="mt-auto pt-3 text-[10px] text-slate-500 flex items-center gap-1"><i data-lucide="mouse-pointer-click" class="w-3 h-3"></i> click to flip</div>
                </div>
                <div class="flip-face flip-back">
                  <div class="text-[10px] uppercase tracking-wider text-success font-bold mb-2">Answer</div>
                  <div class="text-[13.5px] text-slate-200 leading-relaxed">${esc(c.a)}</div>
                  <div class="mark-row mt-auto pt-3 flex items-center gap-2">
                    <button class="mark-btn mark-known flex-1 text-[11px] font-bold px-2 py-1.5 rounded-lg bg-success/15 text-emerald-300 ring-1 ring-success/40 hover:bg-success/30 transition">✓ Got it</button>
                    <button class="mark-btn mark-again flex-1 text-[11px] font-bold px-2 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40 hover:bg-amber-500/30 transition">↻ Review</button>
                  </div>
                </div>
              </div>
            </div>`).join('')}
        </div>`;

      const cardEls = pane.querySelectorAll('.flip-card');

      function updateScore() {
        let known = 0, again = 0;
        deck.forEach(c => { const m = marks.get(c.q); if (m === 'known') known++; else if (m === 'again') again++; });
        const kb = pane.querySelector('#score-known'), ab = pane.querySelector('#score-again');
        if (kb) kb.style.width = (known / deck.length * 100) + '%';
        if (ab) ab.style.width = (again / deck.length * 100) + '%';
        const st = pane.querySelector('#score-text');
        if (st) st.textContent = `${known} got it · ${again} to review · ${deck.length - known - again} left`;
        const rm = pane.querySelector('#review-missed');
        if (rm) {
          if (again > 0 && known + again === deck.length) {
            rm.classList.remove('hidden');
            rm.textContent = `Review the ${again} you missed →`;
          } else rm.classList.add('hidden');
        }
      }

      cardEls.forEach(card => {
        const q = card.getAttribute('data-q');
        const applyMark = () => {
          card.classList.toggle('card-known', marks.get(q) === 'known');
          card.classList.toggle('card-again', marks.get(q) === 'again');
        };
        applyMark();
        card.addEventListener('click', () => card.classList.toggle('flipped'));
        const kBtn = card.querySelector('.mark-known'), aBtn = card.querySelector('.mark-again');
        kBtn.addEventListener('click', (e) => { e.stopPropagation(); marks.set(q, 'known'); persistMark(q, 'known'); applyMark(); card.classList.remove('flipped'); updateScore(); });
        aBtn.addEventListener('click', (e) => { e.stopPropagation(); marks.set(q, 'again'); persistMark(q, 'again'); applyMark(); card.classList.remove('flipped'); updateScore(); });
      });

      pane.querySelector('#flip-all').addEventListener('click', () => {
        const anyUnflipped = [...cardEls].some(c => !c.classList.contains('flipped'));
        cardEls.forEach(c => c.classList.toggle('flipped', anyUnflipped));
      });
      pane.querySelector('#shuffle-cards').addEventListener('click', () => renderDeck(shuffled(deck), label));
      const rm = pane.querySelector('#review-missed');
      rm.addEventListener('click', () => {
        const missed = deck.filter(c => marks.get(c.q) === 'again');
        missed.forEach(c => marks.delete(c.q));           // fresh round for the missed set
        renderDeck(shuffled(missed), `reviewing ${missed.length} missed`);
      });

      updateScore();
      icons();
    }

    renderDeck(allCards, '');
  }

  /* ===================== MY NOTES ===================== */
  function renderMyNotes(module) {
    const pane = $('#tab-mynotes');
    const saved = state.notes[module.id] || '';
    pane.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <p class="text-sm text-slate-400 flex items-center gap-2"><i data-lucide="pen-line" class="w-4 h-4 text-brand"></i>
          Your personal notes for <span class="font-mono text-brand">${esc(module.id)}</span> — saved automatically.</p>
        <span id="note-saved" class="text-[11px] text-slate-600"></span>
      </div>
      <textarea id="mynotes-area" placeholder="Summarise this topic in your own words. Write the answer you'd give in the interview, edge cases you tripped on, links…"
        class="w-full h-80 rounded-xl bg-slate-900/60 border border-slate-800 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand p-4 text-sm text-slate-200 leading-relaxed font-mono resize-y custom-scroll">${esc(saved)}</textarea>
      <div class="mt-2 text-[11px] text-slate-600">Feynman tip: if you can't write it plainly here, revisit the study guide.</div>`;
    const area = $('#mynotes-area');
    let t;
    area.addEventListener('input', () => {
      state.notes[module.id] = area.value;
      clearTimeout(t);
      t = setTimeout(() => {
        save();
        const tag = $('#note-saved');
        tag.textContent = '✓ saved';
        setTimeout(() => { tag.textContent = ''; }, 1200);
      }, 300);
    });
    icons();
  }

  /* ===================== SIDEBAR MOBILE ===================== */
  function openSidebarMobile() { $('#sidebar').classList.add('open'); $('#backdrop').classList.remove('hidden'); }
  function closeSidebarMobile() { $('#sidebar').classList.remove('open'); $('#backdrop').classList.add('hidden'); }

  /* ===================== AUTH + CLOUD SYNC ===================== */
  // Ask the server who we are; drives the account widget and whether we sync.
  async function refreshAuth() {
    try {
      const r = await fetch('/auth/me', { credentials: 'same-origin' });
      auth = await r.json();
    } catch { auth = { configured: false, user: null }; }
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
            ? `<span title="Premium member" class="shrink-0 inline-flex items-center gap-1 px-2 h-7 rounded-lg bg-amber-400/15 text-amber-300 text-[10px] font-bold"><i data-lucide="crown" class="w-3 h-3"></i>PRO</span>`
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

  /* ===================== WIRING ===================== */
  function init() {
    if (typeof marked !== 'undefined') {
      marked.setOptions({ breaks: false, gfm: true });
    }
    if (typeof mermaid !== 'undefined') {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        themeVariables: {
          background:          '#0f172a',
          primaryColor:        '#1e293b',
          primaryTextColor:    '#e2e8f0',
          primaryBorderColor:  '#6366f1',
          lineColor:           '#818cf8',
          secondaryColor:      '#0f172a',
          tertiaryColor:       '#0d1322',
          nodeBorder:          '#6366f1',
          clusterBkg:          '#1e293b',
          clusterBorder:       '#334155',
          titleColor:          '#c4b5fd',
          edgeLabelBackground: '#1e293b',
          fontFamily:          'Inter, ui-sans-serif, sans-serif',
          fontSize:            '13px',
        }
      });
    }
    renderNav();
    renderGlobalProgress();

    // restore last module or show dashboard
    if (state.lastModule && findModule(state.lastModule)) openModule(state.lastModule);
    else renderDashboard();

    $('#search').addEventListener('input', (e) => renderNav(e.target.value));
    $('#dashboard-btn').addEventListener('click', renderDashboard);

    // ---- Collapse / expand all phases ----
    const collapseAllBtn = document.getElementById('collapse-all');
    if (collapseAllBtn) {
      collapseAllBtn.addEventListener('click', () => {
        const collapse = anyPhaseOpen();               // something open -> collapse; all closed -> expand
        CURRICULUM.forEach(p => { state.openPhases[p.id] = !collapse; });
        save();
        renderNav($('#search') ? $('#search').value : '');
      });
    }
    refreshCollapseAllBtn();

    // reading progress bar + back-to-top — driven by the content pane's scroll
    const contentEl = $('#content'), readBar = document.getElementById('read-progress');
    const backTop = document.getElementById('back-top');
    if (contentEl && readBar) {
      contentEl.addEventListener('scroll', () => {
        const max = contentEl.scrollHeight - contentEl.clientHeight;
        readBar.style.width = max > 200 ? (contentEl.scrollTop / max * 100).toFixed(1) + '%' : '0%';
        if (backTop) backTop.classList.toggle('hidden', contentEl.scrollTop < 600);
      }, { passive: true });
    }
    if (backTop && contentEl) {
      backTop.addEventListener('click', () => contentEl.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    // "/" focuses search from anywhere; Escape clears it
    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && !document.activeElement.closest('.monaco-wrap')) {
        e.preventDefault();
        $('#search').focus();
      }
    });
    $('#search').addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.target.value = ''; renderNav(''); e.target.blur(); }
    });
    $('#reset-btn').addEventListener('click', () => {
      if (confirm('Reset ALL progress, notes, and statuses? This cannot be undone.')) {
        state = defaultState();
        save();
        renderNav();
        renderGlobalProgress();
        renderDashboard();
      }
    });
    $('#sidebar-open').addEventListener('click', openSidebarMobile);
    $('#sidebar-close').addEventListener('click', closeSidebarMobile);
    $('#backdrop').addEventListener('click', closeSidebarMobile);

    // ---- Theme toggle ----
    const THEMES = ['dark', 'dim', 'light'];
    const THEME_ICONS = { dark: 'moon', dim: 'contrast', light: 'sun' };
    const THEME_LABELS = { dark: 'Dark', dim: 'Dim', light: 'Light' };

    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('jh-theme', theme);
      const iconName = THEME_ICONS[theme];
      ['theme-btn', 'theme-btn-mobile'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4"></i>`;
        btn.title = `Theme: ${THEME_LABELS[theme]} (click to cycle)`;
      });
      icons();
    }

    function cycleTheme() {
      const cur = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
      applyTheme(next);
    }

    applyTheme(localStorage.getItem('jh-theme') || 'dark');
    $('#theme-btn').addEventListener('click', cycleTheme);
    const mobileThemeBtn = document.getElementById('theme-btn-mobile');
    if (mobileThemeBtn) mobileThemeBtn.addEventListener('click', cycleTheme);

    icons();

    // ---- account widget + cloud sync (no-op when sign-in isn't configured) ----
    renderAccount();
    refreshAuth().then(syncFromServer);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

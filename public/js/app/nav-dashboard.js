/* nav-dashboard.js — part of the Java Interview Hub app engine (split from the original app.js).
   ES module. Shared state + helpers live in core.js (live bindings). */
'use strict';
import { STORAGE_KEY, STATUSES, STATUS_LABEL, STATUS_NEXT, defaultState, state, setState, cardKey, reviewQueue, dayKey, markActivity, studyStreak, auth, setAuth, load, save, allModules, findModule, statusOf, phaseProgress, globalProgress, $, el, icons, esc, openSidebarMobile, closeSidebarMobile } from './core.js';
import { openModule } from './module-view.js';
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

export { anyPhaseOpen, refreshCollapseAllBtn, renderNav, renderGlobalProgress, ring,
  renderDashboard, renderReviewQueue, renderMockInterview, renderStatsPage };

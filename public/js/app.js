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
  const defaultState = () => ({ status: {}, notes: {}, openPhases: {}, lastModule: null, resumeModule: null, activity: {} });
  let state = load();

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
      const isOpen = q ? true : (state.openPhases[phase.id] ?? (idx === 0));

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
          <span class="text-[10px] text-slate-600 shrink-0">${m.hours}h</span>
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

  /* ===================== MARKDOWN + CALLOUTS ===================== */
  function renderMarkdown(md) {
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

  function openModule(id, startSec) {
    const found = findModule(id);
    if (!found) return;
    const { phase, module } = found;
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
          <button data-tab="notes"   class="tab-btn active shrink-0 whitespace-nowrap px-3 sm:px-4 py-2.5 font-medium text-slate-400">📘 <span class="hidden xs:inline">Study </span>Guide</button>
          <button data-tab="sandbox" class="tab-btn shrink-0 whitespace-nowrap px-3 sm:px-4 py-2.5 font-medium text-slate-400">⚡ Code</button>
          <button data-tab="cards"   class="tab-btn shrink-0 whitespace-nowrap px-3 sm:px-4 py-2.5 font-medium text-slate-400">🃏 Flashcards</button>
          <button data-tab="mynotes" class="tab-btn shrink-0 whitespace-nowrap px-3 sm:px-4 py-2.5 font-medium text-slate-400">✎ My Notes</button>
        </div>

        <div id="tab-notes" class="tab-pane prose-notes"></div>
        <div id="tab-sandbox" class="tab-pane hidden"></div>
        <div id="tab-cards" class="tab-pane hidden"></div>
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
      appendInterviewQuestions(notesEl, module, src);
      icons(); // re-run lucide for icons inside callouts / journey
      renderSandbox(src);
      renderFlashcards(src);
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

  // Render a click-to-reveal "Likely interview questions" panel under the notes,
  // sitting right next to the [!EU] interview-tip callouts.
  function appendInterviewQuestions(notesEl, module, src) {
    const qs = interviewQsFor(module, src);
    if (!qs.length) return;

    const block = el('div', { class: 'iq-block mt-10 pt-6 border-t border-slate-800' });
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

    notesEl.appendChild(block);

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

    ensureMonaco(() => {
      rec.ed = monaco.editor.create(editorHost, {
        value: sample.code,
        language: LANG_MAP[sample.lang] || 'plaintext',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 13.5,
        fontFamily: 'JetBrains Mono, monospace',
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
  function renderFlashcards(module) {
    const pane = $('#tab-cards');
    const allCards = module.flashcards || [];
    if (allCards.length === 0) { pane.innerHTML = '<p class="text-slate-400">No flashcards for this module yet.</p>'; return; }

    // session-scoped marks: q -> 'known' | 'again'
    const marks = new Map();

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
        kBtn.addEventListener('click', (e) => { e.stopPropagation(); marks.set(q, 'known'); applyMark(); card.classList.remove('flipped'); updateScore(); });
        aBtn.addEventListener('click', (e) => { e.stopPropagation(); marks.set(q, 'again'); applyMark(); card.classList.remove('flipped'); updateScore(); });
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
          body: JSON.stringify({ status: state.status, notes: state.notes }),
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
          <button id="logout-btn" title="Sign out" class="shrink-0 grid place-items-center w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition">
            <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
          </button>
        </div>`;
      const lo = document.getElementById('logout-btn');
      if (lo) lo.addEventListener('click', logout);
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

    // reading progress bar — fills as the content pane scrolls
    const contentEl = $('#content'), readBar = document.getElementById('read-progress');
    if (contentEl && readBar) {
      contentEl.addEventListener('scroll', () => {
        const max = contentEl.scrollHeight - contentEl.clientHeight;
        readBar.style.width = max > 200 ? (contentEl.scrollTop / max * 100).toFixed(1) + '%' : '0%';
      }, { passive: true });
    }
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

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
  const defaultState = () => ({ status: {}, notes: {}, openPhases: {}, lastModule: null });
  let state = load();

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
      const matches = (m) => !q ||
        m.title.toLowerCase().includes(q) || m.id.includes(q) ||
        phase.title.toLowerCase().includes(q);
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
        const item = el('button', {
          class: 'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition ' +
                 (active ? 'bg-brand/20 ring-1 ring-brand/40' : 'hover:bg-slate-800/60')
        });
        item.innerHTML = `
          <span class="status-dot status-${st}"></span>
          <span class="text-[11px] font-mono text-slate-500 shrink-0">${esc(m.id)}</span>
          <span class="flex-1 text-[13px] ${st === 'completed' ? 'text-slate-400 line-through decoration-slate-600' : 'text-slate-300'} truncate">${esc(m.title)}</span>
          <span class="text-[10px] text-slate-600 shrink-0">${m.hours}h</span>`;
        item.addEventListener('click', () => openModule(m.id));
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

  function openModule(id) {
    const found = findModule(id);
    if (!found) return;
    const { phase, module } = found;
    state.lastModule = id; save();
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
      renderMermaidIn(notesEl);
      initJourneyWidgets(notesEl);
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
      fillContent(module.sections[0]);
      renderBottomNav(0);
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
      Edit and <strong class="text-slate-300">Run</strong> live — Java executes on a real JDK compiler. SQL &amp; shell snippets are shown for reference.
    </p><div class="space-y-6" id="sandbox-host"></div>`;
    const host = $('#sandbox-host');
    samples.forEach(s => mountEditor(host, s));
    icons();
  }

  const RUNNABLE_LANGS = ['java', 'python', 'javascript'];
  function mountEditor(host, sample) {
    const runnable = RUNNABLE_LANGS.includes(sample.lang);
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
          </button>` : `<span class="text-[10px] text-slate-500 italic px-2">illustrative</span>`}
        </div>
      </div>
      <div class="monaco-wrap"></div>
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

  /* ===================== FLASHCARDS ===================== */
  function renderFlashcards(module) {
    const pane = $('#tab-cards');
    const cards = module.flashcards || [];
    if (cards.length === 0) { pane.innerHTML = '<p class="text-slate-400">No flashcards for this module yet.</p>'; return; }

    pane.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-slate-400 flex items-center gap-2"><i data-lucide="brain" class="w-4 h-4 text-brand"></i>
          Active recall — click a card to reveal the answer. <span class="text-slate-500">${cards.length} cards</span></p>
        <button id="flip-all" class="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition">Flip all</button>
      </div>
      <div class="grid sm:grid-cols-2 gap-4" id="cards-grid">
        ${cards.map((c, i) => `
          <div class="flip-card" data-i="${i}">
            <div class="flip-inner">
              <div class="flip-face flip-front">
                <div class="text-[10px] uppercase tracking-wider text-brand font-bold mb-2">Question ${i + 1}</div>
                <div class="text-[15px] text-slate-100 font-medium leading-snug">${esc(c.q)}</div>
                <div class="mt-auto pt-3 text-[10px] text-slate-500 flex items-center gap-1"><i data-lucide="mouse-pointer-click" class="w-3 h-3"></i> click to flip</div>
              </div>
              <div class="flip-face flip-back">
                <div class="text-[10px] uppercase tracking-wider text-success font-bold mb-2">Answer</div>
                <div class="text-[13.5px] text-slate-200 leading-relaxed">${esc(c.a)}</div>
              </div>
            </div>
          </div>`).join('')}
      </div>`;

    pane.querySelectorAll('.flip-card').forEach(card =>
      card.addEventListener('click', () => card.classList.toggle('flipped')));
    $('#flip-all').addEventListener('click', () => {
      const cards = pane.querySelectorAll('.flip-card');
      const anyUnflipped = [...cards].some(c => !c.classList.contains('flipped'));
      cards.forEach(c => c.classList.toggle('flipped', anyUnflipped));
    });
    icons();
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
    $('#dashboard-btn-bottom').addEventListener('click', renderDashboard);
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
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

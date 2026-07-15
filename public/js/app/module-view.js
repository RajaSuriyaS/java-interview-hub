/* module-view.js — part of the Java Interview Hub app engine (split from the original app.js).
   ES module. Shared state + helpers live in core.js (live bindings). */
'use strict';
import { STORAGE_KEY, STATUSES, STATUS_LABEL, STATUS_NEXT, defaultState, state, setState, cardKey, reviewQueue, dayKey, markActivity, studyStreak, auth, setAuth, load, save, allModules, findModule, statusOf, phaseProgress, globalProgress, $, el, icons, esc, openSidebarMobile, closeSidebarMobile } from './core.js';
import { renderMarkdown, initJourneyWidgets, addCopyButtons, renderMermaidIn } from './markdown.js';
import { renderSandbox, editors } from './sandbox.js';
import { renderFlashcards } from './flashcards.js';
import { renderUpgrade } from './billing.js';
import { renderNav, renderGlobalProgress, renderDashboard } from './nav-dashboard.js';
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

export { openModule, interviewQsFor, renderInterviewTab, placeholderNotes, renderMyNotes };

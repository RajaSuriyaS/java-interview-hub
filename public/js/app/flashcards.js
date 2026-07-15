/* flashcards.js — part of the Java Interview Hub app engine (split from the original app.js).
   ES module. Shared state + helpers live in core.js (live bindings). */
'use strict';
import { STORAGE_KEY, STATUSES, STATUS_LABEL, STATUS_NEXT, defaultState, state, setState, cardKey, reviewQueue, dayKey, markActivity, studyStreak, auth, setAuth, load, save, allModules, findModule, statusOf, phaseProgress, globalProgress, $, el, icons, esc, openSidebarMobile, closeSidebarMobile } from './core.js';
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

export { renderFlashcards };

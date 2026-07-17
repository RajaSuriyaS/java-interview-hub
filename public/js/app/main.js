/* main.js — part of the Java Interview Hub app engine (split from the original app.js).
   ES module. Shared state + helpers live in core.js (live bindings). */
'use strict';
import { STORAGE_KEY, STATUSES, STATUS_LABEL, STATUS_NEXT, defaultState, state, setState, cardKey, reviewQueue, dayKey, markActivity, studyStreak, auth, setAuth, load, save, allModules, findModule, statusOf, phaseProgress, globalProgress, $, el, icons, esc, openSidebarMobile, closeSidebarMobile } from './core.js';
import { renderNav, renderGlobalProgress, renderDashboard, refreshCollapseAllBtn, anyPhaseOpen } from './nav-dashboard.js';
import { openModule } from './module-view.js';
import { renderAccount, refreshAuth, syncFromServer } from './account.js';
import { handleBillingReturn } from './billing.js';
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

    // Deep link (?m=<moduleId>) wins, then the last-open module, else the dashboard.
    const urlModule = new URLSearchParams(location.search).get('m');
    if (urlModule && findModule(urlModule)) openModule(urlModule);
    else if (state.lastModule && findModule(state.lastModule)) openModule(state.lastModule);
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
        setState(defaultState());
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
    refreshAuth().then(syncFromServer).then(handleBillingReturn);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

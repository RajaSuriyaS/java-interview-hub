/* core.js — part of the Java Interview Hub app engine (split from the original app.js).
   ES module. Shared state + helpers live in core.js (live bindings). */
'use strict';
import { pushToServer } from './account.js';
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

  function openSidebarMobile() { $('#sidebar').classList.add('open'); $('#backdrop').classList.remove('hidden'); }
  function closeSidebarMobile() { $('#sidebar').classList.remove('open'); $('#backdrop').classList.add('hidden'); }

// Setters so other modules can trigger the (module-local) reassignment of the
// live 'state' / 'auth' bindings without importing them as writable.
export function setState(s) { state = s; }
export function setAuth(a) { auth = a; }

export {
  STORAGE_KEY, STATUSES, STATUS_LABEL, STATUS_NEXT, defaultState, state, cardKey, reviewQueue, dayKey, markActivity, studyStreak, auth, load, save, allModules, findModule, statusOf, phaseProgress, globalProgress, $, el, icons, esc, openSidebarMobile, closeSidebarMobile
};

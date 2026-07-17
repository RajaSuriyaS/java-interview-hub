/* challenges.js — graded coding challenges tab. Fetches problems for a module,
   mounts a Monaco editor per challenge, submits to /api/grade, and shows
   per-test pass/fail. Solved state persists locally (state.solved). */
'use strict';
import { state, save, markActivity, esc, icons } from './core.js';
import { ensureMonaco } from './sandbox.js';
import { renderMarkdown } from './markdown.js';

let chEditors = [];        // { ed } records, relaid out when the tab is shown
let currentChallenges = []; // last-rendered list, for the tab counter

export function layoutChallengeEditors() { chEditors.forEach(e => e.ed && e.ed.layout()); }

function refreshTabCount() {
  const tabBtn = document.querySelector('[data-tab="challenges"]');
  if (!tabBtn || !currentChallenges.length) return;
  const solved = currentChallenges.filter(c => (state.solved || {})[c.id]).length;
  tabBtn.innerHTML = `🏆 Challenges <span class="text-[10px] opacity-70">${solved}/${currentChallenges.length}</span>`;
}

function badge(diff) {
  const map = { easy: 'bg-emerald-500/15 text-emerald-300', medium: 'bg-amber-500/15 text-amber-300', hard: 'bg-red-500/15 text-red-300' };
  return `<span class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${map[diff] || 'bg-slate-700 text-slate-300'}">${esc(diff || '')}</span>`;
}

export async function renderChallenges(module) {
  const pane = document.getElementById('tab-challenges');
  const tabBtn = document.querySelector('[data-tab="challenges"]');
  if (!pane) return;
  chEditors = []; currentChallenges = [];

  let list = [];
  try {
    const r = await fetch('/api/challenges/' + encodeURIComponent(module.id), { credentials: 'same-origin' });
    if (r.ok) { const d = await r.json(); list = d.challenges || []; }
  } catch { /* offline — leave the tab hidden */ }

  if (!list.length) { if (tabBtn) tabBtn.classList.add('hidden'); return; }
  currentChallenges = list;
  if (tabBtn) tabBtn.classList.remove('hidden');
  refreshTabCount();

  pane.innerHTML = `<p class="text-sm text-slate-400 mb-4 flex items-center gap-2">
    <i data-lucide="trophy" class="w-4 h-4 text-amber-400"></i>
    Solve each problem, then <strong class="text-slate-300">Run Tests</strong> — your code is compiled on a real JDK and graded against hidden test cases.
  </p><div class="space-y-6" id="challenge-host"></div>`;
  const host = pane.querySelector('#challenge-host');
  list.forEach(ch => mountChallenge(host, ch));
  icons();
}

function mountChallenge(host, ch) {
  const solved = !!(state.solved || {})[ch.id];
  const wrap = document.createElement('div');
  wrap.className = 'rounded-xl border ' + (solved ? 'border-success/40' : 'border-slate-800') + ' bg-slate-900/40 overflow-hidden';
  const sampleHtml = (ch.sampleTests || []).map(t => `
    <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px] font-mono">
      <span class="text-slate-500">in</span><span class="text-slate-300 whitespace-pre-wrap">${esc((t.stdin || '').replace(/\n+$/, '') || '(none)')}</span>
      <span class="text-slate-500">out</span><span class="text-emerald-300 whitespace-pre-wrap">${esc(t.expected)}</span>
    </div>`).join('<div class="h-px bg-slate-800 my-1.5"></div>');

  wrap.innerHTML = `
    <div class="px-4 py-3 border-b border-slate-800 bg-slate-900/70 flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <span class="ch-solved ${solved ? '' : 'hidden'} text-emerald-400"><i data-lucide="check-circle-2" class="w-4 h-4"></i></span>
        <span class="text-sm font-semibold text-slate-200 truncate">${esc(ch.title)}</span>
        ${badge(ch.difficulty)}
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button class="ch-reset text-[11px] text-slate-500 hover:text-slate-300 transition">Reset</button>
        <button class="ch-run text-xs font-semibold inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-dark text-white transition">
          <i data-lucide="play" class="w-3.5 h-3.5"></i> Run Tests
        </button>
      </div>
    </div>
    <div class="px-4 py-3 text-[13.5px] text-slate-300 leading-relaxed prose-notes ch-prompt"></div>
    <div class="px-4 pb-3">
      <div class="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">Sample tests${ch.hiddenCount ? ` · +${ch.hiddenCount} hidden` : ''}</div>
      <div class="rounded-lg bg-slate-950/50 border border-slate-800 p-3">${sampleHtml}</div>
    </div>
    <div class="monaco-wrap"></div>
    <div class="ch-results hidden border-t border-slate-800 px-4 py-3"></div>`;
  host.appendChild(wrap);
  wrap.querySelector('.ch-prompt').innerHTML = renderMarkdown(ch.prompt);

  const editorHost = wrap.querySelector('.monaco-wrap');
  const storeKey = 'jih.chcode.' + ch.id;
  let savedCode = null;
  try { savedCode = localStorage.getItem(storeKey); } catch { /* private mode */ }
  const rec = { ed: null };
  chEditors.push(rec);

  if (typeof require === 'undefined') {
    editorHost.innerHTML = '<pre class="p-4 text-[13px] font-mono whitespace-pre-wrap overflow-auto h-full">' + esc(savedCode || ch.starter) + '</pre>';
  }
  ensureMonaco(() => {
    rec.ed = monaco.editor.create(editorHost, {
      value: savedCode || ch.starter, language: 'java', theme: 'vs-dark',
      automaticLayout: true, minimap: { enabled: false }, fontSize: 13.5,
      fontFamily: 'JetBrains Mono, monospace', scrollBeyondLastLine: false,
      padding: { top: 12, bottom: 12 }, lineNumbers: 'on', renderLineHighlight: 'none',
      scrollbar: { alwaysConsumeMouseWheel: false },
    });
    rec.ed.onDidChangeModelContent(() => { try { localStorage.setItem(storeKey, rec.ed.getValue()); } catch {} });
  });

  const getCode = () => (rec.ed ? rec.ed.getValue() : (savedCode || ch.starter));
  const results = wrap.querySelector('.ch-results');

  wrap.querySelector('.ch-reset').addEventListener('click', () => {
    if (rec.ed) rec.ed.setValue(ch.starter);
    try { localStorage.removeItem(storeKey); } catch {}
  });

  wrap.querySelector('.ch-run').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true; btn.classList.add('opacity-60');
    results.classList.remove('hidden');
    results.innerHTML = '<span class="text-amber-400 text-[13px]">⏳ Compiling &amp; running tests…</span>';
    try {
      const r = await fetch('/api/grade', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: ch.id, code: getCode() }),
      });
      if (r.status === 401) { results.innerHTML = '<span class="text-amber-300 text-[13px]">Please sign in to run tests.</span>'; return; }
      if (r.status === 429) { results.innerHTML = '<span class="text-amber-300 text-[13px]">Too many runs — wait a minute and try again.</span>'; return; }
      const d = await r.json();
      renderResults(results, d);
      if (d.passed) {
        if (!state.solved) state.solved = {};
        if (!state.solved[ch.id]) { state.solved[ch.id] = true; markActivity(); save(); }
        refreshTabCount();
        wrap.className = 'rounded-xl border border-success/40 bg-slate-900/40 overflow-hidden';
        const s = wrap.querySelector('.ch-solved'); if (s) s.classList.remove('hidden');
      }
    } catch { results.innerHTML = '<span class="text-red-300 text-[13px]">Could not reach the grader. Try again.</span>'; }
    finally { btn.disabled = false; btn.classList.remove('opacity-60'); }
  });
}

function renderResults(elm, d) {
  if (d && d.compileError) {
    elm.innerHTML = `<div class="text-[13px] text-red-300 font-semibold mb-1">✗ Compile error</div>` +
      `<pre class="text-[12px] text-red-200/80 whitespace-pre-wrap max-h-40 overflow-auto">${esc(d.compileError)}</pre>`;
    return;
  }
  if (!d || d.error) { elm.innerHTML = `<span class="text-red-300 text-[13px]">${esc((d && d.error) || 'Grading failed.')}</span>`; return; }
  const rows = (d.results || []).map(r => {
    const detail = (!r.passed && r.sample && r.got !== undefined)
      ? ` <span class="text-slate-600">— got <code class="text-red-300">${esc(String(r.got).slice(0, 60))}</code>, expected <code class="text-emerald-300">${esc(String(r.expected).slice(0, 60))}</code></span>`
      : '';
    return `<div class="flex items-start gap-2 text-[12.5px] py-0.5">
      <span class="${r.passed ? 'text-emerald-400' : 'text-red-400'} shrink-0">${r.passed ? '✓' : '✗'}</span>
      <span class="text-slate-400">${esc(r.name)}${r.sample ? '' : ' <span class="text-slate-600">(hidden)</span>'}${detail}</span>
    </div>`;
  }).join('');
  const head = d.passed
    ? `<div class="text-[14px] font-bold text-emerald-300 mb-2">🎉 All ${d.total} tests passed!</div>`
    : `<div class="text-[14px] font-bold text-amber-300 mb-2">${d.passedCount}/${d.total} tests passed</div>`;
  elm.innerHTML = head + rows;
}

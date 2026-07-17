/* ai-interview.js — part of the Java Interview Hub app engine.
   ES module. AI-powered mock interviewer (premium; dormant until a key is set).
   Talks to POST /api/ai/interview; shared state + helpers live in core.js. */
'use strict';
import { $, el, icons, esc, markActivity, save } from './core.js';
import { renderDashboard } from './nav-dashboard.js';
import { renderUpgrade } from './billing.js';

const AI_TOPICS = [
  { id: 'Core Java',       emoji: '☕', blurb: 'Language, collections, JVM' },
  { id: 'Spring',          emoji: '🌱', blurb: 'Spring Boot, DI, web' },
  { id: 'System Design',   emoji: '🏗️', blurb: 'Scalable backend design' },
  { id: 'Concurrency',     emoji: '🧵', blurb: 'Threads, locks, executors' },
  { id: 'Data Structures', emoji: '🗂️', blurb: 'DS & algorithms' },
  { id: 'Databases',       emoji: '🗄️', blurb: 'SQL, indexing, transactions' },
  { id: 'Microservices',   emoji: '🔗', blurb: 'Services, messaging, resilience' },
];

const backBtn = `<button id="ai-back" class="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand transition mb-6"><i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> Dashboard</button>`;

export async function renderAiInterview() {
  const content = $('#content');
  content.scrollTop = 0;

  // ---- topic picker ----
  content.innerHTML = `
    <div class="w-full max-w-3xl mx-auto px-6 py-10 fade-up">
      ${backBtn}
      <div class="text-center rounded-2xl border border-slate-800 bg-slate-900/50 p-8 sm:p-10">
        <div class="text-5xl mb-4">🤖</div>
        <h1 class="text-2xl font-extrabold text-white mb-3">AI Mock Interview</h1>
        <p class="text-slate-400 text-sm leading-relaxed max-w-md mx-auto mb-7">A senior Java backend interviewer that adapts to your answers — one question at a time, with honest feedback after each. Pick a focus area to begin.</p>
        <div class="grid sm:grid-cols-2 gap-3 text-left" id="ai-topics">
          ${AI_TOPICS.map(t => `
            <button class="ai-topic flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-brand/60 hover:bg-slate-900/70 px-4 py-3 transition group" data-topic="${esc(t.id)}">
              <span class="text-2xl leading-none">${t.emoji}</span>
              <span>
                <span class="block text-sm font-semibold text-slate-200 group-hover:text-brand transition">${esc(t.id)}</span>
                <span class="block text-[11px] text-slate-500">${esc(t.blurb)}</span>
              </span>
            </button>`).join('')}
        </div>
      </div>
    </div>`;
  document.getElementById('ai-back').addEventListener('click', renderDashboard);
  content.querySelectorAll('.ai-topic').forEach(b =>
    b.addEventListener('click', () => startInterview(b.getAttribute('data-topic'))));
  icons();
}

function startInterview(topic) {
  const content = $('#content');
  content.scrollTop = 0;
  const history = []; // [{role:'user'|'assistant', content}]

  content.innerHTML = `
    <div class="w-full max-w-3xl mx-auto px-6 py-8 fade-up flex flex-col" style="min-height:70vh">
      ${backBtn}
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-xl font-extrabold text-white flex items-center gap-2">🤖 AI Interview</h1>
        <span class="text-[11px] font-bold uppercase tracking-wider text-brand bg-brand/15 rounded-full px-3 py-1">${esc(topic)}</span>
      </div>
      <div id="ai-thread" class="flex-1 space-y-4 mb-4 overflow-y-auto"></div>
      <div id="ai-note" class="text-[11px] text-slate-500 mb-2 min-h-[16px]"></div>
      <div class="flex items-end gap-2">
        <textarea id="ai-input" rows="2" placeholder="Type your answer…" class="flex-1 resize-none rounded-xl bg-slate-950/60 border border-slate-800 focus:border-brand/60 focus:outline-none text-[14px] text-slate-200 px-4 py-3 leading-relaxed"></textarea>
        <button id="ai-send" class="px-5 py-3 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold text-sm transition shrink-0">Send</button>
      </div>
    </div>`;

  document.getElementById('ai-back').addEventListener('click', renderDashboard);
  const thread = document.getElementById('ai-thread');
  const input = document.getElementById('ai-input');
  const sendBtn = document.getElementById('ai-send');
  const note = document.getElementById('ai-note');
  icons();

  function bubble(role, text) {
    const mine = role === 'user';
    const wrap = el('div', { class: 'flex ' + (mine ? 'justify-end' : 'justify-start') });
    const inner = el('div', {
      class: (mine
        ? 'bg-brand/20 border border-brand/40 text-slate-100'
        : 'bg-slate-900/60 border border-slate-800 text-slate-200') +
        ' rounded-2xl px-4 py-3 text-[14px] leading-relaxed max-w-[85%] whitespace-pre-wrap'
    });
    inner.innerHTML = esc(text);
    wrap.appendChild(inner);
    thread.appendChild(wrap);
    thread.scrollTop = thread.scrollHeight;
    return inner;
  }

  function setBusy(busy) {
    sendBtn.disabled = busy;
    input.disabled = busy;
    sendBtn.classList.toggle('opacity-50', busy);
  }

  async function turn() {
    setBusy(true);
    note.textContent = 'Interviewer is thinking…';
    try {
      const r = await fetch('/api/ai/interview', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history, topic }),
      });
      if (r.status === 401) { note.textContent = ''; bubble('assistant', 'Please sign in to start an AI interview.'); setBusy(true); input.disabled = true; return; }
      if (r.status === 403) { renderUpgrade(null, null); return; }
      if (r.status === 503) { note.textContent = ''; bubble('assistant', 'AI interviews are not configured yet. Check back soon.'); input.disabled = true; return; }
      if (r.status === 429) { note.textContent = 'You\'re going a bit fast — wait a moment and try again.'; setBusy(false); return; }
      if (!r.ok) { note.textContent = 'The interviewer is unavailable right now. Please try again.'; setBusy(false); return; }
      const d = await r.json();
      const reply = typeof d.reply === 'string' ? d.reply : '(no response)';
      history.push({ role: 'assistant', content: reply });
      bubble('assistant', reply);
      note.textContent = '';
      markActivity(); save();
      setBusy(false);
      input.focus();
    } catch {
      note.textContent = 'Network error — please try again.';
      setBusy(false);
    }
  }

  function send() {
    const text = input.value.trim();
    if (!text || sendBtn.disabled) return;
    history.push({ role: 'user', content: text });
    bubble('user', text);
    input.value = '';
    turn();
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });

  // Kick off the interview: empty history asks the model for its first question.
  turn();
}

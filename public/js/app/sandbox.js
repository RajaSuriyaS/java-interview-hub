/* sandbox.js — part of the Java Interview Hub app engine (split from the original app.js).
   ES module. Shared state + helpers live in core.js (live bindings). */
'use strict';
import { STORAGE_KEY, STATUSES, STATUS_LABEL, STATUS_NEXT, defaultState, state, setState, cardKey, reviewQueue, dayKey, markActivity, studyStreak, auth, setAuth, load, save, allModules, findModule, statusOf, phaseProgress, globalProgress, $, el, icons, esc, openSidebarMobile, closeSidebarMobile } from './core.js';
let editors = []; // active monaco editors on the page (read by module-view for tab layout)

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

export { editors, renderSandbox, javaRunnability, sampleRunInfo, mountEditor, ensureMonaco };

/* markdown.js — part of the Java Interview Hub app engine (split from the original app.js).
   ES module. Shared state + helpers live in core.js (live bindings). */
'use strict';
import { STORAGE_KEY, STATUSES, STATUS_LABEL, STATUS_NEXT, defaultState, state, setState, cardKey, reviewQueue, dayKey, markActivity, studyStreak, auth, setAuth, load, save, allModules, findModule, statusOf, phaseProgress, globalProgress, $, el, icons, esc, openSidebarMobile, closeSidebarMobile } from './core.js';
  /* ===================== MARKDOWN + CALLOUTS ===================== */
  function renderMarkdown(md) {
    // Degrade gracefully if the marked CDN failed to load: show readable plain text.
    if (typeof marked === 'undefined') {
      return '<pre class="whitespace-pre-wrap text-[13.5px] leading-relaxed font-sans">' + esc(md) + '</pre>';
    }
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

export { renderMarkdown, initJourneyWidgets, addCopyButtons, renderMermaidIn };

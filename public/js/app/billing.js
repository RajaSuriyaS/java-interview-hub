/* billing.js — part of the Java Interview Hub app engine (split from the original app.js).
   ES module. Shared state + helpers live in core.js (live bindings). */
'use strict';
import { STORAGE_KEY, STATUSES, STATUS_LABEL, STATUS_NEXT, defaultState, state, setState, cardKey, reviewQueue, dayKey, markActivity, studyStreak, auth, setAuth, load, save, allModules, findModule, statusOf, phaseProgress, globalProgress, $, el, icons, esc, openSidebarMobile, closeSidebarMobile } from './core.js';
import { renderDashboard } from './nav-dashboard.js';
  // ---- Paywall / upgrade page (shown for premium-locked modules) ----
  function renderUpgrade(module, phase) {
    const content = $('#content');
    content.scrollTop = 0;
    const lockedCount = allModules().filter(x => x.module.locked).length;
    content.innerHTML = `
      <div class="w-full px-4 sm:px-8 lg:px-12 xl:px-16 py-7 fade-up">
        <div class="flex items-center gap-2 text-xs text-slate-500 mb-6">
          <button id="up-bc-dash" class="hover:text-brand transition">Dashboard</button>
          <i data-lucide="chevron-right" class="w-3 h-3"></i><span class="text-brand">Premium</span>
        </div>

        <!-- Blurred content teaser (a peek behind the paywall; real content is never sent to free users) -->
        <div class="relative max-w-2xl mx-auto mb-8 rounded-2xl border border-slate-800 overflow-hidden">
          <div class="p-6 text-left select-none pointer-events-none" style="filter:blur(6px)" aria-hidden="true">
            <div class="h-6 w-2/3 rounded bg-slate-700/60 mb-4"></div>
            <div class="space-y-2 mb-5">
              <div class="h-3 rounded bg-slate-700/40"></div>
              <div class="h-3 w-11/12 rounded bg-slate-700/40"></div>
              <div class="h-3 w-4/5 rounded bg-slate-700/40"></div>
            </div>
            <div class="rounded-lg bg-slate-950/70 border border-slate-800 p-4 mb-5">
              <div class="h-3 w-1/2 rounded bg-brand/30 mb-2"></div>
              <div class="h-3 w-3/4 rounded bg-slate-700/40 mb-1.5"></div>
              <div class="h-3 w-2/3 rounded bg-slate-700/40"></div>
            </div>
            <div class="flex gap-2">
              <div class="h-8 w-24 rounded-lg bg-slate-700/40"></div>
              <div class="h-8 w-24 rounded-lg bg-slate-700/40"></div>
            </div>
          </div>
          <div class="absolute inset-0 grid place-items-center bg-slate-950/40">
            <div class="text-center px-4">
              <div class="grid place-items-center w-14 h-14 mx-auto mb-3 rounded-2xl bg-amber-400/15 text-amber-300">
                <i data-lucide="lock" class="w-7 h-7"></i>
              </div>
              <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/15 text-amber-300 text-[10px] font-bold uppercase tracking-wide mb-2"><i data-lucide="crown" class="w-3 h-3"></i>PRO</div>
              <p class="text-sm text-slate-300 font-medium max-w-xs mx-auto">Full study guide, runnable code, flashcards &amp; interview Q&amp;A behind this module.</p>
              <button id="up-unlock" class="mt-4 px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold text-sm transition shadow-lg shadow-brand/30">Unlock with PRO</button>
            </div>
          </div>
        </div>

        <div class="max-w-2xl mx-auto text-center">
          <div class="grid place-items-center w-16 h-16 mx-auto mb-5 rounded-2xl bg-brand/15 text-brand">
            <i data-lucide="lock" class="w-8 h-8"></i>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">${module ? esc(module.title) : 'Premium content'}</h1>
          <p class="text-slate-400 mb-8">This module is part of <b class="text-brand">Premium</b>. Unlock ${lockedCount}+ advanced modules — full study guides, runnable code, flashcards and interview Q&amp;A.</p>
          <div id="up-plans" class="grid sm:grid-cols-2 gap-4 text-left mb-8">
            <div class="rounded-2xl border border-brand/40 bg-brand/[0.06] p-6">
              <div class="text-xs font-bold uppercase tracking-wider text-brand mb-1">Monthly</div>
              <div class="text-3xl font-extrabold text-white mb-1"><span class="up-amt-monthly">₹499</span><span class="text-base font-medium text-slate-400">/mo</span></div>
              <div class="text-[12px] text-slate-500 mb-4">Cancel anytime</div>
              <button data-plan="monthly" class="up-buy w-full py-2.5 rounded-lg bg-brand hover:bg-brand-dark text-white font-bold text-sm transition">Get Premium</button>
            </div>
            <div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
              <div class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Yearly <span class="text-emerald-400">save 30%</span></div>
              <div class="text-3xl font-extrabold text-white mb-1"><span class="up-amt-yearly">₹3,999</span><span class="text-base font-medium text-slate-400">/yr</span></div>
              <div class="text-[12px] text-slate-500 mb-4">Best value</div>
              <button data-plan="yearly" class="up-buy w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition">Get Premium</button>
            </div>
          </div>
          <ul class="text-left text-sm text-slate-300 space-y-2 max-w-md mx-auto mb-6">
            ${['All ' + lockedCount + '+ premium modules across JVM, Spring, System Design, Kafka, Elasticsearch, Terraform & more',
               'Runnable code sandbox, flashcards with spaced repetition, mock interviews',
               'Curated rapid-fire interview Q&A with answers'].map(f =>
              `<li class="flex gap-2"><i data-lucide="check" class="w-4 h-4 text-emerald-400 mt-0.5 shrink-0"></i> ${esc(f)}</li>`).join('')}
          </ul>
          <p id="up-msg" class="text-[13px] text-slate-500"></p>
        </div>
      </div>`;
    icons();
    document.getElementById('up-bc-dash').addEventListener('click', renderDashboard);
    const unlockBtn = document.getElementById('up-unlock');
    if (unlockBtn) unlockBtn.addEventListener('click', () => {
      const plans = document.getElementById('up-plans');
      if (plans) plans.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    // Provider selection: if both are configured, let the user choose (Stripe = cards
    // globally; Razorpay = UPI/cards, better for India). Otherwise the server picks.
    let chosenProvider = null;
    fetch('/api/billing/config', { credentials: 'same-origin' }).then(r => r.json()).then(cfg => {
      // reflect the configured price labels (PRICE_MONTHLY_LABEL / PRICE_YEARLY_LABEL)
      if (cfg.prices) {
        const am = content.querySelector('.up-amt-monthly'); if (am && cfg.prices.monthly) am.textContent = cfg.prices.monthly;
        const ay = content.querySelector('.up-amt-yearly');  if (ay && cfg.prices.yearly)  ay.textContent = cfg.prices.yearly;
      }
      if (cfg.stripe && cfg.razorpay) {
        chosenProvider = 'stripe';
        const bar = document.createElement('div');
        bar.className = 'inline-flex rounded-lg border border-slate-800 overflow-hidden text-[12px] font-semibold mb-6';
        bar.innerHTML = `
          <button data-pv="stripe" class="pv-btn px-4 py-1.5 bg-brand text-white">Card (Stripe)</button>
          <button data-pv="razorpay" class="pv-btn px-4 py-1.5 text-slate-400 hover:text-white">UPI / Card (Razorpay)</button>`;
        const anchor = content.querySelector('.grid.sm\\:grid-cols-2');
        if (anchor) anchor.parentNode.insertBefore(bar, anchor);
        bar.querySelectorAll('.pv-btn').forEach(b => b.addEventListener('click', () => {
          chosenProvider = b.getAttribute('data-pv');
          bar.querySelectorAll('.pv-btn').forEach(x => x.className = 'pv-btn px-4 py-1.5 text-slate-400 hover:text-white');
          b.className = 'pv-btn px-4 py-1.5 bg-brand text-white';
        }));
      }
    }).catch(() => {});

    content.querySelectorAll('.up-buy').forEach(btn => btn.addEventListener('click', async () => {
      const plan = btn.getAttribute('data-plan');
      const msg = document.getElementById('up-msg');
      if (!auth.user) { location.href = '/auth/google'; return; }
      msg.textContent = 'Starting checkout…';
      try {
        const r = await fetch('/api/billing/checkout', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chosenProvider ? { plan, provider: chosenProvider } : { plan }),
        });
        if (r.status === 501) { msg.innerHTML = 'Online payments are being set up. For early access, contact the site owner and you\'ll be upgraded manually.'; return; }
        if (!r.ok) { msg.textContent = 'Could not start checkout. Please try again later.'; return; }
        const d = await r.json();
        if (d.url) { location.href = d.url; return; }                 // Stripe hosted checkout
        if (d.razorpay) { openRazorpayCheckout(d.razorpay, msg); return; } // Razorpay checkout.js
        msg.textContent = 'Could not start checkout. Please try again later.';
      } catch { msg.textContent = 'Could not start checkout. Please try again later.'; }
    }));
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some(s => s.src === src)) return resolve();
      const el = document.createElement('script');
      el.src = src; el.onload = resolve; el.onerror = reject; document.head.appendChild(el);
    });
  }
  async function openRazorpayCheckout(rp, msg) {
    try {
      await loadScript('https://checkout.razorpay.com/v1/checkout.js');
      const options = {
        key: rp.key, subscription_id: rp.subscription_id, name: rp.name || 'Premium',
        description: 'Premium subscription',
        handler: () => { location.href = '/?billing=success'; },
        prefill: { email: rp.email || '' },
        theme: { color: '#8b5cf6' },
      };
      // eslint-disable-next-line no-undef
      new Razorpay(options).open();
    } catch { if (msg) msg.textContent = 'Could not open the payment window. Please try again.'; }
  }

  function toast(msg, ms = 3500) {
    let el = document.getElementById('jh-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'jh-toast';
      el.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-900 text-slate-100 text-sm font-medium border border-slate-700 shadow-xl';
      document.body.appendChild(el);
    }
    el.textContent = msg; el.style.opacity = '1';
    clearTimeout(el._t); el._t = setTimeout(() => { el.style.opacity = '0'; }, ms);
  }

  // Handle return from a payment provider (?billing=success|cancel).
  async function handleBillingReturn() {
    const params = new URLSearchParams(location.search);
    const b = params.get('billing');
    if (!b) return;
    history.replaceState({}, '', location.pathname);
    if (b === 'cancel') { toast('Checkout canceled.'); return; }
    if (b === 'success') {
      toast('Payment received — activating your premium access…', 6000);
      for (let i = 0; i < 6 && !auth.premium; i++) {
        await new Promise(r => setTimeout(r, 1500));
        try { setAuth(await (await fetch('/auth/me', { credentials: 'same-origin' })).json()); } catch {}
      }
      if (auth.premium) { toast('Premium unlocked! Reloading…'); setTimeout(() => location.reload(), 900); }
      else { toast('Payment received. Premium activates shortly — please refresh in a minute.', 6000); }
    }
  }

export { renderUpgrade, loadScript, openRazorpayCheckout, toast, handleBillingReturn };

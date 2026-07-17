/* ============================================================
   Payments — Stripe + Razorpay subscriptions, no SDK (fetch + crypto).
   Dormant until the relevant env vars are set; server keeps returning
   501 from /api/billing/checkout while a provider is unconfigured.

   Stripe env:   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
                 STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY
   Razorpay env: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
                 RAZORPAY_WEBHOOK_SECRET, RAZORPAY_PLAN_MONTHLY,
                 RAZORPAY_PLAN_YEARLY
   Optional:     PRICE_MONTHLY_LABEL, PRICE_YEARLY_LABEL (display only)
   ============================================================ */
import crypto from 'node:crypto';

const clean = (v) => String(v || '').trim();

const S = {
  key:          clean(process.env.STRIPE_SECRET_KEY),
  wh:           clean(process.env.STRIPE_WEBHOOK_SECRET),
  priceMonthly: clean(process.env.STRIPE_PRICE_MONTHLY),
  priceYearly:  clean(process.env.STRIPE_PRICE_YEARLY),
};
const R = {
  keyId:       clean(process.env.RAZORPAY_KEY_ID),
  keySecret:   clean(process.env.RAZORPAY_KEY_SECRET),
  wh:          clean(process.env.RAZORPAY_WEBHOOK_SECRET),
  planMonthly: clean(process.env.RAZORPAY_PLAN_MONTHLY),
  planYearly:  clean(process.env.RAZORPAY_PLAN_YEARLY),
};

export const stripeReady   = () => !!(S.key && (S.priceMonthly || S.priceYearly));
export const razorpayReady = () => !!(R.keyId && R.keySecret && (R.planMonthly || R.planYearly));

export function billingConfig() {
  return {
    stripe: stripeReady(),
    razorpay: razorpayReady(),
    razorpayKeyId: razorpayReady() ? R.keyId : null,
    prices: {
      monthly: clean(process.env.PRICE_MONTHLY_LABEL) || '₹499',
      yearly:  clean(process.env.PRICE_YEARLY_LABEL)  || '₹3,999',
    },
  };
}

/* ---------------- Checkout creation ---------------- */

// Stripe Checkout Session (subscription mode) -> returns { url } to redirect to.
export async function createStripeCheckout({ plan, user, origin }) {
  const price = plan === 'yearly' ? S.priceYearly : S.priceMonthly;
  if (!price) throw new Error('stripe price not configured for plan ' + plan);
  const body = new URLSearchParams();
  body.set('mode', 'subscription');
  body.set('line_items[0][price]', price);
  body.set('line_items[0][quantity]', '1');
  body.set('success_url', origin + '/?billing=success');
  body.set('cancel_url', origin + '/?billing=cancel');
  body.set('client_reference_id', user.id);
  if (user.email) body.set('customer_email', user.email);
  body.set('metadata[userId]', user.id);
  body.set('subscription_data[metadata][userId]', user.id);
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + S.key, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((d.error && d.error.message) || ('stripe HTTP ' + res.status));
  return { provider: 'stripe', url: d.url };
}

// Razorpay Subscription -> returns the ids the client hands to Razorpay Checkout.
export async function createRazorpaySubscription({ plan, user }) {
  const planId = plan === 'yearly' ? R.planYearly : R.planMonthly;
  if (!planId) throw new Error('razorpay plan not configured for plan ' + plan);
  const auth = Buffer.from(R.keyId + ':' + R.keySecret).toString('base64');
  const res = await fetch('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan_id: planId,
      total_count: plan === 'yearly' ? 5 : 60,   // max billing cycles
      customer_notify: 1,
      notes: { userId: user.id, email: user.email || '' },
    }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((d.error && d.error.description) || ('razorpay HTTP ' + res.status));
  return {
    provider: 'razorpay',
    ref: d.id,
    razorpay: { key: R.keyId, subscription_id: d.id, name: 'Java Interview Hub Premium', email: user.email || '' },
  };
}

/* ---------------- Webhook signature verification ---------------- */

function verifyStripeSig(raw, header) {
  if (!S.wh || !header) return false;
  const parts = Object.fromEntries(String(header).split(',').map(p => p.split('=')));
  if (!parts.t || !parts.v1) return false;
  const expected = crypto.createHmac('sha256', S.wh).update(parts.t + '.' + raw).digest('hex');
  const a = Buffer.from(parts.v1), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function verifyRazorpaySig(raw, sig) {
  if (!R.wh || !sig) return false;
  const expected = crypto.createHmac('sha256', R.wh).update(raw).digest('hex');
  const a = Buffer.from(String(sig)), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Map Stripe subscription.status -> our sub_status.
function mapStripeStatus(s) {
  if (s === 'active' || s === 'trialing') return 'active';
  if (s === 'past_due' || s === 'unpaid') return 'past_due';
  return 'none'; // canceled, incomplete, incomplete_expired
}

/* ---------------- Route mounting ----------------
   setSub(userId, {status, plan, until, provider, ref})
   findUserByRef(providerSubId) -> userId | null                     */
export function mountBillingWebhooks(app, express, { setSub, findUserByRef }) {
  // Stripe webhook — raw body required for signature verification.
  app.post('/api/billing/webhook/stripe', express.raw({ type: '*/*' }), (req, res) => {
    const raw = req.body instanceof Buffer ? req.body.toString('utf8') : String(req.body || '');
    if (!verifyStripeSig(raw, req.headers['stripe-signature'])) return res.status(400).send('bad signature');
    let evt; try { evt = JSON.parse(raw); } catch { return res.status(400).send('bad json'); }
    try {
      const obj = evt.data && evt.data.object;
      if (evt.type === 'checkout.session.completed') {
        const userId = obj.client_reference_id || (obj.metadata && obj.metadata.userId);
        if (userId) setSub(userId, { status: 'active', plan: 'stripe', until: null, provider: 'stripe', ref: obj.subscription });
      } else if (evt.type === 'customer.subscription.updated' || evt.type === 'customer.subscription.created') {
        const userId = (obj.metadata && obj.metadata.userId) || findUserByRef(obj.id);
        if (userId) setSub(userId, {
          status: mapStripeStatus(obj.status),
          plan: 'stripe',
          until: obj.current_period_end ? obj.current_period_end * 1000 : null,
          provider: 'stripe', ref: obj.id,
        });
      } else if (evt.type === 'customer.subscription.deleted') {
        const userId = (obj.metadata && obj.metadata.userId) || findUserByRef(obj.id);
        if (userId) setSub(userId, { status: 'none', plan: null, until: null, provider: 'stripe', ref: obj.id });
      }
    } catch (e) { console.error('[billing] stripe webhook:', e.message); }
    res.json({ received: true });
  });

  // Razorpay webhook — raw body required for signature verification.
  app.post('/api/billing/webhook/razorpay', express.raw({ type: '*/*' }), (req, res) => {
    const raw = req.body instanceof Buffer ? req.body.toString('utf8') : String(req.body || '');
    if (!verifyRazorpaySig(raw, req.headers['x-razorpay-signature'])) return res.status(400).send('bad signature');
    let evt; try { evt = JSON.parse(raw); } catch { return res.status(400).send('bad json'); }
    try {
      const sub = evt.payload && evt.payload.subscription && evt.payload.subscription.entity;
      if (!sub) return res.json({ received: true });
      const userId = (sub.notes && sub.notes.userId) || findUserByRef(sub.id);
      if (userId) {
        if (evt.event === 'subscription.activated' || evt.event === 'subscription.charged' || evt.event === 'subscription.resumed') {
          const until = sub.current_end ? sub.current_end * 1000 : (sub.charge_at ? sub.charge_at * 1000 : null);
          setSub(userId, { status: 'active', plan: 'razorpay', until, provider: 'razorpay', ref: sub.id });
        } else if (['subscription.cancelled', 'subscription.completed', 'subscription.halted', 'subscription.expired'].includes(evt.event)) {
          setSub(userId, { status: 'none', plan: null, until: null, provider: 'razorpay', ref: sub.id });
        }
      }
    } catch (e) { console.error('[billing] razorpay webhook:', e.message); }
    res.json({ received: true });
  });
}

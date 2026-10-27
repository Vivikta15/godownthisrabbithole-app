// Creates a Dodo checkout session. Docs: https://docs.dodopayments.com/api-reference/checkout-sessions/create
// Guards (all must hold or nothing is called): CHECKOUT_ENABLED === 'true', a Dodo key, a product id for the plan, and TEST MODE only.
// No trial_period_days is sent: whether the trial needs a card is an undecided product rule, and the app's own 3-day trial is separate.
export type CheckoutEnv = { CHECKOUT_ENABLED?: string; DODO_API_KEY?: string; DODO_ENV?: string; DODO_PRODUCT_MAP?: string; APP_URL?: string };
export type CheckoutResult = { ok: true; url: string; sessionId: string } | { ok: false; status: number; error: string; message: string };

export function productFor(plan: string, mapJson?: string): string | null {
  let m: Record<string, string> = {}; try { m = JSON.parse(mapJson || '{}'); } catch { return null; }
  const hit = Object.entries(m).filter(([, p]) => p === plan).map(([id]) => id);
  return hit.length === 1 ? hit[0] : null; // ambiguous or missing mapping: refuse
}

export async function createCheckout(env: CheckoutEnv, user: { id: string }, plan: string, f: typeof fetch = fetch): Promise<CheckoutResult> {
  if (plan !== 'plan3' && plan !== 'plan5') return { ok: false, status: 400, error: 'bad_plan', message: 'Choose the $3 or $5 plan.' };
  if (env.CHECKOUT_ENABLED !== 'true' || !env.DODO_API_KEY) return { ok: false, status: 501, error: 'payments_not_configured', message: 'Payments are not switched on yet.' };
  if (env.DODO_ENV === 'live_mode') return { ok: false, status: 501, error: 'live_mode_blocked', message: 'Live payments are not allowed in this build.' };
  const product = productFor(plan, env.DODO_PRODUCT_MAP);
  if (!product) return { ok: false, status: 501, error: 'product_not_configured', message: 'That plan is not set up for payments yet.' };
  if (!env.APP_URL || !/^https:\/\//.test(env.APP_URL)) return { ok: false, status: 501, error: 'app_url_missing', message: 'Payments are not switched on yet.' };
  let r: Response;
  try {
    r = await f('https://test.dodopayments.com/checkouts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.DODO_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_cart: [{ product_id: product, quantity: 1 }], metadata: { user_id: user.id, plan }, return_url: `${env.APP_URL.replace(/\/$/, '')}/?checkout=return` }),
    });
  } catch { return { ok: false, status: 502, error: 'provider_unreachable', message: 'Could not reach the payment provider. Nothing was charged.' }; }
  if (!r.ok) return { ok: false, status: 502, error: 'provider_error', message: 'The payment provider refused the request. Nothing was charged.' };
  const j: any = await r.json().catch(() => ({}));
  if (typeof j.checkout_url !== 'string' || !/^https:\/\//.test(j.checkout_url)) return { ok: false, status: 502, error: 'provider_bad_response', message: 'The payment provider gave an unexpected answer. Nothing was charged.' };
  return { ok: true, url: j.checkout_url, sessionId: String(j.session_id ?? '') };
}

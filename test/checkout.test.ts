import { describe, it, expect } from 'vitest';
import { createCheckout, productFor } from '../src/worker/checkout';
const base = { CHECKOUT_ENABLED: 'true', DODO_API_KEY: 'k', DODO_PRODUCT_MAP: '{"pdt_a":"plan3","pdt_b":"plan5"}', APP_URL: 'https://x.example' };
const fake = (status: number, body: any, calls: any[] = []) => (async (u: any, i: any) => { calls.push({ u, i }); return new Response(JSON.stringify(body), { status }); }) as any;
describe('checkout gate', () => {
  it('does nothing unless enabled with a key', async () => {
    const calls: any[] = [];
    expect((await createCheckout({ ...base, CHECKOUT_ENABLED: undefined }, { id: 'u' }, 'plan3', fake(200, {}, calls))).ok).toBe(false);
    expect((await createCheckout({ ...base, DODO_API_KEY: undefined }, { id: 'u' }, 'plan3', fake(200, {}, calls))).ok).toBe(false);
    expect(calls.length).toBe(0);
  });
  it('refuses live mode, bad plans and missing/ambiguous products', async () => {
    const calls: any[] = [];
    const live = await createCheckout({ ...base, DODO_ENV: 'live_mode' }, { id: 'u' }, 'plan3', fake(200, {}, calls));
    expect(live.ok === false && live.error).toBe('live_mode_blocked');
    expect((await createCheckout(base, { id: 'u' }, 'trial', fake(200, {}, calls))).ok).toBe(false);
    expect((await createCheckout({ ...base, DODO_PRODUCT_MAP: '{}' }, { id: 'u' }, 'plan3', fake(200, {}, calls))).ok).toBe(false);
    expect(productFor('plan3', '{"a":"plan3","b":"plan3"}')).toBeNull();
    expect(calls.length).toBe(0);
  });
  it('calls the TEST endpoint with the right product and our metadata', async () => {
    const calls: any[] = [];
    const r = await createCheckout(base, { id: 'user-1' }, 'plan5', fake(200, { checkout_url: 'https://checkout.example/s1', session_id: 's1' }, calls));
    expect(r.ok && r.url).toBe('https://checkout.example/s1');
    expect(calls[0].u).toBe('https://test.dodopayments.com/checkouts');
    const body = JSON.parse(calls[0].i.body);
    expect(body.product_cart).toEqual([{ product_id: 'pdt_b', quantity: 1 }]);
    expect(body.metadata).toEqual({ user_id: 'user-1', plan: 'plan5' });
    expect(body.subscription_data).toBeUndefined();
  });
  it('turns provider failures into safe errors', async () => {
    const r = await createCheckout(base, { id: 'u' }, 'plan3', fake(401, { message: 'secret detail' }));
    expect(r.ok === false && r.message).not.toMatch(/secret/);
    const r2 = await createCheckout(base, { id: 'u' }, 'plan3', fake(200, { checkout_url: 'http://insecure' }));
    expect(r2.ok).toBe(false);
  });
});

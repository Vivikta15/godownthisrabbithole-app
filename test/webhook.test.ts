import { it, expect } from 'vitest';
import { verifyWebhook, signForTest } from '../src/worker/webhook';
const secret = 'whsec_' + btoa('test-secret-bytes-1234');
it('accepts valid, rejects tampered or stale', async () => {
  const body = '{"type":"subscription.active"}'; const now = 1_800_000_000; const ts = String(now);
  const sig = await signForTest(secret, 'msg_1', ts, body);
  expect(await verifyWebhook(secret, { id: 'msg_1', timestamp: ts, signature: sig }, body, now)).toBe(true);
  expect(await verifyWebhook(secret, { id: 'msg_1', timestamp: ts, signature: sig }, body + 'x', now)).toBe(false);
  expect(await verifyWebhook(secret, { id: 'msg_1', timestamp: ts, signature: sig }, body, now + 1000)).toBe(false);
});

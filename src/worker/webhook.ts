// Standard Webhooks signature check (Dodo Payments follows this spec: webhook-id, webhook-timestamp, webhook-signature).
// VERIFY against current Dodo docs before going live; secret format is "whsec_<base64>".
const enc = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function verifyWebhook(secret: string, headers: { id: string; timestamp: string; signature: string }, body: string, nowSec = Math.floor(Date.now() / 1000), toleranceSec = 300): Promise<boolean> {
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > toleranceSec) return false;
  const key = await crypto.subtle.importKey('raw', unb64(secret.replace(/^whsec_/, '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${headers.id}.${headers.timestamp}.${body}`)));
  const expected = b64(mac);
  return headers.signature.split(' ').some((p) => {
    const [v, sig] = p.split(',');
    return v === 'v1' && sig !== undefined && timingSafeEqual(sig, expected);
  });
}
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0;
}
export async function signForTest(secret: string, id: string, ts: string, body: string) {
  const key = await crypto.subtle.importKey('raw', unb64(secret.replace(/^whsec_/, '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return 'v1,' + b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${id}.${ts}.${body}`))));
}

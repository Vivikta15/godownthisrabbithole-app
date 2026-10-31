// Regions where analytics collection needs the visitor's consent first: the EEA
// (Cloudflare's isEUCountry flag) plus NO/IS/LI/GB/CH. A missing, unknown (XX),
// Tor (T1) or otherwise unreadable signal is treated as consent-first too: the
// default-on model only ever applies to a positively identified other region.
const EXTRA_STRICT = new Set(['NO', 'IS', 'LI', 'GB', 'CH']);
export type ConsentRegion = 'strict' | 'open';
export function consentRegionFor(cf: { isEUCountry?: boolean | string; country?: string } | undefined | null): ConsentRegion {
  if (!cf || typeof cf.country !== 'string' || !/^[A-Z]{2}$/.test(cf.country) || cf.country === 'XX' || cf.country === 'T1') return 'strict';
  if (cf.isEUCountry === true || cf.isEUCountry === '1') return 'strict';
  return EXTRA_STRICT.has(cf.country) ? 'strict' : 'open';
}

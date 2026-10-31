// Microsoft Clarity, consent-gated. The tag is injected only when the visitor has
// opted in AND the current page load is eligible. Private views never load it:
// reset/verify token URLs, logged-out welcome and sign-in, the quiz, and the
// account tab. The account tab and quiz redo are reached by full page loads
// (/?you=1, /?redo=1), so a Clarity session can never carry into them: the
// script is simply absent there and no recordings, URLs or events leave the device.
const CLARITY_ID = 'z67hhfssh5';
const KEY = 'clarity-consent';
export type ClarityConsent = 'yes' | 'no' | null;

export function getConsent(): ClarityConsent {
  const v = window.localStorage.getItem(KEY);
  return v === 'yes' || v === 'no' ? v : null;
}

export function setConsent(v: 'yes' | 'no') {
  window.localStorage.setItem(KEY, v);
  if (v === 'no') {
    // Documented withdrawal signal, then drop Clarity's first-party cookies.
    const w = window as unknown as { clarity?: (...args: unknown[]) => void };
    if (typeof w.clarity === 'function') w.clarity('consent', false);
    clearClarityCookies();
  }
}

// Clarity sets first-party cookies (_clck, _clsk). Remove them on opt-out.
function clearClarityCookies() {
  for (const name of ['_clck', '_clsk']) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

// Eligibility is frozen at page-load time. Token URLs strip their query string
// immediately (history.replaceState), so reading location.search later would
// wrongly mark a reset/verify page load as eligible.
const ELIGIBLE_AT_LOAD = (() => {
  const q = new URLSearchParams(window.location.search);
  return !(q.get('reset') || q.get('verify') || q.get('you') || q.get('redo'));
})();
export function pageEligible(): boolean {
  return ELIGIBLE_AT_LOAD;
}

export function clarityLoaded(): boolean {
  return injected;
}

// Opt-out in another tab stops this tab promptly: clear Clarity cookies here and
// reload so the injected tag is gone. A reloaded page will not inject it again.
export function watchCrossTabConsent() {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || getConsent() !== 'no') return;
    // The withdrawing tab (You) has no tag, so its clarity('consent', false)
    // call never reaches a live tracker. The collecting tab must send the
    // documented withdrawal itself, before reloading without the tag.
    if (injected) {
      const w = window as unknown as { clarity?: (...args: unknown[]) => void };
      try { w.clarity?.('consent', false); } catch { /* tag not fully loaded */ }
      clearClarityCookies();
      window.location.reload();
    } else {
      clearClarityCookies();
    }
  });
}

let injected = false;
// strict = consent-required region (or unknown region, or config unavailable):
// collect only after the visitor turns analytics on. Otherwise analytics are on
// unless the visitor turned them off.
export function maybeLoadClarity(strict: boolean) {
  if (injected || getConsent() === 'no' || !pageEligible()) return;
  if (strict && getConsent() !== 'yes') return;
  injected = true;
  // Queue before the tag loads. Advertising storage stays denied in every region;
  // only analytics collection is ever enabled here.
  const w = window as unknown as { clarity?: (...args: unknown[]) => void };
  w.clarity = w.clarity || function (...args: unknown[]) { ((w.clarity as unknown as { q: unknown[] }).q = (w.clarity as unknown as { q: unknown[] }).q || []).push(args); };
  w.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.clarity.ms/tag/${CLARITY_ID}`;
  document.head.appendChild(s);
}

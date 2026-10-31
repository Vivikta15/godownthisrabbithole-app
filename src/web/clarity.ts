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
  if (v === 'no') clearClarityCookies();
}

// Clarity sets first-party cookies (_clck, _clsk). Remove them on opt-out.
function clearClarityCookies() {
  for (const name of ['_clck', '_clsk']) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

export function pageEligible(): boolean {
  const q = new URLSearchParams(window.location.search);
  return !(q.get('reset') || q.get('verify') || q.get('you') || q.get('redo'));
}

let injected = false;
export function maybeLoadClarity() {
  if (injected || getConsent() !== 'yes' || !pageEligible()) return;
  injected = true;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.clarity.ms/tag/${CLARITY_ID}`;
  document.head.appendChild(s);
}

import { gsap } from 'gsap';

// Motion graphics: short, meaningful moves built with GSAP timelines. Every function does nothing but the end state when the person prefers reduced motion.
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// A number that counts up to its value (the streak).
export function countUp(el: HTMLElement | null, to: number, dur = 1.1) {
  if (!el) return; if (still() || to <= 0) { el.textContent = String(to); return; }
  const o = { v: 0 }; el.textContent = '0';
  gsap.to(o, { v: to, duration: Math.min(1.6, dur + to * 0.02), ease: 'power3.out', onUpdate: () => { el.textContent = String(Math.round(o.v)); } });
}

// Petals and leaves fly out from a point and drift down: used when something good happens (a streak, a press on the main button).
const PETAL = ['#ec3f7b', '#ffd23f', '#ffffff', '#86c63f', '#14a39f'];
export function petalBurst(x: number, y: number, n = 16) {
  if (still()) return;
  const layer = document.createElement('div'); layer.setAttribute('aria-hidden', 'true'); layer.className = 'petal-layer'; document.body.appendChild(layer);
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i'); const s = 7 + Math.random() * 8; p.style.cssText = `left:${x}px;top:${y}px;width:${s}px;height:${s * 1.5}px;background:${PETAL[i % PETAL.length]}`; layer.appendChild(p);
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.6, d = 50 + Math.random() * 90;
    gsap.timeline({ onComplete: () => { if (!layer.querySelector('i:not([data-done])') ) layer.remove(); } })
      .fromTo(p, { scale: 0, rotate: 0 }, { x: Math.cos(a) * d, y: Math.sin(a) * d - 30, scale: 1, rotate: Math.random() * 300 - 150, duration: 0.55, ease: 'power3.out' })
      .to(p, { y: `+=${90 + Math.random() * 80}`, x: `+=${(Math.random() - 0.5) * 70}`, rotate: `+=${Math.random() * 240 - 120}`, opacity: 0, duration: 1.1 + Math.random() * 0.5, ease: 'sine.in' }, '>-0.05')
      .set(p, { attr: { 'data-done': '1' } });
  }
  gsap.delayedCall(2.6, () => layer.remove());
}

// A leaf wipe between screens: green and teal leaves sweep up over the page, the content swaps behind them, then they sweep away.
let wipeBusy = false;
export function leafWipe(swap: () => void) {
  if (still() || wipeBusy) { swap(); return; }
  wipeBusy = true;
  const el = document.createElement('div'); el.className = 'leafwipe'; el.setAttribute('aria-hidden', 'true');
  const cols = ['#4a9a2c', '#86c63f', '#14a39f', '#35c1b8', '#72b533', '#0f8f8c', '#98d24a'];
  el.innerHTML = cols.map((c, i) => `<svg class="lw" viewBox="0 0 100 160" preserveAspectRatio="none" style="left:${i * (100 / cols.length) - 4}%;width:${100 / cols.length + 8}%"><path d="M50 0C92 34 108 92 50 160C-8 92 8 34 50 0Z" fill="${c}"/><path d="M50 12V150" stroke="rgba(255,255,255,.35)" stroke-width="1.6" fill="none"/></svg>`).join('');
  document.body.appendChild(el); const leaves = el.querySelectorAll('.lw');
  gsap.set(leaves, { yPercent: 115, transformOrigin: '50% 100%' });
  let swapped = false; const doSwap = () => { if (!swapped) { swapped = true; swap(); } };
  const done = () => { el.remove(); wipeBusy = false; };
  // If the page is hidden or the browser is not painting, animation frames pause. The timers make sure the screen still changes and the overlay is always removed.
  const t1 = window.setTimeout(doSwap, 1200), t2 = window.setTimeout(() => { doSwap(); done(); }, 2600);
  gsap.timeline({ onComplete: () => { clearTimeout(t1); clearTimeout(t2); done(); } })
    .to(leaves, { yPercent: -8, duration: 0.42, ease: 'power3.in', stagger: { each: 0.035, from: 'center' } })
    .add(doSwap)
    .to(leaves, { yPercent: -125, duration: 0.5, ease: 'power3.out', stagger: { each: 0.03, from: 'edges' } }, '+=0.04');
}

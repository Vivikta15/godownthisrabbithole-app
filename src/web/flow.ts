import Lenis from 'lenis';

// The "flow" layer: inertial scrolling, content that eases in as it is reached, cards that lean toward the pointer, buttons that lean toward the finger, a soft cursor.
// It is progressive: with reduced motion, no hover, or no JS, pages show their final readable state and scroll natively.
let lenis: Lenis | null = null;
export const toTop = () => { if (lenis) lenis.scrollTo(0, { immediate: true, force: true }); else window.scrollTo({ top: 0 }); };

const REVEAL = '.strip,.takeaway,.connection,.recap,.bridge,.plan,.streak-card,.cal,.citybox,.detour,.sceneblock,.journal li,.board .row,.story p,.pair-form,.fine-block,.marks2 li';
const TILT = '.streak-card,.plan,.strip,.takeaway,.connection';

export function initFlow() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; if (reduce) return;
  const root = document.documentElement; root.classList.add('flow');
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95, smoothWheel: true });
  const raf = (t: number) => { lenis!.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf);

  // Reveal on arrival. Elements are hidden only once this script has marked them, and only while below the fold; anything already visible just shows.
  const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { e.target.classList.add('rv-in'); io.unobserve(e.target); } }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  const mark = (el: Element) => { if (el.hasAttribute('data-rv')) return; el.setAttribute('data-rv', ''); const sib = el.parentElement ? Array.from(el.parentElement.children).indexOf(el) : 0; (el as HTMLElement).style.setProperty('--rv', String(Math.min(sib, 6) * 70) + 'ms'); io.observe(el); };
  const scan = (n: any) => { if (n instanceof Element && n.matches(REVEAL)) mark(n); n.querySelectorAll?.(REVEAL).forEach(mark); };
  scan(document); new MutationObserver((ms) => { for (const m of ms) m.addedNodes.forEach((n) => { if (n.nodeType === 1) scan(n as Element); }); }).observe(document.getElementById('root')!, { childList: true, subtree: true });

  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  // Cursor: a small dot that follows with a little lag and swells over things you can press.
  const dot = document.createElement('div'); dot.className = 'cursor'; dot.setAttribute('aria-hidden', 'true'); document.body.appendChild(dot);
  let tx = -100, ty = -100, x = -100, y = -100, on = false;
  addEventListener('pointermove', (e) => {
    tx = e.clientX; ty = e.clientY; if (!on) { on = true; dot.classList.add('show'); }
    const t = e.target as Element | null; dot.classList.toggle('big', !!t?.closest?.('a,button,input,select,[role=button],.chip'));
    const card = t?.closest?.(TILT) as HTMLElement | null;
    if (card) { const b = card.getBoundingClientRect(); const px = (e.clientX - b.left) / b.width - 0.5, py = (e.clientY - b.top) / b.height - 0.5; card.style.setProperty('--rx', (-py * 4).toFixed(2) + 'deg'); card.style.setProperty('--ry', (px * 5).toFixed(2) + 'deg'); card.classList.add('leaning'); }
    const btn = t?.closest?.('button.go,.glassbtn') as HTMLElement | null;
    if (btn) { const b = btn.getBoundingClientRect(); btn.style.setProperty('--mx2', (((e.clientX - (b.left + b.width / 2)) / b.width) * 10).toFixed(1) + 'px'); btn.style.setProperty('--my2', (((e.clientY - (b.top + b.height / 2)) / b.height) * 8).toFixed(1) + 'px'); }
  }, { passive: true });
  addEventListener('pointerout', (e) => { const el = e.target as HTMLElement; if (el.classList?.contains('leaning') && !el.contains(e.relatedTarget as Node)) { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); el.classList.remove('leaning'); } if (el.matches?.('button.go,.glassbtn')) { el.style.setProperty('--mx2', '0px'); el.style.setProperty('--my2', '0px'); } });
  document.addEventListener('mouseleave', () => { on = false; dot.classList.remove('show'); });
  const loop = () => { x += (tx - x) * 0.22; y += (ty - y) * 0.22; dot.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`; requestAnimationFrame(loop); }; requestAnimationFrame(loop);
}

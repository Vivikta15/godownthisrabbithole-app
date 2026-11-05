import React, { useEffect, useRef } from 'react';
import { PacoScene, PacoBunny } from './Paco';
import type { MascotState } from '../shared/mascot';
import { LABEL } from './Mascot';

// A painted meadow that sits fixed behind every screen: sky, drifting clouds, mountains, layered pines and hills.
// It reacts to the pointer (parallax, a soft light, wind in the trees, a rabbit that watches the cursor and hops when you click)
// and to scrolling. Nothing here is needed to read: it is aria-hidden, paused when the tab is hidden, and still when motion is reduced.

const rng = (s: number) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const LEAVES =Array.from({ length: 11 }, (_, i) => { const r = rng(40 + i); return { l: 4 + r() * 92, d: 14 + r() * 16, dl: -r() * 28, s: 7 + r() * 8, c: ['#c9a24a', '#8fb75e', '#e1b86a', '#9cc27c'][i % 4], dx: (r() - 0.3) * 160 }; });

const GLASS = '.shell>main,.nav,.pill,.takeaway,.connection,.recap,.bridge,.strip,.plan,.bubble';

export function Meadow({ mascot }: { mascot: MascotState }) {
  const root = useRef<HTMLDivElement>(null), bunny = useRef<HTMLDivElement>(null), pupils = useRef<SVGGElement>(null), head = useRef<SVGGElement>(null), ears = useRef<SVGGElement>(null);
  useEffect(() => {
    const el = root.current, bn = bunny.current; if (!el || !bn) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let tx = 0, ty = 0, x = 0, y = 0, wind = 0, lastX = 0, lastY = 0, sy = 0, lastSy = window.scrollY, raf = 0, alive = true;
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const move = (e: PointerEvent) => {
      tx = (e.clientX / innerWidth - 0.5) * 2; ty = (e.clientY / innerHeight - 0.5) * 2;
      wind = Math.min(4, wind + Math.hypot(e.clientX - lastX, e.clientY - lastY) / 90); lastX = e.clientX; lastY = e.clientY;
      el.style.setProperty('--gx', e.clientX + 'px'); el.style.setProperty('--gy', e.clientY + 'px');
      const g = (e.target as Element | null)?.closest?.(GLASS) as HTMLElement | null;
      if (g) { const b = g.getBoundingClientRect(); g.style.setProperty('--mx', e.clientX - b.left + 'px'); g.style.setProperty('--my', e.clientY - b.top + 'px'); }
      const b = bn.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height * 0.5, dx = e.clientX - cx, dy = e.clientY - cy, dist = Math.hypot(dx, dy);
      const nx = clamp(dx / 400, -1, 1), ny = clamp(dy / 400, -1, 1);
      pupils.current?.setAttribute('transform', `translate(${(nx * 2.2).toFixed(2)} ${(ny * 1.6).toFixed(2)})`);
      head.current?.setAttribute('transform', `rotate(${(nx * 6).toFixed(2)} 68 100)`);
      bn.classList.toggle('alert', dist < 190);
    };
    const down = (e: PointerEvent) => {
      const b = bn.getBoundingClientRect(); bn.style.setProperty('--hx', clamp((e.clientX - (b.left + b.width / 2)) / 8, -26, 26).toFixed(0) + 'px');
      bn.classList.remove('hop'); void bn.offsetWidth; bn.classList.add('hop'); wind = Math.min(4, wind + 1.6);
    };
    const tick = () => {
      if (!alive) return;
      x += (tx - x) * 0.06; y += (ty - y) * 0.06; wind *= 0.965;
      const dy = Math.abs(scrollY - lastSy); lastSy = scrollY; sy += (Math.min(scrollY, 900) - sy) * 0.08; if (dy > 2) wind = Math.min(4, wind + dy / 120);
      el.style.setProperty('--px', x.toFixed(3)); el.style.setProperty('--py', y.toFixed(3)); el.style.setProperty('--sy', sy.toFixed(1)); el.style.setProperty('--wind', wind.toFixed(2));
      raf = requestAnimationFrame(tick);
    };
    const vis = () => { if (document.hidden) { alive = false; cancelAnimationFrame(raf); } else if (!alive) { alive = true; raf = requestAnimationFrame(tick); } };
    window.addEventListener('pointermove', move, { passive: true }); window.addEventListener('pointerdown', down, { passive: true }); document.addEventListener('visibilitychange', vis);
    raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener('pointermove', move); window.removeEventListener('pointerdown', down); document.removeEventListener('visibilitychange', vis); };
  }, []);
  return <>
    <div className="meadow" ref={root} aria-hidden="true">
      <PacoScene />
      <div className="glow" />
      <div className="leaves">{LEAVES.map((l, i) => <i key={i} style={{ left: l.l + '%', width: l.s, height: l.s * 0.62, background: l.c, animationDuration: l.d + 's', animationDelay: l.dl + 's', ['--dx' as string]: l.dx + 'px' }} />)}</div>
      <div className="grain" />
    </div>
    <div ref={bunny} className={`bunny b-${mascot}`} role="img" aria-label={LABEL[mascot]}><PacoBunny state={mascot} pupils={pupils} head={head} ears={ears} /></div>
  </>;
}

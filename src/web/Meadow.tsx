import React, { useEffect, useMemo, useRef } from 'react';
import type { MascotState } from '../shared/mascot';
import { LABEL } from './Mascot';

// A painted meadow that sits fixed behind every screen: sky, drifting clouds, mountains, layered pines and hills.
// It reacts to the pointer (parallax, a soft light, wind in the trees, a rabbit that watches the cursor and hops when you click)
// and to scrolling. Nothing here is needed to read: it is aria-hidden, paused when the tab is hidden, and still when motion is reduced.

const rng = (s: number) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const f = (n: number) => n.toFixed(1);
type Pal = [string, string, string]; // shade, body, light

function pineShape(r: () => number, x: number, y: number, h: number, w: number) {
  const tiers = 8, top = y - h, tierH = (h * 0.94) / tiers;
  const R: [number, number][] = [], L: [number, number][] = [];
  for (let i = 0; i < tiers; i++) {
    const t = (i + 1) / tiers, yy = top + h * 0.94 * t, hw = (w / 2) * (0.16 + 0.84 * t), j = () => (r() - 0.5) * w * 0.06;
    R.push([x + hw * 0.55 + j(), yy - tierH * 0.55], [x + hw + j(), yy]);
    L.push([x - hw * 0.55 + j(), yy - tierH * 0.55], [x - hw + j(), yy]);
  }
  const pts = (a: [number, number][]) => a.map(([px, py]) => `${f(px)} ${f(py)}`).join('L');
  const base = y - h * 0.05;
  return {
    all: `M${f(x)} ${f(top)}L${pts(R)}L${f(x + w * 0.04)} ${f(base)}L${f(x - w * 0.04)} ${f(base)}L${pts([...L].reverse())}Z`,
    left: `M${f(x)} ${f(top)}L${pts(L)}L${f(x - w * 0.04)} ${f(base)}L${f(x + w * 0.01)} ${f(base)}Z`,
    right: `M${f(x)} ${f(top)}L${pts(R)}L${f(x + w * 0.04)} ${f(base)}L${f(x + w * 0.01)} ${f(base)}Z`,
  };
}
function pine(r: () => number, k: string, x: number, y: number, h: number, w: number, pal: Pal, sway = 1) {
  const s = pineShape(r, x, y, h, w);
  return <g key={k} className="sw" style={{ animationDelay: `${(-r() * 7).toFixed(1)}s`, ['--k' as string]: sway }}>
    <rect x={x - w * 0.03} y={y - h * 0.08} width={w * 0.06} height={h * 0.1} fill="#5b4a3a" />
    <path d={s.all} fill={pal[1]} /><path d={s.left} fill={pal[2]} opacity=".5" /><path d={s.right} fill={pal[0]} opacity=".45" />
  </g>;
}
function broadleaf(r: () => number, k: string, x: number, y: number, h: number, pal: Pal) {
  const blobs = Array.from({ length: 9 }, () => [x + (r() - 0.5) * h * 0.7, y - h * (0.55 + r() * 0.4), h * (0.16 + r() * 0.1)] as const);
  return <g key={k} className="sw" style={{ animationDelay: `${(-r() * 7).toFixed(1)}s`, ['--k' as string]: 1.4 }}>
    <path d={`M${x - 4} ${y}L${x - 2} ${y - h * 0.6}L${x + 2} ${y - h * 0.6}L${x + 4} ${y}Z`} fill="#5b4a3a" />
    {blobs.map(([cx, cy, cr], i) => <circle key={'d' + i} cx={cx + cr * 0.25} cy={cy + cr * 0.3} r={cr} fill={pal[0]} />)}
    {blobs.map(([cx, cy, cr], i) => <circle key={'m' + i} cx={cx} cy={cy} r={cr * 0.92} fill={pal[1]} />)}
    {blobs.map(([cx, cy, cr], i) => <circle key={'l' + i} cx={cx - cr * 0.25} cy={cy - cr * 0.3} r={cr * 0.5} fill={pal[2]} opacity=".7" />)}
  </g>;
}
const cloud = (k: string, cx: number, cy: number, s: number, cls: string, delay: number) => (
  <g key={k} className={'cl ' + cls} style={{ animationDelay: `${delay}s` }}>
    {[[0, 0, 150, 62], [-120, 22, 110, 48], [110, 20, 120, 50], [-40, -34, 100, 54], [50, -28, 96, 46], [-190, 40, 80, 34], [190, 40, 84, 34]].map(([dx, dy, rx, ry], i) =>
      <ellipse key={i} cx={cx + dx * s} cy={cy + dy * s} rx={rx * s} ry={ry * s} fill="url(#m-cloud)" />)}
    <ellipse cx={cx} cy={cy + 46 * s} rx={230 * s} ry={30 * s} fill="url(#m-cloudshade)" />
  </g>
);

const PAL_FAR: Pal = ['#7b9fa0', '#93b4b0', '#b3cdc6'];
const PAL_MID: Pal = ['#3f6f4c', '#5a8a56', '#86b06a'];
const PAL_NEAR: Pal = ['#23482f', '#33613b', '#5f8f4e'];
const PAL_BROAD: Pal = ['#3d6b32', '#5c9142', '#93bf63'];

function useScenery() {
  return useMemo(() => {
    const r = rng(15);
    const far = Array.from({ length: 34 }, (_, i) => pine(r, 'f' + i, -60 + i * 52 + r() * 30, 690 + r() * 14, 46 + r() * 40, 20 + r() * 10, PAL_FAR, 0.5));
    const mid = Array.from({ length: 16 }, (_, i) => (i % 5 === 3 ? broadleaf(r, 'b' + i, -40 + i * 108 + r() * 40, 770 + r() * 12, 90 + r() * 40, PAL_BROAD) : pine(r, 'm' + i, -40 + i * 108 + r() * 40, 770 + r() * 12, 120 + r() * 70, 50 + r() * 22, PAL_MID, 0.8)));
    const left = [pine(r, 'l1', 60, 940, 700, 300, PAL_NEAR, 0.5), pine(r, 'l2', 300, 900, 430, 190, PAL_NEAR, 0.7), pine(r, 'l3', 505, 880, 250, 112, PAL_MID, 0.9), broadleaf(r, 'l4', 640, 870, 150, PAL_BROAD)];
    const right = [broadleaf(r, 'r1', 1130, 860, 170, PAL_BROAD), pine(r, 'r2', 1325, 930, 380, 170, PAL_NEAR, 0.7), pine(r, 'r3', 1490, 960, 700, 300, PAL_NEAR, 0.5), pine(r, 'r4', 1640, 940, 520, 230, PAL_NEAR, 0.6)];
    const blades = Array.from({ length: 70 }, (_, i) => { const x = -60 + i * 25 + r() * 20, y = 850 + r() * 40, h = 12 + r() * 20; return <path key={i} className="bl" style={{ animationDelay: `${(-r() * 5).toFixed(1)}s` }} d={`M${f(x)} ${f(y)}q${f((r() - 0.5) * 8)} ${f(-h / 2)} ${f((r() - 0.3) * 10)} ${f(-h)}`} />; });
    const flowers = Array.from({ length: 26 }, (_, i) => <circle key={i} cx={f(r() * 1600)} cy={f(835 + r() * 55)} r={f(1.8 + r() * 1.6)} fill={i % 3 ? '#fffbe8' : '#f4d24e'} opacity=".9" />);
    return { far, mid, left, right, blades, flowers };
  }, []);
}

function Scene() {
  const s = useScenery();
  return <svg className="mscene" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="m-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--s1)' }} /><stop offset=".55" style={{ stopColor: 'var(--s2)' }} /><stop offset="1" style={{ stopColor: 'var(--s3)' }} /></linearGradient>
      <radialGradient id="m-cloud"><stop offset="0" stopColor="#fff" stopOpacity=".96" /><stop offset=".55" stopColor="#fff" stopOpacity=".6" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
      <radialGradient id="m-cloudshade"><stop offset="0" stopColor="#b9cfe0" stopOpacity=".5" /><stop offset="1" stopColor="#b9cfe0" stopOpacity="0" /></radialGradient>
      <radialGradient id="m-sun" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#fffaf0" stopOpacity=".95" /><stop offset=".35" stopColor="#fff1d0" stopOpacity=".45" /><stop offset="1" stopColor="#fff1d0" stopOpacity="0" /></radialGradient>
      <linearGradient id="m-mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#eef6ef" stopOpacity=".85" /></linearGradient>
      <linearGradient id="m-hf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9cc283" /><stop offset="1" stopColor="#6f9f55" /></linearGradient>
      <linearGradient id="m-hm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#74a653" /><stop offset="1" stopColor="#4f8238" /></linearGradient>
      <linearGradient id="m-hn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5d9440" /><stop offset="1" stopColor="#366a2a" /></linearGradient>
    </defs>
    <rect x="-200" y="-200" width="2000" height="1300" fill="url(#m-sky)" />
    <g className="ly" style={{ ['--d' as string]: 0.15 }}><circle cx="1130" cy="150" r="460" fill="url(#m-sun)" /></g>
    <g className="ly" style={{ ['--d' as string]: 0.35 }}>{cloud('c1', 250, 360, 2.6, 'c-a', 0)}{cloud('c2', 1240, 250, 1.8, 'c-b', -9)}{cloud('c3', 720, 150, 1.1, 'c-c', -20)}{cloud('c4', 1450, 560, 1.5, 'c-a', -14)}</g>
    <g className="ly" style={{ ['--d' as string]: 0.5 }}>
      <path d="M-120 700L90 590L210 640L380 540L540 650L690 600L850 690L1010 560L1180 660L1330 590L1520 680L1720 600V900H-120Z" fill="#a8c0d2" opacity=".85" />
      <path d="M-120 720L140 650L320 700L560 610L760 710L980 640L1200 715L1420 650L1720 720V900H-120Z" fill="#bdd1db" opacity=".9" />
      <rect x="-120" y="620" width="1840" height="140" fill="url(#m-mist)" />
    </g>
    <g className="ly" style={{ ['--d' as string]: 0.7 }}><path d="M-120 700C200 650 420 690 700 670S1200 640 1720 690V1000H-120Z" fill="url(#m-hf)" />{s.far}</g>
    <g className="ly" style={{ ['--d' as string]: 1 }}><path d="M-120 765C300 705 600 745 900 730S1400 695 1720 745V1000H-120Z" fill="url(#m-hm)" />{s.mid}</g>
    <g className="ly" style={{ ['--d' as string]: 1.35 }}>
      <path d="M-120 815C200 750 500 805 800 835S1300 805 1720 795V1000H-120Z" fill="url(#m-hn)" /><path d="M-120 815C200 750 500 805 800 835S1300 805 1720 795" fill="none" stroke="#8bbd62" strokeWidth="3" opacity=".6" />
      {s.flowers}<g className="blades" fill="none" strokeLinecap="round">{s.blades}</g>
    </g>
    <g className="ly" style={{ ['--d' as string]: 1.8 }}>{s.left}</g>
    <g className="ly" style={{ ['--d' as string]: 1.8 }}>{s.right}</g>
    <g className="ly" style={{ ['--d' as string]: 1.2 }}>
      <g className="flock">{[[0, 0], [34, 14], [-30, 18], [66, 32], [-62, 38], [100, 10], [-96, 6], [20, 46]].map(([x, y], i) =>
        <path key={i} className="bird" style={{ animationDelay: `${-i * 0.23}s` }} transform={`translate(${940 + x} ${520 + y})`} d="M0 0q5-6 10 0q5-6 10 0" />)}</g>
      <g className="flock f2"><path className="bird" style={{ animationDelay: '-.4s' }} transform="translate(1480 500)" d="M0 0q6-7 12 0q6-7 12 0" /></g>
    </g>
  </svg>;
}

const LEAVES = Array.from({ length: 11 }, (_, i) => { const r = rng(40 + i); return { l: 4 + r() * 92, d: 14 + r() * 16, dl: -r() * 28, s: 7 + r() * 8, c: ['#c9a24a', '#8fb75e', '#e1b86a', '#9cc27c'][i % 4], dx: (r() - 0.3) * 160 }; });

function Bunny({ state, pupils, head, ears }: { state: MascotState; pupils: React.RefObject<SVGGElement | null>; head: React.RefObject<SVGGElement | null>; ears: React.RefObject<SVGGElement | null> }) {
  const reading = state === 'reading', fur = '#fffdf8', edge = '#e6d8c6', ink = '#3a2b22';
  return <svg viewBox="0 0 120 130" width="100%" height="100%" aria-hidden="true">
    <defs><radialGradient id="m-fur" cx=".4" cy=".3" r=".8"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#eee3d4" /></radialGradient></defs>
    <ellipse cx="60" cy="124" rx="56" ry="9" fill="#2f5f2c" opacity=".55" /><ellipse cx="60" cy="122" rx="42" ry="7" fill="#000" opacity=".12" />
    <g className="bb"><g className="rb">
      <circle cx="88" cy="110" r="7" fill="url(#m-fur)" stroke={edge} />
      <ellipse cx="60" cy="104" rx="27" ry="19" fill="url(#m-fur)" stroke={edge} /><ellipse cx="60" cy="92" rx="19" ry="24" fill="url(#m-fur)" stroke={edge} />
      <ellipse cx="51" cy="119" rx="8" ry="4.5" fill="url(#m-fur)" stroke={edge} /><ellipse cx="69" cy="119" rx="8" ry="4.5" fill="url(#m-fur)" stroke={edge} />
      {reading && <g className="tab"><rect x="43" y="98" width="34" height="22" rx="5" fill="#d9ecf2" fillOpacity=".75" stroke="#ffffff" strokeWidth="1.5" /><path d="M49 105h22M49 110h16" stroke="#46683a" strokeWidth="2" strokeLinecap="round" opacity=".7" /></g>}
      <g ref={head} className="hd">
        <g ref={ears}><g className="ear e1"><ellipse cx="48" cy="32" rx="8.5" ry="23" fill="url(#m-fur)" stroke={edge} /><ellipse cx="48" cy="35" rx="4" ry="15" fill="#ffc4b3" /></g>
          <g className="ear e2"><ellipse cx="72" cy="32" rx="8.5" ry="23" fill="url(#m-fur)" stroke={edge} /><ellipse cx="72" cy="35" rx="4" ry="15" fill="#ffc4b3" /></g></g>
        <ellipse cx="60" cy="69" rx="23" ry="19" fill="url(#m-fur)" stroke={edge} />
        {reading ? <g stroke={ink} strokeWidth="2.2" fill="none" strokeLinecap="round"><path d="M44 68q4 3.500 8 0" /><path d="M68 68q4 3.500 8 0" /></g>
          : <g className="eyes"><circle className="blink" cx="50" cy="67" r="3.800" fill={ink} /><circle className="blink" cx="70" cy="67" r="3.800" fill={ink} /><g ref={pupils}><circle cx="51" cy="65.800" r="1.200" fill="#fff" /><circle cx="71" cy="65.800" r="1.200" fill="#fff" /></g></g>}
        <circle cx="42" cy="74" r="4.500" fill="#ffb4a2" opacity=".55" /><circle cx="78" cy="74" r="4.500" fill="#ffb4a2" opacity=".55" />
        <ellipse cx="60" cy="73" rx="2.800" ry="2.100" fill="#f08a96" /><path d="M60 75v2.500M56 78q4 3 8 0" stroke={ink} strokeWidth="1.600" fill="none" strokeLinecap="round" />
      </g>
      {(state === 'greet' || state === 'cheer') && <ellipse className="wave" cx="84" cy="94" rx="5.500" ry="10" fill="url(#m-fur)" stroke={edge} />}
      {state === 'finder_think' && <text className="q" x="80" y="26" fontSize="26" fontFamily="Cormorant Garamond, serif" fontWeight="700" fill="#46683a">?</text>}
      {state === 'finder_found' && <path className="q" d="M92 50l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#f4c64e" />}
    </g></g>
  </svg>;
}

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
      pupils.current?.setAttribute('transform', `translate(${(nx * 2.6).toFixed(2)} ${(ny * 1.8).toFixed(2)})`);
      head.current?.setAttribute('transform', `rotate(${(nx * 7).toFixed(2)} 60 90)`);
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
      <Scene />
      <div className="glow" />
      <div className="leaves">{LEAVES.map((l, i) => <i key={i} style={{ left: l.l + '%', width: l.s, height: l.s * 0.62, background: l.c, animationDuration: l.d + 's', animationDelay: l.dl + 's', ['--dx' as string]: l.dx + 'px' }} />)}</div>
      <div className="grain" />
    </div>
    <div ref={bunny} className={`bunny b-${mascot}`} role="img" aria-label={LABEL[mascot]}><Bunny state={mascot} pupils={pupils} head={head} ears={ears} /></div>
  </>;
}

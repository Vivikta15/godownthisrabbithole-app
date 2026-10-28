// Three.js motion preview 2: a top-down autumn lake, lit and shaded. Article text stays on still paper panels over it.
// Provisional art direction, not final. Native page scroll drives the world through a damped value; nothing is hijacked.
import { startLake } from './lake';
import '@fontsource-variable/baloo-2'; import '@fontsource-variable/dm-sans'; import '@fontsource/dm-mono/400.css';
import './motion.css';
import { SEED } from '../content/seed';

const s = SEED.find((x) => x.id === 'honey')!; const host = document.getElementById('panels')!;
const paras = s.story.map((p) => p.replace(/[<>&]/g, '')); const per = Math.ceil(Math.min(paras.length, 6) / 3);
for (let i = 0; i < 3; i++) { const chunk = paras.slice(i * per, i * per + per); if (!chunk.length) break; const sec = document.createElement('section'); sec.className = 'panel'; sec.style.setProperty('--r', `${[-0.5, 0.4, -0.3][i]}deg`); sec.innerHTML = (i === 0 ? '<h1>Why honey outlasts almost everything</h1>' : '') + chunk.map((p) => `<p>${p}</p>`).join(''); host.appendChild(sec); }
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('in')), { threshold: 0.12 });
document.querySelectorAll('.panel').forEach((p) => (reduce ? p.classList.add('in') : io.observe(p)));

const lake = startLake(document.getElementById('scene') as HTMLCanvasElement, { layout: 'page', reduce });
let paused = lake.isPaused();
const btn = document.getElementById('toggle')!; btn.textContent = paused ? 'Play motion' : 'Pause motion'; btn.addEventListener('click', () => { paused = !paused; lake.setPaused(paused); btn.textContent = paused ? 'Play motion' : 'Pause motion'; btn.setAttribute('aria-pressed', String(paused)); });
(window as unknown as { __motion: unknown }).__motion = { frames: () => lake.frames(), paused: () => lake.isPaused() };

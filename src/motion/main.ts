// Three.js motion preview. The scene frames the article (top band and a bottom scroll bar); the words sit on a still panel.
// Honours prefers-reduced-motion (one still frame), a Pause button, hidden tabs and off-screen canvases. DPR is capped.
import * as THREE from 'three';
import '@fontsource-variable/baloo-2'; import '@fontsource-variable/dm-sans'; import '@fontsource/dm-mono/400.css';
import './motion.css';
import { SEED } from '../content/seed';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let paused = reduce; const toggle = document.getElementById('toggle') as HTMLButtonElement;
const setToggle = () => { toggle.textContent = paused ? 'Play motion' : 'Pause motion'; toggle.setAttribute('aria-pressed', String(paused)); };
toggle.onclick = () => { paused = !paused; setToggle(); kick(); }; setToggle();
const q = new URLSearchParams(location.search); const FIXED_T = q.has('t') ? Number(q.get('t')) : null; // ?t=seconds renders one deterministic frame (used for screenshots)
if (FIXED_T !== null) paused = true;

// Article: first paragraphs of a real story from the app.
const s = SEED.find((x) => x.id === 'honey')!; const art = document.getElementById('article')!;
art.innerHTML = `<h1>${s.title === 'Honey' ? 'Why honey outlasts almost everything' : s.title}</h1>` + s.story.slice(0, 3).map((p) => `<p>${p.replace(/[<>&]/g, '')}</p>`).join('');

const C = (h: number) => new THREE.Color(h);
const rnd = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const mat = (c: number, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: o < 1, opacity: o, depthTest: false });
let ord = 0; // painter's order = order of creation (renderOrder is per object, not inherited)
const add = (g: THREE.Object3D, m: THREE.Object3D, z: number) => { m.position.z = z; m.renderOrder = ++ord; g.add(m); return m; };
const H = 9;

type Scene = { scene: THREE.Scene; update: (t: number) => void; dispose: () => void };
function buildHero(W: number): Scene {
  const scene = new THREE.Scene(); const root = new THREE.Group(); scene.add(root); const R = rnd(7);
  // sky: cooler peach to pale mist, autumn not winter
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(W + 2, H + 2), new THREE.ShaderMaterial({ depthTest: false, uniforms: { a: { value: C(0xcfe0d6) }, b: { value: C(0xf3d6b6) } }, vertexShader: 'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'varying vec2 v;uniform vec3 a,b;void main(){gl_FragColor=vec4(mix(b,a,smoothstep(.15,1.,v.y)),1.);\n#include <colorspace_fragment>\n}' }));
  add(root, sky, -9);
  const sun = new THREE.Mesh(new THREE.CircleGeometry(0.9, 40), mat(0xf4c98a, 0.75)); sun.position.set(W * 0.22, 1.6, 0); add(root, sun, -8);
  const ridges: THREE.Mesh[] = [];
  const ridge = (base: number, amp: number, f: number, ph: number, col: number, z: number) => {
    const sh = new THREE.Shape(); sh.moveTo(-W / 2 - 1.5, -H); for (let i = 0; i <= 60; i++) { const x = -W / 2 - 1.5 + ((W + 3) * i) / 60; sh.lineTo(x, base + amp * Math.sin(x * f + ph) + amp * 0.4 * Math.sin(x * f * 2.3 + ph * 2)); }
    sh.lineTo(W / 2 + 1.5, -H); const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), mat(col)); add(root, m, z); ridges.push(m); return m;
  };
  ridge(0.35, 0.5, 0.5, 0.4, 0xb9cdb5, -7); ridge(-0.1, 0.45, 0.7, 2.1, 0x93baa6, -6);
  const pines = new THREE.Group(); add(root, pines, -5);
  for (let i = 0; i < 26; i++) { const x = -W / 2 + R() * W, h = 0.7 + R() * 0.9; const sh = new THREE.Shape(); sh.moveTo(-h * 0.28, 0); sh.lineTo(0, h); sh.lineTo(h * 0.28, 0); const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), mat(R() > 0.8 ? 0xc47a4e : 0x4e7a63)); m.position.set(x, -0.55 - R() * 0.35, 0); pines.add(m); }
  ridge(-0.75, 0.18, 0.9, 5.0, 0x6f9c7e, -4);
  // lake with moving ripples
  const lakeMat = new THREE.ShaderMaterial({ depthTest: false, uniforms: { t: { value: 0 }, a: { value: C(0x7fb0a2) }, b: { value: C(0x5b9486) } }, vertexShader: 'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 v;uniform float t;uniform vec3 a,b;void main(){float w=sin(v.y*70.+sin(v.x*9.+t*.6)*1.6-t*.9)*.5+.5;float row=floor(v.y*30.);float f=fract(v.y*30.);float h=fract(sin(row*12.9898)*43758.5453);float dash=smoothstep(.88,.97,sin(v.x*16.+h*40.+t*(.25+h*.3))*.5+.5)*step(.42,f)*step(f,.58);vec3 c=mix(b,a,v.y)+vec3(w*.03)+vec3(dash*.22*smoothstep(.1,.9,v.y));gl_FragColor=vec4(c,1.);\n#include <colorspace_fragment>\n}' });
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(W + 2, 4.2), lakeMat); lake.position.set(0, -4.5 + 2.1 - 0.2, 0); add(root, lake, -3);
  // rabbit reading, on the near shore at the left
  const rab = new THREE.Group(); const rx = -W * 0.3; rab.position.set(rx, -3.2, 0); add(root, rab, 2);
  const part = (g: THREE.BufferGeometry, c: number, x: number, y: number, z: number, sx = 1, sy = 1, rz = 0, p: THREE.Object3D = rab) => { const m = new THREE.Mesh(g, mat(c)); m.position.set(x, y, 0); m.scale.set(sx, sy, 1); m.rotation.z = rz; add(p, m, z); return m; };
  const circ = new THREE.CircleGeometry(1, 32);
  part(circ, 0x84684f, 0.2, -0.78, 0, 2.2, 0.34); // log seat
  const body = part(circ, 0xfbf7ec, 0, -0.1, 0.1, 0.78, 0.74);
  part(circ, 0xfbf7ec, -0.78, -0.28, 0.05, 0.24, 0.24); // tail
  const head = new THREE.Group(); head.position.set(0.05, 0.78, 0); add(rab, head, 0.3);
  const earL = new THREE.Group(), earR = new THREE.Group(); earL.position.set(-0.17, 0.3, 0); earR.position.set(0.15, 0.3, 0); add(head, earL, -0.1); add(head, earR, -0.1);
  for (const [e, rz] of [[earL, 0.12], [earR, -0.1]] as [THREE.Group, number][]) { part(circ, 0xfbf7ec, 0, 0.38, 0, 0.14, 0.5, rz, e); part(circ, 0xe9a9a0, 0, 0.36, 0.01, 0.07, 0.34, rz, e); }
  part(circ, 0xfbf7ec, 0, 0, 0, 0.46, 0.4, 0, head);
  part(circ, 0x23413a, 0.17, 0.02, 0.2, 0.045, 0.05, 0, head); part(circ, 0xe9a9a0, 0.28, -0.1, 0.2, 0.08, 0.06, 0, head);
  const bookG = new THREE.Group(); bookG.position.set(0.42, -0.05, 0); add(rab, bookG, 0.5);
  part(new THREE.PlaneGeometry(1, 1), 0x7d5310, 0, 0, 0, 0.95, 0.62, 0.12, bookG); part(new THREE.PlaneGeometry(1, 1), 0xfbf7ec, -0.23, 0.02, 0.01, 0.42, 0.52, 0.12, bookG); const page = part(new THREE.PlaneGeometry(1, 1), 0xf3e9d2, 0.22, 0.02, 0.01, 0.42, 0.52, 0.12, bookG);
  // leaves drifting inside the hero band only
  const N = 34; const leaves = new THREE.InstancedMesh(new THREE.CircleGeometry(0.11, 4), new THREE.MeshBasicMaterial({ depthTest: false, transparent: true }), N); leaves.renderOrder = 60; leaves.frustumCulled = false; root.add(leaves);
  const cols = [0xc47a4e, 0xd99a55, 0xa83a24, 0xe0b04a, 0x8a6d54]; const L = Array.from({ length: N }, () => ({ x: R() * W - W / 2, y: R() * H - H / 2, v: 0.25 + R() * 0.35, ph: R() * 6.28, sw: 0.3 + R() * 0.6, s: 0.7 + R() * 0.9 }));
  L.forEach((l, i) => leaves.setColorAt(i, C(cols[i % cols.length]))); const dm = new THREE.Object3D();
  // fish: jumps every 9s with ripples
  const fish = new THREE.Group(); const fy = -2.45; add(root, fish, 3);
  part(circ, 0xd2603a, 0, 0, 0, 0.34, 0.15, 0, fish); const tail = new THREE.Mesh(new THREE.CircleGeometry(0.16, 3), mat(0xb54a2c)); tail.rotation.z = Math.PI; tail.position.set(-0.36, 0, 0); fish.add(tail); part(circ, 0xfbf7ec, 0.18, 0.03, 0.1, 0.03, 0.03, 0, fish);
  const ring = (w: number) => { const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), mat(0xfbf7ec, 0)); m.scale.set(1, 0.22, 1); m.position.set(0, fy, 0); add(root, m, -2); return m; };
  const r1 = ring(1), r2 = ring(1); const fx0 = W * 0.18;
  const update = (t: number) => {
    lakeMat.uniforms.t.value = t; ridges.forEach((m, i) => { m.position.x = Math.sin(t * 0.05 + i) * 0.12; }); pines.position.x = Math.sin(t * 0.05 + 1) * 0.1;
    body.scale.y = 0.74 + 0.012 * Math.sin(t * 1.6); head.rotation.z = -0.1 + 0.015 * Math.sin(t * 1.1); const tw = Math.max(0, Math.sin(t * 0.7 + 1)) ** 12; earR.rotation.z = -0.08 * tw; earL.rotation.z = 0.05 * Math.sin(t * 0.37);
    page.rotation.z = 0.12 + (((t % 7) > 6.4) ? Math.sin(((t % 7) - 6.4) / 0.6 * Math.PI) * 0.35 : 0);
    L.forEach((l, i) => { const y = ((l.y - t * l.v + H / 2) % H + H) % H - H / 2; const x = l.x + Math.sin(t * l.sw + l.ph) * 0.45; const hidden = y < -2.5 && x > -W / 2 + 4; dm.position.set(x, y, 0); dm.rotation.z = t * 0.6 + l.ph; dm.scale.setScalar(hidden ? 0.001 : l.s); dm.updateMatrix(); leaves.setMatrixAt(i, dm.matrix); }); leaves.instanceMatrix.needsUpdate = true;
    const c = t % 9, u = (c - 6.2) / 1.6; // 1.6s airborne
    if (u >= 0 && u <= 1) { const x = fx0 + (u - 0.5) * 1.8, y = fy + 1.6 * 4 * u * (1 - u); fish.visible = true; fish.position.set(x, y, 0); fish.rotation.z = Math.atan2(1.6 * 4 * (1 - 2 * u), 1.8 * 1.6) ; tail.rotation.z = Math.PI + Math.sin(t * 24) * 0.4; } else fish.visible = false;
    const rp = (k: number, at: number) => { const v = (c - at) / 1.4; const on = v >= 0 && v <= 1; (k === 1 ? r1 : r2).position.x = fx0 + (k === 1 ? -0.9 : 0.9); (k === 1 ? r1 : r2).scale.set(0.2 + v * 1.1, (0.2 + v * 1.1) * 0.22, 1); ((k === 1 ? r1 : r2).material as THREE.MeshBasicMaterial).opacity = on ? 0.55 * (1 - v) : 0; };
    rp(1, 6.2); rp(2, 7.8);
  };
  return { scene, update, dispose: () => scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }) };
}

function buildCatch(W: number): Scene & { setProgress: (p: number) => void } {
  const scene = new THREE.Scene(); const h = 1.2; let prog = 0;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(W, h), mat(0xcfe0d6)); water.renderOrder = 0; scene.add(water);
  const pts = 80; const geo = new THREE.BufferGeometry(); const pos = new Float32Array(pts * 3); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x5b9486, depthTest: false })); line.renderOrder = 1; line.frustumCulled = false; scene.add(line);
  const fish = new THREE.Group(); const fb = new THREE.Mesh(new THREE.CircleGeometry(1, 24), mat(0xd2603a)); fb.scale.set(0.2, 0.09, 1); fish.add(fb); const ft = new THREE.Mesh(new THREE.CircleGeometry(0.1, 3), mat(0xb54a2c)); ft.rotation.z = Math.PI; ft.position.x = -0.22; fish.add(ft); fish.renderOrder = 3; fb.renderOrder = 3; ft.renderOrder = 3; scene.add(fish);
  const track = (x: number, t: number) => Math.sin(x * 3 + t * 1.5) * 0.04;
  const update = (t: number) => { const fxp = -W / 2 + 0.25 + prog * (W - 0.5); for (let i = 0; i < pts; i++) { const x = -W / 2 + (W * i) / (pts - 1); const on = x <= fxp; pos[i * 3] = x; pos[i * 3 + 1] = on ? track(x, t) - 0.02 : track(x, t) - 0.3; pos[i * 3 + 2] = 0; } geo.attributes.position.needsUpdate = true;
    const lift = prog > 0.97 ? Math.min(1, (prog - 0.97) / 0.03) * 0.25 : 0; fish.position.set(fxp, track(fxp, t) + lift, 0.1); fish.rotation.z = Math.sin(t * 2) * 0.06 + lift * 0.8; ft.rotation.z = Math.PI + Math.sin(t * 14) * 0.3; };
  return { scene, update, setProgress: (p) => { prog = Math.max(0, Math.min(1, p)); }, dispose: () => scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }) };
}

function mount<T extends Scene>(canvas: HTMLCanvasElement, build: (W: number) => T, drawsAlways = false) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  const state = { s: null as T | null, W: 0, w: 0, h: 0, visible: true, last: 0 };
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -20, 20);
  const size = () => { const r = canvas.getBoundingClientRect(); const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height)); if (w === state.w && h === state.h) return; state.w = w; state.h = h; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.setSize(w, h, false);
    const vh = build === (buildHero as any) ? H : 1.2; const vw = vh * (w / h); state.W = vw; cam.left = -vw / 2; cam.right = vw / 2; cam.top = vh / 2; cam.bottom = -vh / 2; cam.updateProjectionMatrix(); state.s?.dispose(); state.s = build(vw); if (build === (buildHero as any)) state.s.scene.position.y = 0; };
  size(); new ResizeObserver(() => { size(); draw(performance.now() / 1000); }).observe(canvas);
  new IntersectionObserver((e) => { state.visible = e[0].isIntersecting; kick(); }).observe(canvas);
  const draw = (t: number) => { if (!state.s) return; state.s.update(FIXED_T ?? t); renderer.render(state.s.scene, cam); };
  return { draw, state, renderer };
}
const hero = mount(document.getElementById('scene') as HTMLCanvasElement, buildHero);
const catchM = mount(document.getElementById('catch') as HTMLCanvasElement, buildCatch as any, true);
const prog = () => { const d = document.documentElement; return d.scrollTop / Math.max(1, d.scrollHeight - innerHeight); };
let raf = 0; const t0 = performance.now();
function frame(now: number) { raf = 0; const t = (now - t0) / 1000; if (!paused && !document.hidden) {
  if (now - hero.state.last > 33) { hero.state.last = now; if (hero.state.visible) hero.draw(t); }
  (catchM.state.s as any)?.setProgress(prog()); catchM.draw(t); raf = requestAnimationFrame(frame); } }
function kick() { const t = (performance.now() - t0) / 1000; (catchM.state.s as any)?.setProgress(prog()); hero.draw(t); catchM.draw(t); if (!paused && !document.hidden && !raf) raf = requestAnimationFrame(frame); }
addEventListener('scroll', () => { if (paused) kick(); }, { passive: true }); document.addEventListener('visibilitychange', kick); kick();
(window as any).__motion = { frames: () => hero.renderer.info.render.frame, paused: () => paused };

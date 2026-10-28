// Shared Three.js lake world. Used by the /motion preview and by the whole app as a fixed backdrop behind still paper panels.
import * as THREE from 'three';
export type LakeHandle = { setPaused: (p: boolean) => void; frames: () => number; isPaused: () => boolean; dispose: () => void };
export function startLake(canvas: HTMLCanvasElement, opts: { layout: 'page' | 'app'; reduce: boolean; getScroll?: () => number }): LakeHandle {
  const reduce = opts.reduce; const scrollNow = opts.getScroll ?? (() => scrollY);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100); camera.position.set(0, 0, 14);
  scene.add(new THREE.HemisphereLight(0xffe2b8, 0x1d3a38, 1.05)); const sun = new THREE.DirectionalLight(0xffc98a, 2.4); sun.position.set(-4, 6, 8); scene.add(sun);

  // Water: layered ripple normals, warm sky reflection, soft caustic light, drifting canopy shadow.
  const water = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uS: { value: 0 }, uAsp: { value: 1 } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy*2.0; gl_Position = vec4(position.xy*2.0,0.0,1.0); }',
    fragmentShader: `precision highp float; varying vec2 vP; uniform float uT,uS,uAsp;
    float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
    float fbm(vec2 p){ float a=.5,v=0.; for(int i=0;i<4;i++){ v+=a*n(p); p=p*2.03+vec2(7.1,3.7); a*=.5; } return v; }
    float ht(vec2 p){ return fbm(p*.9+vec2(uT*.03,-uT*.02)) + .22*fbm(p*2.6-vec2(uT*.05,uT*.03)); }
    void main(){ vec2 uv=vP; uv.x*=uAsp; vec2 w=uv*2.2+vec2(0.,uS*1.4);
      float e=.012; float c=ht(w); vec3 nm=normalize(vec3(c-ht(w+vec2(e,0.)), c-ht(w+vec2(0.,e)), .06));
      vec3 deep=vec3(.075,.17,.165), mid=vec3(.15,.31,.28); vec3 col=mix(deep,mid,smoothstep(.3,1.0,c)*.7+ (1.-vP.y-.5)*.15);
      float refl=pow(clamp(dot(normalize(vec3(nm.xy*1.8,1.)),normalize(vec3(-.35,.5,.8))),0.,1.),9.); col+=vec3(.95,.55,.28)*refl*.38;
      float sky=smoothstep(.2,.9,fbm(w*.45+vec2(3.,uS*.3))); col=mix(col,vec3(.55,.34,.2),sky*.10*(.5+.5*nm.x));
      vec2 q=w*1.5+nm.xy*1.6; float ca=n(q+vec2(uT*.08,0.))*n(q*1.3-vec2(0.,uT*.07)); col+=vec3(.9,.78,.55)*smoothstep(.30,.7,ca)*.07;
      float sh=smoothstep(.52,.78,fbm(uv*1.1+vec2(uT*.012,uS*.5+uT*.01))); col*=1.-sh*.32;
      float vg=smoothstep(1.25,.25,length(vP*vec2(1.,1.1))); col*=.55+.45*vg;
      gl_FragColor=vec4(col,1.); }`, depthWrite: false, depthTest: false });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), water); bg.frustumCulled = false; bg.renderOrder = -10; scene.add(bg);

  // Leaves: shaded, slightly cupped, drifting on the surface with a soft contact shadow.
  function leafTexture(a: string, b: string, vein: string) { const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d')!; const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${40 + Math.random() * 60},${20 + Math.random() * 30},10,${Math.random() * 0.07})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 6, 1 + Math.random() * 3); } g.strokeStyle = vein; g.lineWidth = 2.5; g.beginPath(); g.moveTo(128, 6); g.lineTo(128, 250); g.stroke(); g.lineWidth = 1.2; for (let i = 0; i < 9; i++) { const y = 40 + i * 22; g.beginPath(); g.moveTo(128, y); g.lineTo(40 + (i % 2) * 10, y - 26); g.moveTo(128, y); g.lineTo(216 - (i % 2) * 10, y - 26); g.stroke(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
  const tex = [leafTexture('#b8341d', '#7d1f12', '#4d140c'), leafTexture('#e08a1f', '#a8501a', '#6a3510'), leafTexture('#cfa52a', '#8d6a1c', '#5b4412'), leafTexture('#9b5a22', '#5e3417', '#3b210e')];
  function leafGeo() { const sh = new THREE.Shape(); sh.moveTo(0, 1); sh.bezierCurveTo(.55, .7, .78, .1, .22, -.78); sh.lineTo(0, -1); sh.lineTo(-.22, -.78); sh.bezierCurveTo(-.78, .1, -.55, .7, 0, 1); const g = new THREE.ShapeGeometry(sh, 14); const p = g.attributes.position as THREE.BufferAttribute; const uv = g.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.abs(x) * 0.34 - y * y * 0.06); uv.setXY(i, x * 0.5 + 0.5, y * 0.5 + 0.5); } g.computeVertexNormals(); return g; }
  const geo = leafGeo(); const shadowMat = new THREE.MeshBasicMaterial({ color: 0x06100e, transparent: true, opacity: 0.34, depthWrite: false });
  type Leaf = { m: THREE.Mesh; sh: THREE.Mesh; x: number; y: number; d: number; r: number; ph: number; sp: number; sz: number };
  const leaves: Leaf[] = []; const SPAN = 30;
  for (let i = 0; i < 34; i++) { const sz = 0.45 + Math.random() * 0.75; const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex[i % 4], roughness: 0.78, metalness: 0, side: THREE.DoubleSide })); const sh = new THREE.Mesh(geo, shadowMat); sh.renderOrder = -5; scene.add(sh, m); leaves.push({ m, sh, x: (Math.random() - 0.5) * 12, y: Math.random() * SPAN, d: 0.35 + Math.random() * 0.65, r: Math.random() * 6.28, ph: Math.random() * 6.28, sp: 0.4 + Math.random() * 0.8, sz }); }

  // Quiet figures: a fish shadow gliding under the surface, a rabbit silhouette reading on a stone.
  function silhouette(draw: (g: CanvasRenderingContext2D) => void, w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!; draw(g); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
  const fishTex = silhouette((g) => { g.fillStyle = '#03100e'; g.beginPath(); g.moveTo(10, 64); g.bezierCurveTo(60, 20, 150, 22, 190, 64); g.bezierCurveTo(150, 106, 60, 108, 10, 64); g.fill(); g.beginPath(); g.moveTo(186, 64); g.lineTo(250, 22); g.quadraticCurveTo(232, 64, 250, 106); g.closePath(); g.fill(); }, 256, 128);
  const fish = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshBasicMaterial({ map: fishTex, transparent: true, opacity: 0.22, depthWrite: false })); fish.renderOrder = -6; scene.add(fish);
  const rabTex = silhouette((g) => { const body = () => { g.beginPath(); g.ellipse(112, 176, 58, 46, 0, 0, 6.3); g.moveTo(183, 126); g.ellipse(156, 126, 27, 23, 0, 0, 6.3); g.moveTo(156, 74); g.ellipse(148, 74, 8, 32, -0.12, 0, 6.3); g.moveTo(180, 76); g.ellipse(172, 76, 8, 30, 0.18, 0, 6.3); g.moveTo(74, 190); g.arc(60, 190, 14, 0, 6.3); }; g.lineJoin = 'round'; body(); g.strokeStyle = 'rgba(246,228,186,.85)'; g.lineWidth = 9; g.stroke(); body(); g.fillStyle = '#0f221d'; g.fill(); g.fillStyle = '#efdfb6'; g.beginPath(); g.moveTo(150, 168); g.lineTo(200, 160); g.lineTo(206, 190); g.lineTo(152, 198); g.closePath(); g.fill(); g.strokeStyle = '#0f221d'; g.lineWidth = 2; g.beginPath(); g.moveTo(178, 164); g.lineTo(179, 194); g.stroke(); }, 256, 256);
  const halo = silhouette((g) => { const r = g.createRadialGradient(128, 128, 8, 128, 128, 126); r.addColorStop(0, 'rgba(255,205,130,.55)'); r.addColorStop(1, 'rgba(255,205,130,0)'); g.fillStyle = r; g.fillRect(0, 0, 256, 256); }, 256, 256);
  const rabbit = new THREE.Group(); const stone = new THREE.Mesh(new THREE.CircleGeometry(1.5, 40), new THREE.MeshStandardMaterial({ color: 0x5b6760, roughness: 0.95 })); stone.scale.set(1, 0.62, 1); const rabM = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: rabTex, transparent: true })); rabM.position.set(0, 0.62, 0.05); const stShadow = new THREE.Mesh(new THREE.CircleGeometry(1.7, 40), shadowMat); stShadow.scale.set(1.1, 0.7, 1); stShadow.position.set(0.22, -0.2, -0.05); const haloM = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.MeshBasicMaterial({ map: halo, transparent: true, depthWrite: false })); haloM.position.set(0, 0.5, -0.02); rabbit.add(haloM, stShadow, stone, rabM); [haloM, stShadow, stone, rabM].forEach((o, i) => { o.renderOrder = 60 + i; (o.material as THREE.Material).depthTest = false; }); scene.add(rabbit); // drawn after the leaves: nothing may cover the focal rabbit

  let T = 0, S = 0, target = 0, last = performance.now(), paused = reduce, frames = 0, visible = true, raf = 0, dead = false; let halfW = 5, halfH = 5, uK = 1;
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); water.uniforms.uAsp.value = w / h; halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z; halfW = halfH * camera.aspect; bg.scale.set(1, 1, 1); uK = Math.min(1, Math.max(0.5, halfW / 6.2)); }
  function place(dt: number) {
    for (const l of leaves) { const yy = (((l.y - S * 3.2 * l.d + T * 0.05 * l.d) % SPAN) + SPAN) % SPAN - SPAN / 2; const x = l.x * (halfW / 5.5) + Math.sin(T * 0.25 * l.sp + l.ph) * 0.35; const bob = Math.sin(T * 0.8 * l.sp + l.ph);
      l.m.position.set(x, yy, 0.04 + bob * 0.015); l.m.scale.setScalar(l.sz * uK); l.m.rotation.set(Math.sin(T * 0.5 * l.sp + l.ph) * 0.12, Math.cos(T * 0.43 * l.sp + l.ph) * 0.1, l.r + Math.sin(T * 0.15 * l.sp + l.ph) * 0.5 + S * 0.15 * l.d);
      l.sh.position.set(x + 0.14 * l.sz * uK, yy - 0.12 * l.sz * uK, 0); l.sh.scale.setScalar(l.sz * uK * 1.04); l.sh.rotation.copy(l.m.rotation); l.sh.rotation.x = 0; l.sh.rotation.y = 0; }
    fish.position.set(Math.sin(T * 0.07) * halfW * 0.7, ((T * 0.18 - S * 2.2) % 22) - 11, -0.1); fish.rotation.z = Math.cos(T * 0.07) * 0.7 + Math.PI / 2 * 0 - 1.2; fish.scale.setScalar(uK * (1 + Math.sin(T * 0.9) * 0.015));
    if (camera.aspect < 1) { rabbit.position.set(-halfW * 0.5, halfH * 0.76, 0.02); rabbit.scale.setScalar(0.52); } else if (opts.layout === 'app') { rabbit.position.set(halfW * 0.74, -halfH * 0.2, 0.02); rabbit.scale.setScalar(1.35); } else { rabbit.position.set(-halfW * 0.62, -halfH * 0.5, 0.02); rabbit.scale.setScalar(Math.min(1.3, halfW / 4) * 1.15); } rabM.position.y = 0.62 + Math.sin(T * 1.1) * 0.012;
  }
  function frame(now: number) {
    if (dead) return; raf = requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now; if (!visible || document.hidden) return;
    if (!paused) T += dt; target = scrollNow() / innerHeight; S += (target - S) * (1 - Math.exp(-dt * 5.5));
    water.uniforms.uT.value = T; water.uniforms.uS.value = S; place(dt); renderer.render(scene, camera); frames++; }
  addEventListener('resize', resize); resize(); const q = new URLSearchParams(location.search); if (q.has('t')) T = Number(q.get('t')); if (q.has('s')) { S = target = Number(q.get('s')); }
  raf = requestAnimationFrame(frame);

  return { setPaused: (p) => { paused = p; }, frames: () => frames, isPaused: () => paused, dispose: () => { dead = true; cancelAnimationFrame(raf); removeEventListener('resize', resize); renderer.dispose(); } };
}

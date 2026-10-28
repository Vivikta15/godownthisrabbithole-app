import React, { useEffect, useRef } from 'react';

// The lake world sits fixed behind every screen. It loads after the first paint so reading is never blocked,
// pauses when the tab is hidden or the person asks for reduced motion, and quietly stays a dark green ground if WebGL is unavailable.
export function LakeBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let stop: (() => void) | undefined; let off = false;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(() => {
      import('../motion/lake').then(({ startLake }) => { if (off || !ref.current) return; try { const h = startLake(ref.current, { layout: 'app', reduce }); stop = h.dispose; } catch { /* no WebGL: the dark ground stays */ } }).catch(() => undefined);
    }, 60);
    return () => { off = true; window.clearTimeout(t); stop?.(); };
  }, []);
  return <canvas ref={ref} className="lake-world" aria-hidden="true" />;
}

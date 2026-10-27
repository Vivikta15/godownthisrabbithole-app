import React, { useEffect, useReducer, useRef } from 'react';
import { nextMascot, type MascotEvent, type MascotState } from '../shared/mascot';

export function useMascot() {
  const [state, dispatch] = useReducer(nextMascot, 'idle' as MascotState);
  const t = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(t.current);
    const wait: Partial<Record<MascotState, number>> = { greet: 2600, hop_in: 700, hop_out: 700, cheer: 1600, finder_found: 2200 };
    const ms = wait[state];
    if (ms) t.current = window.setTimeout(() => dispatch('animation_done'), ms);
    return () => window.clearTimeout(t.current);
  }, [state]);
  return [state, dispatch as (e: MascotEvent) => void] as const;
}

const LABEL: Record<MascotState, string> = {
  greet: 'The rabbit waves hello', explain_quiz: 'The rabbit is showing you around', idle: 'The rabbit is relaxing',
  finder_think: 'The rabbit is thinking hard', finder_found: 'The rabbit found something', hop_in: 'The rabbit hops into its hole',
  reading: 'The rabbit is reading on its phone in the hole', hop_out: 'The rabbit climbs out of the hole', cheer: 'The rabbit cheers',
};

export function Mascot({ state }: { state: MascotState }) {
  const inHole = state === 'hop_in' || state === 'reading' || state === 'hop_out';
  return (
    <div className={`mascot m-${state}`} role="img" aria-label={LABEL[state]}>
      <svg viewBox="0 0 120 130" width="100%" height="100%" aria-hidden="true">
        {inHole && <ellipse className="hole" cx="60" cy="116" rx="46" ry="12" fill="#6b4630" />}
        <g className="rabbit">
          <g className="ears"><ellipse cx="44" cy="30" rx="9" ry="24" fill="#fff" stroke="#e9d6c3" /><ellipse cx="44" cy="32" rx="4.5" ry="16" fill="#ffc9b8" />
            <ellipse cx="76" cy="30" rx="9" ry="24" fill="#fff" stroke="#e9d6c3" /><ellipse cx="76" cy="32" rx="4.5" ry="16" fill="#ffc9b8" /></g>
          <ellipse cx="60" cy="92" rx="30" ry="26" fill="#fff" stroke="#e9d6c3" />
          <circle cx="60" cy="66" r="28" fill="#fff" stroke="#e9d6c3" />
          <circle className="eye" cx="49" cy="64" r="3.2" fill="#4a3326" /><circle className="eye" cx="71" cy="64" r="3.2" fill="#4a3326" />
          <circle cx="42" cy="72" r="5" fill="#ffc9b8" opacity=".8" /><circle cx="78" cy="72" r="5" fill="#ffc9b8" opacity=".8" />
          <path d="M56 72 Q60 77 64 72" stroke="#4a3326" strokeWidth="2" fill="none" strokeLinecap="round" /><ellipse cx="60" cy="70" rx="2.6" ry="2" fill="#ff8a8a" />
          {state === 'reading' && <g className="phone"><rect x="47" y="72" width="26" height="36" rx="5" fill="#8fd6b4" stroke="#4a3326" strokeWidth="1.5" /><rect x="50" y="76" width="20" height="26" rx="3" fill="#fff" /><path d="M53 83h14M53 88h14M53 93h9" stroke="#8fd6b4" strokeWidth="2" strokeLinecap="round" /></g>}
          {(state === 'greet' || state === 'cheer') && <g className="paw"><ellipse cx="94" cy="84" rx="7" ry="11" fill="#fff" stroke="#e9d6c3" /></g>}
          {state === 'finder_think' && <g className="glass"><circle cx="92" cy="86" r="9" fill="none" stroke="#4a3326" strokeWidth="3" /><line x1="98" y1="93" x2="108" y2="103" stroke="#4a3326" strokeWidth="3" strokeLinecap="round" /></g>}
          {state === 'finder_found' && <g className="spark"><path d="M96 70 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#ff8a3d" /></g>}
        </g>
        {inHole && <ellipse cx="60" cy="124" rx="52" ry="9" fill="#f3d9b1" />}
      </svg>
    </div>
  );
}

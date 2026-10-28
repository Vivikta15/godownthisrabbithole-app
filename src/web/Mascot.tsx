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

export const LABEL: Record<MascotState, string> = {
  greet: 'The rabbit waves hello', explain_quiz: 'The rabbit is showing you around', idle: 'The rabbit is relaxing',
  finder_think: 'The rabbit is thinking hard', finder_found: 'The rabbit found something', hop_in: 'The rabbit hops into its hole',
  reading: 'The rabbit is reading on its phone in the hole', hop_out: 'The rabbit climbs out of the hole', cheer: 'The rabbit cheers',
};

export function Mascot({ state }: { state: MascotState }) {
  const reading = state === 'reading';
  const ink = '#3b2a20';
  return (
    <div className={`mascot m-${state}`} role="img" aria-label={LABEL[state]} data-state={state}>
      <svg viewBox="0 0 200 140" width="100%" height="100%" aria-hidden="true">
        <defs><clipPath id="above"><rect x="0" y="0" width="200" height="125" /></clipPath></defs>
        <ellipse cx="100" cy="124" rx="52" ry="12" fill="var(--burrow)" opacity=".4" />
        <g clipPath="url(#above)">
          <g className="pos"><g className="bob" transform="translate(40 4)">
            <g className="ears"><ellipse cx="44" cy="30" rx="9" ry="24" fill="#fff" stroke="#e9d6c3" /><ellipse cx="44" cy="32" rx="4.5" ry="16" fill="#ffb7a3" />
              <ellipse cx="76" cy="30" rx="9" ry="24" fill="#fff" stroke="#e9d6c3" /><ellipse cx="76" cy="32" rx="4.5" ry="16" fill="#ffb7a3" /></g>
            <ellipse cx="60" cy="92" rx="30" ry="26" fill="#fff" stroke="#e9d6c3" />
            <circle cx="60" cy="66" r="28" fill="#fff" stroke="#e9d6c3" />
            {reading ? <g className="eyes-read"><path d="M45 62 q4 4 8 0" stroke={ink} strokeWidth="2.4" fill="none" strokeLinecap="round" /><path d="M67 62 q4 4 8 0" stroke={ink} strokeWidth="2.4" fill="none" strokeLinecap="round" /></g>
              : <g><circle className="eye" cx="49" cy="64" r="3.4" fill={ink} /><circle className="eye" cx="71" cy="64" r="3.4" fill={ink} /><circle cx="50" cy="63" r="1.1" fill="#fff" /><circle cx="72" cy="63" r="1.1" fill="#fff" /></g>}
            <circle cx="42" cy="72" r="5" fill="#ffb7a3" opacity=".8" /><circle cx="78" cy="72" r="5" fill="#ffb7a3" opacity=".8" />
            <path d="M54 72 Q60 79 66 72" stroke={ink} strokeWidth="2" fill="none" strokeLinecap="round" /><ellipse cx="60" cy="70" rx="2.6" ry="2" fill="#ff7f8a" />
            {reading && <g className="phone" transform="translate(0 -32)"><rect x="44" y="76" width="32" height="40" rx="6" fill="#ffb347" stroke={ink} strokeWidth="2" /><rect x="48" y="81" width="24" height="30" rx="3" fill="#fff7ec" /><path d="M52 88h16M52 94h16M52 100h10" stroke="#ffb347" strokeWidth="2.4" strokeLinecap="round" /><ellipse cx="42" cy="110" rx="6" ry="5" fill="#fff" stroke="#e9d6c3" /><ellipse cx="78" cy="110" rx="6" ry="5" fill="#fff" stroke="#e9d6c3" /></g>}
            {(state === 'greet' || state === 'cheer') && <g className="paw"><ellipse cx="94" cy="84" rx="7" ry="11" fill="#fff" stroke="#e9d6c3" /></g>}
            {state === 'finder_think' && <g className="glass"><circle cx="92" cy="86" r="9" fill="none" stroke="#ffb347" strokeWidth="3" /><line x1="98" y1="93" x2="108" y2="103" stroke="#ffb347" strokeWidth="3" strokeLinecap="round" /></g>}
            {state === 'finder_found' && <g className="spark"><path d="M96 70 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#ffb347" /></g>}
          </g></g>
        </g>
        <path d="M44 126 Q100 108 156 126 L160 140 L40 140 Z" fill="var(--burrow)" /><path d="M44 126 Q100 108 156 126" stroke="var(--wood-dark)" strokeWidth="3" fill="none" />
        <circle cx="62" cy="132" r="2" fill="var(--wood-dark)" /><circle cx="138" cy="134" r="2.4" fill="var(--wood-dark)" /><circle cx="110" cy="131" r="1.6" fill="var(--wood-dark)" />
      </svg>
    </div>
  );
}

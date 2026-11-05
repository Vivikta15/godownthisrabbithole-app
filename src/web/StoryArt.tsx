import React, { useId } from 'react';
import { canopy, swan } from './Paco';

// One small gouache poster per story, chosen by the story's main topic. Flat shapes, cream rims, a few slow moves. Purely decorative (aria-hidden).
const INK = '#1d2f29', CREAM = '#fffaf0', SUN = '#ffd23f', PINK = '#ec3f7b', TEAL = '#14a39f', LEAF = '#72b533';
const Sky = ({ id, a, b }: { id: string; a: string; b: string }) => <><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient></defs><rect width="480" height="240" fill={`url(#${id})`} /></>;
const Cosmos = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => <g transform={`translate(${x} ${y}) scale(${s})`}><path d="M0 0V34" stroke="#3f9a2b" strokeWidth="3" strokeLinecap="round" />{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <ellipse key={a} cx="0" cy="-9" rx="4.600" ry="9" transform={`rotate(${a})`} fill={PINK} />)}<circle r="4.400" fill="#f5a623" /></g>;
const Grass = ({ y, n = 40, seed = 3 }: { y: number; n?: number; seed?: number }) => { let s = seed; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280); return <g fill="none" strokeWidth="3.200" strokeLinecap="round">{Array.from({ length: n }, (_, i) => { const x = (i / n) * 500 - 10 + r() * 8, h = 14 + r() * 26; return <path key={i} className="bl" style={{ animationDelay: `${(-r() * 4).toFixed(1)}s` }} d={`M${x.toFixed(1)} ${y + r() * 20} q${((r() - 0.5) * 8).toFixed(1)} ${-h / 2} ${((r() - 0.3) * 12).toFixed(1)} ${-h}`} stroke={['#6fb52b', '#4f9a22', '#9ed14a'][i % 3]} />; })}</g>; };

function Scene({ tag, id }: { tag: string; id: string }) {
  switch (tag) {
    case 'space': return <>
      <Sky id={id} a="#0f3d5a" b="#1e7a86" />
      {Array.from({ length: 26 }, (_, i) => <circle key={i} className="tw" style={{ animationDelay: `${-(i % 7) * 0.5}s` }} cx={(i * 97) % 470 + 6} cy={(i * 53) % 150 + 8} r={i % 4 ? 1.600 : 2.600} fill={CREAM} />)}
      {/* The planet never spins (a spinning ring ends up standing on edge). The ring is drawn behind the planet, then its near half is drawn in front. */}
      <g className="planet"><ellipse cx="330" cy="98" rx="82" ry="16" fill="none" stroke={PINK} strokeWidth="6" transform="rotate(-18 330 98)" /><circle cx="330" cy="96" r="46" fill={SUN} /><path d="M286 84q44 20 88-6M287 110q44 18 86-4" fill="none" stroke="#f5a623" strokeWidth="9" opacity=".8" /><path d="M248 98A82 16 0 0 0 412 98" fill="none" stroke={PINK} strokeWidth="6" strokeLinecap="round" transform="rotate(-18 330 98)" /></g>
      <path d="M96 40a30 30 0 1 0 22 52a24 24 0 1 1 -22 -52z" fill={CREAM} /><circle cx="170" cy="150" r="14" fill={TEAL} stroke={CREAM} strokeWidth="3" />
      <path className="shoot" d="M60 30L130 70" stroke={CREAM} strokeWidth="2.400" strokeLinecap="round" />
      <path d="M-10 214Q120 160 250 200T500 190V240H-10z" fill="#4f9a2c" /><path d="M-10 226Q140 190 300 222T500 214V240H-10z" fill="#72b533" /></>;
    case 'science': return <>
      <Sky id={id} a="#35c1b8" b="#0c8a8e" />
      <g className="spin">{[0, 60, 120].map((a) => <ellipse key={a} cx="110" cy="100" rx="64" ry="20" fill="none" stroke={CREAM} strokeWidth="3" opacity=".75" transform={`rotate(${a} 110 100)`} />)}<circle cx="110" cy="100" r="10" fill={SUN} /></g>
      <path d="M262 36h56M272 36v62l-52 86a14 14 0 0 0 12 21h116a14 14 0 0 0 12-21l-52-86V36" fill={CREAM} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M241 150q28 10 54 0t54 4l16 26a10 10 0 0 1-9 15H234a10 10 0 0 1-9-15z" fill={PINK} opacity=".9" />
      {[0, 1, 2, 3].map((i) => <circle key={i} className="bub" style={{ animationDelay: `${-i * 0.8}s` }} cx={282 + i * 14} cy="170" r={4 + (i % 2) * 2} fill={CREAM} />)}
      <path d="M0 214H480V240H0z" fill="#0b6f73" /><g transform="translate(400 150)"><path d="M0 64C0 20 28 4 52 0C52 40 28 64 0 64z" fill={LEAF} /><path d="M4 62L40 14" stroke="#2f7a2c" strokeWidth="3" /></g></>;
    case 'history': return <>
      <Sky id={id} a="#8ccbe9" b="#fdeccb" />
      <circle cx="400" cy="70" r="30" fill={SUN} />
      <path d="M-10 196Q120 176 240 192T500 184V240H-10z" fill="#e8c98e" />
      <g><path d="M120 92L240 40L360 92z" fill="#f4e2bb" stroke={INK} strokeWidth="3.500" strokeLinejoin="round" /><rect x="116" y="92" width="248" height="14" fill="#e3cd9a" stroke={INK} strokeWidth="3.500" />
        {[150, 205, 260, 315].map((x) => <g key={x}><rect x={x - 12} y="106" width="24" height="80" fill="#f8ecd0" stroke={INK} strokeWidth="3" /><path d={`M${x - 4} 110V182M${x + 4} 110V182`} stroke="#e3cd9a" strokeWidth="2" /></g>)}
        <rect x="104" y="186" width="272" height="12" fill="#e3cd9a" stroke={INK} strokeWidth="3.500" /><rect x="94" y="198" width="292" height="12" fill="#d9bd85" stroke={INK} strokeWidth="3.500" /></g>
      <g className="flock">{[0, 1, 2].map((i) => <path key={i} className="bird" style={{ animationDelay: `${-i * 0.3}s` }} transform={`translate(${60 + i * 26} ${52 + (i % 2) * 14})`} d="M0 0q6-7 12 0q6-7 12 0" />)}</g></>;
    case 'food': return <>
      <Sky id={id} a="#ffe9a8" b="#ffd23f" />
      {[[40, 30], [100, 30], [70, 80], [130, 80], [160, 30], [190, 80]].map(([x, y], i) => <path key={i} d={`M${x} ${y - 28}l24 14v28l-24 14l-24 -14v-28z`} fill="#f5a623" stroke="#fff3c4" strokeWidth="4" />)}
      <rect x="196" y="82" width="104" height="116" rx="26" fill="#e8912a" stroke={INK} strokeWidth="4" /><rect x="188" y="62" width="120" height="30" rx="12" fill="#b5651d" stroke={INK} strokeWidth="4" /><rect x="214" y="112" width="68" height="50" rx="10" fill={CREAM} stroke={INK} strokeWidth="3" /><path d="M232 138q16-18 32 0q-16 16-32 0z" fill="#f5a623" />
      <path d="M340 150h86v22a40 40 0 0 1-40 40h-6a40 40 0 0 1-40-40z" fill={CREAM} stroke={INK} strokeWidth="4" /><path d="M426 158h10a14 14 0 0 1 0 28h-10" fill="none" stroke={INK} strokeWidth="4" />
      {[0, 1, 2].map((i) => <path key={i} className="steam" style={{ animationDelay: `${-i * 0.9}s` }} d={`M${362 + i * 20} 138q-8-14 0-26t0-24`} fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".85" />)}
      <g className="bee"><ellipse cx="60" cy="170" rx="14" ry="10" fill={SUN} stroke={INK} strokeWidth="3" /><path d="M54 161v18M62 161v18" stroke={INK} strokeWidth="3" /><ellipse cx="56" cy="158" rx="9" ry="5" fill="#fff" opacity=".85" /></g></>;
    case 'places': return <>
      <Sky id={id} a="#86c9e8" b="#d3efe8" />
      <path d="M-10 150Q90 96 200 140T500 120V240H-10z" fill="#9ed14a" /><path d="M-10 190Q130 140 260 180T500 170V240H-10z" fill="#72b533" />
      <path d="M200 240Q150 200 250 178T300 150" fill="none" stroke="#fff3d6" strokeWidth="18" strokeLinecap="round" /><path d="M200 240Q150 200 250 178T300 150" fill="none" stroke="#e8c98e" strokeWidth="2" strokeDasharray="6 8" />
      <g className="balloon"><ellipse cx="380" cy="80" rx="34" ry="40" fill={PINK} stroke={INK} strokeWidth="3.500" /><path d="M360 44q-12 36 0 74M380 40v80M400 44q12 36 0 74" fill="none" stroke={SUN} strokeWidth="4" /><path d="M368 120l-4 16h32l-4-16" fill="#b5651d" stroke={INK} strokeWidth="3" /></g>
      <g transform="translate(96 150)"><path d="M0 0v50" stroke="#8a5a2b" strokeWidth="6" strokeLinecap="round" /><path d="M-6 8h46l10 9l-10 9H-6z" fill={CREAM} stroke={INK} strokeWidth="3" /></g>
      <g transform="translate(60 40)"><circle r="22" fill="#fff" opacity=".9" /><circle cx="30" cy="6" r="18" fill="#fff" opacity=".9" /></g></>;
    case 'everyday life': return <>
      <Sky id={id} a="#bfe6ef" b="#f6f1d8" />
      <path d="M-10 190Q140 168 260 188T500 180V240H-10z" fill="#9ed14a" /><path d="M170 240Q190 200 230 190" fill="none" stroke="#fff3d6" strokeWidth="16" strokeLinecap="round" />
      <rect x="236" y="104" width="150" height="96" fill="#f8ecd0" stroke={INK} strokeWidth="4" /><path d="M222 108L311 52L400 108z" fill="#d9663a" stroke={INK} strokeWidth="4" strokeLinejoin="round" /><rect x="344" y="62" width="18" height="32" fill="#b5651d" stroke={INK} strokeWidth="3" />
      <rect x="258" y="130" width="40" height="40" rx="4" fill={SUN} stroke={INK} strokeWidth="3.500" /><path d="M278 130v40M258 150h40" stroke={INK} strokeWidth="2.500" /><rect x="326" y="146" width="36" height="54" rx="4" fill={TEAL} stroke={INK} strokeWidth="3.500" />
      {[0, 1].map((i) => <circle key={i} className="smoke" style={{ animationDelay: `${-i * 1.6}s` }} cx="353" cy="52" r="9" fill="#fff" opacity=".8" />)}</>;
    case 'money & tech': return <>
      <Sky id={id} a="#35c1b8" b="#0c8a8e" />
      <rect x="170" y="26" width="110" height="190" rx="22" fill={INK} /><rect x="180" y="42" width="90" height="158" rx="10" fill={CREAM} /><circle cx="225" cy="98" r="26" fill={SUN} stroke={INK} strokeWidth="3.500" /><path d="M212 98l10 10l18-20" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /><rect x="198" y="146" width="54" height="8" rx="4" fill="#cfe9e4" /><rect x="198" y="162" width="38" height="8" rx="4" fill="#cfe9e4" />
      {[[340, 170], [376, 150], [320, 120]].map(([x, y], i) => <g key={i} className="coin" style={{ animationDelay: `${-i * 0.7}s` }}><circle cx={x} cy={y} r="26" fill={SUN} stroke={INK} strokeWidth="3.500" /><circle cx={x} cy={y} r="17" fill="none" stroke="#f5a623" strokeWidth="3" /></g>)}
      <path d="M96 60l4 10l10 4l-10 4l-4 10l-4-10l-10-4l10-4z" fill={CREAM} /><path d="M420 90l3 8l8 3l-8 3l-3 8l-3-8l-8-3l8-3z" fill={CREAM} /></>;
    case 'nature': return <>
      <Sky id={id} a="#86c9e8" b="#d3efe8" />
      <circle cx="90" cy="66" r="30" fill={SUN} stroke="#fff3c4" strokeWidth="8" />
      <path d="M-10 160Q120 120 250 150T500 140V240H-10z" fill="#a6d84a" /><path d="M-10 200Q150 160 300 196T500 186V240H-10z" fill="#74b82e" />
      <Cosmos x={150} y={150} s={1.4} /><Cosmos x={300} y={140} s={1.1} /><Cosmos x={390} y={162} s={1.6} /><Grass y={216} />
      {[0, 1].map((i) => <g key={i} className="fly" style={{ animationDelay: `${-i * 2}s` }}><ellipse cx={230 + i * 90} cy={86 + i * 20} rx="9" ry="6" fill={PINK} /><ellipse cx={242 + i * 90} cy={84 + i * 20} rx="9" ry="6" fill={SUN} /></g>)}</>;
    default: return <>
      <Sky id={id} a="#8ccbe9" b="#c8ecec" />
      <rect y="108" width="480" height="132" fill="#14a39f" /><path d="M0 108Q120 98 250 108T480 104" fill="none" stroke="#bff0e2" strokeWidth="5" />
      {swan('a1', 120, 160, 1.3, false, 22, 0)}{swan('a2', 270, 190, 1.1, true, 26, -8)}{swan('a3', 380, 150, 0.9, false, 24, -14)}</>;
  }
}

export function StoryArt({ tags }: { tags: string[] }) {
  const id = 'sa' + useId().replace(/:/g, ''); const tag = tags[0] ?? '';
  const corner = tag === 'animals' || tag === 'nature' || tag === 'everyday life' || tag === '';
  return <svg className="storyart" viewBox="0 0 480 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <Scene tag={tag} id={id} />
    {corner && <g opacity=".98">{canopy(5, 'a', 20, -20, 120, 9)}{canopy(9, 'b', 470, -26, 130, 9)}</g>}
  </svg>;
}

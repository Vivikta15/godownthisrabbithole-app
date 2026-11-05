import React from 'react';

// A cosmos that turns while the page wakes up: petals bloom one after another around a yellow centre.
export function Loader({ label }: { label: string }) {
  return <div className="loader" role="status"><svg viewBox="0 0 80 80" width="72" height="72" aria-hidden="true"><g className="lspin" transform="translate(40 40)">
    {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => <ellipse key={a} className="lpetal" style={{ animationDelay: `${i * 0.12}s` }} cx="0" cy="-17" rx="7" ry="14" transform={`rotate(${a})`} fill={i % 2 ? '#ec3f7b' : '#f06a9a'} />)}
    <circle className="lcore" r="8" fill="#ffd23f" /></g></svg><p>{label}</p></div>;
}

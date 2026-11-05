import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PacoScene } from '../src/web/Paco';

describe('background bird positioning', () => {
  it('keeps all five positions on parents, separate from animated wings', () => {
    const m = renderToStaticMarkup(<PacoScene />);
    const birds = [...m.matchAll(/<g transform="translate\(([^)]+)\)"><path class="bird"[^>]*>/g)];
    expect(birds.map(b => b[1])).toEqual(['760 300', '798 316', '726 320', '830 336', '694 340']);
    for (const [bird] of birds) expect(bird.split('<path')[1]).not.toContain('transform=');
  });
});

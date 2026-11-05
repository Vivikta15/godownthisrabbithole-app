import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
// @ts-ignore node types are not part of this project's type set
import { readFileSync } from 'node:fs';
import { StoryArt } from '../src/web/StoryArt';
import { TOPIC_TAGS } from '../src/content/seed';

// Guardrails for the story posters. They catch the kinds of distortion seen so far (a planet whose spinning ring ended up standing on edge) and the usual ways an
// illustration breaks: stretching, missing references, bad numbers, shapes drifting off the canvas, or motion on something that should stay put.
const TAGS = [...TOPIC_TAGS, '', 'something-new'];
const svg = (tag: string) => renderToStaticMarkup(<StoryArt tags={tag ? [tag] : []} />);
// The only classes a poster may carry. A new animated class has to be added here on purpose, with a look at what it does to the picture.
const ALLOWED = new Set(['storyart', 'sw', 'bl', 'swan', 'l', 'tw', 'spin', 'shoot', 'bub', 'steam', 'bee', 'balloon', 'smoke', 'coin', 'fly', 'bird', 'flock', 'planet']);

describe('story art guardrails', () => {
  for (const tag of TAGS) describe(tag || '(no tag)', () => {
    const m = svg(tag);
    it('is a fixed 2:1 canvas, decorative, and never stretched', () => { expect(m).toContain('viewBox="0 0 480 240"'); expect(m).toContain('aria-hidden="true"'); expect(m).toContain('preserveAspectRatio="xMidYMid slice"'); });
    it('has no broken numbers or empty values', () => { for (const bad of ['NaN', 'undefined', 'Infinity', 'null']) expect(m).not.toContain(bad); });
    it('every url(#id) points at something defined', () => { for (const [, id] of m.matchAll(/url\(#([^)]+)\)/g)) expect(m, id).toContain(`id="${id}"`); });
    it('only uses known classes', () => { for (const [, c] of m.matchAll(/class="([^"]+)"/g)) for (const k of c.split(/\s+/)) expect(ALLOWED.has(k), `${tag}: ${k}`).toBe(true); });
    it('keeps its main shapes on or near the canvas', () => { for (const [, a, v] of m.matchAll(/\b(cx|cy)="(-?[\d.]+)"/g)) { const n = Number(v); expect(n, `${tag} ${a}=${v}`).toBeGreaterThan(-160); expect(n, `${tag} ${a}=${v}`).toBeLessThan(a === 'cx' ? 640 : 400); } });
  });

  it('only the atom may spin: a planet, jar or building must never rotate', () => {
    for (const tag of TAGS) { const spins = (svg(tag).match(/class="spin"/g) ?? []).length; expect(spins, tag).toBe(tag === 'science' ? 1 : 0); }
  });
  it('the planet is not animated, and its ring is drawn behind it and in front of it', () => {
    const m = svg('space'); expect(m).toContain('class="planet"'); expect(m.match(/stroke="#ec3f7b"/g)?.length).toBe(2);
    const css = readFileSync('src/web/paco.css', 'utf8'); expect(css).not.toMatch(/\.storyart\s+\.planet\s*\{[^}]*animation/);
  });
  it('the poster keeps a 2:1 box in CSS, so the picture is scaled, not stretched', () => { const css = readFileSync('src/web/paco.css', 'utf8'); expect(css).toMatch(/\.storyart\{[^}]*aspect-ratio:2\/1/); expect(css).toMatch(/\.storyart\{[^}]*width:100%;height:auto/); });
});

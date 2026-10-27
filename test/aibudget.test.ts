import { describe, it, expect } from 'vitest';
import { estimateNeurons, MODEL_RATES, DEFAULT_DAILY_CAP, FREE_DAILY_NEURONS, budgetDay } from '../src/worker/aibudget';
describe('ai budget', () => {
  it('rejects non-allowlisted models (incl. paid-only ones and prototype keys)', () => {
    expect(estimateNeurons('@cf/deepseek-ai/deepseek-v4-pro-0813', 1, 1)).toBeNull();
    expect(estimateNeurons('constructor', 1, 1)).toBeNull();
  });
  it('matches published per-million rates', () => {
    expect(estimateNeurons('@cf/meta/llama-3.3-70b-instruct-fp8-fast', 3000, 800)).toBe(Math.ceil((3000 * 26668 + 800 * 204805) / 1e6));
  });
  it('cap leaves margin under the free allocation', () => { expect(DEFAULT_DAILY_CAP).toBeLessThan(FREE_DAILY_NEURONS); expect(Object.keys(MODEL_RATES).length).toBe(2); });
  it('budget day is UTC', () => { expect(budgetDay(new Date('2026-10-27T23:59:59Z'))).toBe('2026-10-27'); });
});

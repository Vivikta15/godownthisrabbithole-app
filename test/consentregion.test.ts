import { describe, it, expect } from 'vitest';
import { consentRegionFor } from '../src/worker/consentregion';
describe('consentRegionFor', () => {
  it('is strict for EEA via isEUCountry', () => {
    expect(consentRegionFor({ isEUCountry: true, country: 'DE' })).toBe('strict');
    expect(consentRegionFor({ isEUCountry: '1', country: 'FR' })).toBe('strict');
  });
  it('is strict for EEA-adjacent explicit countries', () => {
    for (const c of ['NO', 'IS', 'LI', 'GB', 'CH']) expect(consentRegionFor({ country: c })).toBe('strict');
  });
  it('is open only for positively identified other regions', () => {
    expect(consentRegionFor({ isEUCountry: false, country: 'IN' })).toBe('open');
    expect(consentRegionFor({ country: 'US' })).toBe('open');
  });
  it('is strict when the signal is missing or unreadable', () => {
    expect(consentRegionFor(undefined)).toBe('strict');
    expect(consentRegionFor(null)).toBe('strict');
    expect(consentRegionFor({})).toBe('strict');
    expect(consentRegionFor({ country: 'XX' })).toBe('strict');
    expect(consentRegionFor({ country: 'T1' })).toBe('strict');
    expect(consentRegionFor({ country: 'india' })).toBe('strict');
    expect(consentRegionFor({ country: 'I' })).toBe('strict');
  });
});

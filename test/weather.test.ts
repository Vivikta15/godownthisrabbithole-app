import { describe, it, expect, vi } from 'vitest';
import { conditionFromSymbol, symbolFromMet, fetchCondition } from '../src/worker/weather';
describe('weather mapping', () => {
  it('maps MET symbols to four calm conditions', () => {
    expect(conditionFromSymbol('clearsky_day')).toBe('clear');
    expect(conditionFromSymbol('fair_night')).toBe('clear');
    expect(conditionFromSymbol('partlycloudy_day')).toBe('cloudy');
    expect(conditionFromSymbol('lightrainshowers_day')).toBe('rain');
    expect(conditionFromSymbol('heavyrainandthunder')).toBe('rain');
    expect(conditionFromSymbol('fog')).toBe('mist');
    expect(conditionFromSymbol('snow')).toBe('cloudy');
    expect(conditionFromSymbol('unknown_thing')).toBeNull();
    expect(conditionFromSymbol(undefined)).toBeNull();
  });
  it('reads the first hour symbol and falls back safely', () => {
    expect(symbolFromMet({ properties: { timeseries: [{ data: { next_1_hours: { summary: { symbol_code: 'fog' } } } }] } })).toBe('fog');
    expect(symbolFromMet({})).toBeUndefined();
  });
});

describe('fetchCondition', () => {
  it('sends an identifying User-Agent, rounds coordinates and caches by location', async () => {
    const store = new Map<string, Response>();
    const cache: any = { match: async (k: Request) => store.get(k.url)?.clone(), put: async (k: Request, v: Response) => { store.set(k.url, v); } };
    const f = vi.fn(async () => new Response(JSON.stringify({ properties: { timeseries: [{ data: { next_1_hours: { summary: { symbol_code: 'rain' } } } }] } })));
    vi.stubGlobal('fetch', f);
    expect(await fetchCondition(28.6139, 77.2090, 'https://example.test', cache)).toBe('rain');
    expect(await fetchCondition(28.6139, 77.2090, 'https://example.test', cache)).toBe('rain');
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as any;
    expect(url).toContain('lat=28.61&lon=77.21');
    expect(init.headers['User-Agent']).toContain('https://example.test');
    vi.unstubAllGlobals();
  });
  it('returns null when the service fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 503 })));
    expect(await fetchCondition(1, 2, 'x', undefined)).toBeNull();
    vi.unstubAllGlobals();
  });
});

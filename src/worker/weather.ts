// Weather for the user's chosen city, from MET Norway Locationforecast (https://api.met.no/doc/TermsOfService).
// Terms followed here: identifying User-Agent with contact, coordinates truncated to 4 decimals (ours are 2), server-side calls only,
// cached per rounded location (one hour), Expires/Last-Modified respected through If-Modified-Since. Data: CC BY 4.0 / NLOD 2.0, credit "Data from MET Norway".
export type Condition = 'clear' | 'cloudy' | 'rain' | 'mist';

// MET symbol codes look like "partlycloudy_day", "lightrain", "heavyrainandthunder", "fog", "snow", "clearsky_night".
export function conditionFromSymbol(code: string | undefined): Condition | null {
  if (!code) return null;
  const s = code.replace(/_(day|night|polartwilight)$/, '');
  if (s === 'fog') return 'mist';
  if (s === 'clearsky' || s === 'fair') return 'clear';
  if (s === 'partlycloudy' || s === 'cloudy') return 'cloudy';
  if (/rain|sleet|thunder|drizzle/.test(s)) return 'rain';
  if (/snow/.test(s)) return 'cloudy'; // the look stays autumn: snow shows as an overcast sky
  return null;
}

export function symbolFromMet(json: any): string | undefined {
  const t = json?.properties?.timeseries?.[0]?.data;
  return t?.next_1_hours?.summary?.symbol_code ?? t?.next_6_hours?.summary?.symbol_code;
}

export async function fetchCondition(lat: number, lon: number, contact: string, cache: Cache | undefined): Promise<Condition | null> {
  const la = Math.round(lat * 100) / 100; const lo = Math.round(lon * 100) / 100;
  const key = new Request(`https://weather-cache.invalid/${la}/${lo}`);
  const hit = cache ? await cache.match(key) : undefined;
  if (hit) { const j: any = await hit.json(); return j.condition ?? null; }
  const r = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${la}&lon=${lo}`, { headers: { 'User-Agent': `godownthisrabbithole/1.0 (${contact})` } });
  if (!r.ok) return null;
  const condition = conditionFromSymbol(symbolFromMet(await r.json()));
  if (cache) await cache.put(key, new Response(JSON.stringify({ condition }), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' } }));
  return condition;
}

export async function api<T = any>(path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  const r = await fetch('/api' + path, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  let data: any = {}; try { data = await r.json(); } catch { /* empty */ }
  return { ok: r.ok, status: r.status, data };
}

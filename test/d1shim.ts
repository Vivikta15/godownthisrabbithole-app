// Minimal D1 over node:sqlite so the real SQL runs in tests.
const { DatabaseSync } = (globalThis as any).process.getBuiltinModule('node:sqlite') as any;
export const GEN_SCHEMA = `CREATE TABLE gen_spend_log (id TEXT PRIMARY KEY, ts INTEGER NOT NULL, micro INTEGER NOT NULL, state TEXT NOT NULL, note TEXT); CREATE INDEX gen_spend_ts ON gen_spend_log (ts);
CREATE TABLE gen_story (id TEXT PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL, body TEXT NOT NULL, meta TEXT NOT NULL);
CREATE TABLE gen_attempt (id TEXT PRIMARY KEY, ts INTEGER NOT NULL, topic TEXT, outcome TEXT NOT NULL, reason TEXT, micro INTEGER NOT NULL DEFAULT 0);
CREATE TABLE gen_control (k TEXT PRIMARY KEY, v TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE gen_cache (attempt TEXT NOT NULL, k TEXT NOT NULL, v TEXT NOT NULL, PRIMARY KEY (attempt, k));`;
export function mkdb() {
  const s = new DatabaseSync(':memory:'); s.exec(GEN_SCHEMA);
  const stmt = (sql: string, args: any[] = []): any => ({
    bind: (...a: any[]) => stmt(sql, a),
    run: async () => { const r = s.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
    first: async () => (s.prepare(sql).get(...args) as any) ?? null,
    all: async () => ({ results: s.prepare(sql).all(...args) as any[] }),
  });
  return { db: { prepare: (sql: string) => stmt(sql), batch: async (l: any[]) => { for (const x of l) await x.run(); return []; } } as any, raw: s };
}

// Content pipeline interface. NOTHING here proves a claim true.
// A piece may be shown as "source-checked" only if every claim has fetched source text AND the checker accepts it.
// The checker is a pluggable (possibly model-based) judge: its verdict is a filter, not a guarantee. The UI must say so,
// and keep source links plus a report-a-mistake path. Real providers are not connected yet.
export interface SourceDoc { url: string; fetchedAt: number; text: string }
export interface Claim { text: string; sourceUrls: string[] }
export interface Draft { title: string; claims: Claim[]; body: string }
export type CheckStatus = 'unchecked' | 'checked_by_automated_filter' | 'rejected';
export interface CheckResult { status: CheckStatus; perClaim: { claim: string; supported: boolean; quote?: string; reason?: string }[] }
export interface Generator { draft(topic: string): Promise<Draft> }
export interface Fetcher { fetch(url: string): Promise<SourceDoc | null> }
export interface Judge { supports(claim: string, source: SourceDoc): Promise<{ supported: boolean; quote?: string }> }

export async function checkDraft(d: Draft, fetcher: Fetcher, judge: Judge): Promise<CheckResult> {
  const perClaim: CheckResult['perClaim'] = [];
  for (const c of d.claims) {
    if (!c.sourceUrls.length) { perClaim.push({ claim: c.text, supported: false, reason: 'no source' }); continue; }
    let ok = false, quote: string | undefined, reason = 'no fetched source supports it';
    for (const u of c.sourceUrls) {
      const doc = await fetcher.fetch(u); if (!doc || !doc.text) continue;
      const r = await judge.supports(c.text, doc);
      // the quote must literally appear in the fetched text, otherwise the judge's answer is discarded
      if (r.supported && r.quote && doc.text.includes(r.quote)) { ok = true; quote = r.quote; break; }
      if (r.supported) reason = 'judge quote not found in fetched text';
    }
    perClaim.push({ claim: c.text, supported: ok, quote, reason: ok ? undefined : reason });
  }
  const all = perClaim.length > 0 && perClaim.every((p) => p.supported);
  return { status: all ? 'checked_by_automated_filter' : 'rejected', perClaim };
}

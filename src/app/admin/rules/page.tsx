import { desc } from "drizzle-orm";
import { Card, Notice, PageTitle, PhaseBadge, ReasonField, sp, type SP } from "@/components/ui";
import { getDb, schema } from "@/db";
import { Dec } from "@/engine";
import { dateTime } from "@/lib/format";
import { RULEBOOK_CHANGES, plainText, suggestedRulebook } from "@/db/rulebook-update";
import { publishRulebook, saveRules } from "@/server/admin-actions";
import { getCompetition, getPhases } from "@/server/core";

export const metadata = { title: "Rules and rulebook" };

export default async function RulesAdmin({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const db = getDb();
  const [comp, phases, versions] = await Promise.all([getCompetition(db), getPhases(db), db.select().from(schema.rulebookVersions).orderBy(desc(schema.rulebookVersions.version))]);
  const latest = versions[0];
  const suggestion = latest ? suggestedRulebook(latest.content) : null;
  const opened = phases.some((p) => p.status !== "draft");
  return (
    <>
      <PageTitle title="Rules and rulebook" sub="Trading rules are enforced by the server on every order. A phase's rules lock while it is open; pause it to change them." />
      <Notice ok={sp(q.ok)} err={sp(q.err)} />
      <form action={saveRules} className="space-y-4">
        <Card title="Competition rules">
          <div className="grid gap-4 sm:grid-cols-3">
            <label>
              <span className="label">Starting capital (₹)</span>
              <input name="capital" defaultValue={comp.startingCapitalPaise / 100} className="input" readOnly={opened} />
              {opened ? <span className="mt-1 block text-xs text-muted">Locked once Phase 1 has opened</span> : null}
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="disqualifyOnShortfall" defaultChecked={comp.disqualifyOnShortfall} />
              Disqualify a team that ends a phase below the minimum number of executed trades
            </label>
          </div>
          <p className="mt-3 text-xs text-muted">Fixed by design: whole lots only, no short selling, execution at the phase&apos;s opening prices, invalid orders blocked. Ties follow the tie-break rule in the rulebook.</p>
        </Card>
        <Card title="Rules per phase" pad={false}>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Phase</th>
                  <th>Status</th>
                  <th>Selling allowed</th>
                  <th>Minimum distinct assets traded</th>
                  <th>Concentration cap % of value</th>
                  <th>Pro-rata rationing</th>
                </tr>
              </thead>
              <tbody>
                {phases.map((p) => (
                  <tr key={p.number}>
                    <td className="font-semibold">{p.name}</td>
                    <td>
                      <PhaseBadge status={p.status} />
                    </td>
                    <td>
                      <input type="checkbox" name={`allowSell_${p.number}`} defaultChecked={p.allowSell} aria-label={`${p.name} selling allowed`} />
                    </td>
                    <td>
                      <input name={`min_${p.number}`} defaultValue={p.minDistinctAssets} className="input w-24" aria-label={`${p.name} minimum assets`} />
                    </td>
                    <td>
                      <input name={`cap_${p.number}`} defaultValue={new Dec(p.capShare).mul(100).toString()} className="input w-24" aria-label={`${p.name} cap`} />
                    </td>
                    <td>
                      <input type="checkbox" name={`rationing_${p.number}`} defaultChecked={p.rationing} aria-label={`${p.name} rationing`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 pb-3 text-xs text-muted">A cap of 100% means no cap. The minimum counts distinct assets with a positive executed quantity; a purchase rationed to 0 lots does not count.</p>
        </Card>
        <div className="card flex flex-wrap items-end gap-2 p-4">
          <div className="min-w-64 flex-1">
            <ReasonField />
          </div>
          <button className="btn btn-primary">Save rules</button>
        </div>
      </form>

      <Card title={`Rulebook (version ${latest?.version ?? 0}, published ${dateTime(latest?.createdAt)})`} className="mt-4">
        {suggestion && suggestion.applied.length > 0 ? (
          <div className="mb-4 rounded-lg border border-warn/40 bg-warnsoft p-3 text-sm">
            <p className="font-medium text-warn">
              The published rulebook still describes the paper form: it allows skipping a phase and disqualifies teams for orders the website now blocks. Suggested update for {suggestion.applied.length} rules:
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer text-accent">Show the suggested wording</summary>
              <div className="mt-2 space-y-3">
                {RULEBOOK_CHANGES.filter((c) => suggestion.applied.includes(c.clause)).map((c) => (
                  <div key={c.clause} className="rounded border border-line bg-panel p-2">
                    <div className="text-xs font-semibold text-muted">{c.topic}</div>
                    <div className="mt-1 text-xs text-muted">Now: {plainText(c.from)}</div>
                    <div className="mt-1 text-xs">Suggested: {plainText(c.to)}</div>
                  </div>
                ))}
              </div>
            </details>
            <form action={publishRulebook} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="content" value={suggestion.content} />
              <div className="min-w-64 flex-1">
                <ReasonField placeholder="Reason, for example: align the rulebook with the website rules" />
              </div>
              <button className="btn btn-primary">Publish the suggested update</button>
            </form>
          </div>
        ) : null}
        <form action={publishRulebook} className="space-y-3">
          <textarea name="content" defaultValue={latest?.content} rows={24} className="input font-mono text-xs" />
          <p className="text-xs text-muted">Formatting: # heading, **bold**, - bullet, | table | rows. Publishing creates a new version; teams always see the latest.</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-64 flex-1">
              <ReasonField placeholder="What changed in this version" />
            </div>
            <button className="btn btn-primary">Publish new version</button>
          </div>
        </form>
        {versions.length > 1 ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-accent">Earlier versions</summary>
            <ul className="mt-2 space-y-1 text-sm">
              {versions.slice(1).map((v) => (
                <li key={v.id}>
                  Version {v.version}, {dateTime(v.createdAt)} by {v.createdBy}: {v.note}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Card>
    </>
  );
}

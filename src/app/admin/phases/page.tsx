import { and, desc, eq } from "drizzle-orm";
import { Badge, Card, Empty, Notice, PageTitle, PhaseBadge, ReasonField, sp, type SP } from "@/components/ui";
import { getDb, schema } from "@/db";
import { addPhase, phaseCommand, removeLastPhase, savePhaseSchedule } from "@/server/admin-actions";
import { getAssets, getConfirmedRuns, getPhaseAssetRows, getPhases, openingPrices, settleAutoClose, type RunResult } from "@/server/core";
import { latestPreview, latestRecalculationPreview } from "@/server/phases";
import { dateTime, inr, num, pct, signedInr, tone, duration } from "@/lib/format";

export const metadata = { title: "Phases and round control" };

function Cmd({ phase, command, label, kind = "btn", needReason = true, children }: { phase: number; command: string; label: string; kind?: string; needReason?: boolean; children?: React.ReactNode }) {
  return (
    <form action={phaseCommand} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="phase" value={phase} />
      <input type="hidden" name="command" value={command} />
      {children}
      {needReason ? (
        <div className="min-w-56 flex-1">
          <ReasonField />
        </div>
      ) : null}
      <button className={`btn ${kind}`}>{label}</button>
    </form>
  );
}

export default async function PhasesPage({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const db = getDb();
  await settleAutoClose(db);
  const [phases, assets, runs, teams, recalc] = await Promise.all([getPhases(db), getAssets(db), getConfirmedRuns(db), db.select().from(schema.teams), latestRecalculationPreview(db)]);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const history = await db.select({ id: schema.phaseRuns.id, phase: schema.phaseRuns.phaseNumber, status: schema.phaseRuns.status, kind: schema.phaseRuns.kind, createdAt: schema.phaseRuns.createdAt, confirmedAt: schema.phaseRuns.confirmedAt, confirmedBy: schema.phaseRuns.confirmedBy, reason: schema.phaseRuns.reason }).from(schema.phaseRuns).where(and(eq(schema.phaseRuns.status, "superseded"))).orderBy(desc(schema.phaseRuns.id));

  const cards = await Promise.all(
    phases.map(async (p) => {
      const preview = p.status === "closed" ? await latestPreview(db, p.number) : null;
      const paRows = await getPhaseAssetRows(db, p.number);
      const opening = openingPrices(p.number, assets, paRows, runs, p.status !== "draft");
      return { p, preview, opening };
    }),
  );

  return (
    <>
      <PageTitle title="Phases and round control" sub="Open, pause, extend and close trading; calculate, confirm and publish results. Every action asks for a reason and is written to the audit log." />
      <Notice ok={sp(q.ok)} err={sp(q.err)} />

      {recalc ? (
        <Card title={`Recalculation preview from Phase ${recalc.fromPhase}`} className="mb-4 border-warn/60">
          <p className="mb-3 text-sm text-muted">
            Prepared by {recalc.createdBy} at {dateTime(recalc.createdAt)}. Nothing has changed yet. Current confirmed results stay in force until you confirm below; they will then be kept as superseded snapshots.
          </p>
          {recalc.summaries.map((s) => (
            <div key={s.phase} className="mb-4">
              <div className="mb-2 font-semibold">Phase {s.phase}</div>
              <div className="grid gap-3 lg:grid-cols-2">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th className="text-right">Price now</th>
                      <th className="text-right">After recalculation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.priceChanges.map((c) => (
                      <tr key={c.code} className={c.beforePaise !== c.afterPaise ? "bg-warnsoft/50" : ""}>
                        <td>{c.code}</td>
                        <td className="num text-right">{inr(c.beforePaise)}</td>
                        <td className="num text-right">{inr(c.afterPaise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th className="text-right">Value now</th>
                      <th className="text-right">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.valueChanges.filter((c) => c.beforePaise !== c.afterPaise).slice(0, 15).map((c) => (
                      <tr key={c.team}>
                        <td>{c.team}</td>
                        <td className="num text-right">{inr(c.beforePaise)}</td>
                        <td className="num text-right">{inr(c.afterPaise)}</td>
                      </tr>
                    ))}
                    {s.valueChanges.every((c) => c.beforePaise === c.afterPaise) ? (
                      <tr>
                        <td colSpan={3} className="text-muted">No team values change</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              {s.voidedOrders.length ? <p className="mt-2 text-sm text-down">Orders that no longer pass the rules and will be voided: {s.voidedOrders.map((v) => `${v.team} (${v.problems.join("; ")})`).join(", ")}</p> : null}
              {s.newlyDisqualified.length ? <p className="mt-1 text-sm text-down">Newly disqualified: {s.newlyDisqualified.join(", ")}</p> : null}
              {s.reinstated.length ? <p className="mt-1 text-sm text-up">No longer disqualified: {s.reinstated.join(", ")}</p> : null}
            </div>
          ))}
          <form action={phaseCommand} className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
            <input type="hidden" name="phase" value={recalc.fromPhase} />
            <input type="hidden" name="command" value="recalc_confirm" />
            <input type="hidden" name="batchId" value={recalc.batchId} />
            <div className="min-w-64 flex-1">
              <ReasonField />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="acknowledge" required /> I have checked the changes above
            </label>
            <button className="btn btn-danger">Confirm recalculation</button>
          </form>
          <form action={phaseCommand} className="mt-2">
            <input type="hidden" name="phase" value={recalc.fromPhase} />
            <input type="hidden" name="command" value="recalc_discard" />
            <button className="btn btn-sm">Discard preview</button>
          </form>
        </Card>
      ) : null}

      <div className="space-y-4">
        {cards.map(({ p, preview, opening }) => {
          const res = preview?.result as RunResult | undefined;
          return (
            <Card
              key={p.number}
              title={
                <span className="flex items-center gap-3">
                  {p.name} <PhaseBadge status={p.status} />
                  {p.needsRecalculation ? <Badge kind="warn">Settings changed after confirmation</Badge> : null}
                </span>
              }
            >
              <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
                <div className="space-y-3 text-sm">
                  <div className="text-muted">
                    {p.allowSell ? "Buy and sell" : "Buy only"} · minimum {p.minDistinctAssets} assets · {duration(p.durationSeconds)}
                    {p.opensAt ? ` · opened ${dateTime(p.opensAt)}` : ""}
                    {p.closesAt && p.status === "open" ? ` · closes ${dateTime(p.closesAt)}` : ""}
                    {p.status === "paused" && p.pausedRemainingMs != null ? ` · ${Math.round(p.pausedRemainingMs / 1000)} seconds left when resumed` : ""}
                  </div>
                  {p.status === "draft" ? (
                    <form action={savePhaseSchedule} className="grid gap-2 sm:grid-cols-3">
                      <input type="hidden" name="phase" value={p.number} />
                      <label>
                        <span className="label">Name</span>
                        <input name="name" defaultValue={p.name} className="input" />
                      </label>
                      <label>
                        <span className="label">Minutes</span>
                        <input name="minutes" defaultValue={p.durationSeconds / 60} className="input" inputMode="decimal" />
                      </label>
                      <label>
                        <span className="label">Planned start (India time)</span>
                        <input name="scheduledAt" type="datetime-local" className="input" />
                      </label>
                      <div className="sm:col-span-2">
                        <ReasonField />
                      </div>
                      <button className="btn">Save schedule</button>
                    </form>
                  ) : null}

                  {p.status === "draft" ? <Cmd phase={p.number} command="open" label={`Open ${p.name} and start the clock`} kind="btn-primary" /> : null}
                  {p.status === "open" ? (
                    <>
                      <Cmd phase={p.number} command="extend" label="Add time">
                        <input name="minutes" defaultValue="2" className="input w-20" inputMode="numeric" aria-label="Minutes to add" />
                      </Cmd>
                      <Cmd phase={p.number} command="pause" label="Pause trading" />
                      <Cmd phase={p.number} command="close" label="Close now" kind="btn-danger" />
                    </>
                  ) : null}
                  {p.status === "paused" ? (
                    <>
                      <p className="rounded-lg border border-warn/40 bg-warnsoft p-2 text-warn">Trading is paused. You may change this phase&apos;s rules now; on resume every accepted order is checked again and any that fail are voided.</p>
                      <Cmd phase={p.number} command="resume" label="Resume trading" kind="btn-primary" />
                      <Cmd phase={p.number} command="extend" label="Add time">
                        <input name="minutes" defaultValue="2" className="input w-20" inputMode="numeric" aria-label="Minutes to add" />
                      </Cmd>
                      <Cmd phase={p.number} command="close" label="Close now" kind="btn-danger" />
                    </>
                  ) : null}
                  {p.status === "closed" ? <Cmd phase={p.number} command="preview" label={preview ? "Recalculate preview" : "Calculate results preview"} kind="btn-primary" needReason={false} /> : null}
                  {p.status === "confirmed" ? (
                    <>
                      <Cmd phase={p.number} command="publish" label="Publish results and leaderboard" kind="btn-primary" />
                      <Cmd phase={p.number} command="recalc_preview" label="Preview a recalculation from this phase" needReason={false} />
                    </>
                  ) : null}
                  {p.status === "published" ? (
                    <>
                      <Cmd phase={p.number} command="unpublish" label="Hide results from teams" />
                      {p.number !== phases.at(-1)?.number ? <Cmd phase={p.number} command="recalc_preview" label="Preview a recalculation from this phase" needReason={false} /> : null}
                    </>
                  ) : null}
                </div>

                <div>
                  <div className="label">{p.status === "draft" ? "Opening prices if opened now" : "Opening prices"}</div>
                  <div className="overflow-x-auto">
                    <table className="tbl">
                      <tbody>
                        {assets.map((a) => (
                          <tr key={a.id}>
                            <td className="font-semibold">{a.code}</td>
                            <td className="num text-right">{opening.get(a.id) == null ? <span className="text-muted">After Phase {p.number - 1} is confirmed</span> : inr(opening.get(a.id)!)}</td>
                            <td className="text-xs text-muted">{a.quoteUnit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {res ? (
                <div className="mt-4 border-t border-line pt-4">
                  <div className="mb-2 font-semibold">Results preview (not visible to teams)</div>
                  <div className="overflow-x-auto">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Asset</th>
                          <th className="text-right">Bought</th>
                          <th className="text-right">Sold</th>
                          <th className="text-right">Supply</th>
                          <th className="text-right">Fill</th>
                          <th className="text-right">News effect</th>
                          <th className="text-right">Demand effect</th>
                          <th className="text-right">Applied</th>
                          <th className="text-right">Opening</th>
                          <th className="text-right">New price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {res.assets.map((a) => (
                          <tr key={a.assetId}>
                            <td className="font-semibold">{a.code}</td>
                            <td className="num text-right">{num(a.buyLots)}</td>
                            <td className="num text-right">{num(a.sellLots)}</td>
                            <td className="num text-right">{num(a.supply)}</td>
                            <td className="num text-right">{(Number(a.fillRatio) * 100).toFixed(1)}%</td>
                            <td className={`num text-right ${tone(a.newsEffect)}`}>{pct(a.newsEffect)}</td>
                            <td className={`num text-right ${tone(a.demandEffect)}`}>{pct(a.demandEffect)}</td>
                            <td className={`num text-right font-semibold ${tone(a.appliedChange)}`}>{pct(a.appliedChange)}</td>
                            <td className="num text-right">{inr(a.openingPricePaise)}</td>
                            <td className="num text-right">{inr(a.newPricePaise)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {res.shortfallTeamIds.length ? (
                    <p className="mt-3 rounded-lg border border-down/40 bg-downsoft p-2 text-sm text-down">
                      Below the minimum of {p.minDistinctAssets} executed trades (disqualified on confirmation{teams.length ? "" : ""}): {res.shortfallTeamIds.map((id) => teamName.get(id)).join(", ")}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-up">Every team meets the minimum trade requirement.</p>
                  )}
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-accent">Team values in this preview</summary>
                    <table className="tbl mt-2">
                      <thead>
                        <tr>
                          <th>Team</th>
                          <th className="text-right">Trades executed</th>
                          <th className="text-right">Value</th>
                          <th className="text-right">Phase profit and loss</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...res.teams].sort((a, b) => b.valuePaise - a.valuePaise).map((t) => (
                          <tr key={t.teamId} className={t.meetsMinimum ? "" : "bg-downsoft/50"}>
                            <td>{teamName.get(t.teamId)}</td>
                            <td className="num text-right">{t.tradesExecuted}</td>
                            <td className="num text-right">{inr(t.valuePaise)}</td>
                            <td className={`num text-right ${tone(t.phasePnlPaise)}`}>{signedInr(t.phasePnlPaise)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                  <form action={phaseCommand} className="mt-3 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="phase" value={p.number} />
                    <input type="hidden" name="command" value="confirm" />
                    <input type="hidden" name="runId" value={preview!.id} />
                    <div className="min-w-64 flex-1">
                      <ReasonField />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="acknowledge" required /> I have reviewed these results
                    </label>
                    <button className="btn btn-primary">Confirm results</button>
                  </form>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Number of phases">
          <form action={addPhase} className="flex flex-wrap items-end gap-2">
            <div className="min-w-56 flex-1">
              <ReasonField />
            </div>
            <button className="btn">Add a phase</button>
          </form>
          <form action={removeLastPhase} className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-56 flex-1">
              <ReasonField />
            </div>
            <button className="btn btn-danger">Remove the last phase (only if not opened)</button>
          </form>
        </Card>
        <Card title="Superseded snapshots">
          {history.length === 0 ? (
            <Empty>No recalculations yet. Each recalculation keeps the earlier results here.</Empty>
          ) : (
            <ul className="space-y-1 text-sm">
              {history.map((h) => (
                <li key={h.id}>
                  Phase {h.phase} run {h.id}, confirmed {dateTime(h.confirmedAt)} by {h.confirmedBy}. {h.reason}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

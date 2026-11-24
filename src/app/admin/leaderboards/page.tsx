import Link from "next/link";
import { Card, Empty, PageTitle, PhaseBadge, sp, type SP } from "@/components/ui";
import { getDb, schema } from "@/db";
import { inr, pct, tone } from "@/lib/format";
import { getConfirmedRuns, getPhases } from "@/server/core";
import { leaderboard } from "@/server/views";

export const metadata = { title: "Leaderboards" };

export default async function LeaderboardsAdmin({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const db = getDb();
  const [phases, runs, teams] = await Promise.all([getPhases(db), getConfirmedRuns(db), db.select().from(schema.teams)]);
  const confirmed = phases.filter((p) => runs.has(p.number));
  const n = Number(sp(q.phase) ?? confirmed.at(-1)?.number ?? 0);
  const p = phases.find((x) => x.number === n);
  const board = n ? leaderboard(n, phases, runs, teams, true) : null;
  const dq = teams.filter((t) => t.status === "disqualified" && (t.disqualifiedPhase ?? 0) <= n);
  return (
    <>
      <PageTitle title="Leaderboards" sub="Every confirmed leaderboard, published or not. Teams only see published ones. Publish from the Phases page." />
      <div className="mb-3 flex flex-wrap gap-2">
        {confirmed.map((x) => (
          <Link key={x.number} href={`/admin/leaderboards?phase=${x.number}`} className={`btn btn-sm ${x.number === n ? "border-accent text-accent" : ""}`}>
            {x.number === phases.at(-1)?.number ? "Final" : `After ${x.name}`}
          </Link>
        ))}
      </div>
      {!board || !p ? (
        <Empty>Leaderboards appear after a phase is confirmed.</Empty>
      ) : (
        <Card title={<span className="flex items-center gap-2">After {p.name} <PhaseBadge status={p.status} /></span>} pad={false}>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th className="text-right">Portfolio value</th>
                  <th className="text-right">Cash</th>
                  <th className="text-right">Holdings</th>
                  <th className="text-right">Phase return</th>
                  <th className="text-right">Overall return</th>
                  <th className="text-right">Tie-break: previous value</th>
                </tr>
              </thead>
              <tbody>
                {board.map((r) => (
                  <tr key={r.teamId}>
                    <td className="num font-semibold">{r.rank}</td>
                    <td>{r.name}</td>
                    <td className="num text-right">{inr(r.valuePaise)}</td>
                    <td className="num text-right">{inr(r.cashPaise)}</td>
                    <td className="num text-right">{inr(r.holdingsPaise)}</td>
                    <td className={`num text-right ${tone(r.phaseReturn)}`}>{pct(r.phaseReturn)}</td>
                    <td className={`num text-right ${tone(r.overallReturn)}`}>{pct(r.overallReturn)}</td>
                    <td className="num text-right text-muted">{r.previousValuePaise == null ? "" : inr(r.previousValuePaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {dq.length ? (
            <div className="border-t border-line p-4 text-sm">
              <div className="font-semibold text-down">Excluded (disqualified)</div>
              <ul className="mt-1 space-y-1 text-muted">
                {dq.map((t) => (
                  <li key={t.id}>
                    {t.name}: Phase {t.disqualifiedPhase}, {t.disqualifiedReason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      )}
    </>
  );
}

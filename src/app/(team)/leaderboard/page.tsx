import Link from "next/link";
import { Card, Empty, PageTitle, sp, type SP } from "@/components/ui";
import { requireTeam } from "@/lib/auth";
import { inr, pct, tone } from "@/lib/format";
import { marketSnapshot, publishedLeaderboard } from "@/server/views";

export const metadata = { title: "Leaderboard" };

export default async function Leaderboard({ searchParams }: { searchParams: SP }) {
  const user = await requireTeam();
  const q = await searchParams;
  const m = await marketSnapshot();
  const published = m.phases.filter((p) => p.status === "published");
  const chosen = Number(sp(q.phase) ?? published.at(-1)?.number ?? 0);
  const board = chosen ? await publishedLeaderboard(chosen) : null;
  const isFinal = chosen === m.phases.at(-1)?.number;
  return (
    <>
      <PageTitle title="Leaderboard" sub="Published by the organisers after each phase. Ranked by total portfolio value; ties are broken as the rulebook sets out." />
      {published.length === 0 ? (
        <Empty>The first leaderboard appears after Phase 1 results are published.</Empty>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {published.map((p) => (
              <Link key={p.number} href={`/leaderboard?phase=${p.number}`} className={`btn btn-sm ${p.number === chosen ? "border-accent text-accent" : ""}`}>
                {p.number === m.phases.at(-1)?.number ? "Final" : `After ${p.name}`}
              </Link>
            ))}
          </div>
          <Card title={isFinal ? "Final leaderboard" : `Leaderboard after Phase ${chosen}`} pad={false}>
            {!board ? (
              <div className="p-4">
                <Empty>Not published.</Empty>
              </div>
            ) : (
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
                    </tr>
                  </thead>
                  <tbody>
                    {board.map((r) => (
                      <tr key={r.teamId} className={r.teamId === user.teamId ? "bg-accentsoft" : ""}>
                        <td className="num font-semibold">{r.rank}</td>
                        <td className={r.teamId === user.teamId ? "font-semibold" : ""}>{r.name}{r.teamId === user.teamId ? " (you)" : ""}</td>
                        <td className="num text-right">{inr(r.valuePaise)}</td>
                        <td className="num text-right">{inr(r.cashPaise)}</td>
                        <td className="num text-right">{inr(r.holdingsPaise)}</td>
                        <td className={`num text-right ${tone(r.phaseReturn)}`}>{pct(r.phaseReturn)}</td>
                        <td className={`num text-right ${tone(r.overallReturn)}`}>{pct(r.overallReturn)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}

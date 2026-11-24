import Link from "next/link";
import { AdminLive } from "@/components/admin-live";
import { Card, Empty, PageTitle, sp, type SP } from "@/components/ui";
import { getDb, schema } from "@/db";
import { inr, num, pct, tone } from "@/lib/format";
import { getConfirmedRuns, getPhases } from "@/server/core";

export const metadata = { title: "Market analytics" };

export default async function Analytics({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const db = getDb();
  const [phases, runs, teams, orders] = await Promise.all([getPhases(db), getConfirmedRuns(db), db.select().from(schema.teams), db.select().from(schema.orders)]);
  const confirmed = phases.filter((p) => runs.has(p.number));
  const n = Number(sp(q.phase) ?? confirmed.at(-1)?.number ?? 0);
  const run = runs.get(n);
  return (
    <>
      <PageTitle title="Market analytics" sub="Confidential organiser view: demand, supply, effects and calculated prices." />
      <Card title="Running phase (live projection)" className="mb-4">
        <AdminLive />
      </Card>
      <div className="mb-3 flex flex-wrap gap-2">
        {confirmed.map((p) => (
          <Link key={p.number} href={`/admin/analytics?phase=${p.number}`} className={`btn btn-sm ${p.number === n ? "border-accent text-accent" : ""}`}>
            {p.name} results
          </Link>
        ))}
      </div>
      {!run ? (
        <Empty>Confirmed results appear here after a phase is confirmed.</Empty>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="card px-4 py-3">
              <div className="text-xs uppercase text-muted">Registered teams</div>
              <div className="num text-xl font-semibold">{teams.length}</div>
            </div>
            <div className="card px-4 py-3">
              <div className="text-xs uppercase text-muted">Teams in phase</div>
              <div className="num text-xl font-semibold">{run.result.teams.length}</div>
            </div>
            <div className="card px-4 py-3">
              <div className="text-xs uppercase text-muted">Orders submitted / executed</div>
              <div className="num text-xl font-semibold">
                {orders.filter((o) => o.phaseNumber === n).length} / {run.inputs.orders.length}
              </div>
            </div>
            <div className="card px-4 py-3">
              <div className="text-xs uppercase text-muted">Below minimum</div>
              <div className="num text-xl font-semibold text-down">{run.result.shortfallTeamIds.length}</div>
            </div>
          </div>
          <Card title={`Phase ${n}: demand, supply and price formation`} pad={false}>
            <div className="overflow-x-auto">
              <table className="tbl min-w-[1100px]">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th className="text-right">Opening</th>
                    <th className="text-right">Buy lots</th>
                    <th className="text-right">Sell lots</th>
                    <th className="text-right">Net</th>
                    <th className="text-right">Supply</th>
                    <th className="text-right">Net to supply</th>
                    <th className="text-right">Fill ratio</th>
                    <th className="text-right">Score</th>
                    <th className="text-right">News effect</th>
                    <th className="text-right">Demand effect</th>
                    <th className="text-right">Combined</th>
                    <th className="text-right">Applied</th>
                    <th className="text-right">Next price</th>
                  </tr>
                </thead>
                <tbody>
                  {run.result.assets.map((a) => (
                    <tr key={a.assetId}>
                      <td className="font-semibold">{a.code}</td>
                      <td className="num text-right">{inr(a.openingPricePaise)}</td>
                      <td className="num text-right">{num(a.buyLots)}</td>
                      <td className="num text-right">{num(a.sellLots)}</td>
                      <td className="num text-right">{num(a.netDemand)}</td>
                      <td className="num text-right">{num(a.supply)}</td>
                      <td className="num text-right">{Number(a.demandRatio).toFixed(4)}</td>
                      <td className="num text-right">{(Number(a.fillRatio) * 100).toFixed(2)}%</td>
                      <td className="num text-right">{a.newsScore}</td>
                      <td className={`num text-right ${tone(a.newsEffect)}`}>{pct(a.newsEffect)}</td>
                      <td className={`num text-right ${tone(a.demandEffect)}`}>{pct(a.demandEffect)}</td>
                      <td className={`num text-right ${tone(a.combinedEffect)}`}>{pct(a.combinedEffect)}</td>
                      <td className={`num text-right font-semibold ${tone(a.appliedChange)}`}>{pct(a.appliedChange)}</td>
                      <td className="num text-right">{inr(a.newPricePaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}

import { AllocationChart, ValueChart } from "@/components/charts";
import { Card, Empty, PageTitle, Stat } from "@/components/ui";
import { requireTeam } from "@/lib/auth";
import { inr, num, pct, signedInr, tone } from "@/lib/format";
import { teamView } from "@/server/views";

export const metadata = { title: "Portfolio" };

export default async function Portfolio() {
  const user = await requireTeam();
  const v = await teamView(user.teamId);
  const pos = v.holdingPosition;
  const holdings = v.rows
    .map((r) => {
      const lots = pos.lots[r.asset.id] ?? 0;
      const avg = v.avgCost.get(r.asset.id) ?? null;
      const value = lots * r.lotPricePaise;
      return { r, lots, avg, value, pnl: avg != null ? lots * (r.lotPricePaise - avg) : null };
    })
    .filter((h) => h.lots > 0);
  const total = v.valueNowPaise;
  const alloc = [...holdings.map((h) => ({ name: h.r.asset.code, rupees: h.value / 100 })), { name: "Cash", rupees: pos.cashPaise / 100 }].filter((d) => d.rupees > 0);
  const progression = [{ label: "Start", rupees: v.comp.startingCapitalPaise / 100 }, ...v.performance.map((p) => ({ label: p.name, rupees: p.valuePaise / 100 }))];
  const pending = v.liveOrder && v.current && (v.current.status === "open" || v.current.status === "paused" || v.current.status === "closed");
  return (
    <>
      <PageTitle title="Portfolio" sub="Holdings valued at the latest public prices. Prices change only when a phase's results are published or the next phase opens." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total value" value={inr(total)} />
        <Stat label="Cash" value={inr(pos.cashPaise)} sub={`${((pos.cashPaise / Math.max(1, total)) * 100).toFixed(1)}% of portfolio`} />
        <Stat label="Holdings value" value={inr(total - pos.cashPaise)} />
        <Stat label="Overall return" value={pct((total - v.comp.startingCapitalPaise) / v.comp.startingCapitalPaise)} valueClass={tone(total - v.comp.startingCapitalPaise)} />
      </div>
      {pending ? (
        <div className="mt-4 rounded-lg border border-accent/40 bg-accentsoft p-3 text-sm text-accent">
          Your accepted {v.current!.name} order executes when the phase is processed. The holdings below are before that order.
        </div>
      ) : null}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card title="Holdings" pad={false}>
          {holdings.length === 0 ? (
            <div className="p-4">
              <Empty>No holdings yet. All {inr(pos.cashPaise)} is in cash.</Empty>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th className="text-right">Lots</th>
                    <th className="text-right">Average cost per lot</th>
                    <th className="text-right">Price per lot</th>
                    <th className="text-right">Market value</th>
                    <th className="text-right">Unrealised profit and loss</th>
                    <th className="text-right">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => (
                    <tr key={h.r.asset.id}>
                      <td>
                        <div className="font-semibold">{h.r.asset.code}</div>
                        <div className="text-xs text-muted">{h.r.asset.name}</div>
                      </td>
                      <td className="num text-right">{num(h.lots)}</td>
                      <td className="num text-right">{h.avg == null ? "" : inr(h.avg)}</td>
                      <td className="num text-right">{inr(h.r.lotPricePaise)}</td>
                      <td className="num text-right">{inr(h.value)}</td>
                      <td className={`num text-right ${h.pnl == null ? "" : tone(h.pnl)}`}>{h.pnl == null ? "" : signedInr(h.pnl)}</td>
                      <td className="num text-right">{((h.value / Math.max(1, total)) * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Allocation">{alloc.length ? <AllocationChart data={alloc} /> : <Empty>Nothing to show yet.</Empty>}</Card>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Portfolio value by phase">
          {progression.length > 1 ? <ValueChart data={progression} /> : <Empty>The chart fills in as each phase is published.</Empty>}
        </Card>
        <Card title="What drove each phase" pad={false}>
          {v.contributions.length === 0 ? (
            <div className="p-4">
              <Empty>Contribution by asset appears after each phase is published.</Empty>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Asset</th>
                    {v.contributions.map((c) => (
                      <th key={c.phase} className="text-right">
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {v.rows
                    .filter((r) => v.contributions.some((c) => (c.byAsset[r.asset.id] ?? 0) !== 0))
                    .map((r) => (
                      <tr key={r.asset.id}>
                        <td className="font-semibold">{r.asset.code}</td>
                        {v.contributions.map((c) => (
                          <td key={c.phase} className={`num text-right ${tone(c.byAsset[r.asset.id] ?? 0)}`}>
                            {c.byAsset[r.asset.id] ? signedInr(c.byAsset[r.asset.id]) : ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

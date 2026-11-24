import Link from "next/link";
import { notFound } from "next/navigation";
import { PriceChart } from "@/components/charts";
import { Card, Empty, PageTitle, Stat } from "@/components/ui";
import { requireTeam } from "@/lib/auth";
import { inr, num, pct, tone } from "@/lib/format";
import { teamView } from "@/server/views";

export default async function AssetPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireTeam();
  const v = await teamView(user.teamId);
  const row = v.rows.find((r) => r.asset.code === code.toUpperCase());
  if (!row) notFound();
  const a = row.asset;
  const held = v.holdingPosition.lots[a.id] ?? 0;
  const cur = v.current;
  return (
    <>
      <PageTitle
        title={`${a.name} (${a.code})`}
        sub={`${a.sector || a.assetType} · ${a.lotDefinition} · quoted ${a.quoteUnit}`}
        actions={
          cur?.status === "open" && v.participating ? (
            <>
              <Link href={`/trade?asset=${a.code}&side=buy`} className="btn btn-primary">Buy</Link>
              {cur.allowSell && held > 0 ? <Link href={`/trade?asset=${a.code}&side=sell`} className="btn btn-danger">Sell</Link> : null}
            </>
          ) : null
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Price" value={inr(row.pricePaise)} sub={a.quoteUnit} />
        <Stat label="Price per lot" value={inr(row.lotPricePaise)} sub={a.lotDefinition} />
        <Stat label="Change" value={row.previousPricePaise == null ? "" : pct(row.changeFraction)} valueClass={tone(row.changeFraction)} sub={row.previousPricePaise == null ? "No earlier price" : `From ${inr(row.previousPricePaise)}`} />
        <Stat label="You hold" value={`${num(held)} lots`} sub={held ? `Worth ${inr(held * row.lotPricePaise)}` : ""} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Price across phases">
          {row.history.length > 1 ? <PriceChart data={row.history.map((h) => ({ label: h.label, rupees: h.pricePaise / 100 }))} /> : <Empty>The price path builds up as phases open and results are published.</Empty>}
        </Card>
        <Card title="Company profile">
          {a.profile || a.description ? (
            <div className="space-y-3 text-sm leading-relaxed">
              {a.profile ? <p>{a.profile}</p> : null}
              {a.description ? <p className="text-muted">{a.description}</p> : null}
            </div>
          ) : (
            <Empty>The organisers have not added a profile for this asset yet.</Empty>
          )}
        </Card>
      </div>
      <Card title="Published phase results" className="mt-4" pad={false}>
        {row.results.length === 0 ? (
          <div className="p-4">
            <Empty>Results appear here after the organisers publish each phase.</Empty>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Phase</th>
                  <th className="text-right">Opening</th>
                  <th className="text-right">Result</th>
                  <th className="text-right">Change</th>
                  {row.results.some((r) => r.buyLots !== null) ? (
                    <>
                      <th className="text-right">Lots bought</th>
                      <th className="text-right">Lots sold</th>
                    </>
                  ) : null}
                  {row.results.some((r) => r.supply !== null) ? <th className="text-right">Supply</th> : null}
                </tr>
              </thead>
              <tbody>
                {row.results.map((r) => {
                  const ch = (r.closingPricePaise - r.openingPricePaise) / r.openingPricePaise;
                  return (
                    <tr key={r.phase}>
                      <td>Phase {r.phase}</td>
                      <td className="num text-right">{inr(r.openingPricePaise)}</td>
                      <td className="num text-right">{inr(r.closingPricePaise)}</td>
                      <td className={`num text-right ${tone(ch)}`}>{pct(ch)}</td>
                      {r.buyLots !== null ? (
                        <>
                          <td className="num text-right">{num(r.buyLots)}</td>
                          <td className="num text-right">{num(r.sellLots)}</td>
                        </>
                      ) : null}
                      {r.supply !== null ? <td className="num text-right">{num(r.supply)}</td> : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

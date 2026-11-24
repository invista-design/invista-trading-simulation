import { Badge, Card, Empty, PageTitle } from "@/components/ui";
import { requireTeam } from "@/lib/auth";
import { dateTime, inr, num } from "@/lib/format";
import { teamView } from "@/server/views";

export const metadata = { title: "Orders" };

export default async function Orders() {
  const user = await requireTeam();
  const v = await teamView(user.teamId);
  const code = new Map(v.rows.map((r) => [r.asset.id, r.asset.code]));
  return (
    <>
      <PageTitle title="Orders" sub="Every order your team submitted. Only the last accepted order in each phase executes; earlier ones show as replaced." />
      {v.myResults.length ? (
        <Card title="Executed trades" className="mb-4" pad={false}>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Phase</th>
                  <th>Asset</th>
                  <th>Side</th>
                  <th className="text-right">Lots requested</th>
                  <th className="text-right">Lots executed</th>
                  <th className="text-right">Price per lot</th>
                  <th className="text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {v.myResults.flatMap((r) =>
                  Object.entries(r.orderLines).map(([assetId, req]) => {
                    const ex = r.executedLines[assetId] ?? 0;
                    const price = r.openingLotPrices[assetId] ?? 0;
                    return (
                      <tr key={`${r.phase}-${assetId}`}>
                        <td>{r.name}</td>
                        <td className="font-semibold">{code.get(assetId)}</td>
                        <td className={req > 0 ? "text-up" : "text-down"}>{req > 0 ? "Buy" : "Sell"}</td>
                        <td className="num text-right">{num(Math.abs(req))}</td>
                        <td className="num text-right">
                          {num(Math.abs(ex))}
                          {Math.abs(ex) !== Math.abs(req) ? <span className="ml-1 text-xs text-warn">rationed</span> : null}
                        </td>
                        <td className="num text-right">{inr(price)}</td>
                        <td className="num text-right">{inr(Math.abs(ex) * price)}</td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
      <Card title="Submissions" pad={false}>
        {v.orders.length === 0 ? (
          <div className="p-4">
            <Empty>No orders submitted yet.</Empty>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Phase</th>
                  <th>Submitted</th>
                  <th>Trades</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {v.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="font-mono text-xs">{o.id.slice(0, 8).toUpperCase()}</td>
                    <td>Phase {o.phaseNumber}</td>
                    <td className="num">{dateTime(o.submittedAt)}</td>
                    <td className="text-xs">
                      {Object.entries(o.lines).map(([id, q]) => (
                        <span key={id} className={`mr-2 inline-block ${q > 0 ? "text-up" : "text-down"}`}>
                          {q > 0 ? "Buy" : "Sell"} {num(Math.abs(q))} {code.get(id)}
                        </span>
                      ))}
                    </td>
                    <td>
                      <Badge kind={o.status === "live" ? "up" : o.status === "voided" ? "down" : "muted"}>{o.status === "live" ? "Accepted" : o.status === "voided" ? "Voided" : "Replaced"}</Badge>
                      {o.voidReason ? <div className="mt-1 max-w-xs text-xs text-down">{o.voidReason}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

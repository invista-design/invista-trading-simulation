import { desc, eq } from "drizzle-orm";
import { Badge, Card, Empty, Notice, PageTitle, ReasonField, sp, type SP } from "@/components/ui";
import { getDb, schema } from "@/db";
import { dateTime, num } from "@/lib/format";
import { enterOrderForTeam } from "@/server/admin-actions";
import { currentPhase, getAssets, getPhases } from "@/server/core";

export const metadata = { title: "Orders" };

export default async function OrdersAdmin({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const db = getDb();
  const phases = await getPhases(db);
  const cur = currentPhase(phases);
  const n = Number(sp(q.phase) ?? cur?.number ?? 1);
  const [assets, teams, orders, attempts] = await Promise.all([
    getAssets(db),
    db.select().from(schema.teams),
    db.select().from(schema.orders).where(eq(schema.orders.phaseNumber, n)).orderBy(desc(schema.orders.submittedAt)),
    db.select().from(schema.orderAttempts).where(eq(schema.orderAttempts.phaseNumber, n)).orderBy(desc(schema.orderAttempts.at)).limit(200),
  ]);
  const name = new Map(teams.map((t) => [t.id, t.name]));
  const code = new Map(assets.map((a) => [a.id, a.code]));
  return (
    <>
      <PageTitle title="Orders" sub="Every submission, including replaced and voided ones, and every attempt the server refused." />
      <Notice ok={sp(q.ok)} err={sp(q.err)} />
      <div className="mb-4 flex flex-wrap gap-2">
        {phases.map((p) => (
          <a key={p.number} href={`/admin/orders?phase=${p.number}`} className={`btn btn-sm ${p.number === n ? "border-accent text-accent" : ""}`}>
            {p.name}
          </a>
        ))}
      </div>
      <Card title={`Submissions in Phase ${n} (${orders.length})`} pad={false}>
        {orders.length === 0 ? (
          <div className="p-4">
            <Empty>No orders yet.</Empty>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Team</th>
                  <th>Trades</th>
                  <th>Source</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="num">{dateTime(o.submittedAt)}</td>
                    <td>{name.get(o.teamId)}</td>
                    <td className="text-xs">
                      {Object.entries(o.lines).map(([id, l]) => (
                        <span key={id} className={`mr-2 inline-block ${l > 0 ? "text-up" : "text-down"}`}>
                          {l > 0 ? "Buy" : "Sell"} {num(Math.abs(l))} {code.get(id)}
                        </span>
                      ))}
                      {o.rationale ? <div className="text-muted">Note: {o.rationale}</div> : null}
                    </td>
                    <td className="text-xs">{o.source === "organiser" ? "Entered by organiser" : "Website"}</td>
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
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title={`Refused attempts in Phase ${n} (${attempts.length})`} pad={false}>
          {attempts.length === 0 ? (
            <div className="p-4">
              <Empty>None. The terminal blocks most invalid orders before they reach the server.</Empty>
            </div>
          ) : (
            <div className="max-h-96 overflow-auto">
              <table className="tbl">
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.id}>
                      <td className="num text-xs">{dateTime(a.at)}</td>
                      <td>{name.get(a.teamId)}</td>
                      <td className="text-xs text-down">{a.issues.map((i) => i.message).join("; ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Enter an order for a team">
          <p className="mb-3 text-sm text-muted">For a proven technical failure only. The order goes through the same checks and is recorded with your name and reason. Positive lots buy, negative lots sell.</p>
          <form action={enterOrderForTeam} className="space-y-3">
            <input type="hidden" name="phase" value={n} />
            <select name="teamId" required className="input">
              <option value="">Choose a team</option>
              {teams
                .filter((t) => t.status === "active")
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {assets.map((a) => (
                <label key={a.id}>
                  <span className="label">{a.code}</span>
                  <input name={`lots_${a.id}`} className="input" inputMode="numeric" />
                </label>
              ))}
            </div>
            <ReasonField />
            <button className="btn btn-primary">Submit order for team</button>
          </form>
        </Card>
      </div>
    </>
  );
}

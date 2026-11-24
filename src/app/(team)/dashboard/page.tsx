import Link from "next/link";
import { Badge, Card, Empty, PageTitle, PhaseBadge, Stat } from "@/components/ui";
import { requireTeam } from "@/lib/auth";
import { dateTime, inr, pct, signedInr, tone, duration } from "@/lib/format";
import { publicAnnouncements, teamView } from "@/server/views";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const user = await requireTeam();
  const v = await teamView(user.teamId);
  const ann = await publicAnnouncements(undefined, 5);
  const cur = v.current;
  const invested = v.valueNowPaise - v.holdingPosition.cashPaise;
  const overall = (v.valueNowPaise - v.comp.startingCapitalPaise) / v.comp.startingCapitalPaise;
  const liveAssets = v.liveOrder ? Object.keys(v.liveOrder.lines).length : 0;
  const tradingPhase = cur && (cur.status === "open" || cur.status === "paused" || cur.status === "draft");
  return (
    <>
      <PageTitle
        title={v.team.name}
        sub={v.team.members.length ? v.team.members.join(", ") : "Members not listed"}
        actions={
          cur && cur.status === "open" && v.participating ? (
            <Link href="/trade" className="btn btn-primary">
              Open trading terminal
            </Link>
          ) : null
        }
      />
      {v.team.status === "disqualified" ? (
        <div className="mb-4 rounded-lg border border-down/40 bg-downsoft p-4 text-sm text-down">
          <div className="font-semibold">Your team is disqualified</div>
          <div>{v.team.disqualifiedReason}. Contact the organisers within 10 minutes of the leaderboard if you believe this is wrong.</div>
        </div>
      ) : null}
      {cur && tradingPhase && v.participating ? (
        <div className={`mb-4 rounded-lg border p-4 text-sm ${liveAssets >= cur.minDistinctAssets ? "border-up/40 bg-upsoft text-up" : "border-down/40 bg-downsoft text-down"}`}>
          {liveAssets >= cur.minDistinctAssets ? (
            <>
              <span className="font-semibold">Minimum trade requirement met for {cur.name}.</span> Your accepted order trades {liveAssets} assets (submitted {dateTime(v.liveOrder!.submittedAt)}).
            </>
          ) : (
            <>
              <span className="font-semibold">Action needed:</span> every team must trade at least {cur.minDistinctAssets} different assets in {cur.name}. You have no accepted order yet. Teams without one are disqualified when the phase is confirmed.
            </>
          )}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Portfolio value" value={inr(v.valueNowPaise)} sub="Cash plus holdings at latest public prices" />
        <Stat label="Cash" value={inr(v.holdingPosition.cashPaise)} />
        <Stat label="Invested" value={inr(invested)} />
        <Stat label="Overall return" value={pct(overall)} valueClass={tone(overall)} sub={`On ${inr(v.comp.startingCapitalPaise, false)} starting capital`} />
        <Stat label="Rank" value={v.myRank ? `#${v.myRank}` : "Not yet"} sub={v.board ? `of ${v.board.length} after the last published phase` : "Published after each phase"} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Phases" className="lg:col-span-1">
          <ul className="space-y-3 text-sm">
            {v.phases.map((p) => {
              const perf = v.performance.find((x) => x.phase === p.number);
              return (
                <li key={p.number} className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted">{p.allowSell ? "Buy and sell" : "Buy only"} · {duration(p.durationSeconds)}</div>
                  </div>
                  <div className="text-right">
                    <PhaseBadge status={p.status} />
                    {perf ? <div className={`num mt-1 text-xs ${tone(perf.phaseReturn)}`}>{pct(perf.phaseReturn)} in this phase</div> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card title="Recent orders" actions={<Link className="text-xs text-accent" href="/orders">All orders</Link>}>
          {v.orders.length === 0 ? (
            <Empty>No orders yet.</Empty>
          ) : (
            <ul className="space-y-2 text-sm">
              {v.orders.slice(0, 5).map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2">
                  <span>
                    Phase {o.phaseNumber} · {Object.keys(o.lines).length} assets
                    <span className="block text-xs text-muted">{dateTime(o.submittedAt)}</span>
                  </span>
                  <Badge kind={o.status === "live" ? "up" : o.status === "voided" ? "down" : "muted"}>{o.status === "live" ? "Accepted" : o.status === "voided" ? "Voided" : "Replaced"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Announcements" actions={<Link className="text-xs text-accent" href="/news">All news</Link>}>
          {ann.length === 0 ? (
            <Empty>No announcements yet.</Empty>
          ) : (
            <ul className="space-y-3 text-sm">
              {ann.map((a) => (
                <li key={a.id}>
                  <div className="font-medium">{a.title}</div>
                  <div className="text-xs text-muted">{dateTime(a.publishedAt)}</div>
                  {a.linkUrl ? (
                    <a className="text-xs text-accent underline" href={a.linkUrl} target="_blank" rel="noreferrer">
                      Open news pack
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {v.performance.length ? (
        <Card title="Phase results" className="mt-4" pad={false}>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Phase</th>
                  <th className="text-right">Value at opening</th>
                  <th className="text-right">Value after</th>
                  <th className="text-right">Profit and loss</th>
                  <th className="text-right">Phase return</th>
                  <th className="text-right">Overall return</th>
                </tr>
              </thead>
              <tbody>
                {v.performance.map((p) => (
                  <tr key={p.phase}>
                    <td>{p.name}</td>
                    <td className="num text-right">{inr(p.openValuePaise)}</td>
                    <td className="num text-right">{inr(p.valuePaise)}</td>
                    <td className={`num text-right ${tone(p.phasePnlPaise)}`}>{signedInr(p.phasePnlPaise)}</td>
                    <td className={`num text-right ${tone(p.phaseReturn)}`}>{pct(p.phaseReturn)}</td>
                    <td className={`num text-right ${tone(p.overallReturn)}`}>{pct(p.overallReturn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </>
  );
}

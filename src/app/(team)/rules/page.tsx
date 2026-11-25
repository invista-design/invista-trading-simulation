import { Markdown } from "@/components/markdown";
import { Card, PageTitle } from "@/components/ui";
import { requireTeam } from "@/lib/auth";
import { dateTime, inr, duration } from "@/lib/format";
import { marketSnapshot, publishedRulebook } from "@/server/views";

export const metadata = { title: "Rules and help" };

export default async function Rules() {
  await requireTeam();
  const [rb, m] = await Promise.all([publishedRulebook(), marketSnapshot()]);
  return (
    <>
      <PageTitle title="Rules and help" sub={rb ? `Rulebook version ${rb.version}, published ${dateTime(rb.createdAt)}` : undefined} />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>{rb ? <Markdown source={rb.content} /> : <p className="text-sm text-muted">The rulebook has not been published yet.</p>}</Card>
        <div className="space-y-4">
          <Card title="Current trading rules">
            <ul className="space-y-2 text-sm">
              <li>Starting cash: {inr(m.comp.startingCapitalPaise, false)}</li>
              {m.phases.map((p) => (
                <li key={p.number}>
                  <span className="font-medium">{p.name}:</span> {p.allowSell ? "buy and sell" : "buy only"}, at least {p.minDistinctAssets} different assets, {duration(p.durationSeconds)}
                </li>
              ))}
              <li>Whole lots only. No short selling. Orders execute at the phase&apos;s opening prices.</li>
              <li>Only your last accepted order in a phase counts.</li>
              {m.comp.disqualifyOnShortfall ? <li>A team without an accepted order meeting the minimum in a phase is disqualified.</li> : null}
            </ul>
          </Card>
          <Card title="Lots">
            <table className="tbl">
              <tbody>
                {m.rows.map((r) => (
                  <tr key={r.asset.id}>
                    <td className="font-semibold">{r.asset.code}</td>
                    <td className="text-muted">{r.asset.lotDefinition}</td>
                    <td className="text-muted">Quoted {r.asset.quoteUnit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title="How prices move">
            <p className="text-sm leading-relaxed text-muted">
              Prices are fixed while a phase is open. When it closes, each price moves with 2 forces: the news and how much all teams together bought or sold compared with the market&apos;s depth. Each move is limited in size. The new prices become the next phase&apos;s opening prices unless the news pack announces a market event.
            </p>
          </Card>
          <Card title="Frequently asked questions">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="font-medium">Can we change our order?</dt>
                <dd className="text-muted">Yes, until the countdown ends. Submit again; the new order replaces the old one.</dd>
              </div>
              <div>
                <dt className="font-medium">What if our order breaks a rule?</dt>
                <dd className="text-muted">The terminal shows the exact problem and will not submit it. Fix the row and submit again.</dd>
              </div>
              <div>
                <dt className="font-medium">What counts as a trade?</dt>
                <dd className="text-muted">Each asset you buy or sell in your accepted order is 1 trade. A purchase that is rationed down to 0 lots does not count.</dd>
              </div>
              <div>
                <dt className="font-medium">We have a question about our result.</dt>
                <dd className="text-muted">Raise it with the organisers within 10 minutes of the leaderboard being shown.</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

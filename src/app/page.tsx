import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { inr, pct, dateTime, duration } from "@/lib/format";
import { PhaseBadge } from "@/components/ui";
import { marketSnapshot, publishedLeaderboard } from "@/server/views";
import { isFinished } from "@/server/core";

export const dynamic = "force-dynamic";

export default async function Landing() {
  let data: Awaited<ReturnType<typeof marketSnapshot>> | null = null;
  try {
    data = await marketSnapshot();
  } catch {
    data = null;
  }
  const user = await getSessionUser().catch(() => null);
  const finished = data ? isFinished(data.phases) : false;
  const finalBoard = data && finished ? await publishedLeaderboard(data.phases.at(-1)!.number) : null;
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">{data?.comp.organiser ?? "InVista"}</div>
          <div className="text-lg font-semibold">{data?.comp.name ?? "Trading Simulation"}</div>
        </div>
        <Link href={user ? (user.role === "organiser" ? "/admin" : "/dashboard") : "/login"} className="btn btn-primary">
          {user ? "Open my workspace" : "Sign in"}
        </Link>
      </header>
      {!data ? (
        <div className="card p-6 text-sm">
          The platform is not set up yet. Organisers: open <Link href="/setup" className="text-accent underline">first-time setup</Link>.
        </div>
      ) : (
        <>
          <section className="mb-8">
            <h1 className="max-w-3xl text-3xl font-semibold leading-tight md:text-4xl">
              {data.comp.roundName}: trade 10 assets over {data.phases.length} phases. Read the news, place your orders, beat the market.
            </h1>
            <p className="mt-3 max-w-2xl text-muted">
              Each team starts with {inr(data.comp.startingCapitalPaise, false)} in virtual cash. Prices move with the news and with what every team buys and sells. The highest portfolio value after the final phase wins.
            </p>
          </section>
          <section className="mb-8 grid gap-3 sm:grid-cols-3">
            {data.phases.map((p) => (
              <div key={p.number} className="card p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{p.name}</div>
                  <PhaseBadge status={p.status} />
                </div>
                <div className="mt-2 text-sm text-muted">
                  {duration(p.durationSeconds)} · {p.number === 1 || !p.allowSell ? "Buy only" : "Buy and sell"}
                  {p.scheduledAt ? ` · ${dateTime(p.scheduledAt)}` : ""}
                </div>
              </div>
            ))}
          </section>
          {finalBoard ? (
            <section className="card mb-8 overflow-x-auto">
              <header className="border-b border-line px-4 py-3 font-semibold">Final results</header>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Team</th>
                    <th className="text-right">Portfolio value</th>
                    <th className="text-right">Overall return</th>
                  </tr>
                </thead>
                <tbody>
                  {finalBoard.slice(0, 20).map((r) => (
                    <tr key={r.teamId}>
                      <td className="num">{r.rank}</td>
                      <td>{r.name}</td>
                      <td className="num text-right">{inr(r.valuePaise)}</td>
                      <td className={`num text-right ${Number(r.overallReturn) >= 0 ? "text-up" : "text-down"}`}>{pct(r.overallReturn)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
          <section className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="card p-4">
              <div className="font-semibold">News</div>
              <p className="mt-1 text-muted">
                News packs are released on the {data.comp.organiser} Instagram page
                {data.comp.instagramUrl ? (
                  <>
                    {" "}
                    (<a className="text-accent underline" href={data.comp.instagramUrl} target="_blank" rel="noreferrer">open</a>)
                  </>
                ) : null}
                . The site announces each release.
              </p>
            </div>
            <div className="card p-4">
              <div className="font-semibold">Rules</div>
              <p className="mt-1 text-muted">
                Read the <Link className="text-accent underline" href="/rulebook">rulebook</Link> before Phase 1.
              </p>
            </div>
            <div className="card p-4">
              <div className="font-semibold">Teams</div>
              <p className="mt-1 text-muted">Sign in with the username and password from the organisers.</p>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

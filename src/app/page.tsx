import Link from "next/link";
import { AssetTicker, Brand, CLUB_NAME, ClubLines, INSTITUTE, Logo } from "@/components/brand";
import { PhaseBadge } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { dateTime, duration, inr, pct, splitTitle } from "@/lib/format";
import { isFinished } from "@/server/core";
import { registrationState } from "@/server/teams";
import { marketSnapshot, publishedLeaderboard } from "@/server/views";

export const dynamic = "force-dynamic";

export default async function Landing() {
  let data: Awaited<ReturnType<typeof marketSnapshot>> | null = null;
  let reg: Awaited<ReturnType<typeof registrationState>> | null = null;
  try {
    [data, reg] = await Promise.all([marketSnapshot(), registrationState()]);
  } catch {
    data = null;
  }
  const user = await getSessionUser().catch(() => null);
  const finished = data ? isFinished(data.phases) : false;
  const finalBoard = data && finished ? await publishedLeaderboard(data.phases.at(-1)!.number) : null;
  const name = data?.comp.name ?? "Market Mayhem - Trading Simulation: Dalal Street Challenge";
  const [title, subtitle] = splitTitle(name);
  const workspace = user ? (user.role === "organiser" ? "/admin" : "/dashboard") : null;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5">
        <Brand name={name} size={44} sub={<ClubLines />} />
        <Link href={workspace ?? "/login"} className="btn">
          {workspace ? "Open my workspace" : "Team login"}
        </Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-12 pt-6 lg:grid-cols-[1.3fr_1fr] lg:pt-12">
          <div>
            <h1 className="display text-5xl font-bold leading-[1.05] text-gold sm:text-6xl lg:text-7xl">{title}</h1>
            {subtitle ? <p className="mt-3 text-xl font-medium sm:text-2xl">{subtitle}</p> : null}
            {data ? (
              <>
                <dl className="mt-7 flex max-w-xl flex-wrap gap-x-12 gap-y-3 border-y border-line py-4">
                  <div>
                    <dt className="text-xs text-muted">Date</dt>
                    <dd className="mt-1 font-semibold sm:text-lg">{data.comp.eventDate}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Time</dt>
                    <dd className="mt-1 font-semibold sm:text-lg">{data.comp.eventTime}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Venue</dt>
                    <dd className="mt-1 font-semibold sm:text-lg">{data.comp.eventVenue}</dd>
                  </div>
                </dl>
                {data.comp.prizePool ? (
                  <div className="prize mt-6 max-w-xl rounded-2xl p-[1.5px]">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-[calc(1rem-1.5px)] bg-panel px-6 py-5">
                      <span className="text-sm font-medium text-muted">Prize pool</span>
                      <span className="prize-amount display text-5xl font-bold leading-none sm:text-6xl">{data.comp.prizePool}</span>
                    </div>
                  </div>
                ) : null}
                {data.comp.eventNote ? (
                  <p className="mt-4 max-w-xl text-sm">
                    <span className="font-semibold text-gold">Recommended:</span> {data.comp.eventNote}
                  </p>
                ) : null}
              </>
            ) : null}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {reg?.open ? (
                <Link href="/register" className="btn btn-primary px-6 py-3 text-base">
                  Register your team
                </Link>
              ) : null}
              <Link href={workspace ?? "/login"} className={`btn px-6 py-3 text-base ${reg?.open ? "" : "btn-primary"}`}>
                {workspace ? "Open my workspace" : "Team login"}
              </Link>
            </div>
            {reg ? (
              <p className="mt-4 text-sm text-muted">
                {reg.open ? "Registration is open." : `${reg.message}.`}
              </p>
            ) : null}
          </div>
          <div className="flex justify-center lg:justify-end">
            <Logo size={340} className="h-auto w-56 sm:w-72 lg:w-[340px]" />
          </div>
        </section>

        {data ? <AssetTicker assets={data.rows.map((r) => ({ code: r.asset.code, name: r.asset.name }))} /> : null}

        {!data ? (
          <div className="mx-auto max-w-6xl px-4 py-10">
            <div className="card p-6 text-sm">
              The platform is not set up yet. Organisers: open{" "}
              <Link href="/setup" className="text-accent underline">
                first-time setup
              </Link>
              .
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-6xl space-y-12 px-4 py-12">
            {finalBoard ? (
              <section className="card overflow-x-auto">
                <h2 className="border-b border-line px-4 py-3 font-semibold">Final results</h2>
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
            ) : (
              <section>
                <h2 className="display text-2xl font-semibold">How to take part</h2>
                <ol className="mt-5 grid gap-6 sm:grid-cols-3">
                  <li className="border-l-2 border-gold pl-4">
                    <div className="display text-3xl font-bold text-gold">1</div>
                    <div className="mt-1 font-semibold">Register your team</div>
                    <p className="mt-1 text-sm text-muted">2 or 3 members, each with a full name, 10-digit mobile number and email ID.</p>
                  </li>
                  <li className="border-l-2 border-gold pl-4">
                    <div className="display text-3xl font-bold text-gold">2</div>
                    <div className="mt-1 font-semibold">Collect your team code</div>
                    <p className="mt-1 text-sm text-muted">The organisers give each team a 3-character code, such as K42, in person. It is your password.</p>
                  </li>
                  <li className="border-l-2 border-gold pl-4">
                    <div className="display text-3xl font-bold text-gold">3</div>
                    <div className="mt-1 font-semibold">Log in on the day</div>
                    <p className="mt-1 text-sm text-muted">Use your team name and code once the organisers open team login, then trade when Phase 1 opens.</p>
                  </li>
                </ol>
              </section>
            )}

            <section>
              <h2 className="display text-2xl font-semibold">The phases</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {data.phases.map((p) => (
                  <div key={p.number} className="card p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{p.name}</div>
                      <PhaseBadge status={p.status} />
                    </div>
                    <p className="mt-2 text-sm text-muted">
                      {duration(p.durationSeconds)}, {p.number === 1 || !p.allowSell ? "buying only" : "buying and selling"}
                      {p.scheduledAt ? `, ${dateTime(p.scheduledAt)}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-6 text-sm sm:grid-cols-2">
              <div>
                <h2 className="font-semibold">News</h2>
                <p className="mt-1 text-muted">
                  News packs are released on the {data.comp.organiser} Instagram page
                  {data.comp.instagramUrl ? (
                    <>
                      {" "}
                      (
                      <a className="text-accent underline" href={data.comp.instagramUrl} target="_blank" rel="noreferrer">
                        open Instagram
                      </a>
                      )
                    </>
                  ) : null}
                  . This site announces each release.
                </p>
              </div>
              <div>
                <h2 className="font-semibold">Rules</h2>
                <p className="mt-1 text-muted">
                  Read the{" "}
                  <Link className="text-accent underline" href="/rulebook">
                    rulebook
                  </Link>{" "}
                  before Phase 1.
                </p>
              </div>
            </section>
          </div>
        )}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-muted">
          <span>
            Organised by {CLUB_NAME}, {INSTITUTE}
          </span>
          <Link href="/organiser" className="underline">
            Organiser sign-in
          </Link>
        </div>
      </footer>
    </div>
  );
}

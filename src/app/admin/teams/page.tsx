import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { AdminTeamForm } from "@/components/admin-team-form";
import { Badge, Card, Empty, Notice, PageTitle, ReasonField, Stat, sp, type SP } from "@/components/ui";
import { getDb, schema } from "@/db";
import { dateTime, nameKey, phone } from "@/lib/format";
import { setRegistration } from "@/server/admin-actions";
import { registrationState } from "@/server/teams";

export const metadata = { title: "Registered teams" };

export default async function TeamsPage({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const term = (sp(q.q) ?? "").trim();
  const db = getDb();
  const [comp] = await db.select().from(schema.competition).limit(1);
  const [teams, users, reg] = await Promise.all([
    db.select().from(schema.teams).orderBy(asc(schema.teams.createdAt)),
    db.select({ teamId: schema.users.teamId, active: schema.users.active, lastLoginAt: schema.users.lastLoginAt }).from(schema.users).where(eq(schema.users.role, "team")),
    registrationState(db),
  ]);
  const login = new Map(users.map((u) => [u.teamId, u]));
  const serial = new Map(teams.map((t, i) => [t.id, i + 1]));
  const key = nameKey(term);
  const shown = term ? teams.filter((t) => t.nameKey.includes(key) || t.code === term.toUpperCase()) : teams;
  const participants = teams.reduce((n, t) => n + t.members.length, 0);
  const two = teams.filter((t) => t.members.length === 2).length;
  const three = teams.filter((t) => t.members.length === 3).length;

  return (
    <>
      <PageTitle title="Registered teams" sub="Teams register themselves on the website and log in with their team name and team code." />
      <Notice ok={sp(q.ok)} err={sp(q.err)} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total registered teams" value={teams.length} sub={`${comp?.teamCapacity ?? 0} places in total`} />
        <Stat label="Total registered participants" value={participants} />
        <Stat label="Teams with 2 members" value={two} />
        <Stat label="Teams with 3 members" value={three} />
      </div>

      <Card title="Registration" className="mb-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="text-sm">
            <div className={`font-semibold ${reg.open ? "text-up" : "text-down"}`}>{reg.open ? "Open on the website" : reg.message}</div>
            <div className="mt-1 text-muted">
              Registration page:{" "}
              <a className="text-accent underline" href="/register" target="_blank" rel="noreferrer">
                /register
              </a>
              . It closes by itself when Phase 1 opens or when all places are taken.
            </div>
          </div>
          <form action={setRegistration} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="open" value={comp?.registrationOpen ? "false" : "true"} />
            <div className="w-64">
              <ReasonField />
            </div>
            <button className={`btn ${comp?.registrationOpen ? "btn-danger" : "btn-primary"}`}>{comp?.registrationOpen ? "Close registration" : "Open registration"}</button>
          </form>
        </div>
      </Card>

      <Card
        title={term ? `${shown.length} of ${teams.length} teams match "${term}"` : `All teams (${teams.length})`}
        pad={false}
        actions={
          <div className="flex flex-wrap gap-2">
            <form className="flex gap-2">
              <input name="q" defaultValue={term} className="input w-56" placeholder="Search team name or code" aria-label="Search team name or code" />
              <button className="btn btn-sm">Search</button>
              {term ? (
                <Link href="/admin/teams" className="btn btn-sm">
                  Clear
                </Link>
              ) : null}
            </form>
            <a className="btn btn-sm" href="/api/admin/export?kind=teams">
              Download (.xlsx)
            </a>
          </div>
        }
      >
        {shown.length === 0 ? (
          <div className="p-4">
            <Empty>{term ? "No team matches this search." : "No teams have registered yet. Share the registration page with participants."}</Empty>
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="tbl min-w-[1900px] text-xs">
              <thead>
                <tr>
                  <th>Serial number</th>
                  <th>Team name</th>
                  <th>Team code</th>
                  {[1, 2, 3].flatMap((i) => [
                    <th key={`${i}n`}>Member {i} name</th>,
                    <th key={`${i}p`}>Member {i} contact number</th>,
                    <th key={`${i}e`}>Member {i} email ID</th>,
                  ])}
                  <th>Registered</th>
                  <th>Registration status</th>
                  <th>
                    <span className="sr-only">Manage</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((t) => {
                  const u = login.get(t.id);
                  return (
                    <tr key={t.id}>
                      <td className="num">{serial.get(t.id)}</td>
                      <td className="font-semibold">
                        <Link href={`/admin/teams/${t.id}`} className="hover:text-accent hover:underline">
                          {t.name}
                        </Link>
                      </td>
                      <td className="display text-sm font-bold tracking-widest text-gold">{t.code}</td>
                      {[0, 1, 2].flatMap((i) => {
                        const m = t.members[i];
                        return [
                          <td key={`${i}n`}>{m?.name ?? <span className="text-muted">Not applicable</span>}</td>,
                          <td key={`${i}p`} className="num">
                            {m?.phone ? phone(m.phone) : ""}
                          </td>,
                          <td key={`${i}e`}>{m?.email ?? ""}</td>,
                        ];
                      })}
                      <td className="num">{dateTime(t.createdAt)}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {u?.active ? <Badge kind="up">Login on</Badge> : <Badge kind="down">Login off</Badge>}
                          {t.status === "disqualified" ? <Badge kind="down">Disqualified, Phase {t.disqualifiedPhase}</Badge> : null}
                          {t.registrationSource === "organiser" ? <Badge kind="muted">Added by organiser</Badge> : null}
                        </div>
                      </td>
                      <td>
                        <Link href={`/admin/teams/${t.id}`} className="btn btn-sm">
                          Manage
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <details className="card mt-4">
        <summary className="cursor-pointer px-4 py-3 font-semibold">Register a team on its behalf</summary>
        <div className="border-t border-line p-4">
          <p className="mb-4 text-sm text-muted">Use this for a team that cannot register on the website. It works even when registration is closed, up to the team capacity.</p>
          <AdminTeamForm mode="add" />
        </div>
      </details>
    </>
  );
}

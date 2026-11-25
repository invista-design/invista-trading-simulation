import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { AdminTeamForm } from "@/components/admin-team-form";
import { Badge, Card, Notice, PageTitle, ReasonField, sp, type SP } from "@/components/ui";
import { getDb, schema } from "@/db";
import { dateTime, phone } from "@/lib/format";
import { changeCode, deleteTeam, disqualifyTeam, reinstateTeam, setLoginAccess } from "@/server/admin-actions";
import { getPhases } from "@/server/core";

export const metadata = { title: "Manage team" };

export default async function TeamPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const q = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = getDb();
  const [[t], [u], phases] = await Promise.all([
    db.select().from(schema.teams).where(eq(schema.teams.id, id)).limit(1),
    db.select().from(schema.users).where(eq(schema.users.teamId, id)).limit(1),
    getPhases(db),
  ]);
  if (!t) notFound();
  const opened = phases.some((p) => p.status !== "draft");
  const locked = u?.lockedUntil && u.lockedUntil > new Date();
  const initial = {
    teamName: t.name,
    ...Object.fromEntries(
      [0, 1, 2].flatMap((i) => [
        [`m${i + 1}Name`, t.members[i]?.name ?? ""],
        [`m${i + 1}Phone`, t.members[i]?.phone ?? ""],
        [`m${i + 1}Email`, t.members[i]?.email ?? ""],
      ]),
    ),
  };

  return (
    <>
      <div className="mb-2 text-sm">
        <Link href="/admin/teams" className="text-accent hover:underline">
          All registered teams
        </Link>
      </div>
      <PageTitle
        title={t.name}
        sub={`Registered ${dateTime(t.createdAt)} ${t.registrationSource === "website" ? "by the team on the website" : "by an organiser"}`}
        actions={
          <div className="flex flex-wrap gap-1">
            {u?.active ? <Badge kind="up">Login on</Badge> : <Badge kind="down">Login off</Badge>}
            {t.status === "disqualified" ? <Badge kind="down">Disqualified</Badge> : <Badge kind="up">Active in the competition</Badge>}
          </div>
        }
      />
      <Notice ok={sp(q.ok)} err={sp(q.err)} />

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card title="Team details">
            <AdminTeamForm mode="edit" teamId={t.id} initial={initial} />
          </Card>
          <Card title="Members on record">
            <table className="tbl tbl-stack">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Full name</th>
                  <th>Contact number</th>
                  <th>Email ID</th>
                </tr>
              </thead>
              <tbody>
                {t.members.map((m, i) => (
                  <tr key={i}>
                    <td className="stack-full font-semibold">Member {i + 1}</td>
                    <td data-label="Full name">{m.name}</td>
                    <td data-label="Contact number" className="num">
                      {phone(m.phone)}
                    </td>
                    <td data-label="Email ID">{m.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Team code">
            <div className="display text-5xl font-bold tracking-[0.25em] text-gold">{t.code}</div>
            <p className="mt-2 text-sm text-muted">Give this code to the team in person. Teams never see it on the website before they log in.</p>
            <form action={changeCode} className="mt-4 space-y-2">
              <input type="hidden" name="teamId" value={t.id} />
              <label className="block">
                <span className="field-label">New code</span>
                <input name="code" maxLength={3} autoCapitalize="characters" className="input uppercase tracking-[0.3em] placeholder:normal-case placeholder:tracking-normal" placeholder="Leave blank to generate one" />
                <span className="mt-1 block text-xs text-muted">1 capital letter and 2 digits, for example K42. It must not belong to another team.</span>
              </label>
              <ReasonField />
              <button className="btn">Change code</button>
              <p className="text-xs text-muted">The team is signed out at once and must log in with the new code. Give them the new code in person.</p>
            </form>
          </Card>

          <Card title="This team's login">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Status</dt>
              <dd>{u?.active ? "On: the team can log in" : "Off: the team cannot log in"}</dd>
              <dt className="text-muted">Last login</dt>
              <dd>{u?.lastLoginAt ? dateTime(u.lastLoginAt) : "Never"}</dd>
              <dt className="text-muted">Wrong codes</dt>
              <dd>{locked ? `Paused until ${dateTime(u!.lockedUntil)} after 5 wrong codes` : `${u?.failedLogins ?? 0} since the last login`}</dd>
            </dl>
            <form action={setLoginAccess} className="mt-4 space-y-2">
              <input type="hidden" name="teamId" value={t.id} />
              <input type="hidden" name="active" value={u?.active ? "false" : "true"} />
              <ReasonField />
              <button className={`btn ${u?.active ? "btn-danger" : "btn-primary"}`}>{u?.active ? "Switch login off" : "Switch login on"}</button>
              {locked && u?.active ? <p className="text-xs text-muted">Switching login off and on again also clears the pause.</p> : null}
            </form>
          </Card>

          <Card title="Competition status">
            {t.status === "disqualified" ? (
              <form action={reinstateTeam} className="space-y-2 text-sm">
                <p>
                  Disqualified in Phase {t.disqualifiedPhase}: {t.disqualifiedReason}
                </p>
                <input type="hidden" name="teamId" value={t.id} />
                <ReasonField />
                <button className="btn">Reinstate</button>
              </form>
            ) : (
              <form action={disqualifyTeam} className="space-y-2 text-sm">
                <p className="text-muted">Disqualifying removes the team from the current phase onward and voids its order in that phase.</p>
                <input type="hidden" name="teamId" value={t.id} />
                <ReasonField />
                <button className="btn btn-danger">Disqualify</button>
              </form>
            )}
          </Card>

          <Card title="Delete registration">
            {opened ? (
              <p className="text-sm text-muted">Teams cannot be deleted once Phase 1 has opened, because their trades are part of the results. Disqualify the team instead.</p>
            ) : (
              <form action={deleteTeam} className="space-y-2 text-sm">
                <p className="text-muted">Deletes the team, its login and its details. This cannot be undone.</p>
                <input type="hidden" name="teamId" value={t.id} />
                <label className="block">
                  <span className="field-label">Type the team code {t.code} to confirm</span>
                  <input name="confirm" required maxLength={3} autoComplete="off" className="input uppercase tracking-[0.3em] placeholder:normal-case placeholder:tracking-normal" />
                </label>
                <ReasonField />
                <button className="btn btn-danger">Delete team</button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

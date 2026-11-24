import { asc, eq } from "drizzle-orm";
import { CredentialForm } from "@/components/credential-form";
import { Badge, Card, Empty, Notice, PageTitle, ReasonField, sp, type SP } from "@/components/ui";
import { getDb, schema } from "@/db";
import { createTeams, deleteTeam, disqualifyTeam, reinstateTeam, resetTeamPassword, updateTeam } from "@/server/admin-actions";
import { getCompetition, getConfirmedRuns, getPhases } from "@/server/core";
import { dateTime, inr } from "@/lib/format";

export const metadata = { title: "Teams" };

export default async function TeamsPage({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const db = getDb();
  const [comp, phases, teams, users, runs] = await Promise.all([
    getCompetition(db),
    getPhases(db),
    db.select().from(schema.teams).orderBy(asc(schema.teams.name)),
    db.select({ teamId: schema.users.teamId, username: schema.users.username, lastLoginAt: schema.users.lastLoginAt }).from(schema.users).where(eq(schema.users.role, "team")),
    getConfirmedRuns(db),
  ]);
  const opened = phases.some((p) => p.status !== "draft");
  const lastRun = [...runs.values()].sort((a, b) => b.run.phaseNumber - a.run.phaseNumber)[0];
  return (
    <>
      <PageTitle title="Teams" sub={`${teams.length} of ${comp.teamCapacity} places used. Names are matched ignoring case and extra spaces, as in the workbook.`} />
      <Notice ok={sp(q.ok)} err={sp(q.err)} />
      <div className="grid gap-4 xl:grid-cols-[1fr_1.6fr]">
        <Card title="Register teams">
          <CredentialForm action={createTeams} submitLabel="Create teams and logins">
            <label className="block">
              <span className="label">1 team per line: Team name | member 1, member 2, member 3</span>
              <textarea name="teams" rows={8} className="input font-mono" placeholder={"Bull Run Capital | Asha Rao, Vikram Singh\nThe Arbitrageurs | Neha Gupta, Rohan Das"} required />
            </label>
            <input name="reason" className="input" placeholder="Note for the audit log (optional)" />
          </CredentialForm>
          {opened ? <p className="mt-3 text-xs text-warn">Phase 1 has opened. Rulebook 5.8 says a team that registers late cannot join; a team added now starts with full starting capital in the next phase.</p> : null}
        </Card>
        <Card title="Registered teams" pad={false}>
          {teams.length === 0 ? (
            <div className="p-4">
              <Empty>No teams yet.</Empty>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {teams.map((t) => {
                const u = users.find((x) => x.teamId === t.id);
                const last = lastRun?.result.teams.find((x) => x.teamId === t.id);
                return (
                  <details key={t.id} className="group px-4 py-3">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                      <span>
                        <span className="font-semibold">{t.name}</span>
                        <span className="ml-2 font-mono text-xs text-muted">{u?.username}</span>
                        <span className="block text-xs text-muted">{t.members.join(", ") || "No members listed"}</span>
                      </span>
                      <span className="flex items-center gap-2 text-xs">
                        {last ? <span className="num text-muted">{inr(last.valuePaise)}</span> : null}
                        {t.status === "active" ? <Badge kind="up">Active</Badge> : <Badge kind="down">Disqualified in Phase {t.disqualifiedPhase}</Badge>}
                      </span>
                    </summary>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      {t.status === "disqualified" ? <p className="text-sm text-down lg:col-span-2">Reason: {t.disqualifiedReason}</p> : null}
                      {t.reinstatedNote ? <p className="text-sm text-muted lg:col-span-2">Reinstated: {t.reinstatedNote}</p> : null}
                      <form action={updateTeam} className="space-y-2">
                        <input type="hidden" name="teamId" value={t.id} />
                        <input name="name" defaultValue={t.name} className="input" aria-label="Team name" />
                        <input name="members" defaultValue={t.members.join(", ")} className="input" aria-label="Members" />
                        <ReasonField />
                        <button className="btn btn-sm">Save team</button>
                      </form>
                      <div className="space-y-3">
                        <CredentialForm action={resetTeamPassword} submitLabel="Reset password">
                          <input type="hidden" name="teamId" value={t.id} />
                          <ReasonField />
                        </CredentialForm>
                        {t.status === "active" ? (
                          <form action={disqualifyTeam} className="space-y-2">
                            <input type="hidden" name="teamId" value={t.id} />
                            <ReasonField placeholder="Reason for disqualification (shown to the team)" />
                            <button className="btn btn-sm btn-danger">Disqualify</button>
                          </form>
                        ) : (
                          <form action={reinstateTeam} className="space-y-2">
                            <input type="hidden" name="teamId" value={t.id} />
                            <ReasonField placeholder="Reason for reinstatement" />
                            <button className="btn btn-sm">Reinstate</button>
                          </form>
                        )}
                        {!opened ? (
                          <form action={deleteTeam} className="space-y-2">
                            <input type="hidden" name="teamId" value={t.id} />
                            <ReasonField placeholder="Reason for deleting" />
                            <button className="btn btn-sm btn-danger">Delete team</button>
                          </form>
                        ) : null}
                        <p className="text-xs text-muted">Last sign-in: {u?.lastLoginAt ? dateTime(u.lastLoginAt) : "never"}</p>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

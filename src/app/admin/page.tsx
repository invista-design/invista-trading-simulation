import Link from "next/link";
import { count } from "drizzle-orm";
import { AdminLive } from "@/components/admin-live";
import { Card, Notice, PageTitle, PhaseBadge, Stat, sp, type SP } from "@/components/ui";
import { getDb, schema } from "@/db";
import { dateTime } from "@/lib/format";
import { currentPhase, getCompetition, getPhases, settleAutoClose } from "@/server/core";

export const metadata = { title: "Admin overview" };

export default async function AdminOverview({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const db = getDb();
  await settleAutoClose(db);
  const [comp, phases, teams, attempts, ann, rb] = await Promise.all([
    getCompetition(db),
    getPhases(db),
    db.select().from(schema.teams),
    db.select({ n: count() }).from(schema.orderAttempts),
    db.select({ n: count() }).from(schema.announcements),
    db.select({ n: count() }).from(schema.rulebookVersions),
  ]);
  const cur = currentPhase(phases);
  const active = teams.filter((t) => t.status === "active").length;
  const checklist = [
    { done: teams.length > 0, text: "Share the registration page with participants and check the registered teams", href: "/admin/teams" },
    { done: !comp.registrationOpen || phases.some((p) => p.status !== "draft"), text: "Close registration when all teams are in (it also closes when Phase 1 opens)", href: "/admin/teams" },
    { done: teams.length > 0 && comp.supplyCalibratedFor === teams.length, text: `Recalibrate supply for the registered team count (calibrated for ${comp.supplyCalibratedFor}, registered ${teams.length})`, href: "/admin/assets" },
    { done: Boolean(comp.instagramUrl), text: "Add the InVista Instagram link", href: "/admin/settings" },
    { done: Number(ann[0]?.n ?? 0) > 0, text: "Post the Phase 1 news announcement", href: "/admin/news?tab=announcements" },
    { done: Number(rb[0]?.n ?? 0) > 1, text: "Publish the suggested rulebook update so the rules match the website (Rules page)", href: "/admin/rules" },
    { done: phases.some((p) => p.status !== "draft"), text: "Open Phase 1", href: "/admin/phases" },
  ];
  const recalc = phases.filter((p) => p.needsRecalculation);
  return (
    <>
      <PageTitle title="Overview" sub={`${comp.name} · ${comp.roundName} · ${phases.length} phases`} actions={<Link href="/admin/phases" className="btn btn-primary">Phase control</Link>} />
      <Notice ok={sp(q.ok)} err={sp(q.err)} />
      {recalc.length ? (
        <div className="mb-4 rounded-lg border border-warn/40 bg-warnsoft p-3 text-sm text-warn">
          Settings of {recalc.map((p) => p.name).join(", ")} changed after confirmation. Results stay as confirmed until you <Link className="underline" href="/admin/phases">recalculate</Link>.
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Registered teams" value={teams.length} sub={`${active} active, capacity ${comp.teamCapacity}`} />
        <Stat label="Current phase" value={cur?.name ?? ""} sub={cur ? <PhaseBadge status={cur.status} /> : null} />
        <Stat label="Blocked order attempts" value={Number(attempts[0]?.n ?? 0)} sub="Refused by the server, never applied" />
        <Stat label="Disqualified teams" value={teams.length - active} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card title={cur ? (["open", "paused", "closed"].includes(cur.status) ? `Live: ${cur.name}` : `${cur.name}: orders and projection`) : "Orders"}>
          <AdminLive />
        </Card>
        <div className="space-y-4">
          <Card title="Before the event">
            <ul className="space-y-2 text-sm">
              {checklist.map((c) => (
                <li key={c.text} className="flex items-start gap-2">
                  <span className={`mt-0.5 inline-block h-4 w-4 shrink-0 rounded border ${c.done ? "border-up bg-up" : "border-line"}`} />
                  <Link href={c.href} className={c.done ? "text-muted line-through" : "hover:text-accent"}>
                    {c.text}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Phases">
            <ul className="space-y-2 text-sm">
              {phases.map((p) => (
                <li key={p.number} className="flex items-center justify-between">
                  <span>
                    {p.name}
                    {p.closesAt && p.status === "open" ? <span className="block text-xs text-muted">Closes {dateTime(p.closesAt)}</span> : null}
                  </span>
                  <PhaseBadge status={p.status} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}


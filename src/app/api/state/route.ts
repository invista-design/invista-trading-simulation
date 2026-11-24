import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { currentPhase, getPhases, settleAutoClose } from "@/server/core";
import { publicPhase } from "@/server/views";

export const dynamic = "force-dynamic";

/** Lightweight status endpoint polled by every open page (phase, timer, version for refresh). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in again" }, { status: 401 });
  const db = getDb();
  await settleAutoClose(db);
  const phases = await getPhases(db);
  const [ann] = await db.select({ id: schema.announcements.id, at: schema.announcements.updatedAt }).from(schema.announcements).orderBy(desc(schema.announcements.updatedAt)).limit(1);
  const cur = currentPhase(phases);
  const version = phases.map((p) => `${p.number}:${p.status}:${p.updatedAt.getTime()}:${p.closesAt?.getTime() ?? 0}`).join("|") + `|a${ann?.id ?? 0}:${ann?.at?.getTime() ?? 0}`;
  let team: unknown = null;
  if (user.role === "team" && user.teamId && cur) {
    const [t] = await db.select({ status: schema.teams.status }).from(schema.teams).where(eq(schema.teams.id, user.teamId)).limit(1);
    const [o] = await db
      .select({ submittedAt: schema.orders.submittedAt, lines: schema.orders.lines })
      .from(schema.orders)
      .where(and(eq(schema.orders.teamId, user.teamId), eq(schema.orders.phaseNumber, cur.number), eq(schema.orders.status, "live")))
      .limit(1);
    team = { status: t?.status, liveOrder: o ? { submittedAt: o.submittedAt, assets: Object.keys(o.lines).length } : null };
  }
  return NextResponse.json(
    { serverNow: new Date().toISOString(), phase: cur ? publicPhase(cur) : null, version, team },
    { headers: { "Cache-Control": "no-store" } },
  );
}

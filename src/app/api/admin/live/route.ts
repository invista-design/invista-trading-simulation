import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { processPhase } from "@/engine";
import { getSessionUser } from "@/lib/auth";
import { buildInputs, currentPhase, getPhases, participates, settleAutoClose } from "@/server/core";

export const dynamic = "force-dynamic";

/** Organiser-only live monitor: compliance per team and live aggregate demand with projected price effects. */
export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "organiser") return NextResponse.json({ error: "Organiser only" }, { status: 403 });
  const db = getDb();
  await settleAutoClose(db);
  const phases = await getPhases(db);
  const cur = currentPhase(phases);
  if (!cur || cur.status === "draft") return NextResponse.json({ phase: cur?.number ?? null, teams: [], assets: [] }, { headers: { "Cache-Control": "no-store" } });
  const teams = await db.select().from(schema.teams);
  const orders = await db.select().from(schema.orders).where(and(eq(schema.orders.phaseNumber, cur.number), eq(schema.orders.status, "live")));
  const counts = teams
    .filter((t) => participates(t, cur.number))
    .map((t) => {
      const o = orders.find((x) => x.teamId === t.id);
      return { teamId: t.id, name: t.name, hasOrder: Boolean(o), assets: o ? Object.keys(o.lines).length : 0, submittedAt: o?.submittedAt ?? null, meets: Boolean(o) && Object.keys(o!.lines).length >= cur.minDistinctAssets };
    })
    .sort((a, b) => Number(a.meets) - Number(b.meets) || a.name.localeCompare(b.name));
  let assets: unknown[] = [];
  try {
    const inputs = await buildInputs(db, cur.number);
    const res = processPhase(inputs);
    assets = res.assets;
  } catch {
    assets = [];
  }
  return NextResponse.json({ phase: cur.number, status: cur.status, minAssets: cur.minDistinctAssets, teams: counts, assets }, { headers: { "Cache-Control": "no-store" } });
}

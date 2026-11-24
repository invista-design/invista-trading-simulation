import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { parseLotInput, validateOrder, type ValidationIssue } from "@/engine";
import { audit } from "@/lib/audit";
import { getAssets, getCompetition, getConfirmedRuns, getPhaseAssetRows, openingPrices, participates, rulesOf, startPosition } from "./core";

export interface SubmitInput {
  teamId: string;
  userId: string | null;
  phaseNumber: number;
  /** assetId to what was typed (signed lots: positive buys, negative sells) */
  lines: Record<string, string | number>;
  clientKey: string;
  rationale?: string;
  source?: "website" | "organiser";
  organiser?: { username: string; reason: string };
}

export type SubmitResult =
  | { ok: true; orderId: string; duplicate: boolean; submittedAt: string; lines: Record<string, number> }
  | { ok: false; status: number; issues: ValidationIssue[] };

const fail = (status: number, message: string, code = "blocked"): SubmitResult => ({ ok: false, status, issues: [{ code, message }] });

/**
 * Accepts or refuses an order. Runs in 1 database transaction:
 * the phase row is share-locked (so it cannot close or pause mid-submission), the team row is locked
 * (so 2 devices of the same team are serialised), every rule is checked, and only a fully valid order is stored.
 */
export async function submitOrder(input: SubmitInput): Promise<SubmitResult> {
  const db = getDb();
  if (!input.clientKey || input.clientKey.length > 100) return fail(400, "Missing submission key. Reload the page and try again");
  return db.transaction(async (tx) => {
    const [phase] = await tx.select().from(schema.phases).where(eq(schema.phases.number, input.phaseNumber)).for("share");
    if (!phase) return fail(404, "This phase does not exist");
    const [{ now }] = await tx.execute<{ now: Date }>(sql`select now() as now`).then((r) => r.rows);
    if (phase.status === "paused") return fail(409, "Trading is paused by the organiser. Your order was not submitted", "paused");
    if (phase.status !== "open" || !phase.closesAt || new Date(phase.closesAt) <= new Date(now)) {
      return fail(409, `The trading window for ${phase.name} is closed. Your order was not submitted`, "window_closed");
    }
    const [team] = await tx.select().from(schema.teams).where(eq(schema.teams.id, input.teamId)).for("update");
    if (!team) return fail(404, "Team not found");
    if (!participates(team, phase.number)) return fail(403, "Your team is disqualified and cannot trade", "disqualified");

    // Duplicate submission (double click or network retry): return the order already stored.
    const [dupe] = await tx
      .select()
      .from(schema.orders)
      .where(and(eq(schema.orders.teamId, team.id), eq(schema.orders.clientKey, input.clientKey)))
      .limit(1);
    if (dupe) return { ok: true, orderId: dupe.id, duplicate: true, submittedAt: dupe.submittedAt.toISOString(), lines: dupe.lines };

    const [comp, assets, paRows, runs] = await Promise.all([getCompetition(tx), getAssets(tx), getPhaseAssetRows(tx, phase.number), getConfirmedRuns(tx)]);
    const opening = openingPrices(phase.number, assets, paRows, runs);
    const position = startPosition(team.id, phase.number, runs, comp.startingCapitalPaise);
    const issues: ValidationIssue[] = [];
    const lines: Record<string, number> = {};
    const ids = new Set(assets.map((a) => a.id));
    for (const [assetId, raw] of Object.entries(input.lines ?? {})) {
      if (!ids.has(assetId)) {
        issues.push({ assetId, code: "unknown_asset", message: "This asset is not traded in this phase" });
        continue;
      }
      const parsed = parseLotInput(raw);
      if (!parsed.ok) issues.push({ assetId, code: "invalid_quantity", message: parsed.message });
      else if (parsed.lots !== 0) lines[assetId] = parsed.lots;
    }
    if (issues.length === 0) {
      const engineAssets = assets.map((a) => ({
        assetId: a.id,
        code: a.code,
        unitsPerLot: a.unitsPerLot,
        openingPricePaise: opening.get(a.id) ?? 0,
        supply: 0,
        newsScore: "0",
      }));
      const v = validateOrder({ rules: rulesOf(phase), assets: engineAssets, position, lines, capitalPaise: comp.startingCapitalPaise });
      issues.push(...v.issues);
    }
    if (issues.length > 0) {
      await tx.insert(schema.orderAttempts).values({ phaseNumber: phase.number, teamId: team.id, userId: input.userId, lines: input.lines, issues });
      return { ok: false, status: 422, issues };
    }
    await tx
      .update(schema.orders)
      .set({ status: "replaced" })
      .where(and(eq(schema.orders.phaseNumber, phase.number), eq(schema.orders.teamId, team.id), eq(schema.orders.status, "live")));
    const [row] = await tx
      .insert(schema.orders)
      .values({
        phaseNumber: phase.number,
        teamId: team.id,
        status: "live",
        lines,
        userId: input.userId,
        source: input.source ?? "website",
        clientKey: input.clientKey,
        rationale: (input.rationale ?? "").slice(0, 1000),
      })
      .returning();
    if (input.organiser) {
      await audit(tx, {
        username: input.organiser.username,
        action: "order.enter_for_team",
        entity: "team",
        entityId: team.name,
        reason: input.organiser.reason,
        after: { phase: phase.number, lines },
      });
    }
    return { ok: true, orderId: row.id, duplicate: false, submittedAt: row.submittedAt.toISOString(), lines };
  });
}

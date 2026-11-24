import "server-only";
import crypto from "node:crypto";
import { and, asc, eq, lt, sql } from "drizzle-orm";
import { schema, type DbOrTx } from "@/db";
import { audit } from "@/lib/audit";
import { openingPrice, type AcceptedOrder, type PhaseAsset, type PhaseResult, type PhaseRules, type Position } from "@/engine";

export type Competition = typeof schema.competition.$inferSelect;
export type Phase = typeof schema.phases.$inferSelect;
export type Asset = typeof schema.assets.$inferSelect;
export type Team = typeof schema.teams.$inferSelect;
export type Run = typeof schema.phaseRuns.$inferSelect;
export type Order = typeof schema.orders.$inferSelect;

export interface RunResult extends PhaseResult {
  /** Teams below the minimum after execution (candidates for disqualification). */
  shortfallTeamIds: string[];
}

export interface RunInputs {
  rules: PhaseRules;
  capitalPaise: number;
  assets: PhaseAsset[];
  positions: Position[];
  orders: (AcceptedOrder & { orderId: string })[];
}

/** An open phase whose time has run out is closed. Called on every read that depends on phase status. */
export async function settleAutoClose(db: DbOrTx): Promise<void> {
  const closed = await db
    .update(schema.phases)
    .set({ status: "closed", updatedAt: new Date() })
    .where(and(eq(schema.phases.status, "open"), lt(schema.phases.closesAt, sql`now()`)))
    .returning({ number: schema.phases.number, closesAt: schema.phases.closesAt });
  for (const p of closed) {
    await audit(db, { username: "system", action: "phase.close_auto", entity: "phase", entityId: p.number, reason: "Trading window ended at the scheduled closing time", after: { closesAt: p.closesAt } });
  }
}

export async function getCompetition(db: DbOrTx): Promise<Competition> {
  const [c] = await db.select().from(schema.competition).where(eq(schema.competition.id, 1)).limit(1);
  if (!c) throw new Error("The competition is not set up yet. Open /setup to create the first organiser account.");
  return c;
}

export async function getPhases(db: DbOrTx): Promise<Phase[]> {
  return db.select().from(schema.phases).orderBy(asc(schema.phases.number));
}

export async function getAssets(db: DbOrTx, includeInactive = false): Promise<Asset[]> {
  const rows = await db.select().from(schema.assets).orderBy(asc(schema.assets.displayOrder), asc(schema.assets.code));
  return includeInactive ? rows : rows.filter((a) => a.active);
}

export function rulesOf(p: Phase): PhaseRules {
  return {
    phaseNumber: p.number,
    allowSell: p.allowSell,
    neutralRatio: p.neutralRatio,
    newsSensitivity: p.newsSensitivity,
    demandSensitivity: p.demandSensitivity,
    maxMove: p.maxMove,
    capShare: p.capShare,
    rationing: p.rationing,
    minDistinctAssets: p.minDistinctAssets,
  };
}

/** The phase teams should be looking at: the live one, else the latest one in progress, else the next to open. */
export function currentPhase(phases: Phase[]): Phase | null {
  const live = phases.find((p) => p.status === "open" || p.status === "paused" || p.status === "closed" || p.status === "confirmed");
  if (live) return live;
  const nextDraft = phases.find((p) => p.status === "draft");
  if (nextDraft) return nextDraft;
  return phases.at(-1) ?? null;
}

export const isFinished = (phases: Phase[]) => phases.length > 0 && phases.every((p) => p.status === "published");

export interface ConfirmedRun {
  run: Run;
  result: RunResult;
  inputs: RunInputs;
}

export async function getConfirmedRuns(db: DbOrTx): Promise<Map<number, ConfirmedRun>> {
  const runs = await db.select().from(schema.phaseRuns).where(eq(schema.phaseRuns.status, "confirmed"));
  return new Map(runs.map((r) => [r.phaseNumber, { run: r, result: r.result as RunResult, inputs: r.inputs as RunInputs }]));
}

/** Does a team take part in phase k? Shortfall disqualification at phase k still includes phase k; manual disqualification at k excludes it. */
export function participates(team: Team, k: number): boolean {
  if (team.status === "active") return true;
  if (team.disqualifiedPhase === null) return false;
  return team.disqualificationSource === "shortfall" ? team.disqualifiedPhase >= k : team.disqualifiedPhase > k;
}

/** Position at the start of phase k: the team's closing position in its latest confirmed earlier phase, else starting capital. */
export function startPosition(teamId: string, k: number, runs: Map<number, { result: PhaseResult }>, capitalPaise: number): Position {
  for (let j = k - 1; j >= 1; j--) {
    const t = runs.get(j)?.result.teams.find((x) => x.teamId === teamId);
    if (t) return { teamId, cashPaise: t.cashAfterPaise, lots: { ...t.lotsAfter } };
  }
  return { teamId, cashPaise: capitalPaise, lots: {} };
}

export async function getPhaseAssetRows(db: DbOrTx, k: number) {
  return db.select().from(schema.phaseAssets).where(eq(schema.phaseAssets.phaseNumber, k));
}

/** Opening price per asset for phase k, or null when it is not known yet (previous phase not confirmed). */
export function openingPrices(
  k: number,
  assets: Asset[],
  phaseAssetRows: (typeof schema.phaseAssets.$inferSelect)[],
  runs: Map<number, { result: PhaseResult }>,
  useFrozen = true,
): Map<string, number | null> {
  const byAsset = new Map(phaseAssetRows.map((r) => [r.assetId, r]));
  const prev = runs.get(k - 1)?.result;
  const out = new Map<string, number | null>();
  for (const a of assets) {
    const pa = byAsset.get(a.id);
    if (useFrozen && pa?.openingPricePaise != null) {
      out.set(a.id, pa.openingPricePaise);
      continue;
    }
    if (k === 1) {
      out.set(a.id, openingPrice(a.initialPricePaise, pa?.overrideType ?? "none", pa?.overrideValue ?? null));
      continue;
    }
    const prevAsset = prev?.assets.find((x) => x.assetId === a.id);
    out.set(a.id, prevAsset ? openingPrice(prevAsset.newPricePaise, pa?.overrideType ?? "none", pa?.overrideValue ?? null) : null);
  }
  return out;
}

/** Makes sure every active asset has market parameters and a confidential key row for every phase. */
export async function ensurePhaseAssetRows(db: DbOrTx): Promise<void> {
  const [phases, assets] = await Promise.all([getPhases(db), getAssets(db, true)]);
  for (const p of phases) {
    for (const a of assets) {
      await db.insert(schema.phaseAssets).values({ phaseNumber: p.number, assetId: a.id, supply: a.baseSupply }).onConflictDoNothing();
      await db.insert(schema.newsKeys).values({ phaseNumber: p.number, assetId: a.id }).onConflictDoNothing();
    }
  }
}

/** Builds the engine inputs for phase k from the database. Confidential scores are read here, server side only. */
export async function buildInputs(
  db: DbOrTx,
  k: number,
  opts: { runs?: Map<number, { result: PhaseResult }>; useFrozen?: boolean; teamsOverride?: Team[] } = {},
): Promise<RunInputs> {
  const [comp, phases, assets, paRows, keys, teamRows, liveOrders] = await Promise.all([
    getCompetition(db),
    getPhases(db),
    getAssets(db),
    getPhaseAssetRows(db, k),
    db.select().from(schema.newsKeys).where(eq(schema.newsKeys.phaseNumber, k)),
    db.select().from(schema.teams).orderBy(asc(schema.teams.createdAt), asc(schema.teams.name)),
    db.select().from(schema.orders).where(and(eq(schema.orders.phaseNumber, k), eq(schema.orders.status, "live"))).orderBy(asc(schema.orders.submittedAt)),
  ]);
  const phase = phases.find((p) => p.number === k);
  if (!phase) throw new Error(`Phase ${k} does not exist`);
  const runs = opts.runs ?? (await getConfirmedRuns(db));
  const opening = openingPrices(k, assets, paRows, runs, opts.useFrozen ?? true);
  const supply = new Map(paRows.map((r) => [r.assetId, r.supply]));
  const score = new Map(keys.map((r) => [r.assetId, r.score]));
  const engineAssets: PhaseAsset[] = assets.map((a) => {
    const open = opening.get(a.id);
    if (open == null) throw new Error(`Opening price of ${a.code} for Phase ${k} is not known yet. Confirm Phase ${k - 1} first.`);
    return { assetId: a.id, code: a.code, unitsPerLot: a.unitsPerLot, openingPricePaise: open, supply: supply.get(a.id) ?? a.baseSupply, newsScore: score.get(a.id) ?? "0" };
  });
  const teamsList = (opts.teamsOverride ?? teamRows).filter((t) => participates(t, k));
  const ids = new Set(teamsList.map((t) => t.id));
  return {
    rules: rulesOf(phase),
    capitalPaise: comp.startingCapitalPaise,
    assets: engineAssets,
    positions: teamsList.map((t) => startPosition(t.id, k, runs, comp.startingCapitalPaise)),
    orders: liveOrders
      .filter((o) => ids.has(o.teamId))
      .map((o) => ({ orderId: o.id, teamId: o.teamId, lines: o.lines, submittedAt: o.submittedAt.toISOString() })),
  };
}

export function inputsHash(inputs: RunInputs): string {
  return crypto.createHash("sha256").update(JSON.stringify(inputs)).digest("hex");
}

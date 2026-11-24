import "server-only";
/**
 * Participant-facing read models. This module is the only data path for team pages and team endpoints.
 * It never reads news_keys, never returns news scores or effects, never returns another team's orders,
 * and never reveals a phase's results before the organiser publishes them.
 */
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema, type DbOrTx } from "@/db";
import { lotPricePaise, rankTeams } from "@/engine";
import {
  currentPhase,
  getAssets,
  getCompetition,
  getConfirmedRuns,
  getPhases,
  participates,
  settleAutoClose,
  startPosition,
  type Asset,
  type ConfirmedRun,
  type Phase,
  type Team,
} from "./core";

export interface PublicPhase {
  number: number;
  name: string;
  status: Phase["status"];
  opensAt: string | null;
  closesAt: string | null;
  pausedRemainingMs: number | null;
  durationSeconds: number;
  allowSell: boolean;
  minDistinctAssets: number;
  scheduledAt: string | null;
}

export const publicPhase = (p: Phase): PublicPhase => ({
  number: p.number,
  name: p.name,
  status: p.status,
  opensAt: p.opensAt?.toISOString() ?? null,
  closesAt: p.closesAt?.toISOString() ?? null,
  pausedRemainingMs: p.pausedRemainingMs,
  durationSeconds: p.durationSeconds,
  allowSell: p.allowSell,
  minDistinctAssets: p.minDistinctAssets,
  scheduledAt: p.scheduledAt?.toISOString() ?? null,
});

export interface PublicAsset {
  id: string;
  code: string;
  name: string;
  assetType: string;
  sector: string;
  quoteUnit: string;
  lotDefinition: string;
  unitsPerLot: string;
  profile: string;
  description: string;
}

const publicAsset = (a: Asset): PublicAsset => ({
  id: a.id,
  code: a.code,
  name: a.name,
  assetType: a.assetType,
  sector: a.sector,
  quoteUnit: a.quoteUnit,
  lotDefinition: a.lotDefinition,
  unitsPerLot: a.unitsPerLot,
  profile: a.profile,
  description: a.description,
});

export interface PricePoint {
  label: string;
  phase: number;
  kind: "opening" | "close" | "final";
  pricePaise: number;
}

export interface PublishedAssetResult {
  phase: number;
  openingPricePaise: number;
  closingPricePaise: number;
  buyLots: number | null;
  sellLots: number | null;
  supply: number | null;
}

/** Internal: market data plus the confirmed runs (which hold confidential scores). Never returned to pages. */
async function loadMarket(db: DbOrTx) {
  await settleAutoClose(db);
  const [comp, phases, assets, paRows, runs] = await Promise.all([
    getCompetition(db),
    getPhases(db),
    getAssets(db),
    db.select().from(schema.phaseAssets),
    getConfirmedRuns(db),
  ]);
  const published = new Set(phases.filter((p) => p.status === "published").map((p) => p.number));
  const history = new Map<string, PricePoint[]>();
  const results = new Map<string, PublishedAssetResult[]>();
  for (const a of assets) {
    const pts: PricePoint[] = [];
    const res: PublishedAssetResult[] = [];
    for (const p of phases) {
      const pa = paRows.find((r) => r.phaseNumber === p.number && r.assetId === a.id);
      if (p.status !== "draft" && pa?.openingPricePaise != null) pts.push({ label: `${p.name} open`, phase: p.number, kind: "opening", pricePaise: pa.openingPricePaise });
      if (published.has(p.number)) {
        const r = runs.get(p.number)?.result.assets.find((x) => x.assetId === a.id);
        if (r) {
          const last = p.number === phases.at(-1)?.number;
          pts.push({ label: last ? "Final" : `${p.name} close`, phase: p.number, kind: last ? "final" : "close", pricePaise: r.newPricePaise });
          res.push({
            phase: p.number,
            openingPricePaise: r.openingPricePaise,
            closingPricePaise: r.newPricePaise,
            buyLots: comp.showDemandAfterPublish ? r.buyLots : null,
            sellLots: comp.showDemandAfterPublish ? r.sellLots : null,
            supply: comp.showMarketParameters ? r.supply : null,
          });
        }
      }
    }
    if (pts.length === 0) pts.push({ label: "Phase 1 open", phase: 1, kind: "opening", pricePaise: a.initialPricePaise });
    history.set(a.id, pts);
    results.set(a.id, res);
  }
  const cur = currentPhase(phases);
  const curPa = (assetId: string) => paRows.find((r) => r.phaseNumber === cur?.number && r.assetId === assetId);
  const rows = assets.map((a) => {
    const pts = history.get(a.id)!;
    const last = pts.at(-1)!;
    // Change is measured from the opening of the last completed move: the previous phase's opening while a phase runs, or this phase's opening once its result is published.
    const openings = pts.filter((x) => x.kind === "opening");
    const prev = (last.kind === "opening" ? openings.at(-2) : openings.at(-1)) ?? null;
    const curOpen = cur && cur.status !== "draft" ? curPa(a.id)?.openingPricePaise ?? null : cur?.number === 1 ? a.initialPricePaise : null;
    const price = last.pricePaise;
    return {
      asset: publicAsset(a),
      pricePaise: price,
      lotPricePaise: lotPricePaise(price, a.unitsPerLot),
      currentOpeningPaise: curOpen,
      currentOpeningLotPaise: curOpen == null ? null : lotPricePaise(curOpen, a.unitsPerLot),
      previousPricePaise: prev?.pricePaise ?? null,
      changePaise: prev ? price - prev.pricePaise : 0,
      changeFraction: prev && prev.pricePaise ? (price - prev.pricePaise) / prev.pricePaise : 0,
      history: pts,
      results: results.get(a.id)!,
    };
  });
  return { comp, phases, current: cur, rows, runs, published };
}

/** Everything public about the market: phases, assets, the public price path and published results. */
export async function marketSnapshot(db: DbOrTx = getDb()) {
  const { runs: _runs, ...pub } = await loadMarket(db);
  return pub;
}

export type MarketSnapshot = Awaited<ReturnType<typeof marketSnapshot>>;

/** Published leaderboard for a phase, or null if not yet published. */
export async function publishedLeaderboard(phaseNumber: number, db: DbOrTx = getDb()) {
  const [phases, runs, teams] = await Promise.all([getPhases(db), getConfirmedRuns(db), db.select().from(schema.teams)]);
  return leaderboard(phaseNumber, phases, runs, teams);
}

export function leaderboard(phaseNumber: number, phases: Phase[], runs: Map<number, ConfirmedRun>, teams: Team[], includeUnpublished = false) {
  const p = phases.find((x) => x.number === phaseNumber);
  if (!p || (!includeUnpublished && p.status !== "published")) return null;
  const run = runs.get(phaseNumber);
  if (!run) return null;
  const prevRun = runs.get(phaseNumber - 1);
  const byId = new Map(teams.map((t) => [t.id, t]));
  const excluded = (t: Team | undefined) => !t || (t.status === "disqualified" && (t.disqualifiedPhase ?? 0) <= phaseNumber);
  const rows = run.result.teams
    .filter((t) => !excluded(byId.get(t.teamId)))
    .map((t) => ({
      teamId: t.teamId,
      name: byId.get(t.teamId)?.name ?? "",
      valuePaise: t.valuePaise,
      previousValuePaise: prevRun?.result.teams.find((x) => x.teamId === t.teamId)?.valuePaise ?? null,
      lastOrderAt: run.inputs.orders.find((o) => o.teamId === t.teamId)?.submittedAt ?? null,
      cashPaise: t.cashAfterPaise,
      holdingsPaise: t.holdingsValuePaise,
      phaseReturn: t.phaseReturn,
      overallReturn: t.overallReturn,
      phasePnlPaise: t.phasePnlPaise,
    }));
  const ranked = rankTeams(rows);
  return ranked.map((r) => ({ ...r, ...rows.find((x) => x.teamId === r.teamId)!, rank: r.rank }));
}

export type LeaderboardRow = NonNullable<ReturnType<typeof leaderboard>>[number];

/** Team dashboard data: own position, own orders, public market data. */
export async function teamView(teamId: string) {
  const db = getDb();
  const market = await loadMarket(db);
  const [team] = await db.select().from(schema.teams).where(eq(schema.teams.id, teamId)).limit(1);
  const teams = await db.select().from(schema.teams);
  const cur = market.current;
  const k = cur ? (cur.status === "draft" || cur.status === "open" || cur.status === "paused" || cur.status === "closed" ? cur.number : cur.number + 1) : 1;
  // Position the team trades from in the current phase (after every confirmed earlier phase).
  const position = startPosition(teamId, cur?.number ?? 1, market.runs, market.comp.startingCapitalPaise);
  const afterCurrent = cur && market.runs.get(cur.number)?.result.teams.find((t) => t.teamId === teamId);
  const holdingPosition = afterCurrent ? { teamId, cashPaise: afterCurrent.cashAfterPaise, lots: afterCurrent.lotsAfter } : position;
  const orders = await db.select().from(schema.orders).where(eq(schema.orders.teamId, teamId)).orderBy(desc(schema.orders.submittedAt));
  const liveOrder = cur ? orders.find((o) => o.phaseNumber === cur.number && o.status === "live") ?? null : null;
  const publishedPhases = market.phases.filter((p) => p.status === "published");
  const lastPublished = publishedPhases.at(-1) ?? null;
  const board = lastPublished ? leaderboard(lastPublished.number, market.phases, market.runs, teams) : null;
  const myRank = board?.find((r) => r.teamId === teamId)?.rank ?? null;
  const performance = publishedPhases
    .map((p) => {
      const t = market.runs.get(p.number)?.result.teams.find((x) => x.teamId === teamId);
      return t ? { phase: p.number, name: p.name, openValuePaise: t.openValuePaise, valuePaise: t.valuePaise, phasePnlPaise: t.phasePnlPaise, phaseReturn: t.phaseReturn, overallReturn: t.overallReturn, tradesExecuted: t.tradesExecuted } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const valueNow = holdingPosition.cashPaise + market.rows.reduce((s, r) => s + (holdingPosition.lots[r.asset.id] ?? 0) * r.lotPricePaise, 0);
  const avgCost = averageCosts(teamId, market.runs, market.rows.map((r) => r.asset.id));
  // Own execution results for every confirmed phase (execution happens at public opening prices).
  const myResults = market.phases
    .filter((p) => market.runs.has(p.number))
    .map((p) => {
      const run = market.runs.get(p.number)!;
      const t = run.result.teams.find((x) => x.teamId === teamId);
      if (!t) return null;
      return {
        phase: p.number,
        name: p.name,
        orderLines: t.orderLines,
        executedLines: t.executedLines,
        openingLotPrices: Object.fromEntries(run.result.assets.map((a) => [a.assetId, a.openingLotPricePaise])),
        tradesExecuted: t.tradesExecuted,
        meetsMinimum: t.meetsMinimum,
        minimum: p.minDistinctAssets,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  // Contribution of each asset to the team's result, published phases only (needs the published closing price).
  const contributions = publishedPhases
    .map((p) => {
      const run = market.runs.get(p.number);
      const t = run?.result.teams.find((x) => x.teamId === teamId);
      if (!run || !t) return null;
      const byAsset: Record<string, number> = {};
      for (const a of run.result.assets) byAsset[a.assetId] = (t.lotsAfter[a.assetId] ?? 0) * (a.newLotPricePaise - a.openingLotPricePaise);
      return { phase: p.number, name: p.name, byAsset };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const { runs: _runs, ...pub } = market;
  return {
    ...pub,
    team: team!,
    k,
    position,
    holdingPosition,
    orders,
    liveOrder,
    board,
    myRank,
    performance,
    avgCost,
    myResults,
    contributions,
    valueNowPaise: valueNow,
    participating: team ? participates(team, cur?.number ?? 1) : false,
  };
}

export type TeamView = Awaited<ReturnType<typeof teamView>>;

/** Average purchase price per asset from the team's executed buys (confirmed phases), reduced proportionally by sales. */
export function averageCosts(teamId: string, runs: Map<number, ConfirmedRun>, assetIds: string[]) {
  const lots = new Map<string, number>(assetIds.map((id) => [id, 0]));
  const cost = new Map<string, number>(assetIds.map((id) => [id, 0]));
  for (const k of [...runs.keys()].sort((a, b) => a - b)) {
    const r = runs.get(k)!;
    const t = r.result.teams.find((x) => x.teamId === teamId);
    if (!t) continue;
    for (const [assetId, q] of Object.entries(t.executedLines)) {
      const price = r.result.assets.find((a) => a.assetId === assetId)?.openingLotPricePaise ?? 0;
      const l = lots.get(assetId) ?? 0;
      const c = cost.get(assetId) ?? 0;
      if (q > 0) {
        lots.set(assetId, l + q);
        cost.set(assetId, c + q * price);
      } else if (l > 0) {
        const remaining = l + q;
        cost.set(assetId, remaining <= 0 ? 0 : Math.round((c * remaining) / l));
        lots.set(assetId, Math.max(0, remaining));
      }
    }
  }
  return new Map(assetIds.map((id) => [id, (lots.get(id) ?? 0) > 0 ? Math.round((cost.get(id) ?? 0) / (lots.get(id) ?? 1)) : null]));
}

export async function publicAnnouncements(db: DbOrTx = getDb(), limit = 50) {
  return db
    .select({
      id: schema.announcements.id,
      phaseNumber: schema.announcements.phaseNumber,
      title: schema.announcements.title,
      body: schema.announcements.body,
      linkUrl: schema.announcements.linkUrl,
      correctionOf: schema.announcements.correctionOf,
      publishedAt: schema.announcements.publishedAt,
      updatedAt: schema.announcements.updatedAt,
    })
    .from(schema.announcements)
    .where(eq(schema.announcements.visible, true))
    .orderBy(desc(schema.announcements.publishedAt))
    .limit(limit);
}

export async function publishedRulebook(db: DbOrTx = getDb()) {
  const [row] = await db
    .select({ version: schema.rulebookVersions.version, content: schema.rulebookVersions.content, createdAt: schema.rulebookVersions.createdAt })
    .from(schema.rulebookVersions)
    .where(eq(schema.rulebookVersions.published, true))
    .orderBy(desc(schema.rulebookVersions.version))
    .limit(1);
  return row ?? null;
}

export async function teamsByIds(db: DbOrTx, ids: string[]) {
  if (ids.length === 0) return [];
  return db.select({ id: schema.teams.id, name: schema.teams.name }).from(schema.teams).where(inArray(schema.teams.id, ids));
}


import Decimal from "decimal.js";
import { Dec, lotPricePaise, roundDown, roundHalfUp } from "./money";
import type { AcceptedOrder, AssetResult, PhaseAsset, PhaseResult, PhaseRules, Position, TeamResult } from "./types";

export interface ProcessInput {
  rules: PhaseRules;
  capitalPaise: number;
  assets: PhaseAsset[];
  /** Every team taking part in the phase, with its position at the opening bell. */
  positions: Position[];
  /** At most 1 accepted order per team. Orders must already have passed validateOrder. */
  orders: AcceptedOrder[];
}

const ZERO = new Dec(0);

/**
 * Executes 1 phase exactly as the master workbook does:
 * fill ratios, executed lots, cash, demand, news and demand effects, capped price change,
 * next price per quote unit and per lot, then revaluation of every portfolio.
 */
export function processPhase(input: ProcessInput): PhaseResult {
  const { rules, capitalPaise, assets, positions, orders } = input;
  const orderByTeam = new Map(orders.map((o) => [o.teamId, o]));

  // 1. Aggregate valid demand (buys and sells, before rationing).
  const buy = new Map<string, number>();
  const sell = new Map<string, number>();
  for (const a of assets) {
    buy.set(a.assetId, 0);
    sell.set(a.assetId, 0);
  }
  for (const o of orders) {
    for (const a of assets) {
      const q = o.lines[a.assetId] ?? 0;
      if (q > 0) buy.set(a.assetId, buy.get(a.assetId)! + q);
      if (q < 0) sell.set(a.assetId, sell.get(a.assetId)! - q);
    }
  }

  // 2. Fill ratio for buys (pro-rata rationing when switched on and buys exceed supply).
  const fill = new Map<string, Dec>();
  for (const a of assets) {
    const b = buy.get(a.assetId)!;
    fill.set(a.assetId, rules.rationing && a.supply > 0 && b > a.supply ? new Dec(a.supply).div(b) : new Dec(1));
  }

  // 3. Price discovery.
  const ns = new Dec(rules.newsSensitivity);
  const ds = new Dec(rules.demandSensitivity);
  const neutral = new Dec(rules.neutralRatio);
  const maxMove = new Dec(rules.maxMove);
  const assetResults: AssetResult[] = [];
  const newLot = new Map<string, number>();
  const openLot = new Map<string, number>();
  for (const a of assets) {
    const b = buy.get(a.assetId)!;
    const s = sell.get(a.assetId)!;
    const net = b - s;
    const ratio = a.supply === 0 ? ZERO : new Dec(net).div(a.supply);
    const newsEffect = new Dec(a.newsScore).mul(ns);
    const demandEffect = ratio.sub(neutral).mul(ds);
    const combined = newsEffect.add(demandEffect);
    const applied = Decimal.max(maxMove.neg(), Decimal.min(maxMove, combined)) as Dec;
    const newPrice = roundHalfUp(new Dec(a.openingPricePaise).mul(new Dec(1).add(applied)), 0).toNumber();
    const lpNew = lotPricePaise(newPrice, a.unitsPerLot);
    const lpOpen = lotPricePaise(a.openingPricePaise, a.unitsPerLot);
    newLot.set(a.assetId, lpNew);
    openLot.set(a.assetId, lpOpen);
    assetResults.push({
      assetId: a.assetId,
      code: a.code,
      openingPricePaise: a.openingPricePaise,
      openingLotPricePaise: lpOpen,
      supply: a.supply,
      buyLots: b,
      sellLots: s,
      netDemand: net,
      demandRatio: ratio.toString(),
      fillRatio: fill.get(a.assetId)!.toString(),
      executedBuyLots: 0,
      newsScore: a.newsScore,
      newsEffect: newsEffect.toString(),
      demandEffect: demandEffect.toString(),
      combinedEffect: combined.toString(),
      appliedChange: applied.toString(),
      newPricePaise: newPrice,
      newLotPricePaise: lpNew,
      direction: applied.gt("0.0005") ? "UP" : applied.lt("-0.0005") ? "DOWN" : "FLAT",
    });
  }

  // 4. Execution and revaluation per team.
  const executedTotals = new Map<string, number>(assets.map((a) => [a.assetId, 0]));
  const teams: TeamResult[] = positions.map((p) => {
    const order = orderByTeam.get(p.teamId);
    const lotsBefore: Record<string, number> = {};
    const lotsAfter: Record<string, number> = {};
    const executedLines: Record<string, number> = {};
    let cash = p.cashPaise;
    let openValue = p.cashPaise;
    let holdings = 0;
    let trades = 0;
    for (const a of assets) {
      const held = p.lots[a.assetId] ?? 0;
      lotsBefore[a.assetId] = held;
      openValue += held * openLot.get(a.assetId)!;
      const q = order?.lines[a.assetId] ?? 0;
      let executed = 0;
      if (q > 0) {
        executed = roundDown(roundHalfUp(new Dec(q).mul(fill.get(a.assetId)!), 6)).toNumber();
        executedTotals.set(a.assetId, executedTotals.get(a.assetId)! + executed);
        cash -= executed * openLot.get(a.assetId)!;
      } else if (q < 0) {
        executed = q; // sales always execute in full
        cash += -q * openLot.get(a.assetId)!;
      }
      if (executed !== 0) {
        executedLines[a.assetId] = executed;
        trades += 1;
      }
      lotsAfter[a.assetId] = held + executed;
      holdings += lotsAfter[a.assetId] * newLot.get(a.assetId)!;
    }
    const value = cash + holdings;
    // Phase 1 opening value is the starting capital, as in the workbook.
    const base = rules.phaseNumber === 1 ? capitalPaise : openValue;
    return {
      teamId: p.teamId,
      hadOrder: Boolean(order),
      orderLines: order?.lines ?? {},
      executedLines,
      lotsBefore,
      cashBeforePaise: p.cashPaise,
      openValuePaise: base,
      lotsAfter,
      cashAfterPaise: cash,
      holdingsValuePaise: holdings,
      valuePaise: value,
      phasePnlPaise: value - base,
      phaseReturn: base === 0 ? "0" : new Dec(value - base).div(base).toString(),
      overallPnlPaise: value - capitalPaise,
      overallReturn: new Dec(value - capitalPaise).div(capitalPaise).toString(),
      tradesExecuted: trades,
      meetsMinimum: trades >= rules.minDistinctAssets,
    };
  });
  for (const r of assetResults) r.executedBuyLots = executedTotals.get(r.assetId)!;

  return { phaseNumber: rules.phaseNumber, assets: assetResults, teams };
}

export type OverrideType = "none" | "price" | "percent";

/** Opening price of a phase: the previous phase's computed price unless the organiser overrides it. */
export function openingPrice(previousPricePaise: number, overrideType: OverrideType, overrideValue: string | null): number {
  if (overrideType === "price" && overrideValue) return roundHalfUp(new Dec(overrideValue), 0).toNumber();
  if (overrideType === "percent" && overrideValue) {
    return roundHalfUp(new Dec(previousPricePaise).mul(new Dec(1).add(new Dec(overrideValue).div(100))), 0).toNumber();
  }
  return previousPricePaise;
}

/** Workbook supply formula: ROUND(teams x capital x deployment share / number of assets / price per lot, 0). */
export function suggestedSupply(teams: number, capitalPaise: number, deploymentShare: string, assetCount: number, lotPrice: number): number {
  if (assetCount === 0 || lotPrice === 0) return 0;
  return roundHalfUp(new Dec(teams).mul(capitalPaise).mul(deploymentShare).div(assetCount).div(lotPrice), 0).toNumber();
}

import { Dec, formatRupees, lotPricePaise } from "./money";
import type { OrderLines, PhaseAsset, PhaseRules, Position, ValidationIssue } from "./types";

export type LotParse = { ok: true; lots: number } | { ok: false; message: string };

/** Parses what a participant typed in a lots box. Blank means 0. Never silently changes a value. */
export function parseLotInput(raw: string | number | null | undefined): LotParse {
  if (raw === null || raw === undefined) return { ok: true, lots: 0 };
  const s = String(raw).trim();
  if (s === "" || s === "-" || s === "+") return { ok: true, lots: 0 };
  if (/^[+-]?\d+$/.test(s)) {
    const n = Number(s);
    if (!Number.isSafeInteger(n) || Math.abs(n) > 100_000_000) return { ok: false, message: "This number is too large" };
    return { ok: true, lots: n === 0 ? 0 : n };
  }
  if (/^[+-]?(\d+\.\d*|\.\d+)$/.test(s)) {
    const n = Number(s);
    if (Number.isInteger(n)) return { ok: true, lots: n === 0 ? 0 : n };
    return { ok: false, message: "Fractional lots are not allowed. Enter a whole number of lots" };
  }
  return { ok: false, message: "Enter a whole number of lots" };
}

/** Only the rules and asset fields that order validity depends on. Market parameters are never needed here. */
export type ValidationRules = Pick<PhaseRules, "phaseNumber" | "allowSell" | "minDistinctAssets" | "capShare">;
export type ValidationAsset = Pick<PhaseAsset, "assetId" | "code" | "unitsPerLot" | "openingPricePaise">;

export interface ValidateInput {
  rules: ValidationRules;
  assets: ValidationAsset[];
  position: Position;
  lines: OrderLines;
  capitalPaise: number;
}

export interface OrderSummary {
  buyValuePaise: number;
  sellValuePaise: number;
  cashAfterPaise: number;
  distinctAssets: number;
  lotsAfter: Record<string, number>;
  openValuePaise: number;
  valueAtOpeningPaise: number;
}

export interface ValidateResult {
  ok: boolean;
  issues: ValidationIssue[];
  summary: OrderSummary;
}

/**
 * Checks an order against every rule. Returns all problems at once, so the terminal can show
 * each failing row. Mirrors the master workbook checks plus the configurable distinct-asset minimum.
 */
export function validateOrder(input: ValidateInput): ValidateResult {
  const { rules, assets, position, lines, capitalPaise } = input;
  const issues: ValidationIssue[] = [];
  let buyValue = 0;
  let sellValue = 0;
  let distinct = 0;
  let openHoldings = 0;
  const lotsAfter: Record<string, number> = {};
  const known = new Set(assets.map((a) => a.assetId));

  for (const assetId of Object.keys(lines)) {
    if (!known.has(assetId)) issues.push({ assetId, code: "unknown_asset", message: "This asset is not traded in this phase" });
  }

  for (const a of assets) {
    const qty = lines[a.assetId] ?? 0;
    const held = position.lots[a.assetId] ?? 0;
    const lp = lotPricePaise(a.openingPricePaise, a.unitsPerLot);
    openHoldings += held * lp;
    lotsAfter[a.assetId] = held + (Number.isInteger(qty) ? qty : 0);
    if (!Number.isInteger(qty)) {
      issues.push({ assetId: a.assetId, code: "fractional", message: "Fractional lots are not allowed. Enter a whole number of lots" });
      continue;
    }
    if (qty === 0) continue;
    distinct += 1;
    if (qty > 0) buyValue += qty * lp;
    if (qty < 0) {
      sellValue += -qty * lp;
      if (!rules.allowSell) {
        issues.push({
          assetId: a.assetId,
          code: "selling_not_allowed",
          message: rules.phaseNumber === 1 ? "Selling is not allowed in Phase 1" : "Selling is switched off in this phase",
        });
      } else if (held + qty < 0) {
        issues.push({
          assetId: a.assetId,
          code: "short_selling",
          message: `You hold ${held} lots of ${a.code}, so you cannot sell ${-qty}. Short selling is not allowed`,
        });
      }
    }
  }

  if (rules.minDistinctAssets > 0 && distinct < rules.minDistinctAssets) {
    issues.push({
      code: "minimum_assets",
      message: `Trade at least ${rules.minDistinctAssets} different assets in this phase. This order trades ${distinct}`,
    });
  }

  const net = buyValue - sellValue;
  if (net > position.cashPaise) {
    issues.push({
      code: "insufficient_cash",
      message: `Insufficient cash. Purchases of ${formatRupees(buyValue)} exceed your cash of ${formatRupees(position.cashPaise)}${
        sellValue > 0 ? ` plus sale proceeds of ${formatRupees(sellValue)}` : ""
      } by ${formatRupees(net - position.cashPaise)}`,
    });
  }

  const openValue = position.cashPaise + openHoldings;
  const cap = new Dec(rules.capShare);
  if (cap.lt(1)) {
    const base = rules.phaseNumber === 1 ? capitalPaise : openValue;
    const limit = cap.mul(base);
    for (const a of assets) {
      const qty = lines[a.assetId] ?? 0;
      if (!Number.isInteger(qty) || qty <= 0) continue;
      const after = ((position.lots[a.assetId] ?? 0) + qty) * lotPricePaise(a.openingPricePaise, a.unitsPerLot);
      // Workbook tolerance: rejected only when above the limit by more than ₹0.005 (half a paisa).
      if (limit.add(0.5).lt(after)) {
        issues.push({
          assetId: a.assetId,
          code: "concentration_cap",
          message: `${a.code} would be worth ${formatRupees(after)} after this order, above the limit of ${formatRupees(
            limit.floor().toNumber(),
          )} (${cap.mul(100).toString()}% of ${rules.phaseNumber === 1 ? "starting capital" : "your portfolio value at opening prices"})`,
        });
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    summary: {
      buyValuePaise: buyValue,
      sellValuePaise: sellValue,
      cashAfterPaise: position.cashPaise - net,
      distinctAssets: distinct,
      lotsAfter,
      openValuePaise: openValue,
      valueAtOpeningPaise: openValue,
    },
  };
}

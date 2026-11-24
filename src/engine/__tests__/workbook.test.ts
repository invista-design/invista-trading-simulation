import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { openingPrice, processPhase, validateOrder, type PhaseAsset, type PhaseRules, type Position } from "../index";

/**
 * Parity with the master workbook. Each fixture holds 3 phases of orders that were pasted into the real
 * workbook and recalculated in LibreOffice; every expected number below was read from the workbook's
 * own Pricing and Portfolio sheets.
 */
interface Fixture {
  name: string;
  capitalPaise: number;
  assets: { code: string; unitsPerLot: string; initialPricePaise: number; supply: number }[];
  phases: {
    number: number;
    settings: Omit<PhaseRules, "phaseNumber" | "minDistinctAssets">;
    scores: Record<string, string>;
    overrides: Record<string, { type: "percent"; value: string } | { type: "price"; valuePaise: number }>;
    joining: string[];
    orders: { team: string; lines: Record<string, number> }[];
    expected: {
      assets: Record<string, { openingPricePaise: number; buyLots: number; sellLots: number; fillRatio: number; executedBuyLots: number; appliedChange: number; newPricePaise: number; newLotPricePaise: number }>;
      teams: Record<string, { cashAfterPaise: number; lotsAfter: Record<string, number>; valuePaise: number; openValuePaise: number | null }>;
    };
  }[];
}

const dir = path.join(__dirname, "fixtures");
const fixtures: Fixture[] = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));

describe.each(fixtures)("workbook scenario $name", (fx) => {
  it("matches every price, fill, lot, cash and portfolio value across 3 phases", () => {
    const positions = new Map<string, Position>();
    let previousClose: Record<string, number> = Object.fromEntries(fx.assets.map((a) => [a.code, a.initialPricePaise]));
    let checks = 0;
    for (const ph of fx.phases) {
      for (const t of ph.joining) positions.set(t, { teamId: t, cashPaise: fx.capitalPaise, lots: {} });
      const assets: PhaseAsset[] = fx.assets.map((a) => {
        const ov = ph.overrides[a.code];
        const open =
          ph.number === 1
            ? a.initialPricePaise
            : ov?.type === "percent"
              ? openingPrice(previousClose[a.code], "percent", ov.value)
              : ov?.type === "price"
                ? openingPrice(previousClose[a.code], "price", String(ov.valuePaise))
                : previousClose[a.code];
        return { assetId: a.code, code: a.code, unitsPerLot: a.unitsPerLot, openingPricePaise: open, supply: a.supply, newsScore: ph.scores[a.code] };
      });
      const rules: PhaseRules = { ...ph.settings, phaseNumber: ph.number, minDistinctAssets: 0 };
      // Every order the workbook accepted must also pass the website's validation.
      for (const o of ph.orders) {
        const v = validateOrder({ rules, assets, position: positions.get(o.team)!, lines: o.lines, capitalPaise: fx.capitalPaise });
        expect(v.issues, `${fx.name} phase ${ph.number} ${o.team}`).toEqual([]);
      }
      const res = processPhase({
        rules,
        capitalPaise: fx.capitalPaise,
        assets,
        positions: [...positions.values()],
        orders: ph.orders.map((o) => ({ teamId: o.team, lines: o.lines })),
      });
      for (const a of res.assets) {
        const e = ph.expected.assets[a.code];
        const tag = `${fx.name} phase ${ph.number} ${a.code}`;
        expect(a.openingPricePaise, tag).toBe(e.openingPricePaise);
        expect(a.buyLots, tag).toBe(e.buyLots);
        expect(a.sellLots, tag).toBe(e.sellLots);
        expect(Math.abs(Number(a.fillRatio) - e.fillRatio), tag).toBeLessThan(1e-12);
        expect(a.executedBuyLots, tag).toBe(e.executedBuyLots);
        expect(Math.abs(Number(a.appliedChange) - e.appliedChange), tag).toBeLessThan(1e-12);
        expect(a.newPricePaise, tag).toBe(e.newPricePaise);
        expect(a.newLotPricePaise, tag).toBe(e.newLotPricePaise);
        checks += 8;
      }
      expect(res.teams.length).toBe(Object.keys(ph.expected.teams).length);
      for (const t of res.teams) {
        const e = ph.expected.teams[t.teamId];
        const tag = `${fx.name} phase ${ph.number} ${t.teamId}`;
        expect(e, tag).toBeDefined();
        expect(t.cashAfterPaise, tag).toBe(e.cashAfterPaise);
        expect(t.valuePaise, tag).toBe(e.valuePaise);
        if (e.openValuePaise !== null) expect(t.openValuePaise, tag).toBe(e.openValuePaise);
        for (const code of Object.keys(e.lotsAfter)) expect(t.lotsAfter[code] ?? 0, `${tag} ${code}`).toBe(e.lotsAfter[code]);
        checks += 3 + Object.keys(e.lotsAfter).length;
        positions.set(t.teamId, { teamId: t.teamId, cashPaise: t.cashAfterPaise, lots: t.lotsAfter });
      }
      previousClose = Object.fromEntries(res.assets.map((a) => [a.code, a.newPricePaise]));
    }
    expect(checks).toBeGreaterThan(500);
  });
});

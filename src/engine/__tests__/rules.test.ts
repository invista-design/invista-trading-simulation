import { describe, expect, it } from "vitest";
import { lotPricePaise, parseLotInput, processPhase, rankTeams, suggestedSupply, validateOrder, type PhaseAsset, type PhaseRules } from "../index";

const capital = 100_000_000; // ₹10,00,000 in paise
const assets: PhaseAsset[] = [
  { assetId: "VRDB", code: "VRDB", unitsPerLot: "1", openingPricePaise: 164200, supply: 639, newsScore: "-0.26" },
  { assetId: "ORBT", code: "ORBT", unitsPerLot: "1", openingPricePaise: 138500, supply: 758, newsScore: "-0.38" },
  { assetId: "AROG", code: "AROG", unitsPerLot: "1", openingPricePaise: 97800, supply: 1074, newsScore: "0.05" },
  { assetId: "GOLD", code: "GOLD", unitsPerLot: "0.1", openingPricePaise: 14317000, supply: 73, newsScore: "-0.12" },
];
const phase1: PhaseRules = {
  phaseNumber: 1, allowSell: false, neutralRatio: "1", newsSensitivity: "0.15", demandSensitivity: "0.1",
  maxMove: "0.15", capShare: "1", rationing: false, minDistinctAssets: 3,
};
const phase2: PhaseRules = { ...phase1, phaseNumber: 2, allowSell: true, neutralRatio: "0" };
const fresh = { teamId: "t", cashPaise: capital, lots: {} };
const codes = (r: { issues: { code: string }[] }) => r.issues.map((i) => i.code);

describe("lot input parsing", () => {
  it("accepts whole numbers and blank, rejects fractions and text", () => {
    expect(parseLotInput("")).toEqual({ ok: true, lots: 0 });
    expect(parseLotInput(" 25 ")).toEqual({ ok: true, lots: 25 });
    expect(parseLotInput("-10")).toEqual({ ok: true, lots: -10 });
    expect(parseLotInput("2.0")).toEqual({ ok: true, lots: 2 });
    expect(parseLotInput("2.5").ok).toBe(false);
    expect(parseLotInput("abc").ok).toBe(false);
    expect(parseLotInput("1e3").ok).toBe(false);
  });
});

describe("lot prices", () => {
  it("prices gold and silver per lot, not per quote unit", () => {
    expect(lotPricePaise(14317000, "0.1")).toBe(1431700); // ₹1,43,170 per 10 grams = ₹14,317 per 1-gram lot
    expect(lotPricePaise(18728000, "0.1")).toBe(1872800); // ₹1,87,280 per kilogram = ₹18,728 per 100-gram lot
    expect(lotPricePaise(12627594, "0.1")).toBe(1262759); // rounds half away from zero
  });
});

describe("order validation", () => {
  it("accepts a valid Phase 1 order covering 3 assets", () => {
    const r = validateOrder({ rules: phase1, assets, position: fresh, lines: { VRDB: 10, ORBT: 10, GOLD: 2 }, capitalPaise: capital });
    expect(r.ok).toBe(true);
    expect(r.summary.cashAfterPaise).toBe(capital - 10 * 164200 - 10 * 138500 - 2 * 1431700);
  });
  it("blocks fewer distinct assets than the configured minimum", () => {
    const r = validateOrder({ rules: phase1, assets, position: fresh, lines: { VRDB: 10, ORBT: 10 }, capitalPaise: capital });
    expect(codes(r)).toEqual(["minimum_assets"]);
    const relaxed = validateOrder({ rules: { ...phase1, minDistinctAssets: 2 }, assets, position: fresh, lines: { VRDB: 10, ORBT: 10 }, capitalPaise: capital });
    expect(relaxed.ok).toBe(true);
  });
  it("blocks selling in Phase 1", () => {
    const r = validateOrder({ rules: phase1, assets, position: fresh, lines: { VRDB: -1, ORBT: 1, AROG: 1 }, capitalPaise: capital });
    expect(codes(r)).toContain("selling_not_allowed");
    expect(r.issues[0].message).toBe("Selling is not allowed in Phase 1");
  });
  it("blocks fractional lots", () => {
    const r = validateOrder({ rules: phase1, assets, position: fresh, lines: { VRDB: 1.5, ORBT: 1, AROG: 1 }, capitalPaise: capital });
    expect(codes(r)).toContain("fractional");
  });
  it("blocks an order above available cash, at the exact paisa", () => {
    const exact = validateOrder({ rules: { ...phase1, minDistinctAssets: 0 }, assets, position: { ...fresh, cashPaise: 164200 }, lines: { VRDB: 1 }, capitalPaise: capital });
    expect(exact.ok).toBe(true);
    const over = validateOrder({ rules: { ...phase1, minDistinctAssets: 0 }, assets, position: { ...fresh, cashPaise: 164199 }, lines: { VRDB: 1 }, capitalPaise: capital });
    expect(codes(over)).toEqual(["insufficient_cash"]);
  });
  it("lets sale proceeds fund purchases in the same order (rulebook 4.3)", () => {
    const pos = { teamId: "t", cashPaise: 0, lots: { GOLD: 10 } };
    const r = validateOrder({ rules: phase2, assets, position: pos, lines: { GOLD: -10, VRDB: 10, ORBT: 10 }, capitalPaise: capital });
    expect(r.ok).toBe(true);
  });
  it("blocks short selling", () => {
    const pos = { teamId: "t", cashPaise: capital, lots: { GOLD: 5 } };
    const r = validateOrder({ rules: phase2, assets, position: pos, lines: { GOLD: -6, VRDB: 1, ORBT: 1 }, capitalPaise: capital });
    expect(codes(r)).toEqual(["short_selling"]);
  });
  it("blocks sales when selling is switched off", () => {
    const pos = { teamId: "t", cashPaise: capital, lots: { GOLD: 5 } };
    const r = validateOrder({ rules: { ...phase2, allowSell: false }, assets, position: pos, lines: { GOLD: -1, VRDB: 1, ORBT: 1 }, capitalPaise: capital });
    expect(r.issues[0].message).toBe("Selling is switched off in this phase");
  });
  it("applies the concentration cap with the workbook base for each phase", () => {
    const capped = { ...phase1, capShare: "0.4" }; // limit ₹4,00,000 of starting capital in Phase 1
    const under = validateOrder({ rules: capped, assets, position: fresh, lines: { GOLD: 27, VRDB: 1, ORBT: 1 }, capitalPaise: capital });
    expect(under.ok).toBe(true); // 27 x ₹14,317 = ₹3,86,559
    const over = validateOrder({ rules: capped, assets, position: fresh, lines: { GOLD: 28, VRDB: 1, ORBT: 1 }, capitalPaise: capital });
    expect(codes(over)).toEqual(["concentration_cap"]); // 28 x ₹14,317 = ₹4,00,876
    // Later phases measure against the portfolio value at opening prices, counting lots already held.
    const pos = { teamId: "t", cashPaise: 50_000_000, lots: { GOLD: 20 } }; // ₹5,00,000 + 20 x ₹14,317 = ₹7,86,340
    const ok2 = validateOrder({ rules: { ...phase2, capShare: "0.4" }, assets, position: pos, lines: { GOLD: 1, VRDB: 1, ORBT: 1 }, capitalPaise: capital });
    expect(ok2.ok).toBe(true); // 21 lots = ₹3,00,657, limit ₹3,14,536
    const bad2 = validateOrder({ rules: { ...phase2, capShare: "0.4" }, assets, position: pos, lines: { GOLD: 2, VRDB: 1, ORBT: 1 }, capitalPaise: capital });
    expect(codes(bad2)).toEqual(["concentration_cap"]); // 22 lots = ₹3,14,974 is above ₹3,14,536
  });
  it("reports every problem at once", () => {
    const r = validateOrder({ rules: phase1, assets, position: fresh, lines: { VRDB: -1, ORBT: 1.5 }, capitalPaise: capital });
    expect(codes(r).sort()).toEqual(["fractional", "minimum_assets", "selling_not_allowed"]);
  });
});

describe("minimum trades after execution", () => {
  it("does not count a purchase rationed to 0 lots", () => {
    const tiny: PhaseAsset[] = [
      { ...assets[0], supply: 50 },
      { ...assets[1] },
      { ...assets[2] },
    ];
    const res = processPhase({
      rules: { ...phase1, rationing: true },
      capitalPaise: capital,
      assets: tiny,
      positions: [
        { teamId: "a", cashPaise: capital, lots: {} },
        { teamId: "b", cashPaise: capital, lots: {} },
      ],
      orders: [
        { teamId: "a", lines: { VRDB: 1, ORBT: 1, AROG: 1 } }, // VRDB fill 50/101: 1 lot becomes 0
        { teamId: "b", lines: { VRDB: 100, ORBT: 1, AROG: 1 } }, // 100 lots become 49
      ],
    });
    const a = res.teams.find((t) => t.teamId === "a")!;
    expect(a.executedLines.VRDB).toBeUndefined();
    expect(a.lotsAfter.VRDB).toBe(0);
    expect(a.tradesExecuted).toBe(2);
    expect(a.meetsMinimum).toBe(false);
    const b = res.teams.find((t) => t.teamId === "b")!;
    expect(b.executedLines.VRDB).toBe(49);
    expect(b.tradesExecuted).toBe(3);
    expect(b.meetsMinimum).toBe(true);
  });
  it("marks a team with no order as below the minimum", () => {
    const res = processPhase({ rules: phase1, capitalPaise: capital, assets, positions: [fresh], orders: [] });
    expect(res.teams[0].tradesExecuted).toBe(0);
    expect(res.teams[0].meetsMinimum).toBe(false);
    expect(res.teams[0].valuePaise).toBe(capital);
  });
});

describe("ranking (rulebook 7.6)", () => {
  it("breaks ties by previous value, then by earlier last order", () => {
    const r = rankTeams([
      { teamId: "a", name: "A", valuePaise: 100, previousValuePaise: 50, lastOrderAt: "2026-12-01T10:05:00Z" },
      { teamId: "b", name: "B", valuePaise: 100, previousValuePaise: 60, lastOrderAt: "2026-12-01T10:09:00Z" },
      { teamId: "c", name: "C", valuePaise: 100, previousValuePaise: 60, lastOrderAt: "2026-12-01T10:01:00Z" },
      { teamId: "d", name: "D", valuePaise: 200, previousValuePaise: 0, lastOrderAt: null },
    ]);
    expect(r.map((x) => `${x.teamId}${x.rank}`)).toEqual(["d1", "c2", "b3", "a4"]);
  });
});

describe("supply calibration", () => {
  it("reproduces the workbook's suggested supply for 15 teams", () => {
    expect(suggestedSupply(15, capital, "0.7", 10, 164200)).toBe(639);
    expect(suggestedSupply(15, capital, "0.7", 10, 1431700)).toBe(73);
    expect(suggestedSupply(15, capital, "0.7", 10, 18600)).toBe(5645);
  });
});

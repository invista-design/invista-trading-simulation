"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { inr, num, pct, tone } from "@/lib/format";

export interface MarketRow {
  id: string;
  code: string;
  name: string;
  sector: string;
  assetType: string;
  quoteUnit: string;
  lotDefinition: string;
  pricePaise: number;
  lotPricePaise: number;
  previousPricePaise: number | null;
  changePaise: number;
  changeFraction: number;
  held: number;
}

type Key = "code" | "pricePaise" | "changePaise" | "changeFraction" | "held";

export function MarketTable({ rows, canTrade, allowSell }: { rows: MarketRow[]; canTrade: boolean; allowSell: boolean }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("All");
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "code", dir: 1 });
  const shown = useMemo(() => {
    const f = rows.filter((r) => (type === "All" || r.assetType === type) && `${r.code} ${r.name} ${r.sector}`.toLowerCase().includes(q.toLowerCase()));
    return [...f].sort((a, b) => (a[sort.key] > b[sort.key] ? 1 : a[sort.key] < b[sort.key] ? -1 : 0) * sort.dir);
  }, [rows, q, type, sort]);
  const th = (key: Key, label: string, right = true) => (
    <th className={right ? "text-right" : ""}>
      <button type="button" className="uppercase" onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : 1 }))}>
        {label}
        {sort.key === key ? (sort.dir === 1 ? " (low first)" : " (high first)") : ""}
      </button>
    </th>
  );
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap gap-2 border-b border-line p-3">
        <input className="input max-w-64" placeholder="Search asset or sector" value={q} onChange={(e) => setQ(e.target.value)} />
        {["All", "Stock", "Commodity"].map((t) => (
          <button key={t} type="button" onClick={() => setType(t)} className={`btn btn-sm ${type === t ? "border-accent text-accent" : ""}`}>
            {t === "All" ? "All assets" : t === "Stock" ? "Stocks" : "Commodities"}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="tbl min-w-[880px]">
          <thead>
            <tr>
              {th("code", "Asset", false)}
              <th>Sector</th>
              {th("pricePaise", "Price")}
              <th className="text-right">Previous</th>
              {th("changePaise", "Change")}
              {th("changeFraction", "Change %")}
              <th className="text-right">Price per lot</th>
              {th("held", "Held")}
              <th className="text-right">Trade</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/markets/${r.code}`} className="font-semibold hover:text-accent">
                    {r.code}
                  </Link>
                  <div className="text-xs text-muted">{r.name}</div>
                </td>
                <td className="text-muted">{r.sector}</td>
                <td className="num text-right font-semibold">
                  {inr(r.pricePaise)}
                  <div className="text-xs font-normal text-muted">{r.quoteUnit}</div>
                </td>
                <td className="num text-right text-muted">{r.previousPricePaise == null ? "" : inr(r.previousPricePaise)}</td>
                <td className={`num text-right ${tone(r.changePaise)}`}>{r.previousPricePaise == null ? "" : `${r.changePaise > 0 ? "+" : r.changePaise < 0 ? "-" : ""}${inr(Math.abs(r.changePaise))}`}</td>
                <td className={`num text-right ${tone(r.changeFraction)}`}>{r.previousPricePaise == null ? "" : pct(r.changeFraction)}</td>
                <td className="num text-right">
                  {inr(r.lotPricePaise)}
                  <div className="text-xs text-muted">{r.lotDefinition}</div>
                </td>
                <td className="num text-right">{num(r.held)}</td>
                <td className="text-right">
                  <div className="inline-flex gap-1">
                    <Link href={`/trade?asset=${r.code}&side=buy`} className={`btn btn-sm border-up/50 text-up ${canTrade ? "" : "pointer-events-none opacity-40"}`}>
                      Buy
                    </Link>
                    <Link href={`/trade?asset=${r.code}&side=sell`} className={`btn btn-sm border-down/50 text-down ${canTrade && allowSell && r.held > 0 ? "" : "pointer-events-none opacity-40"}`}>
                      Sell
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

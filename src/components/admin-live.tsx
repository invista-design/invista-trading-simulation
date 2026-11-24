"use client";
import { useEffect, useState } from "react";
import { inr, pct, tone } from "@/lib/format";

interface LiveData {
  phase: number | null;
  status?: string;
  minAssets?: number;
  teams: { teamId: string; name: string; hasOrder: boolean; assets: number; submittedAt: string | null; meets: boolean }[];
  assets: { assetId: string; code: string; buyLots: number; sellLots: number; netDemand: number; supply: number; demandRatio: string; newsEffect: string; demandEffect: string; appliedChange: string; openingPricePaise: number; newPricePaise: number }[];
}

/** Live compliance board and projected prices for the running phase. Refreshes every 5 seconds. */
export function AdminLive({ showPrices = true }: { showPrices?: boolean }) {
  const [d, setD] = useState<LiveData | null>(null);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/admin/live", { cache: "no-store" });
        if (r.ok) setD(await r.json());
      } catch {}
      if (!stop) setTimeout(tick, 5000);
    };
    tick();
    return () => {
      stop = true;
    };
  }, []);
  if (!d) return <div className="text-sm text-muted">Loading live data</div>;
  if (!d.phase || d.teams.length === 0) return <div className="text-sm text-muted">No phase is running. Open a phase to see live submissions.</div>;
  const missing = d.teams.filter((t) => !t.meets);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="card px-4 py-3">
          <div className="text-xs uppercase text-muted">Teams in phase</div>
          <div className="num text-xl font-semibold">{d.teams.length}</div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-xs uppercase text-muted">Accepted orders</div>
          <div className="num text-xl font-semibold text-up">{d.teams.length - missing.length}</div>
        </div>
        <div className={`card px-4 py-3 ${missing.length ? "border-down/50" : ""}`}>
          <div className="text-xs uppercase text-muted">Without an accepted order</div>
          <div className={`num text-xl font-semibold ${missing.length ? "text-down" : ""}`}>{missing.length}</div>
        </div>
      </div>
      <div className="card max-h-96 overflow-auto">
        <table className="tbl">
          <thead className="sticky top-0 bg-panel">
            <tr>
              <th>Team</th>
              <th className="text-right">Assets in order</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {d.teams.map((t) => (
              <tr key={t.teamId} className={t.meets ? "" : "bg-downsoft/50"}>
                <td>{t.name}</td>
                <td className="num text-right">{t.hasOrder ? t.assets : ""}</td>
                <td className={t.meets ? "text-up" : "font-semibold text-down"}>
                  {t.meets ? `Accepted ${t.submittedAt ? new Date(t.submittedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }) : ""}` : `No accepted order (minimum ${d.minAssets} assets)`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showPrices && d.assets.length ? (
        <div className="card overflow-x-auto">
          <div className="border-b border-line px-4 py-2 text-xs text-muted">Projected from the orders accepted so far. Confidential: never shown to teams.</div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Asset</th>
                <th className="text-right">Bought</th>
                <th className="text-right">Sold</th>
                <th className="text-right">Net to supply</th>
                <th className="text-right">News effect</th>
                <th className="text-right">Demand effect</th>
                <th className="text-right">Projected change</th>
                <th className="text-right">Projected price</th>
              </tr>
            </thead>
            <tbody>
              {d.assets.map((a) => (
                <tr key={a.assetId}>
                  <td className="font-semibold">{a.code}</td>
                  <td className="num text-right">{a.buyLots}</td>
                  <td className="num text-right">{a.sellLots}</td>
                  <td className="num text-right">{Number(a.demandRatio).toFixed(3)}</td>
                  <td className={`num text-right ${tone(a.newsEffect)}`}>{pct(a.newsEffect)}</td>
                  <td className={`num text-right ${tone(a.demandEffect)}`}>{pct(a.demandEffect)}</td>
                  <td className={`num text-right font-semibold ${tone(a.appliedChange)}`}>{pct(a.appliedChange)}</td>
                  <td className="num text-right">{inr(a.newPricePaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

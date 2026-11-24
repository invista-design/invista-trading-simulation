"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ValidationIssue } from "@/engine/types";
import { parseLotInput, validateOrder } from "@/engine/validate";
import { inr, num } from "@/lib/format";

export interface TerminalAsset {
  id: string;
  code: string;
  name: string;
  lotDefinition: string;
  quoteUnit: string;
  unitsPerLot: string;
  openingPricePaise: number;
  lotPricePaise: number;
}

export interface TerminalProps {
  teamId: string;
  phase: { number: number; name: string; status: string; allowSell: boolean; minDistinctAssets: number; capShare: string };
  canSubmit: boolean;
  blockedReason: string | null;
  assets: TerminalAsset[];
  cashPaise: number;
  lots: Record<string, number>;
  capitalPaise: number;
  liveOrder: { lines: Record<string, number>; submittedAt: string } | null;
}

type Side = "buy" | "sell";
type Row = { side: Side; qty: string };

const emptyRows = (assets: TerminalAsset[]) => Object.fromEntries(assets.map((a) => [a.id, { side: "buy" as Side, qty: "" }]));
const rowsFromLines = (assets: TerminalAsset[], lines: Record<string, number>) =>
  Object.fromEntries(assets.map((a) => [a.id, { side: (lines[a.id] ?? 0) < 0 ? "sell" : "buy", qty: lines[a.id] ? String(Math.abs(lines[a.id])) : "" } as Row]));

export function Terminal(props: TerminalProps) {
  const { assets, phase } = props;
  const router = useRouter();
  const params = useSearchParams();
  const draftKey = `draft:${props.teamId}:${phase.number}`;
  const [rows, setRows] = useState<Record<string, Row>>(() => emptyRows(assets));
  const [stage, setStage] = useState<"edit" | "review" | "sending" | "done">("edit");
  const [serverIssues, setServerIssues] = useState<ValidationIssue[]>([]);
  const [receipt, setReceipt] = useState<{ at: string; duplicate: boolean } | null>(null);
  const [rationale, setRationale] = useState("");
  const clientKey = useRef<string | null>(null);
  const focusCode = params.get("asset");

  // Restore a saved draft, else start from the accepted order, else empty.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        setRows({ ...emptyRows(assets), ...JSON.parse(saved) });
        return;
      }
    } catch {}
    if (props.liveOrder) setRows(rowsFromLines(assets, props.liveOrder.lines));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    if (!focusCode) return;
    const a = assets.find((x) => x.code === focusCode);
    if (!a) return;
    const side = params.get("side") === "sell" ? "sell" : "buy";
    setRows((r) => ({ ...r, [a.id]: { ...r[a.id], side } }));
    setTimeout(() => document.getElementById(`qty-${a.id}`)?.focus(), 50);
  }, [focusCode, assets, params]);

  const save = (next: Record<string, Row>) => {
    setRows(next);
    setServerIssues([]);
    clientKey.current = null;
    try {
      localStorage.setItem(draftKey, JSON.stringify(next));
    } catch {}
  };

  // Parse every row and run the same validation the server runs.
  const analysis = useMemo(() => {
    const rowIssues: Record<string, string[]> = {};
    const lines: Record<string, number> = {};
    for (const a of assets) {
      const r = rows[a.id] ?? { side: "buy", qty: "" };
      const raw = r.qty.trim();
      if (!raw) continue;
      if (raw.startsWith("-") || raw.startsWith("+")) {
        rowIssues[a.id] = ["Enter a positive number of lots and choose Buy or Sell"];
        continue;
      }
      const p = parseLotInput(raw);
      if (!p.ok) {
        rowIssues[a.id] = [p.message];
        continue;
      }
      if (p.lots !== 0) lines[a.id] = r.side === "sell" ? -p.lots : p.lots;
    }
    const v = validateOrder({
      rules: { phaseNumber: phase.number, allowSell: phase.allowSell, minDistinctAssets: phase.minDistinctAssets, capShare: phase.capShare },
      assets: assets.map((a) => ({ assetId: a.id, code: a.code, unitsPerLot: a.unitsPerLot, openingPricePaise: a.openingPricePaise })),
      position: { teamId: props.teamId, cashPaise: props.cashPaise, lots: props.lots },
      lines,
      capitalPaise: props.capitalPaise,
    });
    const general: string[] = [];
    for (const i of v.issues) {
      if (i.assetId) (rowIssues[i.assetId] ??= []).push(i.message);
      else general.push(i.message);
    }
    const hasRowErrors = Object.keys(rowIssues).length > 0;
    return { lines, summary: v.summary, rowIssues, general, ok: v.ok && !hasRowErrors };
  }, [rows, assets, phase, props.cashPaise, props.lots, props.capitalPaise, props.teamId]);

  const traded = Object.keys(analysis.lines).length;
  const valueAtOpening = analysis.summary.openValuePaise;

  async function submit() {
    setStage("sending");
    setServerIssues([]);
    clientKey.current ??= crypto.randomUUID();
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: phase.number, lines: analysis.lines, clientKey: clientKey.current, rationale }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setServerIssues(data.issues ?? [{ code: "error", message: "The order was not accepted" }]);
        setStage("edit");
        return;
      }
      setReceipt({ at: data.submittedAt, duplicate: data.duplicate });
      setStage("done");
      try {
        localStorage.removeItem(draftKey);
      } catch {}
      clientKey.current = null;
      router.refresh();
    } catch {
      setServerIssues([{ code: "network", message: "Connection problem. Your order may not have reached the server. Press Submit again: a repeated submission is recognised and never counted twice" }]);
      setStage("review");
    }
  }

  const serverRow = (id: string) => serverIssues.filter((i) => i.assetId === id).map((i) => i.message);
  const serverGeneral = serverIssues.filter((i) => !i.assetId).map((i) => i.message);

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="text-sm font-semibold">
            Order sheet · {phase.name}
            <span className="ml-2 font-normal text-muted">{phase.allowSell ? "Buy or sell" : "Buy only"} · at least {phase.minDistinctAssets} assets</span>
          </div>
          <div className="flex gap-2">
            {props.liveOrder ? (
              <button type="button" className="btn btn-sm" onClick={() => save(rowsFromLines(assets, props.liveOrder!.lines))}>
                Load accepted order
              </button>
            ) : null}
            <button type="button" className="btn btn-sm" onClick={() => save(emptyRows(assets))}>
              Clear
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="tbl tbl-stack md:min-w-[860px]">
            <thead>
              <tr>
                <th>Asset</th>
                <th className="text-right">Held</th>
                <th className="text-right">Price per lot</th>
                <th>Side</th>
                <th>Lots</th>
                <th className="text-right">Value</th>
                <th className="text-right">Lots after</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => {
                const r = rows[a.id] ?? { side: "buy", qty: "" };
                const q = analysis.lines[a.id] ?? 0;
                const errs = [...(analysis.rowIssues[a.id] ?? []), ...serverRow(a.id)];
                const held = props.lots[a.id] ?? 0;
                return (
                  <tr key={a.id} className={errs.length ? "bg-downsoft/40" : q !== 0 ? "bg-accentsoft/30" : ""}>
                    <td className="stack-full">
                      <div className="font-semibold">{a.code}</div>
                      <div className="text-xs text-muted">
                        {a.name} · {a.lotDefinition}
                      </div>
                      {errs.map((e) => (
                        <div key={e} className="mt-1 text-xs font-medium text-down">
                          {e}
                        </div>
                      ))}
                    </td>
                    <td className="num text-right" data-label="Held">{num(held)}</td>
                    <td className="num text-right" data-label="Price per lot">
                      {inr(a.lotPricePaise)}
                      <div className="text-xs text-muted">
                        {inr(a.openingPricePaise)} {a.quoteUnit}
                      </div>
                    </td>
                    <td data-label="Side">
                      <div className="inline-flex overflow-hidden rounded-lg border border-line text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => save({ ...rows, [a.id]: { ...r, side: "buy" } })}
                          className={`px-3 py-1.5 ${r.side === "buy" ? "bg-up text-white" : "text-muted"}`}
                          aria-pressed={r.side === "buy"}
                        >
                          Buy
                        </button>
                        <button
                          type="button"
                          disabled={!phase.allowSell}
                          title={phase.allowSell ? "" : phase.number === 1 ? "Selling is not allowed in Phase 1" : "Selling is switched off in this phase"}
                          onClick={() => save({ ...rows, [a.id]: { ...r, side: "sell" } })}
                          className={`px-3 py-1.5 disabled:opacity-40 ${r.side === "sell" ? "bg-down text-white" : "text-muted"}`}
                          aria-pressed={r.side === "sell"}
                        >
                          Sell
                        </button>
                      </div>
                    </td>
                    <td data-label="Lots">
                      <input
                        id={`qty-${a.id}`}
                        inputMode="numeric"
                        aria-label={`Lots of ${a.code}`}
                        className={`input num w-28 ${errs.length ? "border-down" : ""}`}
                        value={r.qty}
                        placeholder="0"
                        disabled={stage === "sending"}
                        onChange={(e) => save({ ...rows, [a.id]: { ...r, qty: e.target.value } })}
                      />
                      {r.side === "sell" && held > 0 ? (
                        <button type="button" className="ml-2 text-xs text-accent underline" onClick={() => save({ ...rows, [a.id]: { side: "sell", qty: String(held) } })}>
                          All
                        </button>
                      ) : null}
                    </td>
                    <td data-label="Value" className={`num text-right ${q > 0 ? "text-up" : q < 0 ? "text-down" : "text-muted"}`}>{q ? inr(Math.abs(q) * a.lotPricePaise) : ""}</td>
                    <td className="num text-right" data-label="Lots after">{num(held + q)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="card p-4">
          <div className="text-sm font-semibold">Order summary</div>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Cash available</dt><dd className="num">{inr(props.cashPaise)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Purchases</dt><dd className="num text-up">{inr(analysis.summary.buyValuePaise)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Sale proceeds</dt><dd className="num text-down">{inr(analysis.summary.sellValuePaise)}</dd></div>
            <div className="flex justify-between border-t border-line pt-2 font-semibold">
              <dt>Cash after</dt>
              <dd className={`num ${analysis.summary.cashAfterPaise < 0 ? "text-down" : ""}`}>{inr(analysis.summary.cashAfterPaise)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Assets traded</dt>
              <dd className={`num font-semibold ${traded >= phase.minDistinctAssets ? "text-up" : "text-warn"}`}>
                {traded} of {phase.minDistinctAssets} required
              </dd>
            </div>
            <div className="flex justify-between"><dt className="text-muted">Portfolio value at opening prices</dt><dd className="num">{inr(valueAtOpening)}</dd></div>
          </dl>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-panel2" title="Share of portfolio value invested after this order">
            <div className="h-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, ((valueAtOpening - analysis.summary.cashAfterPaise) / Math.max(1, valueAtOpening)) * 100))}%` }} />
          </div>
          <div className="mt-1 text-xs text-muted">Invested after this order: {(((valueAtOpening - analysis.summary.cashAfterPaise) / Math.max(1, valueAtOpening)) * 100).toFixed(1)}%</div>
        </div>

        {[...analysis.general, ...serverGeneral].length > 0 ? (
          <div role="alert" className="rounded-lg border border-down/40 bg-downsoft p-3 text-sm text-down">
            <div className="font-semibold">Fix before submitting</div>
            <ul className="mt-1 list-disc pl-5">
              {[...analysis.general, ...serverGeneral].map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {props.liveOrder && stage !== "done" ? (
          <div className="rounded-lg border border-up/40 bg-upsoft p-3 text-sm text-up">
            Accepted order on file ({Object.keys(props.liveOrder.lines).length} assets). A new submission replaces it.
          </div>
        ) : null}

        {stage === "done" && receipt ? (
          <div className="rounded-lg border border-up/40 bg-upsoft p-3 text-sm text-up" role="status">
            <div className="font-semibold">Order accepted{receipt.duplicate ? " (already received)" : ""}</div>
            <div>
              Registered at {new Date(receipt.at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}. It executes at these prices when the phase closes. You can still replace it until then.
            </div>
            <button type="button" className="btn btn-sm mt-2" onClick={() => setStage("edit")}>
              Edit order
            </button>
          </div>
        ) : null}

        {!props.canSubmit ? (
          <div className="rounded-lg border border-warn/40 bg-warnsoft p-3 text-sm text-warn">{props.blockedReason ?? "Trading is not open. You can still plan your order."}</div>
        ) : null}

        <label className="block">
          <span className="label">Note for your team (optional)</span>
          <textarea className="input" rows={2} maxLength={1000} value={rationale} onChange={(e) => setRationale(e.target.value)} />
        </label>

        <button type="button" className="btn btn-primary w-full py-3" disabled={!analysis.ok || !props.canSubmit || stage === "sending"} onClick={() => setStage("review")}>
          Review order
        </button>
        {!analysis.ok && props.canSubmit ? <p className="text-center text-xs text-muted">The button unlocks when every rule is met.</p> : null}
      </aside>

      {stage === "review" || stage === "sending" ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Review order">
          <div className="card w-full max-w-lg p-5">
            <div className="text-lg font-semibold">Confirm your {phase.name} order</div>
            <p className="mt-1 text-sm text-muted">Orders execute at the opening prices below when the phase closes. Only your last accepted order counts.</p>
            <table className="tbl mt-3">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Side</th>
                  <th className="text-right">Lots</th>
                  <th className="text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {assets
                  .filter((a) => analysis.lines[a.id])
                  .map((a) => {
                    const q = analysis.lines[a.id];
                    return (
                      <tr key={a.id}>
                        <td className="font-semibold">{a.code}</td>
                        <td className={q > 0 ? "text-up" : "text-down"}>{q > 0 ? "Buy" : "Sell"}</td>
                        <td className="num text-right">{num(Math.abs(q))}</td>
                        <td className="num text-right">{inr(Math.abs(q) * a.lotPricePaise)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            <div className="mt-3 flex justify-between text-sm font-semibold">
              <span>Cash after</span>
              <span className="num">{inr(analysis.summary.cashAfterPaise)}</span>
            </div>
            {serverIssues.length ? <div className="mt-3 text-sm text-down">{serverIssues.map((i) => i.message).join(". ")}</div> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn" disabled={stage === "sending"} onClick={() => setStage("edit")}>
                Back
              </button>
              <button type="button" className="btn btn-primary" disabled={stage === "sending"} onClick={submit}>
                {stage === "sending" ? "Submitting" : "Submit order"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

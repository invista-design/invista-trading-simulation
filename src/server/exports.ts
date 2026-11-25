import "server-only";
import { phone as formatPhone } from "@/lib/format";
import ExcelJS from "exceljs";
import { asc, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getAssets, getConfirmedRuns, getPhases } from "./core";
import { leaderboard } from "./views";

type ColType = "text" | "money" | "int" | "pct" | "decimal" | "date";
interface Col {
  header: string;
  key: string;
  type: ColType;
}
export interface Table {
  title: string;
  columns: Col[];
  rows: Record<string, unknown>[];
}

export const EXPORT_KINDS = {
  summary: "Competition summary",
  portfolios: "Team portfolios by phase",
  orders: "Order history",
  executions: "Executed transactions",
  market: "Demand, supply and price movements",
  leaderboards: "Leaderboards by phase",
  attempts: "Blocked order attempts",
  teams: "Registered teams",
  audit: "Audit log",
} as const;
export type ExportKind = keyof typeof EXPORT_KINDS;

const rupees = (paise: number | null | undefined) => (paise == null ? null : paise / 100);

export async function buildTables(kind: ExportKind): Promise<Table[]> {
  const db = getDb();
  const [phases, assets, runs, teams] = await Promise.all([getPhases(db), getAssets(db, true), getConfirmedRuns(db), db.select().from(schema.teams).orderBy(asc(schema.teams.name))]);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const assetCode = new Map(assets.map((a) => [a.id, a.code]));
  const lotCols: Col[] = assets.map((a) => ({ header: `Lots ${a.code}`, key: `lots_${a.id}`, type: "int" }));

  if (kind === "portfolios") {
    const rows: Record<string, unknown>[] = [];
    for (const p of phases) {
      const r = runs.get(p.number);
      if (!r) continue;
      for (const t of r.result.teams) {
        const row: Record<string, unknown> = {
          phase: p.name,
          team: teamName.get(t.teamId),
          open: rupees(t.openValuePaise),
          cash: rupees(t.cashAfterPaise),
          holdings: rupees(t.holdingsValuePaise),
          value: rupees(t.valuePaise),
          pnl: rupees(t.phasePnlPaise),
          ret: Number(t.phaseReturn),
          overall: Number(t.overallReturn),
          trades: t.tradesExecuted,
        };
        for (const a of assets) row[`lots_${a.id}`] = t.lotsAfter[a.id] ?? 0;
        rows.push(row);
      }
    }
    return [{
      title: "Portfolios",
      columns: [
        { header: "Phase", key: "phase", type: "text" },
        { header: "Team", key: "team", type: "text" },
        { header: "Value at opening (₹)", key: "open", type: "money" },
        { header: "Cash after (₹)", key: "cash", type: "money" },
        { header: "Holdings value (₹)", key: "holdings", type: "money" },
        { header: "Portfolio value (₹)", key: "value", type: "money" },
        { header: "Phase profit and loss (₹)", key: "pnl", type: "money" },
        { header: "Phase return", key: "ret", type: "pct" },
        { header: "Overall return", key: "overall", type: "pct" },
        { header: "Assets traded", key: "trades", type: "int" },
        ...lotCols,
      ],
      rows,
    }];
  }

  if (kind === "orders") {
    const orders = await db.select().from(schema.orders).orderBy(asc(schema.orders.phaseNumber), asc(schema.orders.submittedAt));
    return [{
      title: "Orders",
      columns: [
        { header: "Order", key: "id", type: "text" },
        { header: "Phase", key: "phase", type: "int" },
        { header: "Team", key: "team", type: "text" },
        { header: "Submitted", key: "at", type: "date" },
        { header: "Status", key: "status", type: "text" },
        { header: "Source", key: "source", type: "text" },
        ...assets.map((a) => ({ header: `${a.code} lots (+ buy, - sell)`, key: `l_${a.id}`, type: "int" as const })),
        { header: "Reason voided", key: "voidReason", type: "text" },
        { header: "Rationale", key: "rationale", type: "text" },
      ],
      rows: orders.map((o) => ({
        id: o.id.slice(0, 8),
        phase: o.phaseNumber,
        team: teamName.get(o.teamId),
        at: o.submittedAt,
        status: o.status === "live" ? "Accepted" : o.status === "replaced" ? "Replaced" : "Voided",
        source: o.source,
        ...Object.fromEntries(assets.map((a) => [`l_${a.id}`, o.lines[a.id] ?? 0])),
        voidReason: o.voidReason ?? "",
        rationale: o.rationale,
      })),
    }];
  }

  if (kind === "executions") {
    const rows: Record<string, unknown>[] = [];
    for (const p of phases) {
      const r = runs.get(p.number);
      if (!r) continue;
      for (const t of r.result.teams) {
        for (const [assetId, q] of Object.entries(t.executedLines)) {
          const a = r.result.assets.find((x) => x.assetId === assetId)!;
          rows.push({
            phase: p.name,
            team: teamName.get(t.teamId),
            asset: assetCode.get(assetId),
            side: q > 0 ? "Buy" : "Sell",
            requested: Math.abs(t.orderLines[assetId] ?? 0),
            executed: Math.abs(q),
            price: rupees(a.openingLotPricePaise),
            value: rupees(Math.abs(q) * a.openingLotPricePaise),
          });
        }
      }
    }
    return [{
      title: "Executions",
      columns: [
        { header: "Phase", key: "phase", type: "text" },
        { header: "Team", key: "team", type: "text" },
        { header: "Asset", key: "asset", type: "text" },
        { header: "Side", key: "side", type: "text" },
        { header: "Lots requested", key: "requested", type: "int" },
        { header: "Lots executed", key: "executed", type: "int" },
        { header: "Price per lot (₹)", key: "price", type: "money" },
        { header: "Value (₹)", key: "value", type: "money" },
      ],
      rows,
    }];
  }

  if (kind === "market") {
    const rows: Record<string, unknown>[] = [];
    for (const p of phases) {
      const r = runs.get(p.number);
      if (!r) continue;
      for (const a of r.result.assets) {
        rows.push({
          phase: p.name, asset: a.code, open: rupees(a.openingPricePaise), supply: a.supply, buy: a.buyLots, sell: a.sellLots, net: a.netDemand,
          ratio: Number(a.demandRatio), fill: Number(a.fillRatio), executed: a.executedBuyLots, score: Number(a.newsScore), news: Number(a.newsEffect),
          demand: Number(a.demandEffect), combined: Number(a.combinedEffect), applied: Number(a.appliedChange), next: rupees(a.newPricePaise), nextLot: rupees(a.newLotPricePaise), direction: a.direction,
        });
      }
    }
    return [{
      title: "Market",
      columns: [
        { header: "Phase", key: "phase", type: "text" },
        { header: "Asset", key: "asset", type: "text" },
        { header: "Opening price (₹ per quote unit)", key: "open", type: "money" },
        { header: "Supply (lots)", key: "supply", type: "int" },
        { header: "Buy lots", key: "buy", type: "int" },
        { header: "Sell lots", key: "sell", type: "int" },
        { header: "Net demand (lots)", key: "net", type: "int" },
        { header: "Demand to supply ratio", key: "ratio", type: "decimal" },
        { header: "Fill ratio", key: "fill", type: "decimal" },
        { header: "Buy lots executed", key: "executed", type: "int" },
        { header: "News score", key: "score", type: "decimal" },
        { header: "News effect", key: "news", type: "pct" },
        { header: "Demand effect", key: "demand", type: "pct" },
        { header: "Combined effect", key: "combined", type: "pct" },
        { header: "Applied change (capped)", key: "applied", type: "pct" },
        { header: "Next price (₹ per quote unit)", key: "next", type: "money" },
        { header: "Next price per lot (₹)", key: "nextLot", type: "money" },
        { header: "Direction", key: "direction", type: "text" },
      ],
      rows,
    }];
  }

  if (kind === "leaderboards" || kind === "summary") {
    const tables: Table[] = [];
    if (kind === "summary") {
      const rows = assets.map((a) => {
        const row: Record<string, unknown> = { asset: a.code, name: a.name, initial: rupees(a.initialPricePaise) };
        for (const p of phases) {
          const r = runs.get(p.number)?.result.assets.find((x) => x.assetId === a.id);
          row[`o${p.number}`] = rupees(r?.openingPricePaise ?? null);
          row[`c${p.number}`] = rupees(r?.newPricePaise ?? null);
        }
        const last = runs.get(phases.at(-1)?.number ?? 0)?.result.assets.find((x) => x.assetId === a.id);
        row.season = last ? last.newPricePaise / a.initialPricePaise - 1 : null;
        return row;
      });
      tables.push({
        title: "Price path",
        columns: [
          { header: "Asset", key: "asset", type: "text" },
          { header: "Name", key: "name", type: "text" },
          { header: "Initial price (₹)", key: "initial", type: "money" },
          ...phases.flatMap((p) => [
            { header: `${p.name} opening (₹)`, key: `o${p.number}`, type: "money" as const },
            { header: `${p.name} result (₹)`, key: `c${p.number}`, type: "money" as const },
          ]),
          { header: "Season change", key: "season", type: "pct" },
        ],
        rows,
      });
      const teamRows = teams.map((t) => {
        const row: Record<string, unknown> = { team: t.name, status: t.status === "active" ? "Active" : `Disqualified in Phase ${t.disqualifiedPhase}: ${t.disqualifiedReason ?? ""}` };
        for (const p of phases) {
          const r = runs.get(p.number)?.result.teams.find((x) => x.teamId === t.id);
          row[`v${p.number}`] = rupees(r?.valuePaise ?? null);
          const board = leaderboard(p.number, phases, runs, teams, true);
          row[`r${p.number}`] = board?.find((x) => x.teamId === t.id)?.rank ?? null;
        }
        return row;
      });
      tables.push({
        title: "Teams",
        columns: [
          { header: "Team", key: "team", type: "text" },
          { header: "Status", key: "status", type: "text" },
          ...phases.flatMap((p) => [
            { header: `Value after ${p.name} (₹)`, key: `v${p.number}`, type: "money" as const },
            { header: `Rank after ${p.name}`, key: `r${p.number}`, type: "int" as const },
          ]),
        ],
        rows: teamRows,
      });
    }
    for (const p of phases) {
      const board = leaderboard(p.number, phases, runs, teams, true);
      if (!board) continue;
      tables.push({
        title: `${p.name} leaderboard`,
        columns: [
          { header: "Rank", key: "rank", type: "int" },
          { header: "Team", key: "name", type: "text" },
          { header: "Portfolio value (₹)", key: "value", type: "money" },
          { header: "Cash (₹)", key: "cash", type: "money" },
          { header: "Holdings value (₹)", key: "holdings", type: "money" },
          { header: "Phase return", key: "pr", type: "pct" },
          { header: "Overall return", key: "or", type: "pct" },
          { header: "Published", key: "pub", type: "text" },
        ],
        rows: board.map((b) => ({ rank: b.rank, name: b.name, value: rupees(b.valuePaise), cash: rupees(b.cashPaise), holdings: rupees(b.holdingsPaise), pr: Number(b.phaseReturn), or: Number(b.overallReturn), pub: p.status === "published" ? "Yes" : "No" })),
      });
    }
    return tables;
  }

  if (kind === "attempts") {
    const rows = await db.select().from(schema.orderAttempts).orderBy(desc(schema.orderAttempts.at));
    return [{
      title: "Blocked attempts",
      columns: [
        { header: "Time", key: "at", type: "date" },
        { header: "Phase", key: "phase", type: "int" },
        { header: "Team", key: "team", type: "text" },
        { header: "Problems", key: "issues", type: "text" },
      ],
      rows: rows.map((r) => ({ at: r.at, phase: r.phaseNumber, team: teamName.get(r.teamId), issues: r.issues.map((i) => i.message).join("; ") })),
    }];
  }

  if (kind === "teams") {
    const users = await db.select().from(schema.users).where(eq(schema.users.role, "team"));
    const ordered = [...teams].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const memberCols: Col[] = [1, 2, 3].flatMap((i) => [
      { header: `Member ${i} name`, key: `m${i}Name`, type: "text" as const },
      { header: `Member ${i} contact number`, key: `m${i}Phone`, type: "text" as const },
      { header: `Member ${i} email ID`, key: `m${i}Email`, type: "text" as const },
    ]);
    return [{
      title: "Registered teams",
      columns: [
        { header: "Serial number", key: "sn", type: "int" },
        { header: "Team name", key: "team", type: "text" },
        { header: "Team code", key: "code", type: "text" },
        ...memberCols,
        { header: "Registered at", key: "registeredAt", type: "date" },
        { header: "Registered by", key: "source", type: "text" },
        { header: "Login access", key: "login", type: "text" },
        { header: "Competition status", key: "status", type: "text" },
        { header: "Disqualified in phase", key: "dqPhase", type: "int" },
        { header: "Reason", key: "dqReason", type: "text" },
        { header: "Reinstatement note", key: "reinstated", type: "text" },
        { header: "Last login", key: "lastLogin", type: "date" },
      ],
      rows: ordered.map((t, idx) => {
        const u = users.find((x) => x.teamId === t.id);
        const row: Record<string, unknown> = {
          sn: idx + 1, team: t.name, code: t.code, registeredAt: t.createdAt, source: t.registrationSource === "website" ? "Team, on the website" : "Organiser",
          login: u?.active ? "On" : "Off", status: t.status === "active" ? "Active" : "Disqualified",
          dqPhase: t.disqualifiedPhase, dqReason: t.disqualifiedReason ?? "", reinstated: t.reinstatedNote ?? "", lastLogin: u?.lastLoginAt ?? null,
        };
        [0, 1, 2].forEach((i) => {
          const m = t.members[i];
          row[`m${i + 1}Name`] = m?.name ?? "";
          row[`m${i + 1}Phone`] = m?.phone ? formatPhone(m.phone) : "";
          row[`m${i + 1}Email`] = m?.email ?? "";
        });
        return row;
      }),
    }];
  }

  const log = await db.select().from(schema.auditLog).orderBy(desc(schema.auditLog.id));
  return [{
    title: "Audit log",
    columns: [
      { header: "Time", key: "at", type: "date" },
      { header: "Organiser", key: "username", type: "text" },
      { header: "Action", key: "action", type: "text" },
      { header: "Item", key: "entity", type: "text" },
      { header: "Reason", key: "reason", type: "text" },
      { header: "Before", key: "before", type: "text" },
      { header: "After", key: "after", type: "text" },
    ],
    rows: log.map((l) => ({ at: l.at, username: l.username, action: l.action, entity: `${l.entity} ${l.entityId}`.trim(), reason: l.reason, before: l.before ? JSON.stringify(l.before) : "", after: l.after ? JSON.stringify(l.after) : "" })),
  }];
}

const INDIAN_MONEY = '[>=10000000]##\\,##\\,##\\,##0.00;[>=100000]##\\,##\\,##0.00;##,##0.00';

export async function toXlsx(tables: Table[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Trading Simulation";
  for (const t of tables) {
    const ws = wb.addWorksheet(t.title.slice(0, 31).replace(/[\\/?*[\]:]/g, " "));
    ws.columns = t.columns.map((c) => ({ header: c.header, key: c.key, width: Math.min(48, Math.max(12, c.header.length + 2)) }));
    for (const r of t.rows) ws.addRow(Object.fromEntries(t.columns.map((c) => [c.key, r[c.key] ?? null])));
    t.columns.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      if (c.type === "money") col.numFmt = INDIAN_MONEY;
      if (c.type === "pct") col.numFmt = "0.00%";
      if (c.type === "decimal") col.numFmt = "0.0000";
      if (c.type === "int") col.numFmt = "0";
      if (c.type === "date") col.numFmt = "dd mmm yyyy hh:mm:ss";
    });
    ws.eachRow((row, i) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { name: "Calibri", size: 11, bold: i === 1 };
      });
    });
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function toCsv(table: Table): string {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = v instanceof Date ? v.toISOString() : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [table.columns.map((c) => esc(c.header)).join(","), ...table.rows.map((r) => table.columns.map((c) => esc(r[c.key])).join(","))].join("\n");
}

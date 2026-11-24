import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { buildTables, EXPORT_KINDS, toCsv, toXlsx, type ExportKind } from "@/server/exports";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "organiser") return NextResponse.json({ error: "Organiser only" }, { status: 403 });
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") as ExportKind;
  if (!(kind in EXPORT_KINDS)) return NextResponse.json({ error: "Unknown report" }, { status: 400 });
  const tables = await buildTables(kind);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  if (url.searchParams.get("format") === "csv") {
    const csv = "﻿" + tables.map((t) => (tables.length > 1 ? `${t.title}\n` : "") + toCsv(t)).join("\n\n");
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${kind}-${stamp}.csv"`, "Cache-Control": "no-store" } });
  }
  const buf = await toXlsx(tables);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${kind}-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

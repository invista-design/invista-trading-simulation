import { NextResponse } from "next/server";
import { assertSameOrigin, getSessionUser } from "@/lib/auth";
import { submitOrder } from "@/server/orders";

export const dynamic = "force-dynamic";

/** Team order submission. Every rule is enforced here on the server, whatever the browser did. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "team" || !user.teamId) return NextResponse.json({ ok: false, issues: [{ code: "auth", message: "Sign in again" }] }, { status: 401 });
  if (!(await assertSameOrigin())) return NextResponse.json({ ok: false, issues: [{ code: "origin", message: "Request blocked" }] }, { status: 403 });
  let body: { phase?: number; lines?: Record<string, string | number>; clientKey?: string; rationale?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, issues: [{ code: "bad_request", message: "Invalid request" }] }, { status: 400 });
  }
  if (!Number.isInteger(body.phase) || typeof body.lines !== "object" || body.lines === null) {
    return NextResponse.json({ ok: false, issues: [{ code: "bad_request", message: "Invalid order" }] }, { status: 400 });
  }
  const res = await submitOrder({
    teamId: user.teamId,
    userId: user.id,
    phaseNumber: body.phase!,
    lines: body.lines,
    clientKey: String(body.clientKey ?? ""),
    rationale: body.rationale,
  });
  return NextResponse.json(res, { status: res.ok ? 200 : res.status, headers: { "Cache-Control": "no-store" } });
}

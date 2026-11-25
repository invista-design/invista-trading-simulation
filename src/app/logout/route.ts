import { NextResponse } from "next/server";
import { getSessionUser, logout } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getSessionUser().catch(() => null);
  await logout();
  const page = user?.role === "organiser" ? "/organiser" : "/login";
  return NextResponse.redirect(new URL(`${page}?ok=Signed%20out`, req.url), { status: 303 });
}

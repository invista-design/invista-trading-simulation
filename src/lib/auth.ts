import "server-only";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { nameKey } from "@/lib/format";

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number, opts: crypto.ScryptOptions) => Promise<Buffer>;
const COOKIE = "ts_session";
const SESSION_HOURS = 72;
const MAX_FAILED = 10;
const LOCK_MINUTES = 5;
/** Team codes are short, so wrong guesses are throttled harder: 5 wrong codes pause that team's login for 2 minutes. */
const TEAM_MAX_FAILED = 5;
const TEAM_LOCK_MINUTES = 2;

export interface SessionUser {
  id: string;
  username: string;
  role: "organiser" | "team";
  teamId: string | null;
  displayName: string;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, hashB64] = stored.split("$");
  if (algo !== "scrypt") return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/** Readable random password: 3 groups of 4 characters without look-alike letters. */
export function generatePassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(12);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`;
}

const tokenId = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export type LoginResult = { ok: true; user: SessionUser } | { ok: false; message: string };

type UserRow = typeof schema.users.$inferSelect;
const lockedMessage = (until: Date) => `Too many incorrect attempts. Try again after ${until.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}`;

async function recordFailure(u: UserRow, max: number, lockMinutes: number) {
  const failed = u.failedLogins + 1;
  await getDb()
    .update(schema.users)
    .set({ failedLogins: failed >= max ? 0 : failed, lockedUntil: failed >= max ? new Date(Date.now() + lockMinutes * 60_000) : null })
    .where(eq(schema.users.id, u.id));
}

async function startSession(u: UserRow): Promise<SessionUser> {
  const db = getDb();
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);
  await db.insert(schema.sessions).values({ id: tokenId(token), userId: u.id, expiresAt });
  await db.update(schema.users).set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(schema.users.id, u.id));
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
  return { id: u.id, username: u.username, role: u.role, teamId: u.teamId, displayName: u.displayName };
}

/** Organiser sign-in with username and password. */
export async function login(username: string, password: string): Promise<LoginResult> {
  const db = getDb();
  const uname = username.trim().toLowerCase();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.username, uname)).limit(1);
  const generic = "Incorrect username or password";
  if (!u || !u.active || u.role !== "organiser") {
    await verifyPassword(password, "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA"); // equalise timing
    return { ok: false, message: generic };
  }
  if (u.lockedUntil && u.lockedUntil > new Date()) return { ok: false, message: lockedMessage(u.lockedUntil) };
  if (!(await verifyPassword(password, u.passwordHash))) {
    await recordFailure(u, MAX_FAILED, LOCK_MINUTES);
    return { ok: false, message: generic };
  }
  return { ok: true, user: await startSession(u) };
}

/** Team sign-in with the registered team name (case and extra spaces ignored) and the team code. */
export async function loginTeam(teamName: string, code: string): Promise<LoginResult> {
  const db = getDb();
  const generic = "Team name or team code is incorrect";
  const rows = await db
    .select({ team: schema.teams, user: schema.users })
    .from(schema.teams)
    .innerJoin(schema.users, eq(schema.users.teamId, schema.teams.id))
    .where(eq(schema.teams.nameKey, nameKey(teamName)))
    .limit(1);
  const row = rows[0];
  if (!row) return { ok: false, message: generic };
  const { team, user } = row;
  if (user.lockedUntil && user.lockedUntil > new Date()) return { ok: false, message: lockedMessage(user.lockedUntil) };
  const given = Buffer.from(code.trim().toUpperCase());
  const stored = Buffer.from(team.code);
  if (given.length !== stored.length || !crypto.timingSafeEqual(given, stored)) {
    await recordFailure(user, TEAM_MAX_FAILED, TEAM_LOCK_MINUTES);
    return { ok: false, message: generic };
  }
  if (!user.active) return { ok: false, message: "Login access for this team is switched off. Contact the organisers" };
  return { ok: true, user: await startSession(user) };
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await getDb().delete(schema.sessions).where(eq(schema.sessions.id, tokenId(token)));
  jar.delete(COOKIE);
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const rows = await db
    .select({ id: schema.users.id, username: schema.users.username, role: schema.users.role, teamId: schema.users.teamId, displayName: schema.users.displayName, active: schema.users.active })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(and(eq(schema.sessions.id, tokenId(token)), gt(schema.sessions.expiresAt, sql`now()`)))
    .limit(1);
  const u = rows[0];
  if (!u || !u.active) return null;
  return { id: u.id, username: u.username, role: u.role, teamId: u.teamId, displayName: u.displayName };
});

export async function requireOrganiser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect("/organiser");
  if (u.role !== "organiser") redirect("/dashboard");
  return u;
}

export async function requireTeam(): Promise<SessionUser & { teamId: string }> {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  if (u.role !== "team" || !u.teamId) redirect("/admin");
  return u as SessionUser & { teamId: string };
}

/** Rejects cross-site requests to JSON endpoints (defence in depth on top of SameSite cookies). */
export async function assertSameOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) return true;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function revokeUserSessions(userId: string): Promise<void> {
  await getDb().delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}

import "server-only";
import crypto from "node:crypto";
import { count, eq, sql } from "drizzle-orm";
import { getDb, schema, type DbOrTx } from "@/db";
import type { TeamMember } from "@/db/schema";
import { audit } from "@/lib/audit";
import { nameKey } from "@/lib/format";

/** A team code is 1 capital letter followed by 2 digits, for example A07. */
export const CODE_PATTERN = /^[A-Z][0-9]{2}$/;
/** Letters used for new codes. I and O are left out so codes are not misread as 1 and 0. */
const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
/** Serialises registrations and code changes so capacity, names and codes stay unique under load. */
const REGISTRATION_LOCK = 724_001;

export class TeamError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

export const normaliseCode = (raw: string) => raw.trim().toUpperCase();

/** Picks a random unused code. Reads every code in use first, so the result is never a duplicate. */
export async function allocateCode(db: DbOrTx): Promise<string> {
  const used = new Set((await db.select({ code: schema.teams.code }).from(schema.teams)).map((r) => r.code));
  const free: string[] = [];
  for (const letter of CODE_LETTERS) for (let n = 0; n < 100; n++) {
    const code = `${letter}${String(n).padStart(2, "0")}`;
    if (!used.has(code)) free.push(code);
  }
  if (!free.length) throw new TeamError("No team codes are left");
  return free[crypto.randomInt(free.length)];
}

// ---------- validation ----------

/** Accepts 10-digit Indian mobile numbers with or without +91, 91 or 0 in front. Returns the 10 digits. */
export function parsePhone(raw: string): string | null {
  let d = raw.replace(/[\s\-().]/g, "");
  if (d.startsWith("+91")) d = d.slice(3);
  else if (d.startsWith("0091")) d = d.slice(4);
  else if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const PERSON = /^[\p{L}][\p{L} .'-]{1,59}$/u;
const TEAM_NAME = /^[\p{L}\p{N}][\p{L}\p{N} &.'()-]{1,39}$/u;

export const TEAM_FIELDS = ["teamName", "m1Name", "m1Phone", "m1Email", "m2Name", "m2Phone", "m2Email", "m3Name", "m3Phone", "m3Email"] as const;
export type TeamFormValues = Partial<Record<(typeof TEAM_FIELDS)[number], string>>;
export type FieldErrors = Partial<Record<(typeof TEAM_FIELDS)[number], string>>;
export interface TeamInput {
  name: string;
  members: TeamMember[];
}

export function readTeamForm(fd: FormData): TeamFormValues {
  const v: TeamFormValues = {};
  for (const f of TEAM_FIELDS) v[f] = String(fd.get(f) ?? "").trim();
  return v;
}

/** Checks every field. Members 1 and 2 are required; member 3 is optional but must be complete if started. */
export function validateTeamForm(v: TeamFormValues): { errors: FieldErrors; input: TeamInput | null } {
  const errors: FieldErrors = {};
  const name = (v.teamName ?? "").replace(/\s+/g, " ").trim();
  if (!name) errors.teamName = "Enter your team name";
  else if (!TEAM_NAME.test(name)) errors.teamName = "Use 2 to 40 letters, numbers, spaces or & . ' ( ) -";
  const members: TeamMember[] = [];
  for (const i of [1, 2, 3] as const) {
    const n = (v[`m${i}Name`] ?? "").replace(/\s+/g, " ").trim();
    const p = v[`m${i}Phone`] ?? "";
    const e = (v[`m${i}Email`] ?? "").toLowerCase();
    if (i === 3 && !n && !p && !e) continue;
    const who = `member ${i}`;
    if (!n) errors[`m${i}Name`] = `Enter ${who}'s full name`;
    else if (!PERSON.test(n)) errors[`m${i}Name`] = "Use letters, spaces and . ' - only";
    const phone = parsePhone(p);
    if (!p) errors[`m${i}Phone`] = `Enter ${who}'s contact number`;
    else if (!phone) errors[`m${i}Phone`] = "Enter a 10-digit Indian mobile number";
    if (!e) errors[`m${i}Email`] = `Enter ${who}'s email ID`;
    else if (!EMAIL.test(e) || e.length > 120) errors[`m${i}Email`] = "Enter a valid email ID, for example name@imi.edu";
    members.push({ name: n, phone: phone ?? p, email: e });
  }
  // The same person cannot appear twice in 1 team.
  members.forEach((m, i) => {
    members.slice(0, i).forEach((o) => {
      if (m.email && m.email === o.email) errors[`m${i + 1}Email` as keyof FieldErrors] = "This email ID is already used by another member of your team";
      if (m.phone && m.phone === o.phone) errors[`m${i + 1}Phone` as keyof FieldErrors] = "This number is already used by another member of your team";
    });
  });
  return { errors, input: Object.keys(errors).length ? null : { name, members } };
}

/** Rejects a team name or member contact already registered with another team. */
async function assertUnique(db: DbOrTx, input: TeamInput, exceptTeamId?: string) {
  const all = await db.select({ id: schema.teams.id, nameKey: schema.teams.nameKey, members: schema.teams.members }).from(schema.teams);
  const others = all.filter((t) => t.id !== exceptTeamId);
  if (others.some((t) => t.nameKey === nameKey(input.name))) throw new TeamError("A team with this name is already registered. Choose another name", "teamName");
  input.members.forEach((m, i) => {
    for (const t of others) {
      if (t.members.some((o) => o.email && o.email === m.email)) throw new TeamError("This email ID is already registered in another team", `m${i + 1}Email`);
      if (t.members.some((o) => o.phone && o.phone === m.phone)) throw new TeamError("This contact number is already registered in another team", `m${i + 1}Phone`);
    }
  });
}

// ---------- registration ----------

export interface RegistrationState {
  open: boolean;
  message: string;
  registered: number;
  capacity: number;
}

export async function registrationState(db: DbOrTx = getDb()): Promise<RegistrationState> {
  const [comp] = await db.select().from(schema.competition).limit(1);
  const [{ n }] = await db.select({ n: count() }).from(schema.teams);
  const [{ started }] = await db.select({ started: count() }).from(schema.phases).where(sql`${schema.phases.status} <> 'draft'`);
  const registered = Number(n);
  const capacity = comp?.teamCapacity ?? 0;
  if (!comp) return { open: false, message: "Registration has not opened yet", registered, capacity };
  if (Number(started) > 0) return { open: false, message: "Registration closed when Phase 1 opened", registered, capacity };
  if (!comp.registrationOpen) return { open: false, message: "Registration is closed", registered, capacity };
  if (registered >= capacity) return { open: false, message: `All ${capacity} places are taken`, registered, capacity };
  return { open: true, message: "Registration is open", registered, capacity };
}

/**
 * Registers a team and assigns its code in 1 transaction. A website registration must find registration open;
 * an organiser can add a team at any time up to the team capacity.
 */
export async function createTeam(input: TeamInput, source: "website" | "organiser", actor: string, reason?: string) {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${REGISTRATION_LOCK})`);
    const state = await registrationState(tx);
    if (source === "website" && !state.open) throw new TeamError(`${state.message}. Contact the organisers`);
    if (state.registered >= state.capacity) throw new TeamError(`All ${state.capacity} places are taken. Raise the team capacity in Settings first`);
    await assertUnique(tx, input);
    const code = await allocateCode(tx);
    const [team] = await tx
      .insert(schema.teams)
      .values({ name: input.name, nameKey: nameKey(input.name), code, members: input.members, registrationSource: source })
      .returning();
    await tx.insert(schema.users).values({ username: `team-${team.id}`, passwordHash: "!", role: "team", teamId: team.id, displayName: input.name });
    await audit(tx, {
      username: actor,
      action: source === "website" ? "team.register" : "team.create",
      entity: "team",
      entityId: input.name,
      reason: reason ?? "Registered on the website",
      after: { code, members: input.members.map((m) => m.name) },
    });
    return { team, code };
  });
}

export async function updateTeamDetails(teamId: string, input: TeamInput, actor: string, reason: string) {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${REGISTRATION_LOCK})`);
    const [before] = await tx.select().from(schema.teams).where(eq(schema.teams.id, teamId)).limit(1);
    if (!before) throw new TeamError("Team not found");
    await assertUnique(tx, input, teamId);
    await tx.update(schema.teams).set({ name: input.name, nameKey: nameKey(input.name), members: input.members }).where(eq(schema.teams.id, teamId));
    await tx.update(schema.users).set({ displayName: input.name }).where(eq(schema.users.teamId, teamId));
    await audit(tx, { username: actor, action: "team.update", entity: "team", entityId: input.name, reason, before: { name: before.name, members: before.members }, after: input });
    return input.name;
  });
}

/** Sets a new code (or a random one when none is given) and signs the team out everywhere. */
export async function changeTeamCode(teamId: string, requested: string, actor: string, reason: string) {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${REGISTRATION_LOCK})`);
    const [t] = await tx.select().from(schema.teams).where(eq(schema.teams.id, teamId)).limit(1);
    if (!t) throw new TeamError("Team not found");
    let code = normaliseCode(requested);
    if (code) {
      if (!CODE_PATTERN.test(code)) throw new TeamError("A code is 1 capital letter followed by 2 digits, for example K42", "code");
      if (code === t.code) throw new TeamError(`${t.name} already has code ${code}`, "code");
      const [clash] = await tx.select({ name: schema.teams.name }).from(schema.teams).where(eq(schema.teams.code, code)).limit(1);
      if (clash) throw new TeamError(`Code ${code} belongs to ${clash.name}. Choose another code`, "code");
    } else {
      code = await allocateCode(tx);
    }
    await tx.update(schema.teams).set({ code }).where(eq(schema.teams.id, teamId));
    const [u] = await tx.select().from(schema.users).where(eq(schema.users.teamId, teamId)).limit(1);
    if (u) {
      await tx.update(schema.users).set({ failedLogins: 0, lockedUntil: null }).where(eq(schema.users.id, u.id));
      await tx.delete(schema.sessions).where(eq(schema.sessions.userId, u.id));
    }
    await audit(tx, { username: actor, action: "team.change_code", entity: "team", entityId: t.name, reason, before: { code: t.code }, after: { code } });
    return { name: t.name, code };
  });
}

/** Switches a team's login access on or off. Switching off signs the team out at once. */
export async function setTeamLogin(teamId: string, active: boolean, actor: string, reason: string) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [t] = await tx.select().from(schema.teams).where(eq(schema.teams.id, teamId)).limit(1);
    const [u] = await tx.select().from(schema.users).where(eq(schema.users.teamId, teamId)).limit(1);
    if (!t || !u) throw new TeamError("Team not found");
    await tx.update(schema.users).set({ active, failedLogins: 0, lockedUntil: null }).where(eq(schema.users.id, u.id));
    if (!active) await tx.delete(schema.sessions).where(eq(schema.sessions.userId, u.id));
    await audit(tx, { username: actor, action: active ? "team.login_on" : "team.login_off", entity: "team", entityId: t.name, reason });
    return t.name;
  });
}

export async function setRegistrationOpen(open: boolean, actor: string, reason: string) {
  const db = getDb();
  await db.update(schema.competition).set({ registrationOpen: open, updatedAt: new Date() });
  await audit(db, { username: actor, action: open ? "registration.open" : "registration.close", entity: "competition", reason });
}

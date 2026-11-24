"use server";
import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { Dec, rupeesToPaise, suggestedSupply, lotPricePaise } from "@/engine";
import { audit } from "@/lib/audit";
import { generatePassword, hashPassword, requireOrganiser, revokeUserSessions, verifyPassword } from "@/lib/auth";
import { nameKey } from "@/lib/format";
import { ensurePhaseAssetRows, getAssets, getPhases } from "./core";
import { submitOrder } from "./orders";
import * as P from "./phases";

// ---------- helpers ----------
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
class UserError extends Error {}
function need(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new UserError(msg);
}
const reasonOf = (fd: FormData) => {
  const r = str(fd, "reason");
  need(r.length >= 3, "Enter a reason for this change. It is recorded in the audit log");
  return r;
};
const decimalField = (fd: FormData, k: string, label: string, min?: number, maxV?: number) => {
  const v = str(fd, k);
  need(/^-?\d+(\.\d+)?$/.test(v), `${label}: enter a number`);
  const d = new Dec(v);
  if (min !== undefined) need(d.gte(min), `${label} must be at least ${min}`);
  if (maxV !== undefined) need(d.lte(maxV), `${label} must be at most ${maxV}`);
  return d.toString();
};
const intField = (fd: FormData, k: string, label: string, min = 0, maxV = 1_000_000_000) => {
  const v = str(fd, k);
  need(/^\d+$/.test(v), `${label}: enter a whole number`);
  const n = Number(v);
  need(n >= min && n <= maxV, `${label} must be between ${min} and ${maxV}`);
  return n;
};
const back = (path: string, kind: "ok" | "err", msg: string) => `${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}`;

/** Runs an organiser action, records nothing on failure, and returns to the page with a message. */
async function act(path: string, fn: (actor: string) => Promise<string>): Promise<never> {
  const user = await requireOrganiser();
  let target: string;
  try {
    const msg = await fn(user.username);
    target = back(path, "ok", msg);
  } catch (e) {
    const msg = e instanceof UserError || e instanceof P.PhaseError ? e.message : `Could not save: ${(e as Error).message}`;
    target = back(path, "err", msg);
  }
  revalidatePath("/", "layout");
  redirect(target);
}

async function phaseStatus(n: number) {
  const [p] = await getDb().select().from(schema.phases).where(eq(schema.phases.number, n)).limit(1);
  need(p, `Phase ${n} does not exist`);
  return p;
}
async function phase1Opened() {
  const p = await getPhases(getDb());
  return p.some((x) => x.status !== "draft");
}

// ---------- teams ----------
export interface CredentialState {
  ok?: string;
  err?: string;
  credentials?: { team: string; username: string; password: string }[];
}

function usernameFrom(name: string) {
  return nameKey(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "team";
}

export async function createTeams(_prev: CredentialState, fd: FormData): Promise<CredentialState> {
  const user = await requireOrganiser();
  const db = getDb();
  try {
    const lines = str(fd, "teams").split("\n").map((l) => l.trim()).filter(Boolean);
    need(lines.length > 0, "Enter at least 1 team, 1 per line");
    const [comp] = await db.select().from(schema.competition).limit(1);
    const existing = await db.select().from(schema.teams);
    need(existing.length + lines.length <= (comp?.teamCapacity ?? 1000), `Team capacity is ${comp?.teamCapacity}. Raise it in Settings first`);
    const creds: NonNullable<CredentialState["credentials"]> = [];
    await db.transaction(async (tx) => {
      for (const line of lines) {
        const [rawName, rawMembers = ""] = line.split("|");
        const name = rawName.replace(/\s+/g, " ").trim();
        need(name.length >= 2 && name.length <= 60, `Team name "${name}" must be 2 to 60 characters`);
        const members = rawMembers.split(/[,;]/).map((m) => m.trim()).filter(Boolean);
        const [dupe] = await tx.select().from(schema.teams).where(eq(schema.teams.nameKey, nameKey(name))).limit(1);
        need(!dupe, `A team named "${name}" already exists (names are matched ignoring case and extra spaces)`);
        const [team] = await tx.insert(schema.teams).values({ name, nameKey: nameKey(name), members }).returning();
        let username = usernameFrom(name);
        for (let i = 2; (await tx.select().from(schema.users).where(eq(schema.users.username, username)).limit(1)).length > 0; i++) username = `${usernameFrom(name)}-${i}`;
        const password = generatePassword();
        await tx.insert(schema.users).values({ username, passwordHash: await hashPassword(password), role: "team", teamId: team.id, displayName: name });
        creds.push({ team: name, username, password });
      }
      await audit(tx, { username: user.username, action: "team.create", entity: "team", reason: str(fd, "reason") || "Team registration", after: creds.map((c) => ({ team: c.team, username: c.username })) });
    });
    revalidatePath("/admin/teams");
    return { ok: `${creds.length} team(s) created. Copy or download the passwords now: they are shown only once`, credentials: creds };
  } catch (e) {
    return { err: e instanceof UserError ? e.message : `Could not create teams: ${(e as Error).message}` };
  }
}

export async function resetTeamPassword(_prev: CredentialState, fd: FormData): Promise<CredentialState> {
  const user = await requireOrganiser();
  const db = getDb();
  try {
    const teamId = str(fd, "teamId");
    const reason = reasonOf(fd);
    const [u] = await db.select().from(schema.users).where(eq(schema.users.teamId, teamId)).limit(1);
    need(u, "Team login not found");
    const password = generatePassword();
    await db.update(schema.users).set({ passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null }).where(eq(schema.users.id, u.id));
    await revokeUserSessions(u.id);
    await audit(db, { username: user.username, action: "team.reset_password", entity: "team", entityId: u.displayName, reason });
    return { ok: "New password created. Existing sessions for this team were signed out", credentials: [{ team: u.displayName, username: u.username, password }] };
  } catch (e) {
    return { err: e instanceof UserError ? e.message : (e as Error).message };
  }
}

export async function updateTeam(fd: FormData) {
  return act("/admin/teams", async (actor) => {
    const db = getDb();
    const id = str(fd, "teamId");
    const reason = reasonOf(fd);
    const name = str(fd, "name").replace(/\s+/g, " ");
    need(name.length >= 2 && name.length <= 60, "Team name must be 2 to 60 characters");
    const members = str(fd, "members").split(/[,;\n]/).map((m) => m.trim()).filter(Boolean);
    const [before] = await db.select().from(schema.teams).where(eq(schema.teams.id, id)).limit(1);
    need(before, "Team not found");
    const [clash] = await db.select().from(schema.teams).where(eq(schema.teams.nameKey, nameKey(name))).limit(1);
    need(!clash || clash.id === id, `Another team is already named "${name}"`);
    await db.update(schema.teams).set({ name, nameKey: nameKey(name), members }).where(eq(schema.teams.id, id));
    await db.update(schema.users).set({ displayName: name }).where(eq(schema.users.teamId, id));
    await audit(db, { username: actor, action: "team.update", entity: "team", entityId: name, reason, before: { name: before.name, members: before.members }, after: { name, members } });
    return `Saved ${name}`;
  });
}

export async function disqualifyTeam(fd: FormData) {
  return act("/admin/teams", async (actor) => {
    const db = getDb();
    const id = str(fd, "teamId");
    const reason = reasonOf(fd);
    const phases = await getPhases(db);
    const current = phases.find((p) => ["open", "paused", "closed"].includes(p.status)) ?? phases.find((p) => p.status === "draft") ?? phases.at(-1)!;
    const [t] = await db.select().from(schema.teams).where(eq(schema.teams.id, id)).limit(1);
    need(t && t.status === "active", "Team is not active");
    await db.transaction(async (tx) => {
      await tx.update(schema.teams).set({ status: "disqualified", disqualifiedPhase: current.number, disqualificationSource: "manual", disqualifiedReason: reason }).where(eq(schema.teams.id, id));
      await tx
        .update(schema.orders)
        .set({ status: "voided", voidReason: `Team disqualified by the organiser: ${reason}` })
        .where(and(eq(schema.orders.teamId, id), eq(schema.orders.phaseNumber, current.number), eq(schema.orders.status, "live")));
      await audit(tx, { username: actor, action: "team.disqualify", entity: "team", entityId: t.name, reason, after: { phase: current.number } });
    });
    return `${t.name} disqualified from ${current.name} onward`;
  });
}

export async function reinstateTeam(fd: FormData) {
  return act("/admin/teams", async (actor) => {
    const db = getDb();
    const id = str(fd, "teamId");
    const reason = reasonOf(fd);
    const [t] = await db.select().from(schema.teams).where(eq(schema.teams.id, id)).limit(1);
    need(t && t.status === "disqualified", "Team is not disqualified");
    await db
      .update(schema.teams)
      .set({ status: "active", disqualifiedPhase: null, disqualificationSource: null, disqualifiedReason: null, reinstatedNote: reason })
      .where(eq(schema.teams.id, id));
    await audit(db, {
      username: actor,
      action: "team.reinstate",
      entity: "team",
      entityId: t.name,
      reason,
      before: { disqualifiedPhase: t.disqualifiedPhase, source: t.disqualificationSource, reason: t.disqualifiedReason },
    });
    return `${t.name} reinstated. It continues from its last confirmed position`;
  });
}

export async function deleteTeam(fd: FormData) {
  return act("/admin/teams", async (actor) => {
    const db = getDb();
    need(!(await phase1Opened()), "Teams cannot be deleted once Phase 1 has opened. Disqualify the team instead");
    const id = str(fd, "teamId");
    const reason = reasonOf(fd);
    const [t] = await db.select().from(schema.teams).where(eq(schema.teams.id, id)).limit(1);
    need(t, "Team not found");
    await db.delete(schema.teams).where(eq(schema.teams.id, id));
    await audit(db, { username: actor, action: "team.delete", entity: "team", entityId: t.name, reason });
    return `${t.name} deleted`;
  });
}

// ---------- assets ----------
export async function saveAsset(fd: FormData) {
  return act("/admin/assets", async (actor) => {
    const db = getDb();
    const reason = reasonOf(fd);
    const id = str(fd, "assetId");
    const opened = await phase1Opened();
    const text = {
      name: str(fd, "name"),
      assetType: str(fd, "assetType") || "Stock",
      sector: str(fd, "sector"),
      quoteUnit: str(fd, "quoteUnit"),
      lotDefinition: str(fd, "lotDefinition"),
      profile: str(fd, "profile"),
      description: str(fd, "description"),
      displayOrder: intField(fd, "displayOrder", "Display order", 0, 1000),
    };
    need(text.name.length >= 2, "Enter the asset name");
    const structural = {
      code: str(fd, "code").toUpperCase(),
      unitsPerLot: decimalField(fd, "unitsPerLot", "Quote units per lot", 0.0001, 1_000_000),
      initialPricePaise: rupeesToPaise(decimalField(fd, "initialPrice", "Initial price", 0.01, 1_000_000_000)),
      baseSupply: intField(fd, "baseSupply", "Supply"),
    };
    need(/^[A-Z0-9]{2,10}$/.test(structural.code), "Code: 2 to 10 capital letters or digits");
    if (id) {
      const [before] = await db.select().from(schema.assets).where(eq(schema.assets.id, id)).limit(1);
      need(before, "Asset not found");
      const changedStructure =
        before.code !== structural.code || before.unitsPerLot !== structural.unitsPerLot || before.initialPricePaise !== structural.initialPricePaise;
      need(!(opened && changedStructure), "Code, lot size and initial price are locked once Phase 1 has opened");
      await db.update(schema.assets).set({ ...text, ...(opened ? {} : structural), baseSupply: structural.baseSupply }).where(eq(schema.assets.id, id));
      await audit(db, { username: actor, action: "asset.update", entity: "asset", entityId: structural.code, reason, before, after: { ...text, ...structural } });
      return `Saved ${structural.code}`;
    }
    need(!opened, "Assets can only be added before Phase 1 opens");
    await db.insert(schema.assets).values({ ...text, ...structural });
    await ensurePhaseAssetRows(db);
    await audit(db, { username: actor, action: "asset.create", entity: "asset", entityId: structural.code, reason, after: { ...text, ...structural } });
    return `Added ${structural.code}`;
  });
}

export async function removeAsset(fd: FormData) {
  return act("/admin/assets", async (actor) => {
    const db = getDb();
    need(!(await phase1Opened()), "Assets can only be removed before Phase 1 opens");
    const reason = reasonOf(fd);
    const [a] = await db.select().from(schema.assets).where(eq(schema.assets.id, str(fd, "assetId"))).limit(1);
    need(a, "Asset not found");
    await db.delete(schema.assets).where(eq(schema.assets.id, a.id));
    await audit(db, { username: actor, action: "asset.delete", entity: "asset", entityId: a.code, reason, before: a });
    return `Removed ${a.code}`;
  });
}

export async function recalibrateSupply(fd: FormData) {
  return act("/admin/assets", async (actor) => {
    const db = getDb();
    const reason = reasonOf(fd);
    const teamsCount = intField(fd, "teams", "Number of teams", 1, 10000);
    const share = decimalField(fd, "deployment", "Deployment share in %", 1, 100);
    const deployment = new Dec(share).div(100).toString();
    const [comp] = await db.select().from(schema.competition).limit(1);
    const assets = await getAssets(db);
    const phases = (await getPhases(db)).filter((p) => p.status === "draft" || p.status === "open" || p.status === "paused" || p.status === "closed");
    need(phases.length > 0, "Every phase is already confirmed. Change supply per phase on the News and market page instead");
    const result: Record<string, number> = {};
    await db.transaction(async (tx) => {
      for (const a of assets) {
        const s = suggestedSupply(teamsCount, comp.startingCapitalPaise, deployment, assets.length, lotPricePaise(a.initialPricePaise, a.unitsPerLot));
        result[a.code] = s;
        await tx.update(schema.assets).set({ baseSupply: s }).where(eq(schema.assets.id, a.id));
        for (const p of phases) {
          await tx.update(schema.phaseAssets).set({ supply: s }).where(and(eq(schema.phaseAssets.phaseNumber, p.number), eq(schema.phaseAssets.assetId, a.id)));
        }
      }
      await tx.update(schema.competition).set({ supplyCalibratedFor: teamsCount, deploymentShare: deployment });
      await audit(tx, { username: actor, action: "supply.recalibrate", entity: "competition", reason, after: { teamsCount, deployment, phases: phases.map((p) => p.number), supply: result } });
    });
    return `Supply recalibrated for ${teamsCount} teams in ${phases.map((p) => p.name).join(", ")}`;
  });
}

// ---------- news and market impact ----------
export async function saveMarketImpact(fd: FormData) {
  const n = Number(str(fd, "phase"));
  return act(`/admin/news?phase=${n}`, async (actor) => {
    const db = getDb();
    const reason = reasonOf(fd);
    const p = await phaseStatus(n);
    const params = {
      newsSensitivity: new Dec(decimalField(fd, "newsSensitivity", "News sensitivity in %", 0, 100)).div(100).toString(),
      demandSensitivity: new Dec(decimalField(fd, "demandSensitivity", "Demand sensitivity in %", 0, 100)).div(100).toString(),
      neutralRatio: decimalField(fd, "neutralRatio", "Neutral demand ratio", -10, 10),
      maxMove: new Dec(decimalField(fd, "maxMove", "Maximum price move in %", 0, 100)).div(100).toString(),
    };
    const assets = await getAssets(db);
    const before = { phase: { ...p }, assets: await db.select().from(schema.phaseAssets).where(eq(schema.phaseAssets.phaseNumber, n)) };
    const afterAssets: Record<string, unknown> = {};
    await db.transaction(async (tx) => {
      await tx.update(schema.phases).set({ ...params, updatedAt: new Date() }).where(eq(schema.phases.number, n));
      for (const a of assets) {
        const score = decimalField(fd, `score_${a.id}`, `${a.code} news score`, -2, 2);
        const supply = intField(fd, `supply_${a.id}`, `${a.code} supply`);
        const ovType = (str(fd, `ovType_${a.id}`) || "none") as "none" | "price" | "percent";
        need(["none", "price", "percent"].includes(ovType), "Unknown override type");
        let ovValue: string | null = null;
        if (ovType === "price") ovValue = String(rupeesToPaise(decimalField(fd, `ovValue_${a.id}`, `${a.code} override price`, 0.01)));
        if (ovType === "percent") ovValue = decimalField(fd, `ovValue_${a.id}`, `${a.code} override %`, -99, 1000);
        const [pa] = await tx.select().from(schema.phaseAssets).where(and(eq(schema.phaseAssets.phaseNumber, n), eq(schema.phaseAssets.assetId, a.id))).limit(1);
        const overrideChanged = (pa?.overrideType ?? "none") !== ovType || (pa?.overrideValue ?? null) !== ovValue;
        need(!(overrideChanged && p.status !== "draft"), `${a.code}: the opening price override is fixed once ${p.name} has opened`);
        await tx.update(schema.phaseAssets).set({ supply, overrideType: ovType, overrideValue: ovValue }).where(and(eq(schema.phaseAssets.phaseNumber, n), eq(schema.phaseAssets.assetId, a.id)));
        const key = {
          score,
          storyNumber: str(fd, `story_${a.id}`),
          headline: str(fd, `headline_${a.id}`),
          realWorldReference: str(fd, `ref_${a.id}`),
          realMove: str(fd, `move_${a.id}`),
          explanation: str(fd, `expl_${a.id}`),
          learningObjective: str(fd, `learn_${a.id}`),
          isDistractor: bool(fd, `distractor_${a.id}`),
        };
        await tx.update(schema.newsKeys).set(key).where(and(eq(schema.newsKeys.phaseNumber, n), eq(schema.newsKeys.assetId, a.id)));
        afterAssets[a.code] = { supply, ovType, ovValue, ...key };
      }
      if (p.status === "confirmed" || p.status === "published") await P.flagRecalculation(tx, n);
      await audit(tx, { username: actor, action: "market.save", entity: "phase", entityId: n, reason, before, after: { params, assets: afterAssets } });
    });
    return p.status === "confirmed" || p.status === "published"
      ? `Saved. ${p.name} is already confirmed, so its results will change only after you recalculate on the Phases page`
      : `Saved news and market settings for ${p.name}`;
  });
}

export async function saveAnnouncement(fd: FormData) {
  return act("/admin/news?tab=announcements", async (actor) => {
    const db = getDb();
    const id = Number(str(fd, "id") || 0);
    const title = str(fd, "title");
    need(title.length >= 3, "Enter a title");
    const linkUrl = str(fd, "linkUrl");
    need(!linkUrl || /^https?:\/\//.test(linkUrl), "The link must start with https://");
    const values = { title, body: str(fd, "body"), linkUrl, phaseNumber: str(fd, "phase") ? Number(str(fd, "phase")) : null, visible: bool(fd, "visible"), updatedAt: new Date() };
    if (id) {
      const [before] = await db.select().from(schema.announcements).where(eq(schema.announcements.id, id)).limit(1);
      need(before, "Announcement not found");
      await db.update(schema.announcements).set(values).where(eq(schema.announcements.id, id));
      await audit(db, { username: actor, action: "announcement.update", entity: "announcement", entityId: id, reason: str(fd, "reason") || "Correction", before, after: values });
      return "Announcement updated. Teams see it marked as updated";
    }
    const [row] = await db.insert(schema.announcements).values(values).returning({ id: schema.announcements.id });
    await audit(db, { username: actor, action: "announcement.create", entity: "announcement", entityId: row.id, reason: str(fd, "reason") || "New announcement", after: values });
    return "Announcement published";
  });
}

export async function deleteAnnouncement(fd: FormData) {
  return act("/admin/news?tab=announcements", async (actor) => {
    const db = getDb();
    const id = Number(str(fd, "id"));
    const reason = reasonOf(fd);
    const [before] = await db.select().from(schema.announcements).where(eq(schema.announcements.id, id)).limit(1);
    need(before, "Announcement not found");
    await db.delete(schema.announcements).where(eq(schema.announcements.id, id));
    await audit(db, { username: actor, action: "announcement.delete", entity: "announcement", entityId: id, reason, before });
    return "Announcement deleted";
  });
}

// ---------- rules and rulebook ----------
export async function saveRules(fd: FormData) {
  return act("/admin/rules", async (actor) => {
    const db = getDb();
    const reason = reasonOf(fd);
    const phases = await getPhases(db);
    const [comp] = await db.select().from(schema.competition).limit(1);
    const opened = phases.some((p) => p.status !== "draft");
    const capital = rupeesToPaise(decimalField(fd, "capital", "Starting capital", 1000, 1_000_000_000));
    need(!(opened && capital !== comp.startingCapitalPaise), "Starting capital is locked once Phase 1 has opened");
    const compAfter = { startingCapitalPaise: capital, disqualifyOnShortfall: bool(fd, "disqualifyOnShortfall") };
    const changes: Record<string, unknown> = {};
    await db.transaction(async (tx) => {
      await tx.update(schema.competition).set({ ...compAfter, updatedAt: new Date() });
      for (const p of phases) {
        const next = {
          allowSell: bool(fd, `allowSell_${p.number}`),
          minDistinctAssets: intField(fd, `min_${p.number}`, `${p.name} minimum distinct assets`, 0, 100),
          capShare: new Dec(decimalField(fd, `cap_${p.number}`, `${p.name} concentration cap in %`, 1, 100)).div(100).toString(),
          rationing: bool(fd, `rationing_${p.number}`),
        };
        const changed = next.allowSell !== p.allowSell || next.minDistinctAssets !== p.minDistinctAssets || !new Dec(next.capShare).eq(p.capShare) || next.rationing !== p.rationing;
        if (!changed) continue;
        need(p.status !== "open", `${p.name} is open. Pause it before changing its trading rules`);
        need(p.status !== "closed", `${p.name} is closed with orders already checked. Confirm it first, then recalculate if needed`);
        await tx.update(schema.phases).set({ ...next, updatedAt: new Date() }).where(eq(schema.phases.number, p.number));
        if (p.status === "confirmed" || p.status === "published") await P.flagRecalculation(tx, p.number);
        changes[p.name] = { before: { allowSell: p.allowSell, minDistinctAssets: p.minDistinctAssets, capShare: p.capShare, rationing: p.rationing }, after: next };
      }
      await audit(tx, { username: actor, action: "rules.save", entity: "rules", reason, before: { startingCapitalPaise: comp.startingCapitalPaise, disqualifyOnShortfall: comp.disqualifyOnShortfall }, after: { ...compAfter, phases: changes } });
    });
    return Object.keys(changes).length ? `Saved. Changed: ${Object.keys(changes).join(", ")}` : "Saved";
  });
}

export async function publishRulebook(fd: FormData) {
  return act("/admin/rules", async (actor) => {
    const db = getDb();
    const reason = reasonOf(fd);
    const content = String(fd.get("content") ?? "");
    need(content.trim().length > 50, "The rulebook text looks empty");
    const [m] = await db.select({ v: max(schema.rulebookVersions.version) }).from(schema.rulebookVersions);
    const version = (m?.v ?? 0) + 1;
    await db.insert(schema.rulebookVersions).values({ version, content, note: reason, createdBy: actor });
    await audit(db, { username: actor, action: "rulebook.publish", entity: "rulebook", entityId: version, reason });
    return `Rulebook version ${version} published`;
  });
}

// ---------- phases ----------
export async function savePhaseSchedule(fd: FormData) {
  return act("/admin/phases", async (actor) => {
    const db = getDb();
    const reason = reasonOf(fd);
    const n = Number(str(fd, "phase"));
    const p = await phaseStatus(n);
    const name = str(fd, "name") || p.name;
    const minutes = decimalField(fd, "minutes", "Duration in minutes", 1, 600);
    const durationSeconds = Math.round(Number(minutes) * 60);
    const scheduled = str(fd, "scheduledAt");
    need(p.status === "draft" || durationSeconds === p.durationSeconds, `${p.name} has opened. Use Extend to add time`);
    const after = { name, durationSeconds, scheduledAt: scheduled ? new Date(`${scheduled}:00+05:30`) : null };
    await db.update(schema.phases).set({ ...after, updatedAt: new Date() }).where(eq(schema.phases.number, n));
    await audit(db, { username: actor, action: "phase.schedule", entity: "phase", entityId: n, reason, before: { name: p.name, durationSeconds: p.durationSeconds, scheduledAt: p.scheduledAt }, after });
    return `Saved ${name}`;
  });
}

export async function addPhase(fd: FormData) {
  return act("/admin/phases", async (actor) => {
    const db = getDb();
    const reason = reasonOf(fd);
    const phases = await getPhases(db);
    const last = phases.at(-1);
    need(!last || last.status !== "published", "The final phase is published. The competition is complete");
    const n = (last?.number ?? 0) + 1;
    await db.insert(schema.phases).values({
      number: n,
      name: `Phase ${n}`,
      durationSeconds: last?.durationSeconds ?? 600,
      allowSell: n > 1,
      neutralRatio: n === 1 ? "1" : "0",
      newsSensitivity: last?.newsSensitivity ?? "0.15",
      demandSensitivity: last?.demandSensitivity ?? "0.1",
      maxMove: last?.maxMove ?? "0.15",
      capShare: last?.capShare ?? "1",
      rationing: last?.rationing ?? false,
      minDistinctAssets: last?.minDistinctAssets ?? 3,
    });
    await ensurePhaseAssetRows(db);
    if (last) {
      const prevRows = await db.select().from(schema.phaseAssets).where(eq(schema.phaseAssets.phaseNumber, last.number));
      for (const r of prevRows) await db.update(schema.phaseAssets).set({ supply: r.supply }).where(and(eq(schema.phaseAssets.phaseNumber, n), eq(schema.phaseAssets.assetId, r.assetId)));
    }
    await audit(db, { username: actor, action: "phase.add", entity: "phase", entityId: n, reason });
    return `Phase ${n} added. Set its news scores on the News and market page`;
  });
}

export async function removeLastPhase(fd: FormData) {
  return act("/admin/phases", async (actor) => {
    const db = getDb();
    const reason = reasonOf(fd);
    const phases = await getPhases(db);
    const last = phases.at(-1);
    need(last && phases.length > 1, "At least 1 phase is required");
    need(last.status === "draft", `${last.name} has already opened and cannot be removed`);
    await db.delete(schema.phases).where(eq(schema.phases.number, last.number));
    await audit(db, { username: actor, action: "phase.remove", entity: "phase", entityId: last.number, reason });
    return `${last.name} removed`;
  });
}

export async function phaseCommand(fd: FormData) {
  const n = Number(str(fd, "phase"));
  const cmd = str(fd, "command");
  return act(`/admin/phases?focus=${n}`, async (actor) => {
    const reason = cmd === "preview" || cmd === "recalc_preview" ? str(fd, "reason") || "Preview" : reasonOf(fd);
    switch (cmd) {
      case "open":
        await P.openPhase(n, actor, reason);
        return `Phase ${n} is open. The countdown has started`;
      case "pause":
        await P.pausePhase(n, actor, reason);
        return `Phase ${n} paused. Teams cannot submit until you resume`;
      case "resume": {
        const voided = await P.resumePhase(n, actor, reason);
        return voided.length ? `Resumed. ${voided.length} order(s) no longer met the rules and were voided: ${voided.map((v) => v.team).join(", ")}` : "Resumed. All accepted orders still meet the rules";
      }
      case "extend":
        await P.extendPhase(n, Number(str(fd, "minutes")), actor, reason);
        return `Added ${str(fd, "minutes")} minute(s)`;
      case "close":
        await P.closePhase(n, actor, reason);
        return `Phase ${n} closed`;
      case "preview":
        await P.previewPhase(n, actor);
        return "Preview calculated. Review it below, then confirm";
      case "confirm": {
        need(bool(fd, "acknowledge"), "Tick the confirmation box");
        const { disqualified } = await P.confirmPhase(n, Number(str(fd, "runId")), actor, reason);
        return `Phase ${n} confirmed.${disqualified.length ? ` Disqualified for the minimum trade rule: ${disqualified.join(", ")}` : ""} Publish it when ready`;
      }
      case "publish":
        await P.publishPhase(n, actor, reason, true);
        return `Phase ${n} results and leaderboard are now visible to teams`;
      case "unpublish":
        await P.publishPhase(n, actor, reason, false);
        return `Phase ${n} results hidden from teams`;
      case "recalc_preview":
        await P.previewRecalculation(n, actor);
        return "Recalculation preview ready. Compare before and after below, then confirm";
      case "recalc_confirm":
        need(bool(fd, "acknowledge"), "Tick the confirmation box");
        await P.confirmRecalculation(str(fd, "batchId"), actor, reason);
        return "Recalculation confirmed. Earlier results are kept as superseded snapshots";
      case "recalc_discard":
        await P.discardRecalculation(actor);
        return "Recalculation preview discarded";
      default:
        throw new UserError("Unknown command");
    }
  });
}

// ---------- orders ----------
export async function enterOrderForTeam(fd: FormData) {
  return act("/admin/orders", async (actor) => {
    const reason = reasonOf(fd);
    const teamId = str(fd, "teamId");
    const n = Number(str(fd, "phase"));
    const assets = await getAssets(getDb());
    const lines: Record<string, string> = {};
    for (const a of assets) {
      const v = str(fd, `lots_${a.id}`);
      if (v) lines[a.id] = v;
    }
    const res = await submitOrder({ teamId, userId: null, phaseNumber: n, lines, clientKey: `organiser-${crypto.randomUUID()}`, source: "organiser", organiser: { username: actor, reason } });
    if (!res.ok) throw new UserError(res.issues.map((i) => i.message).join(". "));
    return "Order entered for the team";
  });
}

// ---------- settings and organiser accounts ----------
export async function saveSettings(fd: FormData) {
  return act("/admin/settings", async (actor) => {
    const db = getDb();
    const reason = reasonOf(fd);
    const [before] = await db.select().from(schema.competition).limit(1);
    const url = str(fd, "instagramUrl");
    need(!url || /^https:\/\//.test(url), "The Instagram link must start with https://");
    const after = {
      name: str(fd, "name") || before.name,
      organiser: str(fd, "organiser") || before.organiser,
      roundName: str(fd, "roundName") || before.roundName,
      teamCapacity: intField(fd, "teamCapacity", "Team capacity", 1, 10000),
      instagramUrl: url,
      showDemandAfterPublish: bool(fd, "showDemandAfterPublish"),
      showMarketParameters: bool(fd, "showMarketParameters"),
    };
    await db.update(schema.competition).set({ ...after, updatedAt: new Date() });
    await audit(db, { username: actor, action: "settings.save", entity: "competition", reason, before, after });
    return "Settings saved";
  });
}

export async function addOrganiser(_prev: CredentialState, fd: FormData): Promise<CredentialState> {
  const user = await requireOrganiser();
  const db = getDb();
  try {
    const reason = reasonOf(fd);
    const username = str(fd, "username").toLowerCase();
    need(/^[a-z0-9._-]{3,40}$/.test(username), "Username: 3 to 40 characters, letters, numbers, dot, hyphen or underscore");
    const [exists] = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
    need(!exists, "That username is taken");
    const password = generatePassword();
    await db.insert(schema.users).values({ username, passwordHash: await hashPassword(password), role: "organiser", displayName: str(fd, "displayName") || username });
    await audit(db, { username: user.username, action: "organiser.create", entity: "user", entityId: username, reason });
    return { ok: "Organiser account created. Share the password securely", credentials: [{ team: "Organiser", username, password }] };
  } catch (e) {
    return { err: e instanceof UserError ? e.message : (e as Error).message };
  }
}

export async function changeOwnPassword(_prev: CredentialState, fd: FormData): Promise<CredentialState> {
  const user = await requireOrganiser();
  const db = getDb();
  try {
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, user.id)).limit(1);
    need(await verifyPassword(str(fd, "current"), u.passwordHash), "Current password is incorrect");
    const next = str(fd, "next");
    need(next.length >= 10, "New password must be at least 10 characters");
    await db.update(schema.users).set({ passwordHash: await hashPassword(next) }).where(eq(schema.users.id, u.id));
    await audit(db, { username: user.username, action: "organiser.change_password", entity: "user", entityId: user.username, reason: "Own password changed" });
    return { ok: "Password changed" };
  } catch (e) {
    return { err: e instanceof UserError ? e.message : (e as Error).message };
  }
}

export async function setOrganiserActive(fd: FormData) {
  return act("/admin/settings", async (actor) => {
    const db = getDb();
    const reason = reasonOf(fd);
    const id = str(fd, "userId");
    const active = bool(fd, "active");
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    need(u && u.role === "organiser", "Organiser not found");
    need(u.username !== actor || active, "You cannot deactivate your own account");
    await db.update(schema.users).set({ active }).where(eq(schema.users.id, id));
    if (!active) await revokeUserSessions(id);
    await audit(db, { username: actor, action: active ? "organiser.activate" : "organiser.deactivate", entity: "user", entityId: u.username, reason });
    return `${u.username} ${active ? "activated" : "deactivated"}`;
  });
}


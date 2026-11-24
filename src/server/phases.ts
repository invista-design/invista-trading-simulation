import "server-only";
import crypto from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema, type DbOrTx } from "@/db";
import { processPhase, validateOrder, type PhaseResult } from "@/engine";
import { audit } from "@/lib/audit";
import {
  buildInputs,
  ensurePhaseAssetRows,
  getAssets,
  getCompetition,
  getConfirmedRuns,
  getPhaseAssetRows,
  getPhases,
  inputsHash,
  openingPrices,
  participates,
  settleAutoClose,
  type Phase,
  type RunInputs,
  type RunResult,
  type Team,
} from "./core";

export class PhaseError extends Error {}
function must(cond: unknown, message: string): asserts cond {
  if (!cond) throw new PhaseError(message);
}

async function lockPhases(db: DbOrTx): Promise<Phase[]> {
  return db.select().from(schema.phases).orderBy(asc(schema.phases.number)).for("update");
}

function runEngine(inputs: RunInputs): RunResult {
  const res = processPhase({ ...inputs, orders: inputs.orders });
  return { ...res, shortfallTeamIds: res.teams.filter((t) => !t.meetsMinimum).map((t) => t.teamId) };
}

export async function openPhase(n: number, actor: string, reason: string) {
  const db = getDb();
  await db.transaction(async (tx) => {
    await settleAutoClose(tx);
    const phases = await lockPhases(tx);
    const p = phases.find((x) => x.number === n);
    must(p, `Phase ${n} does not exist`);
    must(p.status === "draft", `${p.name} has already been opened`);
    const busy = phases.find((x) => ["open", "paused", "closed"].includes(x.status));
    must(!busy, `${busy?.name} is still ${busy?.status}. Close and confirm it first`);
    const prev = phases.find((x) => x.number === n - 1);
    if (prev) {
      must(prev.status === "confirmed" || prev.status === "published", `Confirm ${prev.name} before opening ${p.name}`);
      must(!prev.needsRecalculation, `${prev.name} has unconfirmed changes. Recalculate it first`);
    }
    await ensurePhaseAssetRows(tx);
    const [assets, paRows, runs] = await Promise.all([getAssets(tx), getPhaseAssetRows(tx, n), getConfirmedRuns(tx)]);
    const opening = openingPrices(n, assets, paRows, runs, false);
    for (const a of assets) {
      const price = opening.get(a.id);
      must(price != null && price > 0, `Opening price of ${a.code} is missing`);
      await tx
        .update(schema.phaseAssets)
        .set({ openingPricePaise: price })
        .where(and(eq(schema.phaseAssets.phaseNumber, n), eq(schema.phaseAssets.assetId, a.id)));
    }
    const [{ now }] = (await tx.execute<{ now: Date }>(sql`select now() as now`)).rows;
    const closesAt = new Date(new Date(now).getTime() + p.durationSeconds * 1000);
    await tx.update(schema.phases).set({ status: "open", opensAt: new Date(now), closesAt, pausedRemainingMs: null, updatedAt: new Date() }).where(eq(schema.phases.number, n));
    await audit(tx, {
      username: actor,
      action: "phase.open",
      entity: "phase",
      entityId: n,
      reason,
      after: { closesAt, openingPrices: Object.fromEntries(assets.map((a) => [a.code, opening.get(a.id)])) },
    });
  });
}

export async function pausePhase(n: number, actor: string, reason: string) {
  const db = getDb();
  await db.transaction(async (tx) => {
    await settleAutoClose(tx);
    const p = (await lockPhases(tx)).find((x) => x.number === n);
    must(p && p.status === "open" && p.closesAt, "Only an open phase can be paused");
    const [{ now }] = (await tx.execute<{ now: Date }>(sql`select now() as now`)).rows;
    const remaining = Math.max(0, new Date(p.closesAt).getTime() - new Date(now).getTime());
    await tx.update(schema.phases).set({ status: "paused", pausedRemainingMs: remaining, updatedAt: new Date() }).where(eq(schema.phases.number, n));
    await audit(tx, { username: actor, action: "phase.pause", entity: "phase", entityId: n, reason, after: { remainingSeconds: Math.round(remaining / 1000) } });
  });
}

/** Resumes trading. Every accepted order is checked again against the current rules; orders that now fail are voided. */
export async function resumePhase(n: number, actor: string, reason: string) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const p = (await lockPhases(tx)).find((x) => x.number === n);
    must(p && p.status === "paused", "Only a paused phase can be resumed");
    const inputs = await buildInputs(tx, n);
    const teamNames = new Map((await tx.select().from(schema.teams)).map((t) => [t.id, t.name]));
    const voided: { team: string; problems: string[] }[] = [];
    for (const o of inputs.orders) {
      const position = inputs.positions.find((x) => x.teamId === o.teamId)!;
      const v = validateOrder({ rules: inputs.rules, assets: inputs.assets, position, lines: o.lines, capitalPaise: inputs.capitalPaise });
      if (!v.ok) {
        const problems = v.issues.map((i) => i.message);
        await tx
          .update(schema.orders)
          .set({ status: "voided", voidReason: `Rules changed while trading was paused: ${problems.join("; ")}` })
          .where(eq(schema.orders.id, o.orderId));
        voided.push({ team: teamNames.get(o.teamId) ?? o.teamId, problems });
      }
    }
    const [{ now }] = (await tx.execute<{ now: Date }>(sql`select now() as now`)).rows;
    const closesAt = new Date(new Date(now).getTime() + (p.pausedRemainingMs ?? 0));
    await tx.update(schema.phases).set({ status: "open", closesAt, pausedRemainingMs: null, updatedAt: new Date() }).where(eq(schema.phases.number, n));
    await audit(tx, { username: actor, action: "phase.resume", entity: "phase", entityId: n, reason, after: { closesAt, voidedOrders: voided } });
    return voided;
  });
}

export async function extendPhase(n: number, minutes: number, actor: string, reason: string) {
  must(Number.isFinite(minutes) && minutes > 0 && minutes <= 120, "Enter between 1 and 120 minutes");
  const db = getDb();
  await db.transaction(async (tx) => {
    await settleAutoClose(tx);
    const p = (await lockPhases(tx)).find((x) => x.number === n);
    must(p && (p.status === "open" || p.status === "paused"), "Only an open or paused phase can be extended");
    if (p.status === "open") {
      await tx.update(schema.phases).set({ closesAt: new Date(new Date(p.closesAt!).getTime() + minutes * 60_000) }).where(eq(schema.phases.number, n));
    } else {
      await tx.update(schema.phases).set({ pausedRemainingMs: (p.pausedRemainingMs ?? 0) + minutes * 60_000 }).where(eq(schema.phases.number, n));
    }
    await audit(tx, { username: actor, action: "phase.extend", entity: "phase", entityId: n, reason, after: { minutes } });
  });
}

export async function closePhase(n: number, actor: string, reason: string) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const p = (await lockPhases(tx)).find((x) => x.number === n);
    must(p && (p.status === "open" || p.status === "paused"), "Only an open or paused phase can be closed");
    await tx.update(schema.phases).set({ status: "closed", closesAt: sql`now()`, pausedRemainingMs: null, updatedAt: new Date() }).where(eq(schema.phases.number, n));
    await audit(tx, { username: actor, action: "phase.close_early", entity: "phase", entityId: n, reason });
  });
}

/** Calculates the phase without changing anything teams can see. */
export async function previewPhase(n: number, actor: string) {
  const db = getDb();
  return db.transaction(async (tx) => {
    await settleAutoClose(tx);
    const p = (await lockPhases(tx)).find((x) => x.number === n);
    must(p && p.status === "closed", "The phase must be closed before it can be calculated");
    const inputs = await buildInputs(tx, n);
    const result = runEngine(inputs);
    await tx
      .update(schema.phaseRuns)
      .set({ status: "discarded" })
      .where(and(eq(schema.phaseRuns.phaseNumber, n), eq(schema.phaseRuns.status, "preview"), eq(schema.phaseRuns.kind, "preview")));
    const [run] = await tx
      .insert(schema.phaseRuns)
      .values({ phaseNumber: n, kind: "preview", status: "preview", inputs, result, createdBy: actor, batchId: inputsHash(inputs) })
      .returning({ id: schema.phaseRuns.id });
    return run.id;
  });
}

async function applyShortfallDisqualifications(tx: DbOrTx, n: number, result: RunResult, minAssets: number, enabled: boolean, actor: string) {
  if (!enabled) return [] as string[];
  const ids = result.shortfallTeamIds;
  if (ids.length === 0) return [];
  const teams = await tx.select().from(schema.teams).where(inArray(schema.teams.id, ids));
  const names: string[] = [];
  for (const t of teams) {
    if (t.status !== "active") continue;
    await tx
      .update(schema.teams)
      .set({
        status: "disqualified",
        disqualifiedPhase: n,
        disqualificationSource: "shortfall",
        disqualifiedReason: `Fewer than ${minAssets} assets traded with a positive executed quantity in Phase ${n}`,
      })
      .where(eq(schema.teams.id, t.id));
    names.push(t.name);
    const row = result.teams.find((x) => x.teamId === t.id);
    await audit(tx, {
      username: actor,
      action: "team.disqualify_shortfall",
      entity: "team",
      entityId: t.name,
      reason: `Automatic on confirming Phase ${n}: ${row?.tradesExecuted ?? 0} executed trades, minimum ${minAssets}`,
      after: { phase: n, tradesExecuted: row?.tradesExecuted ?? 0, executedLines: row?.executedLines ?? {} },
    });
  }
  return names;
}

/** Makes a previewed calculation official. Requires the preview to match the current orders and settings exactly. */
export async function confirmPhase(n: number, runId: number, actor: string, reason: string) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const p = (await lockPhases(tx)).find((x) => x.number === n);
    must(p && p.status === "closed", "Only a closed phase can be confirmed");
    const [run] = await tx.select().from(schema.phaseRuns).where(eq(schema.phaseRuns.id, runId)).for("update");
    must(run && run.phaseNumber === n && run.status === "preview" && run.kind === "preview", "This preview is no longer current. Run the preview again");
    const current = await buildInputs(tx, n);
    must(inputsHash(current) === run.batchId, "Orders or settings changed after this preview. Run the preview again before confirming");
    await tx.update(schema.phaseRuns).set({ status: "confirmed", confirmedAt: new Date(), confirmedBy: actor, reason }).where(eq(schema.phaseRuns.id, run.id));
    const comp = await getCompetition(tx);
    const result = run.result as RunResult;
    const disqualified = await applyShortfallDisqualifications(tx, n, result, p.minDistinctAssets, comp.disqualifyOnShortfall, actor);
    await tx.update(schema.phases).set({ status: "confirmed", confirmedRunId: run.id, needsRecalculation: false, updatedAt: new Date() }).where(eq(schema.phases.number, n));
    await audit(tx, {
      username: actor,
      action: "phase.confirm",
      entity: "phase",
      entityId: n,
      reason,
      after: { runId: run.id, newPrices: Object.fromEntries(result.assets.map((a) => [a.code, a.newPricePaise])), disqualified },
    });
    return { disqualified };
  });
}

export async function publishPhase(n: number, actor: string, reason: string, publish = true) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const p = (await lockPhases(tx)).find((x) => x.number === n);
    if (publish) {
      must(p && p.status === "confirmed", "Only a confirmed phase can be published");
      must(!p.needsRecalculation, "This phase has changes that are not yet recalculated");
      await tx.update(schema.phases).set({ status: "published", publishedAt: new Date(), updatedAt: new Date() }).where(eq(schema.phases.number, n));
    } else {
      must(p && p.status === "published", "Only a published phase can be withdrawn");
      await tx.update(schema.phases).set({ status: "confirmed", publishedAt: null, updatedAt: new Date() }).where(eq(schema.phases.number, n));
    }
    await audit(tx, { username: actor, action: publish ? "phase.publish" : "phase.unpublish", entity: "phase", entityId: n, reason });
  });
}

// ---------------------------------------------------------------------------------------------
// Recalculation of confirmed phases. Old runs are kept as "superseded"; nothing is overwritten.
// ---------------------------------------------------------------------------------------------

export interface RecalcPhaseSummary {
  phase: number;
  priceChanges: { code: string; beforePaise: number; afterPaise: number }[];
  valueChanges: { team: string; beforePaise: number; afterPaise: number }[];
  voidedOrders: { team: string; problems: string[] }[];
  newlyDisqualified: string[];
  reinstated: string[];
}

function simulateTeamsAfterRecalc(teams: Team[], fromN: number): Team[] {
  // Shortfall disqualifications from the recalculated phases onward are decided again.
  return teams.map((t) =>
    t.status === "disqualified" && t.disqualificationSource === "shortfall" && (t.disqualifiedPhase ?? 0) >= fromN
      ? { ...t, status: "active" as const, disqualifiedPhase: null, disqualificationSource: null }
      : t,
  );
}

async function computeRecalculation(tx: DbOrTx, fromN: number) {
  const phases = await getPhases(tx);
  const comp = await getCompetition(tx);
  const targets = phases.filter((p) => p.number >= fromN && (p.status === "confirmed" || p.status === "published"));
  must(targets.length > 0 && targets[0].number === fromN, `Phase ${fromN} is not confirmed, so there is nothing to recalculate`);
  must(!phases.some((p) => p.status === "open" || p.status === "paused"), "Close the running phase before recalculating");
  const last = phases.at(-1)!;
  must(last.status !== "published", "The final leaderboard is published. Recalculation is closed");
  const confirmed = await getConfirmedRuns(tx);
  const runs = new Map<number, { result: PhaseResult }>(confirmed);
  const allTeams = await tx.select().from(schema.teams).orderBy(asc(schema.teams.createdAt), asc(schema.teams.name));
  let teams = simulateTeamsAfterRecalc(allTeams, fromN);
  const names = new Map(allTeams.map((t) => [t.id, t.name]));
  const out: { phase: number; inputs: RunInputs; result: RunResult; voidIds: string[]; summary: RecalcPhaseSummary }[] = [];
  for (const p of targets) {
    const inputs = await buildInputs(tx, p.number, { runs, useFrozen: p.number === 1, teamsOverride: teams });
    const voidIds: string[] = [];
    const voided: RecalcPhaseSummary["voidedOrders"] = [];
    inputs.orders = inputs.orders.filter((o) => {
      const position = inputs.positions.find((x) => x.teamId === o.teamId)!;
      const v = validateOrder({ rules: inputs.rules, assets: inputs.assets, position, lines: o.lines, capitalPaise: inputs.capitalPaise });
      if (!v.ok) {
        voidIds.push(o.orderId);
        voided.push({ team: names.get(o.teamId) ?? o.teamId, problems: v.issues.map((i) => i.message) });
      }
      return v.ok;
    });
    const result = runEngine(inputs);
    const before = confirmed.get(p.number)?.result;
    const beforeDq = new Set(allTeams.filter((t) => t.status === "disqualified" && t.disqualifiedPhase === p.number && t.disqualificationSource === "shortfall").map((t) => t.id));
    const afterDq = comp.disqualifyOnShortfall ? new Set(result.shortfallTeamIds) : new Set<string>();
    out.push({
      phase: p.number,
      inputs,
      result,
      voidIds,
      summary: {
        phase: p.number,
        priceChanges: result.assets.map((a) => ({ code: a.code, beforePaise: before?.assets.find((x) => x.assetId === a.assetId)?.newPricePaise ?? 0, afterPaise: a.newPricePaise })),
        valueChanges: result.teams.map((t) => ({ team: names.get(t.teamId) ?? t.teamId, beforePaise: before?.teams.find((x) => x.teamId === t.teamId)?.valuePaise ?? 0, afterPaise: t.valuePaise })),
        voidedOrders: voided,
        newlyDisqualified: [...afterDq].filter((id) => !beforeDq.has(id) && allTeams.find((t) => t.id === id)?.status !== "disqualified").map((id) => names.get(id) ?? id),
        reinstated: [...beforeDq].filter((id) => !afterDq.has(id)).map((id) => names.get(id) ?? id),
      },
    });
    runs.set(p.number, { result });
    if (comp.disqualifyOnShortfall) {
      teams = teams.map((t) =>
        afterDq.has(t.id) && t.status === "active" ? { ...t, status: "disqualified" as const, disqualifiedPhase: p.number, disqualificationSource: "shortfall" as const } : t,
      );
    }
  }
  return { out, comp, targets };
}

export async function previewRecalculation(fromN: number, actor: string) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const { out } = await computeRecalculation(tx, fromN);
    const batchId = crypto.randomUUID();
    await tx
      .update(schema.phaseRuns)
      .set({ status: "discarded" })
      .where(and(eq(schema.phaseRuns.kind, "recalculation"), eq(schema.phaseRuns.status, "preview")));
    for (const o of out) {
      await tx.insert(schema.phaseRuns).values({
        phaseNumber: o.phase,
        kind: "recalculation",
        status: "preview",
        batchId,
        inputs: { ...o.inputs, voidIds: o.voidIds, fromPhase: fromN, hash: inputsHash(o.inputs) },
        result: { ...o.result, summary: o.summary },
        createdBy: actor,
      });
    }
    return { batchId, summaries: out.map((o) => o.summary) };
  });
}

export async function latestRecalculationPreview(db: DbOrTx) {
  const rows = await db
    .select()
    .from(schema.phaseRuns)
    .where(and(eq(schema.phaseRuns.kind, "recalculation"), eq(schema.phaseRuns.status, "preview")))
    .orderBy(asc(schema.phaseRuns.phaseNumber));
  if (rows.length === 0) return null;
  return {
    batchId: rows[0].batchId!,
    createdAt: rows[0].createdAt,
    createdBy: rows[0].createdBy,
    fromPhase: (rows[0].inputs as { fromPhase: number }).fromPhase,
    summaries: rows.map((r) => (r.result as { summary: RecalcPhaseSummary }).summary),
  };
}

/** Applies a recalculation after explicit organiser confirmation. Earlier confirmed runs are kept as superseded snapshots. */
export async function confirmRecalculation(batchId: string, actor: string, reason: string) {
  const db = getDb();
  return db.transaction(async (tx) => {
    await lockPhases(tx);
    const previewRows = await tx
      .select()
      .from(schema.phaseRuns)
      .where(and(eq(schema.phaseRuns.batchId, batchId), eq(schema.phaseRuns.status, "preview")))
      .orderBy(asc(schema.phaseRuns.phaseNumber));
    must(previewRows.length > 0, "This recalculation preview is no longer current. Run it again");
    const fromN = (previewRows[0].inputs as { fromPhase: number }).fromPhase;
    const { out, comp } = await computeRecalculation(tx, fromN);
    must(
      out.length === previewRows.length && out.every((o, i) => inputsHash(o.inputs) === (previewRows[i].inputs as { hash: string }).hash),
      "Orders or settings changed after the recalculation preview. Run it again before confirming",
    );
    const allTeams = await tx.select().from(schema.teams);
    // Shortfall disqualifications from fromN onward are decided again by this recalculation.
    const restored: typeof allTeams = [];
    for (const t of allTeams) {
      if (t.status === "disqualified" && t.disqualificationSource === "shortfall" && (t.disqualifiedPhase ?? 0) >= fromN) {
        await tx.update(schema.teams).set({ status: "active", disqualifiedPhase: null, disqualificationSource: null, disqualifiedReason: null }).where(eq(schema.teams.id, t.id));
        restored.push(t);
      }
    }
    for (const [i, o] of out.entries()) {
      const row = previewRows[i];
      await tx
        .update(schema.phaseRuns)
        .set({ status: "superseded" })
        .where(and(eq(schema.phaseRuns.phaseNumber, o.phase), eq(schema.phaseRuns.status, "confirmed")));
      await tx.update(schema.phaseRuns).set({ status: "confirmed", confirmedAt: new Date(), confirmedBy: actor, reason }).where(eq(schema.phaseRuns.id, row.id));
      if (o.voidIds.length > 0) {
        await tx
          .update(schema.orders)
          .set({ status: "voided", voidReason: "No longer valid after the organiser recalculated an earlier phase" })
          .where(inArray(schema.orders.id, o.voidIds));
      }
      for (const a of o.inputs.assets) {
        await tx
          .update(schema.phaseAssets)
          .set({ openingPricePaise: a.openingPricePaise })
          .where(and(eq(schema.phaseAssets.phaseNumber, o.phase), eq(schema.phaseAssets.assetId, a.assetId)));
      }
      const p = (await getPhases(tx)).find((x) => x.number === o.phase)!;
      await applyShortfallDisqualifications(tx, o.phase, o.result, p.minDistinctAssets, comp.disqualifyOnShortfall, actor);
      await tx.update(schema.phases).set({ confirmedRunId: row.id, needsRecalculation: false, updatedAt: new Date() }).where(eq(schema.phases.number, o.phase));
    }
    const after = await tx.select().from(schema.teams).where(inArray(schema.teams.id, restored.length ? restored.map((t) => t.id) : ["00000000-0000-0000-0000-000000000000"]));
    for (const t of after.filter((x) => x.status === "active")) {
      const was = restored.find((x) => x.id === t.id)!;
      await audit(tx, { username: actor, action: "team.reinstate_recalculation", entity: "team", entityId: t.name, reason: `Meets the minimum after recalculation from Phase ${fromN}`, before: { disqualifiedPhase: was.disqualifiedPhase, reason: was.disqualifiedReason } });
    }
    // Opening prices of the next phase if it is open or closed are not touched; recalculation is blocked while a phase runs.
    await audit(tx, { username: actor, action: "phase.recalculate", entity: "phase", entityId: fromN, reason, after: out.map((o) => o.summary) });
    return out.map((o) => o.summary);
  });
}

export async function discardRecalculation(actor: string) {
  const db = getDb();
  await db.update(schema.phaseRuns).set({ status: "discarded" }).where(and(eq(schema.phaseRuns.kind, "recalculation"), eq(schema.phaseRuns.status, "preview")));
  await audit(db, { username: actor, action: "phase.recalculate_discard", entity: "phase", reason: "Discarded recalculation preview" });
}

export async function latestPreview(db: DbOrTx, n: number) {
  const [row] = await db
    .select()
    .from(schema.phaseRuns)
    .where(and(eq(schema.phaseRuns.phaseNumber, n), eq(schema.phaseRuns.kind, "preview"), eq(schema.phaseRuns.status, "preview")))
    .orderBy(desc(schema.phaseRuns.id))
    .limit(1);
  return row ?? null;
}

/** Marks confirmed phases from n onward as needing recalculation after a settings change. */
export async function flagRecalculation(tx: DbOrTx, n: number) {
  const phases = await getPhases(tx);
  for (const p of phases) {
    if (p.number >= n && (p.status === "confirmed" || p.status === "published")) {
      await tx.update(schema.phases).set({ needsRecalculation: true }).where(eq(schema.phases.number, p.number));
    }
  }
}

export { participates };

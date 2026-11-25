import "server-only";
import { count, eq, sql } from "drizzle-orm";
import { getDb, schema, type DbOrTx } from "@/db";
import { audit } from "@/lib/audit";
import { seedMarket } from "./setup";

export interface ResetOptions {
  /** Delete every team and its login. Otherwise teams keep their logins and become active again. */
  deleteTeams: boolean;
  /** Delete every announcement. */
  deleteAnnouncements: boolean;
  /** Replace assets, prices, supply, news scores and phase rules with the workbook defaults. */
  restoreDefaults: boolean;
}

export interface ResetSummary {
  orders: number;
  attempts: number;
  results: number;
  teams: number;
  disqualified: number;
  announcements: number;
  phasesStarted: number;
}

/** What a reset would remove, shown to the organiser before confirming. */
export async function resetPreview(db: DbOrTx = getDb()): Promise<ResetSummary> {
  const n = async (q: Promise<{ n: number }[]>) => Number((await q)[0]?.n ?? 0);
  return {
    orders: await n(db.select({ n: count() }).from(schema.orders)),
    attempts: await n(db.select({ n: count() }).from(schema.orderAttempts)),
    results: await n(db.select({ n: count() }).from(schema.phaseRuns)),
    teams: await n(db.select({ n: count() }).from(schema.teams)),
    disqualified: await n(db.select({ n: count() }).from(schema.teams).where(eq(schema.teams.status, "disqualified"))),
    announcements: await n(db.select({ n: count() }).from(schema.announcements)),
    phasesStarted: await n(db.select({ n: count() }).from(schema.phases).where(sql`${schema.phases.status} <> 'draft'`)),
  };
}

/**
 * Returns the competition to the state before Phase 1 opened. Removes every order, refused attempt and
 * phase result, and sets every phase back to not started. Organiser accounts, the rulebook versions and
 * the audit log are always kept. Runs in 1 transaction: either everything is reset or nothing changes.
 */
export async function resetCompetition(actor: string, reason: string, opts: ResetOptions): Promise<ResetSummary> {
  const db = getDb();
  return db.transaction(async (tx) => {
    // Lock every phase so no order can be accepted while the reset runs.
    await tx.execute(sql`select number from phases for update`);
    const before = await resetPreview(tx);

    await tx.delete(schema.orders);
    await tx.delete(schema.orderAttempts);
    await tx.delete(schema.phaseRuns);

    if (opts.deleteTeams) {
      await tx.delete(schema.users).where(eq(schema.users.role, "team"));
      await tx.delete(schema.teams);
    } else {
      await tx
        .update(schema.teams)
        .set({ status: "active", disqualifiedPhase: null, disqualifiedReason: null, disqualificationSource: null, reinstatedNote: null });
      await tx.update(schema.users).set({ failedLogins: 0, lockedUntil: null }).where(eq(schema.users.role, "team"));
    }
    if (opts.deleteAnnouncements) await tx.delete(schema.announcements);

    if (opts.restoreDefaults) {
      // Deleting phases and assets also removes their supply, overrides and news scores.
      await tx.delete(schema.phases);
      await tx.delete(schema.assets);
      await seedMarket(tx);
      await tx
        .update(schema.competition)
        .set({ startingCapitalPaise: 100_000_000, deploymentShare: "0.7", supplyCalibratedFor: 15, disqualifyOnShortfall: true, updatedAt: new Date() });
    } else {
      await tx.update(schema.phases).set({
        status: "draft",
        opensAt: null,
        closesAt: null,
        pausedRemainingMs: null,
        confirmedRunId: null,
        needsRecalculation: false,
        publishedAt: null,
        updatedAt: new Date(),
      });
      await tx.update(schema.phaseAssets).set({ openingPricePaise: null });
    }

    await audit(tx, {
      username: actor,
      action: "competition.reset",
      entity: "competition",
      reason,
      before: { ...before },
      after: { ...opts },
    });
    return before;
  });
}

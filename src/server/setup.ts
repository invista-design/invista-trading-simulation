import "server-only";
import { count, eq } from "drizzle-orm";
import { getDb, schema, type DbOrTx } from "@/db";
import { SEED_ASSETS, SEED_NEWS_KEYS, SEED_OVERRIDES, SEED_RULEBOOK } from "@/db/seed-data";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";

export async function organiserCount(db: DbOrTx = getDb()): Promise<number> {
  const [r] = await db.select({ n: count() }).from(schema.users).where(eq(schema.users.role, "organiser"));
  return Number(r?.n ?? 0);
}

/** Loads the workbook defaults: 10 assets, 3 phases with the workbook settings, scores, override and the rulebook. */
export async function seedDefaults(db: DbOrTx, actor: string) {
  const [existing] = await db.select({ n: count() }).from(schema.competition);
  if (Number(existing?.n ?? 0) > 0) return false;
  await db.insert(schema.competition).values({ id: 1 });
  await seedMarket(db);
  await db.insert(schema.rulebookVersions).values({ version: 1, content: SEED_RULEBOOK, note: "Participant Rulebook (final), as supplied", createdBy: actor });
  await audit(db, { username: actor, action: "competition.seed", entity: "competition", reason: "Loaded workbook defaults at first setup" });
  return true;
}

/** Inserts the workbook's assets, 3 phases with their settings, supply, overrides and news scores. Tables must be empty. */
export async function seedMarket(db: DbOrTx) {
  const assetIds = new Map<string, string>();
  for (const a of SEED_ASSETS) {
    const [row] = await db
      .insert(schema.assets)
      .values({
        code: a.code,
        name: a.name,
        assetType: a.assetType,
        sector: a.sector,
        quoteUnit: a.quoteUnit,
        lotDefinition: a.lotDefinition,
        unitsPerLot: a.unitsPerLot,
        initialPricePaise: a.initialPricePaise,
        baseSupply: a.baseSupply,
        displayOrder: a.displayOrder,
      })
      .returning({ id: schema.assets.id });
    assetIds.set(a.code, row.id);
  }
  for (const n of [1, 2, 3]) {
    await db.insert(schema.phases).values({
      number: n,
      name: `Phase ${n}`,
      durationSeconds: 600,
      allowSell: n > 1,
      neutralRatio: n === 1 ? "1" : "0",
      newsSensitivity: "0.15",
      demandSensitivity: "0.1",
      maxMove: "0.15",
      capShare: "1",
      rationing: false,
      minDistinctAssets: 3,
    });
    for (const a of SEED_ASSETS) {
      const ov = SEED_OVERRIDES.find((o) => o.phase === n && o.code === a.code);
      await db.insert(schema.phaseAssets).values({
        phaseNumber: n,
        assetId: assetIds.get(a.code)!,
        supply: a.baseSupply,
        overrideType: ov ? ov.type : "none",
        overrideValue: ov ? ov.value : null,
      });
      const k = SEED_NEWS_KEYS[n]?.[a.code];
      await db.insert(schema.newsKeys).values({
        phaseNumber: n,
        assetId: assetIds.get(a.code)!,
        score: k?.score ?? "0",
        storyNumber: k?.storyNumber ?? "",
        headline: k?.headline ?? "",
        realWorldReference: k?.realWorldReference ?? "",
        realMove: k?.realMove ?? "",
        explanation: k?.explanation ?? "",
      });
    }
  }
}

export async function createFirstOrganiser(username: string, password: string, displayName: string) {
  const db = getDb();
  return db.transaction(async (tx) => {
    if ((await organiserCount(tx)) > 0) throw new Error("Setup is already complete. Sign in instead.");
    const uname = username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(uname)) throw new Error("Username: 3 to 40 characters, letters, numbers, dot, hyphen or underscore");
    if (password.length < 10) throw new Error("Password must be at least 10 characters");
    await tx.insert(schema.users).values({ username: uname, passwordHash: await hashPassword(password), role: "organiser", displayName: displayName || uname });
    await seedDefaults(tx, uname);
    await audit(tx, { username: uname, action: "organiser.create_first", entity: "user", entityId: uname, reason: "First organiser account created at setup" });
  });
}

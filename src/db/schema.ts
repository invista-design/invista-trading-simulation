import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const money = (name: string) => bigint(name, { mode: "number" });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/** Single competition row (id = 1). */
export const competition = pgTable("competition", {
  id: integer("id").primaryKey().default(1),
  name: text("name").notNull().default("Market Mayhem - Trading Simulation: Dalal Street Challenge"),
  organiser: text("organiser").notNull().default("InVista"),
  roundName: text("round_name").notNull().default("Round 1"),
  startingCapitalPaise: money("starting_capital_paise").notNull().default(100_000_000),
  teamCapacity: integer("team_capacity").notNull().default(60),
  instagramUrl: text("instagram_url").notNull().default(""),
  disqualifyOnShortfall: boolean("disqualify_on_shortfall").notNull().default(true),
  showDemandAfterPublish: boolean("show_demand_after_publish").notNull().default(true),
  showMarketParameters: boolean("show_market_parameters").notNull().default(false),
  deploymentShare: text("deployment_share").notNull().default("0.7"),
  supplyCalibratedFor: integer("supply_calibrated_for").notNull().default(15),
  /** Teams can register on the website while this is on. Registration also closes once Phase 1 opens. */
  registrationOpen: boolean("registration_open").notNull().default(true),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export interface TeamMember {
  name: string;
  /** 10-digit Indian mobile number, digits only. */
  phone: string;
  email: string;
}

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  nameKey: text("name_key").notNull().unique(),
  /** Login code: 1 capital letter and 2 digits, for example A07. Unique across teams. */
  code: text("code").notNull().unique(),
  members: jsonb("members").$type<TeamMember[]>().notNull().default([]),
  registrationSource: text("registration_source").$type<"website" | "organiser">().notNull().default("website"),
  status: text("status").$type<"active" | "disqualified">().notNull().default("active"),
  disqualifiedPhase: integer("disqualified_phase"),
  disqualifiedReason: text("disqualified_reason"),
  disqualificationSource: text("disqualification_source").$type<"shortfall" | "manual" | null>(),
  reinstatedNote: text("reinstated_note"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<"organiser" | "team">().notNull(),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull().default(""),
  active: boolean("active").notNull().default(true),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: ts("locked_until"),
  lastLoginAt: ts("last_login_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  assetType: text("asset_type").notNull().default("Stock"),
  sector: text("sector").notNull().default(""),
  quoteUnit: text("quote_unit").notNull().default("per share"),
  lotDefinition: text("lot_definition").notNull().default("1 lot = 1 share"),
  unitsPerLot: text("units_per_lot").notNull().default("1"),
  initialPricePaise: money("initial_price_paise").notNull(),
  baseSupply: integer("base_supply").notNull().default(0),
  profile: text("profile").notNull().default(""),
  description: text("description").notNull().default(""),
  displayOrder: integer("display_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export type PhaseStatus = "draft" | "open" | "paused" | "closed" | "confirmed" | "published";

export const phases = pgTable("phases", {
  number: integer("number").primaryKey(),
  name: text("name").notNull(),
  status: text("status").$type<PhaseStatus>().notNull().default("draft"),
  durationSeconds: integer("duration_seconds").notNull().default(600),
  scheduledAt: ts("scheduled_at"),
  opensAt: ts("opens_at"),
  closesAt: ts("closes_at"),
  pausedRemainingMs: integer("paused_remaining_ms"),
  allowSell: boolean("allow_sell").notNull().default(true),
  neutralRatio: text("neutral_ratio").notNull().default("0"),
  newsSensitivity: text("news_sensitivity").notNull().default("0.15"),
  demandSensitivity: text("demand_sensitivity").notNull().default("0.1"),
  maxMove: text("max_move").notNull().default("0.15"),
  capShare: text("cap_share").notNull().default("1"),
  rationing: boolean("rationing").notNull().default(false),
  minDistinctAssets: integer("min_distinct_assets").notNull().default(3),
  confirmedRunId: integer("confirmed_run_id"),
  needsRecalculation: boolean("needs_recalculation").notNull().default(false),
  publishedAt: ts("published_at"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** Market parameters per phase and asset. Opening price is frozen when the phase opens. */
export const phaseAssets = pgTable(
  "phase_assets",
  {
    phaseNumber: integer("phase_number").notNull().references(() => phases.number, { onDelete: "cascade" }),
    assetId: uuid("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
    supply: integer("supply").notNull().default(0),
    overrideType: text("override_type").$type<"none" | "price" | "percent">().notNull().default("none"),
    overrideValue: text("override_value"),
    openingPricePaise: money("opening_price_paise"),
  },
  (t) => [primaryKey({ columns: [t.phaseNumber, t.assetId] })],
);

/** Confidential layer. Never read by participant code. */
export const newsKeys = pgTable(
  "news_keys",
  {
    phaseNumber: integer("phase_number").notNull().references(() => phases.number, { onDelete: "cascade" }),
    assetId: uuid("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
    score: text("score").notNull().default("0"),
    storyNumber: text("story_number").notNull().default(""),
    headline: text("headline").notNull().default(""),
    realWorldReference: text("real_world_reference").notNull().default(""),
    realMove: text("real_move").notNull().default(""),
    explanation: text("explanation").notNull().default(""),
    learningObjective: text("learning_objective").notNull().default(""),
    isDistractor: boolean("is_distractor").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.phaseNumber, t.assetId] })],
);

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  phaseNumber: integer("phase_number"),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  linkUrl: text("link_url").notNull().default(""),
  visible: boolean("visible").notNull().default(true),
  correctionOf: integer("correction_of"),
  publishedAt: ts("published_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const rulebookVersions = pgTable("rulebook_versions", {
  id: serial("id").primaryKey(),
  version: integer("version").notNull(),
  content: text("content").notNull(),
  note: text("note").notNull().default(""),
  published: boolean("published").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
  createdBy: text("created_by").notNull().default(""),
});

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phaseNumber: integer("phase_number").notNull().references(() => phases.number, { onDelete: "cascade" }),
    teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    status: text("status").$type<"live" | "replaced" | "voided">().notNull().default("live"),
    lines: jsonb("lines").$type<Record<string, number>>().notNull(),
    submittedAt: ts("submitted_at").notNull().defaultNow(),
    userId: uuid("user_id"),
    source: text("source").$type<"website" | "organiser">().notNull().default("website"),
    clientKey: text("client_key").notNull(),
    rationale: text("rationale").notNull().default(""),
    voidReason: text("void_reason"),
  },
  (t) => [
    uniqueIndex("orders_team_client_key").on(t.teamId, t.clientKey),
    uniqueIndex("orders_one_live_per_team_phase").on(t.phaseNumber, t.teamId).where(sql`status = 'live'`),
    index("orders_phase_idx").on(t.phaseNumber),
  ],
);

export const orderAttempts = pgTable("order_attempts", {
  id: serial("id").primaryKey(),
  phaseNumber: integer("phase_number").notNull(),
  teamId: uuid("team_id").notNull(),
  userId: uuid("user_id"),
  lines: jsonb("lines").$type<Record<string, unknown>>().notNull(),
  issues: jsonb("issues").$type<{ code: string; message: string; assetId?: string }[]>().notNull(),
  at: ts("at").notNull().defaultNow(),
});

/** Every calculation of a phase is kept. Confirmed runs are the official record; nothing is overwritten. */
export const phaseRuns = pgTable(
  "phase_runs",
  {
    id: serial("id").primaryKey(),
    phaseNumber: integer("phase_number").notNull().references(() => phases.number, { onDelete: "cascade" }),
    kind: text("kind").$type<"preview" | "recalculation">().notNull(),
    status: text("status").$type<"preview" | "confirmed" | "superseded" | "discarded">().notNull(),
    batchId: text("batch_id"),
    inputs: jsonb("inputs").notNull(),
    result: jsonb("result").notNull(),
    reason: text("reason").notNull().default(""),
    createdAt: ts("created_at").notNull().defaultNow(),
    createdBy: text("created_by").notNull().default(""),
    confirmedAt: ts("confirmed_at"),
    confirmedBy: text("confirmed_by"),
  },
  (t) => [index("phase_runs_phase_idx").on(t.phaseNumber)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    at: ts("at").notNull().defaultNow(),
    username: text("username").notNull(),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull().default(""),
    reason: text("reason").notNull().default(""),
    before: jsonb("before"),
    after: jsonb("after"),
  },
  (t) => [index("audit_at_idx").on(t.at)],
);

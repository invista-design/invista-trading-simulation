CREATE TABLE "announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"phase_number" integer,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"link_url" text DEFAULT '' NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"correction_of" integer,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"asset_type" text DEFAULT 'Stock' NOT NULL,
	"sector" text DEFAULT '' NOT NULL,
	"quote_unit" text DEFAULT 'per share' NOT NULL,
	"lot_definition" text DEFAULT '1 lot = 1 share' NOT NULL,
	"units_per_lot" text DEFAULT '1' NOT NULL,
	"initial_price_paise" bigint NOT NULL,
	"base_supply" integer DEFAULT 0 NOT NULL,
	"profile" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "assets_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"username" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text DEFAULT '' NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"before" jsonb,
	"after" jsonb
);
--> statement-breakpoint
CREATE TABLE "competition" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" text DEFAULT 'Trading Simulation' NOT NULL,
	"organiser" text DEFAULT 'InVista' NOT NULL,
	"round_name" text DEFAULT 'Round 1' NOT NULL,
	"starting_capital_paise" bigint DEFAULT 100000000 NOT NULL,
	"team_capacity" integer DEFAULT 60 NOT NULL,
	"instagram_url" text DEFAULT '' NOT NULL,
	"disqualify_on_shortfall" boolean DEFAULT true NOT NULL,
	"show_demand_after_publish" boolean DEFAULT true NOT NULL,
	"show_market_parameters" boolean DEFAULT false NOT NULL,
	"deployment_share" text DEFAULT '0.7' NOT NULL,
	"supply_calibrated_for" integer DEFAULT 15 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_keys" (
	"phase_number" integer NOT NULL,
	"asset_id" uuid NOT NULL,
	"score" text DEFAULT '0' NOT NULL,
	"story_number" text DEFAULT '' NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"real_world_reference" text DEFAULT '' NOT NULL,
	"real_move" text DEFAULT '' NOT NULL,
	"explanation" text DEFAULT '' NOT NULL,
	"learning_objective" text DEFAULT '' NOT NULL,
	"is_distractor" boolean DEFAULT false NOT NULL,
	CONSTRAINT "news_keys_phase_number_asset_id_pk" PRIMARY KEY("phase_number","asset_id")
);
--> statement-breakpoint
CREATE TABLE "order_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"phase_number" integer NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid,
	"lines" jsonb NOT NULL,
	"issues" jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase_number" integer NOT NULL,
	"team_id" uuid NOT NULL,
	"status" text DEFAULT 'live' NOT NULL,
	"lines" jsonb NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"source" text DEFAULT 'website' NOT NULL,
	"client_key" text NOT NULL,
	"rationale" text DEFAULT '' NOT NULL,
	"void_reason" text
);
--> statement-breakpoint
CREATE TABLE "phase_assets" (
	"phase_number" integer NOT NULL,
	"asset_id" uuid NOT NULL,
	"supply" integer DEFAULT 0 NOT NULL,
	"override_type" text DEFAULT 'none' NOT NULL,
	"override_value" text,
	"opening_price_paise" bigint,
	CONSTRAINT "phase_assets_phase_number_asset_id_pk" PRIMARY KEY("phase_number","asset_id")
);
--> statement-breakpoint
CREATE TABLE "phase_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"phase_number" integer NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"batch_id" text,
	"inputs" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text DEFAULT '' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"confirmed_by" text
);
--> statement-breakpoint
CREATE TABLE "phases" (
	"number" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"duration_seconds" integer DEFAULT 600 NOT NULL,
	"scheduled_at" timestamp with time zone,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"paused_remaining_ms" integer,
	"allow_sell" boolean DEFAULT true NOT NULL,
	"neutral_ratio" text DEFAULT '0' NOT NULL,
	"news_sensitivity" text DEFAULT '0.15' NOT NULL,
	"demand_sensitivity" text DEFAULT '0.1' NOT NULL,
	"max_move" text DEFAULT '0.15' NOT NULL,
	"cap_share" text DEFAULT '1' NOT NULL,
	"rationing" boolean DEFAULT false NOT NULL,
	"min_distinct_assets" integer DEFAULT 3 NOT NULL,
	"confirmed_run_id" integer,
	"needs_recalculation" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rulebook_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"members" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"disqualified_phase" integer,
	"disqualified_reason" text,
	"disqualification_source" text,
	"reinstated_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_name_key_unique" UNIQUE("name_key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"team_id" uuid,
	"display_name" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "news_keys" ADD CONSTRAINT "news_keys_phase_number_phases_number_fk" FOREIGN KEY ("phase_number") REFERENCES "public"."phases"("number") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_keys" ADD CONSTRAINT "news_keys_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_phase_number_phases_number_fk" FOREIGN KEY ("phase_number") REFERENCES "public"."phases"("number") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phase_assets" ADD CONSTRAINT "phase_assets_phase_number_phases_number_fk" FOREIGN KEY ("phase_number") REFERENCES "public"."phases"("number") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phase_assets" ADD CONSTRAINT "phase_assets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phase_runs" ADD CONSTRAINT "phase_runs_phase_number_phases_number_fk" FOREIGN KEY ("phase_number") REFERENCES "public"."phases"("number") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_team_client_key" ON "orders" USING btree ("team_id","client_key");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_one_live_per_team_phase" ON "orders" USING btree ("phase_number","team_id") WHERE status = 'live';--> statement-breakpoint
CREATE INDEX "orders_phase_idx" ON "orders" USING btree ("phase_number");--> statement-breakpoint
CREATE INDEX "phase_runs_phase_idx" ON "phase_runs" USING btree ("phase_number");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");
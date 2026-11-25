ALTER TABLE "competition" ALTER COLUMN "name" SET DEFAULT 'Market Mayhem - Trading Simulation: Dalal Street Challenge';--> statement-breakpoint
ALTER TABLE "competition" ADD COLUMN "registration_open" boolean DEFAULT true NOT NULL;--> statement-breakpoint
UPDATE "competition" SET "name" = 'Market Mayhem - Trading Simulation: Dalal Street Challenge' WHERE "name" = 'Trading Simulation';--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "code" text;--> statement-breakpoint
UPDATE "teams" t SET "code" = s.code FROM (
  SELECT id, chr(65 + ((row_number() OVER (ORDER BY created_at, id) - 1) / 100)::int) || lpad((((row_number() OVER (ORDER BY created_at, id)) - 1) % 100)::text, 2, '0') AS code
  FROM "teams"
) s WHERE t.id = s.id;--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_code_unique" UNIQUE("code");--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "registration_source" text DEFAULT 'website' NOT NULL;--> statement-breakpoint
UPDATE "teams" SET "registration_source" = 'organiser';--> statement-breakpoint
UPDATE "teams" SET "members" = COALESCE(
  (SELECT jsonb_agg(jsonb_build_object('name', m, 'phone', '', 'email', '')) FROM jsonb_array_elements_text("members") AS m),
  '[]'::jsonb
) WHERE jsonb_typeof("members") = 'array' AND jsonb_array_length("members") > 0 AND jsonb_typeof("members" -> 0) = 'string';

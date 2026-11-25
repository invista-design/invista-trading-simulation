ALTER TABLE "competition" ADD COLUMN "event_date" text DEFAULT '30th November, 2026' NOT NULL;--> statement-breakpoint
ALTER TABLE "competition" ADD COLUMN "event_time" text DEFAULT '5PM' NOT NULL;--> statement-breakpoint
ALTER TABLE "competition" ADD COLUMN "event_venue" text DEFAULT 'Auditorium' NOT NULL;--> statement-breakpoint
ALTER TABLE "competition" ADD COLUMN "prize_pool" text DEFAULT '₹12,000' NOT NULL;--> statement-breakpoint
ALTER TABLE "competition" ADD COLUMN "event_note" text DEFAULT 'Bring your fully charged laptops' NOT NULL;
ALTER TABLE "user_preferences" ADD COLUMN "byok_connections" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "byok_active_connection_id" text;
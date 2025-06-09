CREATE TABLE "chat_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"messages" jsonb NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "chat_summaries" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"summary" text NOT NULL,
	"key_topics" text[] DEFAULT '{}' NOT NULL,
	"user_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"writing_style_analysis" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_summaries" ADD CONSTRAINT "chat_summaries_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;
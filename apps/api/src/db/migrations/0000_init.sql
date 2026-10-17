CREATE TABLE "day_presence" (
	"day_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"display_name" text NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_presence_day_id_session_id_pk" PRIMARY KEY("day_id","session_id")
);
--> statement-breakpoint
CREATE TABLE "days" (
	"id" uuid PRIMARY KEY NOT NULL,
	"trip_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by_name" text,
	"updated_at" timestamp with time zone,
	CONSTRAINT "days_trip_position_uq" UNIQUE("trip_id","position"),
	CONSTRAINT "days_position_ck" CHECK ("days"."position" between 1 and 60),
	CONSTRAINT "days_text_len_ck" CHECK (char_length("days"."text") <= 5000)
);
--> statement-breakpoint
CREATE TABLE "delete_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"trip_id" uuid NOT NULL,
	"requested_by_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "destinations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'geoapify' NOT NULL,
	"provider_place_id" text NOT NULL,
	"name" text NOT NULL,
	"region" text,
	"country" text NOT NULL,
	"country_code" char(2) NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "destinations_provider_place_uq" UNIQUE("provider","provider_place_id")
);
--> statement-breakpoint
CREATE TABLE "provider_cache" (
	"cache_key" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_counters" (
	"bucket_key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_slug_history" (
	"old_slug" text PRIMARY KEY NOT NULL,
	"trip_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"slug" text NOT NULL,
	"destination_id" uuid NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"organiser_token" text NOT NULL,
	"edit_token" text NOT NULL,
	"view_token" text NOT NULL,
	"organiser_email_hash" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"copied_from_trip_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trips_name_key_uq" UNIQUE("name_key"),
	CONSTRAINT "trips_slug_uq" UNIQUE("slug"),
	CONSTRAINT "trips_organiser_token_uq" UNIQUE("organiser_token"),
	CONSTRAINT "trips_edit_token_uq" UNIQUE("edit_token"),
	CONSTRAINT "trips_view_token_uq" UNIQUE("view_token"),
	CONSTRAINT "trips_name_len_ck" CHECK (char_length("trips"."name") between 3 and 80),
	CONSTRAINT "trips_dates_order_ck" CHECK ("trips"."to_date" >= "trips"."from_date"),
	CONSTRAINT "trips_max_days_ck" CHECK ("trips"."to_date" - "trips"."from_date" <= 59)
);
--> statement-breakpoint
ALTER TABLE "day_presence" ADD CONSTRAINT "day_presence_day_id_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "days" ADD CONSTRAINT "days_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delete_requests" ADD CONSTRAINT "delete_requests_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_slug_history" ADD CONSTRAINT "trip_slug_history_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delete_requests_trip_status_idx" ON "delete_requests" USING btree ("trip_id","status");--> statement-breakpoint
CREATE INDEX "provider_cache_expires_idx" ON "provider_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "rate_counters_expires_idx" ON "rate_counters" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "trip_slug_history_trip_idx" ON "trip_slug_history" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trips_published_idx" ON "trips" USING btree ("is_published","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "trips_destination_published_idx" ON "trips" USING btree ("destination_id","is_published");--> statement-breakpoint
CREATE INDEX "trips_email_hash_idx" ON "trips" USING btree ("organiser_email_hash");
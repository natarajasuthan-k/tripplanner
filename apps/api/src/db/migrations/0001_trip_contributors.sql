CREATE TABLE "trip_contributors" (
	"trip_id" uuid NOT NULL,
	"contributor_hash" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_contributors_trip_id_contributor_hash_pk" PRIMARY KEY("trip_id","contributor_hash")
);
--> statement-breakpoint
ALTER TABLE "trip_contributors" ADD CONSTRAINT "trip_contributors_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
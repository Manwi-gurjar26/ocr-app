CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_path" text NOT NULL,
	"doc_type" text DEFAULT 'unknown' NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"raw_text" text,
	"ocr_confidence" real,
	"extraction_method" text,
	"fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "documents_type_idx" ON "documents" USING btree ("doc_type");--> statement-breakpoint
CREATE INDEX "documents_created_idx" ON "documents" USING btree ("created_at");
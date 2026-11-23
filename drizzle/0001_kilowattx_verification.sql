CREATE TABLE "document_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"action" text DEFAULT 'system' NOT NULL,
	"actor" text DEFAULT 'system' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"extraction_method" text NOT NULL,
	"doc_type" text NOT NULL,
	"extracted_text" text,
	"extracted_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence_score" real,
	"validation_result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "status" SET DEFAULT 'uploaded';--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "customer_id" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "declared_type" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "declared" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "ocr_provider" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "validation" jsonb;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "document_events" ADD CONSTRAINT "document_events_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_document_idx" ON "document_events" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE INDEX "extractions_document_idx" ON "document_extractions" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE INDEX "documents_status_idx" ON "documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "documents_customer_idx" ON "documents" USING btree ("customer_id");--> statement-breakpoint
UPDATE "documents" SET "status" = 'manual_review' WHERE "status" = 'done';

import { index, integer, jsonb, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type {
  DeclaredDetails,
  DocStatus,
  DocType,
  DocumentFields,
  ExtractionMethod,
  OcrProviderName,
  ReviewAction,
  ValidationResult,
} from "@/lib/types";

/** One row per uploaded file. Holds the latest extraction snapshot for fast listing. */
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Owner of the document (customer / factory / landowner id from the main platform). */
    customerId: text("customer_id"),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size").notNull(),
    /** Private storage reference (local path today, S3 key in production). */
    filePath: text("file_path").notNull(),
    /** Category the uploader selected, if any. */
    declaredType: text("declared_type").$type<DocType>(),
    /** Customer-entered details to cross-check against the document. */
    declared: jsonb("declared").$type<DeclaredDetails>().notNull().default({}),
    docType: text("doc_type").$type<DocType>().notNull().default("unknown"),
    status: text("status").$type<DocStatus>().notNull().default("uploaded"),
    rawText: text("raw_text"),
    ocrConfidence: real("ocr_confidence"),
    ocrProvider: text("ocr_provider").$type<OcrProviderName>(),
    extractionMethod: text("extraction_method").$type<ExtractionMethod>(),
    fields: jsonb("fields").$type<DocumentFields>().notNull().default({}),
    validation: jsonb("validation").$type<ValidationResult>(),
    error: text("error"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("documents_type_idx").on(t.docType),
    index("documents_created_idx").on(t.createdAt),
    index("documents_status_idx").on(t.status),
    index("documents_customer_idx").on(t.customerId),
  ],
);

/** Every OCR/extraction run (history; reprocessing appends a new row). */
export const documentExtractions = pgTable(
  "document_extractions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    provider: text("provider").$type<OcrProviderName>().notNull(),
    extractionMethod: text("extraction_method").$type<ExtractionMethod>().notNull(),
    docType: text("doc_type").$type<DocType>().notNull(),
    extractedText: text("extracted_text"),
    extractedData: jsonb("extracted_data").$type<DocumentFields>().notNull().default({}),
    confidenceScore: real("confidence_score"),
    validationResult: jsonb("validation_result").$type<ValidationResult>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("extractions_document_idx").on(t.documentId, t.createdAt)],
);

/** Audit trail: status transitions and reviewer actions. */
export const documentEvents = pgTable(
  "document_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    fromStatus: text("from_status").$type<DocStatus>(),
    toStatus: text("to_status").$type<DocStatus>().notNull(),
    action: text("action").$type<ReviewAction | "system">().notNull().default("system"),
    actor: text("actor").notNull().default("system"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_document_idx").on(t.documentId, t.createdAt)],
);

export type DocumentRow = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type ExtractionRow = typeof documentExtractions.$inferSelect;
export type NewExtraction = typeof documentExtractions.$inferInsert;
export type EventRow = typeof documentEvents.$inferSelect;

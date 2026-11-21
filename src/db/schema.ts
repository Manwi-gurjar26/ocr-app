import { index, integer, jsonb, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { DocStatus, DocType, DocumentFields, ExtractionMethod } from "@/lib/types";

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size").notNull(),
    filePath: text("file_path").notNull(),
    docType: text("doc_type").$type<DocType>().notNull().default("unknown"),
    status: text("status").$type<DocStatus>().notNull().default("processing"),
    rawText: text("raw_text"),
    ocrConfidence: real("ocr_confidence"),
    extractionMethod: text("extraction_method").$type<ExtractionMethod>(),
    fields: jsonb("fields").$type<DocumentFields>().notNull().default({}),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("documents_type_idx").on(t.docType), index("documents_created_idx").on(t.createdAt)],
);

export type DocumentRow = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import type { DB } from "@/db";
import {
  documentEvents,
  documentExtractions,
  documents,
  type DocumentRow,
  type EventRow,
  type ExtractionRow,
  type NewDocument,
  type NewExtraction,
} from "@/db/schema";
import type { DocStatus, DocType, ReviewAction } from "./types";

export interface ListFilter {
  type?: DocType;
  status?: DocStatus;
  customerId?: string;
  q?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export function createDocumentsRepo(db: DB) {
  return {
    async create(input: NewDocument): Promise<DocumentRow> {
      const [row] = await db.insert(documents).values(input).returning();
      return row;
    },

    async get(id: string): Promise<DocumentRow | undefined> {
      const [row] = await db.select().from(documents).where(eq(documents.id, id));
      return row;
    },

    async update(id: string, patch: Partial<NewDocument>): Promise<DocumentRow | undefined> {
      const [row] = await db
        .update(documents)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(documents.id, id))
        .returning();
      return row;
    },

    /**
     * Move a document to a new status, applying `patch`, and record the transition in the audit log.
     * Returns undefined if the document doesn't exist.
     */
    async transition(
      id: string,
      to: DocStatus,
      patch: Partial<NewDocument> = {},
      event: { action?: ReviewAction | "system"; actor?: string; note?: string | null } = {},
    ): Promise<DocumentRow | undefined> {
      return db.transaction(async (tx) => {
        const [cur] = await tx.select({ status: documents.status }).from(documents).where(eq(documents.id, id)).for("update");
        if (!cur) return undefined;
        const [row] = await tx
          .update(documents)
          .set({ ...patch, status: to, updatedAt: new Date() })
          .where(eq(documents.id, id))
          .returning();
        await tx.insert(documentEvents).values({
          documentId: id,
          fromStatus: cur.status,
          toStatus: to,
          action: event.action ?? "system",
          actor: event.actor ?? "system",
          note: event.note ?? null,
        });
        return row;
      });
    },

    async addExtraction(input: NewExtraction): Promise<ExtractionRow> {
      const [row] = await db.insert(documentExtractions).values(input).returning();
      return row;
    },

    async updateExtraction(id: string, patch: Partial<NewExtraction>): Promise<void> {
      await db.update(documentExtractions).set(patch).where(eq(documentExtractions.id, id));
    },

    async extractions(documentId: string): Promise<ExtractionRow[]> {
      return db
        .select()
        .from(documentExtractions)
        .where(eq(documentExtractions.documentId, documentId))
        .orderBy(desc(documentExtractions.createdAt));
    },

    async events(documentId: string): Promise<EventRow[]> {
      return db
        .select()
        .from(documentEvents)
        .where(eq(documentEvents.documentId, documentId))
        .orderBy(desc(documentEvents.createdAt), desc(documentEvents.id));
    },

    async remove(id: string): Promise<DocumentRow | undefined> {
      const [row] = await db.delete(documents).where(eq(documents.id, id)).returning();
      return row;
    },

    async list(f: ListFilter = {}): Promise<{ items: DocumentRow[]; total: number }> {
      const conds: SQL[] = [];
      if (f.type) conds.push(eq(documents.docType, f.type));
      if (f.status) conds.push(eq(documents.status, f.status));
      if (f.customerId) conds.push(eq(documents.customerId, f.customerId));
      if (f.from) conds.push(gte(documents.createdAt, f.from));
      if (f.to) conds.push(lte(documents.createdAt, f.to));
      if (f.q) {
        const like = `%${f.q}%`;
        conds.push(or(ilike(documents.fileName, like), ilike(documents.rawText, like), sql`${documents.fields}::text ilike ${like}`)!);
      }
      const where = conds.length ? and(...conds) : undefined;
      const [items, [{ count }]] = await Promise.all([
        db
          .select()
          .from(documents)
          .where(where)
          .orderBy(desc(documents.createdAt))
          .limit(f.limit ?? 50)
          .offset(f.offset ?? 0),
        db.select({ count: sql<number>`count(*)::int` }).from(documents).where(where),
      ]);
      return { items, total: count };
    },

    async stats(): Promise<{ total: number; byType: Record<string, number>; byStatus: Record<string, number> }> {
      const rows = await db
        .select({ docType: documents.docType, status: documents.status, count: sql<number>`count(*)::int` })
        .from(documents)
        .groupBy(documents.docType, documents.status);
      const byType: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      let total = 0;
      for (const r of rows) {
        byType[r.docType] = (byType[r.docType] ?? 0) + r.count;
        byStatus[r.status] = (byStatus[r.status] ?? 0) + r.count;
        total += r.count;
      }
      return { total, byType, byStatus };
    },
  };
}

export type DocumentsRepo = ReturnType<typeof createDocumentsRepo>;

import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import type { DB } from "@/db";
import { documents, type DocumentRow, type NewDocument } from "@/db/schema";
import type { DocType } from "./types";

export interface ListFilter {
  type?: DocType;
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

    async remove(id: string): Promise<DocumentRow | undefined> {
      const [row] = await db.delete(documents).where(eq(documents.id, id)).returning();
      return row;
    },

    async list(f: ListFilter = {}): Promise<{ items: DocumentRow[]; total: number }> {
      const conds: SQL[] = [];
      if (f.type) conds.push(eq(documents.docType, f.type));
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

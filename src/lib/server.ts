import "server-only";
import { z } from "zod";
import { getDb } from "@/db";
import { createDocumentsRepo, type ListFilter } from "./documents-repo";
import { DOC_TYPES } from "./types";

export function repo() {
  return createDocumentsRepo(getDb());
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const ListQuery = z.object({
  type: z.enum(DOC_TYPES).optional(),
  q: z.string().trim().max(100).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/** Parse ?type&q&from&to&limit&offset into a repo filter. `to` is inclusive (end of day). */
export function parseListQuery(params: URLSearchParams): ListFilter {
  const raw = Object.fromEntries([...params].filter(([, v]) => v !== ""));
  const p = ListQuery.parse(raw);
  return {
    type: p.type,
    q: p.q || undefined,
    from: p.from ? new Date(`${p.from}T00:00:00`) : undefined,
    to: p.to ? new Date(`${p.to}T23:59:59.999`) : undefined,
    limit: p.limit,
    offset: p.offset,
  };
}

export const UuidParam = z.string().uuid();

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/** Convert thrown errors into JSON responses. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError(err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), 400);
    console.error(err);
    return jsonError("Internal server error", 500);
  }
}

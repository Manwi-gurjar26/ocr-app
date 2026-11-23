import { z } from "zod";
import { deleteUpload } from "@/lib/storage";
import { revalidate } from "@/lib/pipeline";
import { handle, jsonError, repo, UuidParam } from "@/lib/server";
import { isBusy } from "@/lib/types";
import { DOC_TYPES } from "@/lib/types";

const Patch = z.object({
  docType: z.enum(DOC_TYPES).optional(),
  fields: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(_req: Request, ctx: RouteContext<"/api/documents/[id]">) {
  return handle(async () => {
    const id = UuidParam.safeParse((await ctx.params).id);
    if (!id.success) return jsonError("Not found", 404);
    const doc = await repo().get(id.data);
    return doc ? Response.json(doc) : jsonError("Not found", 404);
  });
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/documents/[id]">) {
  return handle(async () => {
    const id = UuidParam.safeParse((await ctx.params).id);
    if (!id.success) return jsonError("Not found", 404);
    const body = Patch.parse(await req.json().catch(() => ({})));
    const r = repo();
    const cur = await r.get(id.data);
    if (!cur) return jsonError("Not found", 404);
    if (isBusy(cur.status)) return jsonError("Document is still processing", 409);
    await r.update(id.data, body);
    // Corrected values go back through the business rules (reviewer decisions are cleared).
    const doc = await revalidate({ repo: r }, id.data);
    return Response.json(doc);
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/documents/[id]">) {
  return handle(async () => {
    const id = UuidParam.safeParse((await ctx.params).id);
    if (!id.success) return jsonError("Not found", 404);
    const doc = await repo().remove(id.data);
    if (!doc) return jsonError("Not found", 404);
    await deleteUpload(doc.filePath);
    return new Response(null, { status: 204 });
  });
}

import { z } from "zod";
import { deleteUpload } from "@/lib/storage";
import { handle, jsonError, repo, UuidParam } from "@/lib/server";
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
    const doc = await repo().update(id.data, body);
    return doc ? Response.json(doc) : jsonError("Not found", 404);
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

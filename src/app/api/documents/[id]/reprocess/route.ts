import { after } from "next/server";
import { processDocument } from "@/lib/pipeline";
import { handle, jsonError, repo, UuidParam } from "@/lib/server";

export const maxDuration = 300;

export async function POST(_req: Request, ctx: RouteContext<"/api/documents/[id]/reprocess">) {
  return handle(async () => {
    const id = UuidParam.safeParse((await ctx.params).id);
    if (!id.success) return jsonError("Not found", 404);
    const r = repo();
    const doc = await r.update(id.data, { status: "processing", error: null });
    if (!doc) return jsonError("Not found", 404);
    after(() => processDocument({ repo: r }, doc.id));
    return Response.json(doc, { status: 202 });
  });
}

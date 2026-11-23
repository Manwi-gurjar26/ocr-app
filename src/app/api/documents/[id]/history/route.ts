import { handle, jsonError, repo, UuidParam } from "@/lib/server";

/** Extraction runs + audit trail for one document. */
export async function GET(_req: Request, ctx: RouteContext<"/api/documents/[id]/history">) {
  return handle(async () => {
    const id = UuidParam.safeParse((await ctx.params).id);
    if (!id.success) return jsonError("Not found", 404);
    const r = repo();
    if (!(await r.get(id.data))) return jsonError("Not found", 404);
    const [extractions, events] = await Promise.all([r.extractions(id.data), r.events(id.data)]);
    // Raw OCR text is large; the document row already carries the latest copy.
    return Response.json({ extractions: extractions.map((e) => ({ ...e, extractedText: undefined })), events });
  });
}

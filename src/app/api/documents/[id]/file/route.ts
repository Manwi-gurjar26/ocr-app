import { readUpload } from "@/lib/storage";
import { handle, jsonError, repo, UuidParam } from "@/lib/server";

/** Serves the original upload for previews. */
export async function GET(_req: Request, ctx: RouteContext<"/api/documents/[id]/file">) {
  return handle(async () => {
    const id = UuidParam.safeParse((await ctx.params).id);
    if (!id.success) return jsonError("Not found", 404);
    const doc = await repo().get(id.data);
    if (!doc) return jsonError("Not found", 404);
    const bytes = await readUpload(doc.filePath).catch(() => null);
    if (!bytes) return jsonError("File missing", 404);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.fileName)}"`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}

import { documentReport } from "@/lib/reports";
import { handle, jsonError, repo, UuidParam } from "@/lib/server";

export async function GET(req: Request, ctx: RouteContext<"/api/documents/[id]/report">) {
  return handle(async () => {
    const id = UuidParam.safeParse((await ctx.params).id);
    if (!id.success) return jsonError("Not found", 404);
    const doc = await repo().get(id.data);
    if (!doc) return jsonError("Not found", 404);
    const download = new URL(req.url).searchParams.get("download") === "1";
    const pdf = await documentReport(doc);
    const name = `${doc.fileName.replace(/\.[^.]+$/, "")}-report.pdf`;
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(name)}"`,
      },
    });
  });
}

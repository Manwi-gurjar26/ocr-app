import { z } from "zod";
import { reviewDocument, ReviewError } from "@/lib/pipeline";
import { actorOf, handle, jsonError, repo, UuidParam } from "@/lib/server";
import { REVIEW_ACTIONS } from "@/lib/types";

const Body = z.object({
  action: z.enum(REVIEW_ACTIONS),
  note: z.string().trim().max(1000).optional(),
});

/** Admin review: approve → verified, reject / request_reupload → failed (note required). Audited. */
export async function POST(req: Request, ctx: RouteContext<"/api/documents/[id]/review">) {
  return handle(async () => {
    const id = UuidParam.safeParse((await ctx.params).id);
    if (!id.success) return jsonError("Not found", 404);
    const body = Body.parse(await req.json().catch(() => ({})));
    try {
      const doc = await reviewDocument({ repo: repo() }, id.data, { ...body, reviewer: actorOf(req) });
      return doc ? Response.json(doc) : jsonError("Not found", 404);
    } catch (e) {
      if (e instanceof ReviewError) return jsonError(e.message, 409);
      throw e;
    }
  });
}

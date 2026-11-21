import { aiAvailable } from "@/lib/extract/ai";
import { handle, repo } from "@/lib/server";

export async function GET() {
  return handle(async () => Response.json({ ...(await repo().stats()), aiEnabled: aiAvailable() }));
}

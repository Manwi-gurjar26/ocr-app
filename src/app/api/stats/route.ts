import { aiAvailable } from "@/lib/extract/ai";
import { defaultRegistry } from "@/lib/providers";
import { handle, repo } from "@/lib/server";

export async function GET() {
  return handle(async () => Response.json({ ...(await repo().stats()), aiEnabled: aiAvailable(),
      providers: { textract: defaultRegistry.textract.available(), perfios: defaultRegistry.perfios.available() } }));
}

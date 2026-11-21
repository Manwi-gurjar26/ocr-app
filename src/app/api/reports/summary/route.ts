import { TYPE_LABEL } from "@/lib/format";
import { summaryReport } from "@/lib/reports";
import { handle, parseListQuery, repo } from "@/lib/server";

export async function GET(req: Request) {
  return handle(async () => {
    const params = new URL(req.url).searchParams;
    const filter = parseListQuery(params);
    const { items } = await repo().list({ ...filter, limit: 500, offset: 0 });

    const parts = [
      filter.type ? `${TYPE_LABEL[filter.type]}s` : "All documents",
      params.get("from") ? `from ${params.get("from")}` : "",
      params.get("to") ? `to ${params.get("to")}` : "",
      filter.q ? `matching "${filter.q}"` : "",
    ].filter(Boolean);

    const pdf = await summaryReport(items, { filterLabel: parts.join(" ") });
    const download = params.get("download") === "1";
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="documents-summary.pdf"`,
      },
    });
  });
}

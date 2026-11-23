import type { AnalyzeDocumentCommandOutput, Block } from "@aws-sdk/client-textract";
import type { DocumentChecker } from "./types";

/**
 * Amazon Textract adapter (blueprint: electricity bills + GST certificates).
 * Uses synchronous AnalyzeDocument with FORMS — supports images and single-page PDFs up to 10 MB.
 * Multi-page PDFs need the async StartDocumentAnalysis API reading from S3 (see docs/kilowattx).
 *
 * Enable with TEXTRACT_ENABLED=true and AWS_REGION; credentials come from the default AWS chain.
 */

type Send = (bytes: Uint8Array) => Promise<Pick<AnalyzeDocumentCommandOutput, "Blocks" | "DocumentMetadata">>;

async function defaultSend(bytes: Uint8Array) {
  const { TextractClient, AnalyzeDocumentCommand } = await import("@aws-sdk/client-textract");
  const client = new TextractClient({ region: process.env.AWS_REGION });
  return client.send(new AnalyzeDocumentCommand({ Document: { Bytes: bytes }, FeatureTypes: ["FORMS"] }));
}

function textOf(block: Block, byId: Map<string, Block>): string {
  const ids = block.Relationships?.filter((r) => r.Type === "CHILD").flatMap((r) => r.Ids ?? []) ?? [];
  return ids
    .map((id) => byId.get(id))
    .map((b) => (b?.BlockType === "WORD" ? b.Text : b?.BlockType === "SELECTION_ELEMENT" ? (b.SelectionStatus === "SELECTED" ? "[x]" : "") : ""))
    .filter(Boolean)
    .join(" ");
}

/** Turn Textract blocks into reading-order text plus "Key: Value" lines from detected form fields. */
export function blocksToText(blocks: Block[]): { text: string; confidence: number; keyValues: Record<string, string> } {
  const byId = new Map(blocks.filter((b) => b.Id).map((b) => [b.Id!, b]));
  const lines = blocks.filter((b) => b.BlockType === "LINE");
  const keyValues: Record<string, string> = {};
  for (const b of blocks) {
    if (b.BlockType !== "KEY_VALUE_SET" || !b.EntityTypes?.includes("KEY")) continue;
    const key = textOf(b, byId).replace(/[:\s]+$/, "");
    const valueIds = b.Relationships?.filter((r) => r.Type === "VALUE").flatMap((r) => r.Ids ?? []) ?? [];
    const value = valueIds.map((id) => byId.get(id)).map((v) => (v ? textOf(v, byId) : "")).join(" ").trim();
    if (key && value) keyValues[key] = value;
  }
  const confs = lines.map((l) => l.Confidence ?? 0);
  const confidence = confs.length ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : 0;
  const kvText = Object.entries(keyValues).map(([k, v]) => `${k}: ${v}`);
  const text = [...lines.map((l) => l.Text ?? ""), ...(kvText.length ? ["", ...kvText] : [])].join("\n").trim();
  return { text, confidence, keyValues };
}

export function createTextractChecker(send: Send = defaultSend): DocumentChecker {
  return {
    name: "textract",
    available: () => process.env.TEXTRACT_ENABLED === "true" && Boolean(process.env.AWS_REGION),
    async analyze({ bytes, mime }) {
      const res = await send(new Uint8Array(bytes));
      const { text, confidence } = blocksToText(res.Blocks ?? []);
      const images = mime.startsWith("image/") ? [bytes] : [];
      return { provider: "textract", text, confidence, pages: res.DocumentMetadata?.Pages ?? 1, images };
    },
  };
}

export const textractChecker = createTextractChecker();

import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { AI_MODEL, extractWithAi } from "@/lib/extract/ai";

function fakeClient(response: Record<string, unknown>) {
  const parse = vi.fn().mockResolvedValue(response);
  return { client: { messages: { parse } } as unknown as Pick<Anthropic, "messages">, parse };
}

const idCard = {
  idType: "pan", idNumber: "ABCDE1234F", fullName: "RAMESH KUMAR", dateOfBirth: "1988-11-05",
  gender: null, fatherName: "SURESH KUMAR", address: null, expiryDate: null,
};

describe("AI extraction", () => {
  it("sends image + OCR text and maps the matching object", async () => {
    const { client, parse } = fakeClient({
      stop_reason: "end_turn",
      parsed_output: { docType: "id_card", invoice: null, receipt: null, idCard },
    });
    const r = await extractWithAi([Buffer.from("png-bytes")], "INCOME TAX DEPARTMENT", client);
    expect(r).toEqual({ docType: "id_card", fields: idCard });

    const req = parse.mock.calls[0][0];
    expect(req.model).toBe(AI_MODEL);
    expect(req.output_config.effort).toBe("low");
    expect(req.messages[0].content[0]).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/png" } });
    expect(req.messages[0].content.at(-1).text).toContain("INCOME TAX DEPARTMENT");
  });

  it("throws on refusal or missing output so the pipeline can fall back", async () => {
    await expect(extractWithAi([], "x", fakeClient({ stop_reason: "refusal", parsed_output: null }).client)).rejects.toThrow(/declined/);
    await expect(extractWithAi([], "x", fakeClient({ stop_reason: "max_tokens", parsed_output: null }).client)).rejects.toThrow(/no structured/);
  });
});

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function root(): string {
  // Runtime-only path; tell Turbopack not to trace it into the build output.
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.UPLOAD_DIR ?? "uploads");
}

/** Resolve a stored relative path, refusing anything that escapes the upload root. */
function resolveSafe(rel: string): string {
  const full = path.resolve(/*turbopackIgnore: true*/ root(), rel);
  if (!full.startsWith(root() + path.sep)) throw new Error("Invalid file path");
  return full;
}

export async function saveUpload(bytes: Buffer, mime: string): Promise<string> {
  const ext = EXT[mime];
  if (!ext) throw new Error(`Unsupported file type: ${mime}`);
  await fs.mkdir(root(), { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(/*turbopackIgnore: true*/ root(), name), bytes);
  return name;
}

export function readUpload(rel: string): Promise<Buffer> {
  return fs.readFile(resolveSafe(rel));
}

export async function deleteUpload(rel: string): Promise<void> {
  await fs.rm(resolveSafe(rel), { force: true });
}

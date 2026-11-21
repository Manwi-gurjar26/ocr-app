import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from "pdf-lib";

export const A4: [number, number] = [595.28, 841.89];
const M = 48; // margin

export const C = {
  ink: rgb(0.11, 0.11, 0.13),
  muted: rgb(0.45, 0.47, 0.52),
  line: rgb(0.88, 0.89, 0.92),
  zebra: rgb(0.965, 0.97, 0.985),
  accent: rgb(0.0, 0.48, 1.0),
  accent2: rgb(0.36, 0.34, 0.96),
  white: rgb(1, 1, 1),
};

/** Standard PDF fonts only cover WinAnsi; map common symbols and drop the rest. */
export function safe(s: string): string {
  return s
    .replace(/₹/g, "Rs.")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[\t]/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "");
}

export class PdfWriter {
  doc!: PDFDocument;
  font!: PDFFont;
  bold!: PDFFont;
  page!: PDFPage;
  y = 0;
  readonly width = A4[0] - M * 2;
  private title = "";

  static async create(title: string): Promise<PdfWriter> {
    const w = new PdfWriter();
    w.doc = await PDFDocument.create();
    w.doc.setTitle(title);
    w.doc.setProducer("DocScan OCR");
    w.doc.setCreationDate(new Date());
    w.font = await w.doc.embedFont(StandardFonts.Helvetica);
    w.bold = await w.doc.embedFont(StandardFonts.HelveticaBold);
    w.title = title;
    w.newPage();
    return w;
  }

  newPage() {
    this.page = this.doc.addPage(A4);
    this.y = A4[1] - M;
  }

  ensure(h: number) {
    if (this.y - h < M + 20) {
      this.newPage();
      this.y -= 10;
    }
  }

  text(s: string, opts: { x?: number; size?: number; bold?: boolean; color?: RGB; maxWidth?: number } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.bold : this.font;
    for (const line of this.wrap(safe(s), font, size, opts.maxWidth ?? this.width)) {
      this.ensure(size * 1.45);
      this.page.drawText(line, { x: M + (opts.x ?? 0), y: this.y - size, size, font, color: opts.color ?? C.ink });
      this.y -= size * 1.45;
    }
  }

  gap(h = 10) {
    this.y -= h;
  }

  wrap(s: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const out: string[] = [];
    for (const para of s.split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) <= maxWidth) line = next;
        else {
          if (line) out.push(line);
          // hard-break very long words
          let w = word;
          while (font.widthOfTextAtSize(w, size) > maxWidth && w.length > 1) {
            let cut = w.length;
            while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > maxWidth) cut--;
            out.push(w.slice(0, cut));
            w = w.slice(cut);
          }
          line = w;
        }
      }
      out.push(line);
    }
    return out;
  }

  /** Gradient-ish header band with title and subtitle. */
  header(title: string, subtitle: string) {
    const h = 92;
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const color = rgb(
        C.accent.red + (C.accent2.red - C.accent.red) * t,
        C.accent.green + (C.accent2.green - C.accent.green) * t,
        C.accent.blue + (C.accent2.blue - C.accent.blue) * t,
      );
      this.page.drawRectangle({ x: (A4[0] / steps) * i, y: A4[1] - h, width: A4[0] / steps + 1, height: h, color });
    }
    this.page.drawText(safe(title), { x: M, y: A4[1] - 50, size: 22, font: this.bold, color: C.white });
    this.page.drawText(safe(subtitle), { x: M, y: A4[1] - 72, size: 10, font: this.font, color: C.white, opacity: 0.85 });
    this.y = A4[1] - h - 28;
  }

  sectionTitle(s: string) {
    this.ensure(40);
    this.gap(6);
    this.text(s.toUpperCase(), { size: 9, bold: true, color: C.accent });
    this.page.drawLine({ start: { x: M, y: this.y + 2 }, end: { x: M + this.width, y: this.y + 2 }, thickness: 0.6, color: C.line });
    this.gap(8);
  }

  /** Two-column label/value list. */
  keyValues(rows: { label: string; value: string }[]) {
    const labelW = 140;
    rows.forEach((r, i) => {
      const lines = this.wrap(safe(r.value), this.font, 10, this.width - labelW - 12);
      const h = lines.length * 14.5 + 8;
      this.ensure(h);
      if (i % 2 === 0) this.page.drawRectangle({ x: M, y: this.y - h + 4, width: this.width, height: h, color: C.zebra });
      this.page.drawText(safe(r.label), { x: M + 8, y: this.y - 12, size: 9, font: this.bold, color: C.muted });
      lines.forEach((l, j) => this.page.drawText(l, { x: M + labelW, y: this.y - 12 - j * 14.5, size: 10, font: this.font, color: C.ink }));
      this.y -= h;
    });
  }

  /** Simple table. `widths` are fractions of the content width; `align` per column. */
  table(headers: string[], rows: string[][], widths: number[], align: ("left" | "right")[] = []) {
    const colW = widths.map((w) => w * this.width);
    const drawRow = (cells: string[], bold: boolean, fill?: RGB) => {
      const font = bold ? this.bold : this.font;
      const size = bold ? 8.5 : 9;
      const wrapped = cells.map((c, i) => this.wrap(safe(c), font, size, colW[i] - 10));
      const h = Math.max(...wrapped.map((w) => w.length)) * 12.5 + 8;
      this.ensure(h);
      if (fill) this.page.drawRectangle({ x: M, y: this.y - h + 4, width: this.width, height: h, color: fill });
      let x = M;
      wrapped.forEach((lines, i) => {
        lines.forEach((l, j) => {
          const tw = font.widthOfTextAtSize(l, size);
          const tx = align[i] === "right" ? x + colW[i] - 5 - tw : x + 5;
          this.page.drawText(l, { x: tx, y: this.y - 11 - j * 12.5, size, font, color: bold ? C.muted : C.ink });
        });
        x += colW[i];
      });
      this.y -= h;
    };
    drawRow(headers.map((h) => h.toUpperCase()), true);
    this.page.drawLine({ start: { x: M, y: this.y + 3 }, end: { x: M + this.width, y: this.y + 3 }, thickness: 0.6, color: C.line });
    rows.forEach((r, i) => drawRow(r, false, i % 2 === 1 ? C.zebra : undefined));
  }

  /** Row of stat tiles. */
  stats(tiles: { label: string; value: string }[]) {
    const gap = 10;
    const w = (this.width - gap * (tiles.length - 1)) / tiles.length;
    const h = 58;
    this.ensure(h + 10);
    tiles.forEach((t, i) => {
      const x = M + i * (w + gap);
      this.page.drawRectangle({ x, y: this.y - h, width: w, height: h, color: C.zebra, borderColor: C.line, borderWidth: 0.6 });
      this.page.drawText(safe(t.label.toUpperCase()), { x: x + 10, y: this.y - 18, size: 7.5, font: this.bold, color: C.muted });
      let size = 16;
      const v = safe(t.value);
      while (this.bold.widthOfTextAtSize(v, size) > w - 20 && size > 8) size -= 1;
      this.page.drawText(v, { x: x + 10, y: this.y - 42, size, font: this.bold, color: C.ink });
    });
    this.y -= h + 14;
  }

  async finish(): Promise<Uint8Array> {
    const pages = this.doc.getPages();
    pages.forEach((p, i) => {
      const footer = safe(`${this.title}  ·  Page ${i + 1} of ${pages.length}`);
      p.drawText(footer, { x: M, y: 24, size: 8, font: this.font, color: C.muted });
    });
    return this.doc.save();
  }
}

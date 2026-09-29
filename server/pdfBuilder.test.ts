import { describe, expect, it } from "vitest";
import { buildPdfFromJpegs } from "../shared/pdfBuilder";

const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);

describe("scanner PDF builder", () => {
  it("builds a well-formed PDF with one page per scanned image", () => {
    const pdf = buildPdfFromJpegs([
      { jpeg: fakeJpeg, width: 1240, height: 1754 },
      { jpeg: fakeJpeg, width: 1754, height: 1240 },
    ], "Thesis (scan)");
    const text = new TextDecoder("latin1").decode(pdf);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Count 2");
    expect(text).toContain("/Filter /DCTDecode");
    expect(text).toContain("/Title (Thesis \\(scan\\))");
    // startxref must point at the cross-reference table
    const xrefAt = Number(/startxref\n(\d+)\n%%EOF/.exec(text)![1]);
    expect(text.slice(xrefAt, xrefAt + 4)).toBe("xref");
    // every object offset in the table must point at "N 0 obj"
    const entries = text.slice(xrefAt).split("\n").slice(3, 3 + 9);
    entries.forEach((line, i) => {
      const offset = Number(line.slice(0, 10));
      expect(text.slice(offset).startsWith(`${i + 1} 0 obj`)).toBe(true);
    });
  });

  it("refuses to build an empty PDF", () => {
    expect(() => buildPdfFromJpegs([])).toThrow(/at least one page/);
  });
});

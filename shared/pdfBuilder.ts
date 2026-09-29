/**
 * Minimal PDF writer: turns a list of JPEG images (scanned pages) into a PDF file.
 * No external libraries — each page is one JPEG embedded with the DCTDecode filter,
 * which every PDF reader supports. Used by the admin document scanner.
 */

export type PdfPageImage = {
  /** Raw JPEG file bytes. */
  jpeg: Uint8Array;
  /** Pixel size of the image. */
  width: number;
  height: number;
  /** Colour model the JPEG was encoded with. */
  colorSpace?: "DeviceRGB" | "DeviceGray";
};

/** A4 width in PDF points (1/72 inch). Pages keep the image's shape at this width. */
const PAGE_WIDTH = 595.28;

const encoder = new TextEncoder();

export function buildPdfFromJpegs(pages: PdfPageImage[], title = "Scanned document"): Uint8Array {
  if (pages.length === 0) throw new Error("Add at least one page before creating the PDF");

  const chunks: Uint8Array[] = [];
  const offsets: number[] = []; // byte offset of each object, index = object number
  let length = 0;

  const push = (data: Uint8Array | string) => {
    const bytes = typeof data === "string" ? encoder.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const startObject = (num: number) => {
    offsets[num] = length;
    push(`${num} 0 obj\n`);
  };

  // Object numbers: 1 catalog, 2 page tree, 3 info, then 3 objects per page (page, content, image).
  const pageObj = (i: number) => 4 + i * 3;
  const contentObj = (i: number) => 5 + i * 3;
  const imageObj = (i: number) => 6 + i * 3;
  const totalObjects = 3 + pages.length * 3;

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

  startObject(1);
  push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  startObject(2);
  const kids = pages.map((_, i) => `${pageObj(i)} 0 R`).join(" ");
  push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`);

  startObject(3);
  const safeTitle = title.replace(/[\\()]/g, m => `\\${m}`).replace(/[^\x20-\x7E]/g, "?");
  push(`<< /Title (${safeTitle}) /Producer (Capstone Archive Scanner) >>\nendobj\n`);

  pages.forEach((page, i) => {
    if (!page.width || !page.height) throw new Error(`Page ${i + 1} has no size`);
    const pageHeight = +(PAGE_WIDTH * (page.height / page.width)).toFixed(2);
    const w = PAGE_WIDTH.toFixed(2);
    const h = pageHeight.toFixed(2);

    startObject(pageObj(i));
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
      `/Resources << /XObject << /Im${i} ${imageObj(i)} 0 R >> >> /Contents ${contentObj(i)} 0 R >>\nendobj\n`
    );

    const content = `q\n${w} 0 0 ${h} 0 0 cm\n/Im${i} Do\nQ\n`;
    startObject(contentObj(i));
    push(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream\nendobj\n`);

    startObject(imageObj(i));
    push(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} ` +
      `/ColorSpace /${page.colorSpace ?? "DeviceRGB"} /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`
    );
    push(page.jpeg);
    push("\nendstream\nendobj\n");
  });

  const xrefOffset = length;
  let xref = `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= totalObjects; n++) {
    xref += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  }
  push(xref);
  push(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

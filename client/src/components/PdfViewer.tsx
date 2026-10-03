import { useEffect, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
// Vite's `?url` suffix gives us the built worker file's final URL so pdf.js
// can run parsing/rendering off the main thread, the same way it would in
// any other Vite app — no server involvement, nothing added to the backend.
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useAuth } from "@/_core/hooks/useAuth";
import { AlertCircle, Loader2 } from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// Served from client/public, so it's just a static file at this path — no
// bundler import needed, same as the login page's own "/logo.jpg".
const SCHOOL_LOGO_SRC = "/golden-west-logo.png";

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Builds a seamlessly-tiling background image out of the watermark text,
 * via an inline SVG data URI, rather than laying out a fixed grid of text
 * nodes ourselves. `background-repeat` then covers a page of ANY size with
 * no gaps and no per-page math — which is what guarantees the watermark
 * reaches every corner of every page, however tall or wide it renders.
 *
 * Kept deliberately light (≈13% opacity) and thin (normal weight, small
 * size) so the scanned/typed page content underneath stays fully legible —
 * this is a faint diagonal stamp, not a translucent panel over the page.
 * It's still dark enough, and repeats densely enough, that a screenshot or
 * photo of the screen keeps the student's name and ID readable even though
 * no single instance of the text is bold or prominent on its own.
 */
function watermarkTileDataUri(text: string): string {
  const tileW = 300;
  const tileH = 130;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tileW}" height="${tileH}">` +
    `<text x="50%" y="50%" fill="rgba(70,70,70,0.13)" font-size="11" font-weight="400" ` +
    `font-family="Arial, Helvetica, sans-serif" text-anchor="middle" dominant-baseline="middle" ` +
    `transform="rotate(-30 ${tileW / 2} ${tileH / 2})">${escapeXml(text)}</text></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

interface RenderedPage {
  /** Object URL for this page's rendered PNG — revoked on cleanup/unmount. */
  url: string;
  width: number;
  height: number;
}

interface PdfViewerProps {
  /** Base64-encoded PDF bytes, as returned by `trpc.projects.viewDocument`. */
  base64: string;
  fileName?: string;
}

/**
 * Renders every page of a PDF (via pdf.js) to its own image instead of
 * handing the browser a raw file URL to open in its native plugin/iframe.
 * That's what makes the watermark below possible at all: a native PDF
 * viewer is a black box we can't draw into or reason about the scroll
 * position of, so there'd be no way to keep a watermark aligned with every
 * page while scrolling, or to guarantee it's baked into the same pixels a
 * screenshot would capture. Rendering each page ourselves means the
 * watermark overlay just has to sit on top of that page's own wrapper — it
 * scrolls, resizes and renders exactly in lockstep with that page, with no
 * separate tracking logic needed.
 *
 * Each page is rendered to an *offscreen* canvas created on the fly, then
 * turned into an object URL and displayed as a plain <img>, rather than
 * rendering straight onto a <canvas> ref sitting in the page's own JSX. The
 * earlier canvas-ref approach set page sizes (to mount empty canvases),
 * waited a tick, and then imperatively grabbed those refs to draw into —
 * but in React 18 Strict Mode (dev) effects run twice, and that first
 * "wait a tick, then find and draw into whatever canvas is at this index"
 * step turned out to be racy enough that pages intermittently stayed blank
 * (correct content, invisible). Storing finished images in state instead
 * means every run of the effect produces output through the normal React
 * render path — nothing is lost if an earlier run's effect is cancelled
 * mid-flight, and a page simply reflects whichever render actually
 * finished.
 *
 * The watermark text is derived fresh from `useAuth()` on every render, not
 * passed in or cached: whoever is signed in right now is who it names. When
 * that person logs out, `useAuth()` immediately reflects it (see
 * `useAuth.ts`'s `logout`, which clears the query cache synchronously), so
 * there's no stale frame where a previous viewer's name could still be
 * showing before a next login replaces it.
 */
export default function PdfViewer({ base64, fileName }: PdfViewerProps) {
  const { user } = useAuth();
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The watermark (logo + "CONFIDENTIAL — name — ID" text) is a student-
  // facing protection against a student photographing or screenshotting a
  // document they only have view access to. It only applies when a student
  // is the one browsing: an admin/adviser previewing the same document
  // (e.g. to review it before approval) sees the page clean, since the
  // whole point of a traceable watermark is to name the viewer, and most
  // admin/adviser previews aren't the leak risk this exists for.
  const showWatermark = user?.role === "student";

  const watermarkText = user
    ? `CONFIDENTIAL — ${user.name?.trim() || "Unknown User"}${user.schoolId ? `  •  ID: ${user.schoolId}` : ""}`
    : "CONFIDENTIAL";
  const watermarkBg = watermarkTileDataUri(watermarkText);

  useEffect(() => {
    let cancelled = false;
    // Object URLs created by *this* run of the effect, so cleanup only ever
    // revokes URLs this run actually made — never ones a still-rendering
    // later run is about to hand to <img> tags.
    const urlsCreatedThisRun: string[] = [];
    setLoading(true);
    setError(null);
    setPages([]);

    (async () => {
      try {
        const bytes = base64ToBytes(base64);
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        if (cancelled) return;

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });

          // Render into a brand-new, never-mounted canvas. It isn't
          // reused or looked up by ref, so there's no window where some
          // other render pass could clear or repurpose it before we're
          // done reading its pixels back out.
          const offscreen = document.createElement("canvas");
          offscreen.width = viewport.width;
          offscreen.height = viewport.height;
          const ctx = offscreen.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (cancelled) return;

          const blob: Blob | null = await new Promise(resolve => offscreen.toBlob(resolve, "image/png"));
          if (cancelled) return;
          if (!blob) continue;

          const url = URL.createObjectURL(blob);
          urlsCreatedThisRun.push(url);
          setPages(prev => [...prev, { url, width: viewport.width, height: viewport.height }]);
        }
      } catch (err) {
        console.error("[PdfViewer] Failed to render document:", err);
        if (!cancelled) setError("This document couldn't be displayed here. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      for (const url of urlsCreatedThisRun) URL.revokeObjectURL(url);
    };
  }, [base64]);

  return (
    <div
      className="rounded-lg border bg-muted/30 p-4 select-none"
      onContextMenu={e => e.preventDefault()}
      style={{ userSelect: "none" }}
      aria-label={fileName ? `Protected preview of ${fileName}` : "Protected document preview"}
    >
      {loading && pages.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading document…</span>
        </div>
      )}

      {error && !loading && (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {pages.map((page, i) => (
          <div
            key={i}
            className="relative mx-auto bg-white shadow-md"
            style={{ width: page.width, height: page.height, maxWidth: "100%" }}
          >
            <img
              src={page.url}
              alt={fileName ? `Page ${i + 1} of ${fileName}` : `Page ${i + 1}`}
              draggable={false}
              className="block w-full h-full"
            />
            {/* Watermark layers — student view only (see `showWatermark`
                above). Both pointer-events-none, and no UI control ever
                targets either, so there is nothing in this page for a
                student to click, drag or toggle to hide them.

                1) The school logo — large, centered, faded. `mixBlendMode:
                   "multiply"` is what lets this sit "behind" the readable
                   page rather than as a washed-out white square on top of
                   it: the logo PNG's own background is solid white, and
                   multiply blending treats white as a no-op (it darkens the
                   page only where the logo's ink actually is), instead of
                   `opacity` alone which would tint the whole square box.
                2) The existing tiled "CONFIDENTIAL — name — ID" text, kept
                   exactly as before — this is the actual identity/security
                   feature (a large centered logo alone can't be traced back
                   to one student), so it stays on top, equally faint. */}
            {showWatermark && (
              <>
                <img
                  src={SCHOOL_LOGO_SRC}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="pointer-events-none absolute select-none"
                  style={{
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "60%",
                    height: "auto",
                    opacity: 0.16,
                    mixBlendMode: "multiply",
                    zIndex: 9,
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-0 z-10"
                  aria-hidden="true"
                  style={{
                    backgroundImage: watermarkBg,
                    backgroundRepeat: "repeat",
                    userSelect: "none",
                  }}
                />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

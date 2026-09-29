import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck, AlertCircle, RotateCw } from "lucide-react";
import { Button } from "./ui/button";
import Watermark from "./Watermark";
import ContentProtection from "./ContentProtection";
// pdf.js is bundled with the app (via npm, see package.json) instead of being
// fetched from a CDN at runtime. Loading it from a CDN used to fail with
// "Could not load the document viewer library" whenever that CDN host was
// unreachable — blocked network, ad blocker, offline/localhost dev, a
// regional block, the host being down — none of which have anything to do
// with whether the *document* is viewable. Bundling it removes that failure
// mode entirely: it ships in the same JS bundle as the rest of the app, so
// it works exactly as reliably as the app itself, including fully offline.
import * as pdfjsLib from "pdfjs-dist";
// Vite's `?url` suffix gives us the built worker file's final URL so it's
// served from our own app, not a third party.
// eslint-disable-next-line import/no-unresolved
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

/**
 * Renders a PDF page-by-page onto <canvas> elements — never the browser's
 * native PDF plugin, so there is no built-in download/print/save toolbar,
 * no selectable text layer, and nothing to "Save link as" (the file's bytes
 * only ever reach this component as base64 inside an authenticated API
 * response, never a fetchable URL). Combined with ContentProtection (blocks
 * right-click, copy, print, common save/dev-tools shortcuts, and blurs on
 * tab-switch/window-blur) and the Watermark overlay, this is the strongest
 * practical protection a browser can offer — screenshots and photos of the
 * screen can never be fully prevented by any web app, browser extension, or
 * native app, only deterred (the watermark identifies who viewed it).
 */
export default function DocumentViewer({ base64, fileName }: { base64: string; fileName?: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        if (cancelled) return;
        setPageCount(pdf.numPages);

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.4 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "w-full h-auto rounded-lg border border-border shadow-sm mb-4 select-none";
          canvas.setAttribute("aria-label", `Page ${pageNum} of ${pdf.numPages}`);
          const ctx2d = canvas.getContext("2d");
          if (!ctx2d) continue;
          await page.render({ canvasContext: ctx2d, viewport }).promise;
          if (cancelled) return;
          container.appendChild(canvas);
        }

        if (!cancelled) setStatus("ready");
      } catch (err: any) {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(err?.message || "Could not display this document.");
        }
      }
    }

    setStatus("loading");
    setErrorMessage(null);
    render();
    return () => {
      cancelled = true;
    };
  }, [base64, retryToken]);

  return (
    <ContentProtection enabled>
      <Watermark>
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              View-only — {fileName || "Document"}{pageCount ? ` · ${pageCount} page${pageCount === 1 ? "" : "s"}` : ""}
            </span>
          </div>

          {status === "loading" && (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading document…
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground max-w-sm">{errorMessage}</p>
              <Button variant="outline" size="sm" onClick={() => setRetryToken((n) => n + 1)}>
                <RotateCw className="h-3.5 w-3.5 mr-1.5" /> Try again
              </Button>
            </div>
          )}

          <div ref={containerRef} className={status === "ready" ? "" : "hidden"} />
        </div>
      </Watermark>
    </ContentProtection>
  );
}

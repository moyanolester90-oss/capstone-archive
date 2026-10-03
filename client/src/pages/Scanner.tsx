import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import {
  ArrowDown, ArrowUp, Camera, CameraOff, CheckCircle2, FileDown, FilePlus2, ImagePlus, Loader2,
  Paperclip, RotateCcw, RotateCw, ScanLine, Trash2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProjectForm from "@/components/ProjectForm";
import { buildPdfFromJpegs } from "@shared/pdfBuilder";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@shared/validation";
import { formatFileSize, readFileForUpload } from "@/lib/fileUpload";

type Mode = "document" | "grayscale" | "color";
type ScanPage = { id: string; image: HTMLImageElement; rotation: number; thumb: string };

/** Longest side of a page in the PDF, in pixels (≈ 200 dpi for A4: sharp, but small files). */
const MAX_SIDE = 2000;
const JPEG_QUALITY = 0.82;

const MODE_LABELS: Record<Mode, string> = {
  document: "Document (clean black & white)",
  grayscale: "Grayscale",
  color: "Color",
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image"));
    img.src = src;
  });
}

/** Draws a page with its rotation and enhancement applied, scaled to at most `maxSide` pixels. */
function renderPage(page: ScanPage, mode: Mode, maxSide = MAX_SIDE): HTMLCanvasElement {
  const { image, rotation } = page;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const w = Math.round(image.naturalWidth * scale);
  const h = Math.round(image.naturalHeight * scale);
  const turned = rotation % 180 !== 0;
  const canvas = document.createElement("canvas");
  canvas.width = turned ? h : w;
  canvas.height = turned ? w : h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(image, -w / 2, -h / 2, w, h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const W = canvas.width;
  const H = canvas.height;
  const data = ctx.getImageData(0, 0, W, H);
  const px = data.data;
  const lumAt = (i: number) => (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;

  // 1. Estimate how bright the bare paper is at every point (shadows and uneven light
  //    make it darker in places): take the brightest value in each block, smooth the
  //    grid, and stretch it back to full size.
  const B = Math.max(16, Math.round(Math.max(W, H) / 60));
  const gw = Math.ceil(W / B);
  const gh = Math.ceil(H / B);
  const grid = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let max = 0;
      for (let y = gy * B; y < Math.min(H, (gy + 1) * B); y += 2) {
        for (let x = gx * B; x < Math.min(W, (gx + 1) * B); x += 2) {
          const l = lumAt((y * W + x) * 4);
          if (l > max) max = l;
        }
      }
      grid[gy * gw + gx] = max;
    }
  }
  const small = document.createElement("canvas");
  small.width = gw;
  small.height = gh;
  const sctx = small.getContext("2d")!;
  const sdata = sctx.createImageData(gw, gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      // 3x3 average so a dark block (a picture, a big heading) doesn't leave a hole.
      let sum = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = gx + dx, y = gy + dy;
        if (x >= 0 && y >= 0 && x < gw && y < gh) { sum += grid[y * gw + x]; n++; }
      }
      const v = sum / n;
      const o = (gy * gw + gx) * 4;
      sdata.data[o] = sdata.data[o + 1] = sdata.data[o + 2] = v;
      sdata.data[o + 3] = 255;
    }
  }
  sctx.putImageData(sdata, 0, 0);
  const bgCanvas = document.createElement("canvas");
  bgCanvas.width = W;
  bgCanvas.height = H;
  const bctx = bgCanvas.getContext("2d", { willReadFrequently: true })!;
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = "high";
  bctx.drawImage(small, 0, 0, W, H);
  const bg = bctx.getImageData(0, 0, W, H).data;

  // 2. Divide by the paper brightness so the paper becomes evenly white everywhere,
  //    then apply the chosen look.
  for (let i = 0; i < px.length; i += 4) {
    const paper = Math.max(bg[i], 40);
    if (mode === "color") {
      for (let c = 0; c < 3; c++) px[i + c] = Math.min(255, (px[i + c] * 255) / paper);
      continue;
    }
    let v = Math.min(255, (lumAt(i) * 255) / paper);
    if (mode === "document") {
      // Crisp black text on white paper.
      v = v >= 200 ? 255 : Math.pow(v / 200, 2.2) * 255;
    }
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async blob => {
      if (!blob) return reject(new Error("Could not encode the page"));
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, "image/jpeg", JPEG_QUALITY);
  });
}

/**
 * Document Converter (librarian/admin only): capture hard-copy pages with a webcam or
 * phone camera (or import photos/scanner images), clean them up, and turn them into
 * one PDF that can be attached to a new or existing capstone.
 */
export default function Scanner() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState<string>("");
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [mode, setMode] = useState<Mode>("document");
  const [title, setTitle] = useState("");
  const [building, setBuilding] = useState(false);
  const [pdf, setPdf] = useState<{ file: File; url: string } | null>(null);
  const [target, setTarget] = useState<"new" | "existing" | null>(null);
  const [existingId, setExistingId] = useState<string>("");

  const { data: allProjects } = trpc.projects.all.useQuery(undefined, { enabled: isAdmin });
  const createProject = trpc.projects.create.useMutation();
  const replaceFile = trpc.projects.replaceFile.useMutation();

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);
  // Any change to the pages makes an already-built PDF out of date.
  useEffect(() => {
    setPdf(prev => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setTarget(null);
  }, [pages, mode]);

  const startCamera = async (deviceId?: string) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("This browser can't open the camera here. Use \"Add photos\" instead (on a phone it opens the camera).");
      return;
    }
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraOn(true);
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput");
      setCameras(devices);
      setCameraId(stream.getVideoTracks()[0]?.getSettings().deviceId || deviceId || "");
    } catch (err: any) {
      toast.error(err?.name === "NotAllowedError"
        ? "Camera permission was denied. Allow the camera in the browser, or use \"Add photos\"."
        : "No camera found. Connect a webcam, or use \"Add photos\" to import scans or phone pictures.");
    }
  };

  const addPage = async (src: string) => {
    const image = await loadImage(src);
    const page: ScanPage = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, image, rotation: 0, thumb: "" };
    page.thumb = renderPage(page, mode, 360).toDataURL("image/jpeg", 0.7);
    setPages(prev => [...prev, page]);
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    await addPage(canvas.toDataURL("image/jpeg", 0.95));
    toast.success(`Page ${pages.length + 1} captured`);
  };

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const images = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (images.length !== files.length) toast.error("Only image files (JPG, PNG) can be added as pages");
    for (const f of images) {
      const url = URL.createObjectURL(f);
      try {
        await addPage(url);
      } catch {
        toast.error(`Could not read ${f.name}`);
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updatePage = (id: string, change: (p: ScanPage) => ScanPage) =>
    setPages(prev => prev.map(p => {
      if (p.id !== id) return p;
      const next = change(p);
      next.thumb = renderPage(next, mode, 360).toDataURL("image/jpeg", 0.7);
      return next;
    }));

  const move = (index: number, delta: number) =>
    setPages(prev => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });

  // Re-draw thumbnails when the enhancement mode changes.
  useEffect(() => {
    setPages(prev => prev.map(p => ({ ...p, thumb: renderPage(p, mode, 360).toDataURL("image/jpeg", 0.7) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const buildPdf = async () => {
    setBuilding(true);
    try {
      const pdfPages = [];
      for (const page of pages) {
        const canvas = renderPage(page, mode);
        pdfPages.push({ jpeg: await canvasToJpeg(canvas), width: canvas.width, height: canvas.height });
      }
      const name = (title.trim() || "scanned-document").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "scanned-document";
      const bytes = buildPdfFromJpegs(pdfPages, title.trim() || "Scanned document");
      const file = new File([bytes.buffer as ArrayBuffer], `${name}.pdf`, { type: "application/pdf" });
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(`The PDF is ${formatFileSize(file.size)}, over the ${MAX_UPLOAD_MB} MB limit. Split it into parts or use fewer pages.`);
      }
      setPdf({ file, url: URL.createObjectURL(file) });
      toast.success(`PDF created: ${pages.length} page${pages.length === 1 ? "" : "s"}, ${formatFileSize(file.size)}`);
    } catch (err: any) {
      toast.error(err?.message || "Could not create the PDF");
    } finally {
      setBuilding(false);
    }
  };

  const attachToExisting = async () => {
    if (!pdf || !existingId) return;
    try {
      const fileData = await readFileForUpload(pdf.file);
      await replaceFile.mutateAsync({ id: Number(existingId), fileData, source: "scanner" });
      await utils.projects.invalidate();
      toast.success("Scanned PDF attached to the capstone");
      navigate(`/projects/${existingId}`);
    } catch (err: any) {
      toast.error(err?.message || "Could not attach the PDF");
    }
  };

  const sortedProjects = useMemo(
    () => [...(allProjects ?? [])].sort((a, b) => a.title.localeCompare(b.title)),
    [allProjects]
  );

  if (loading) {
    return <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Librarian Only</CardTitle>
            <CardDescription>The Document Converter is only available to the librarian/admin.</CardDescription>
          </CardHeader>
          <CardContent><Link href="/"><Button>Go Home</Button></Link></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] py-8">
      <div className="container max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><ScanLine className="h-8 w-8 text-primary" /> Document Converter</h1>
          <p className="text-muted-foreground">
            Turn a printed (hard copy) capstone into a PDF: capture each page with a webcam or phone camera, or import images from a scanner, then attach the PDF to a capstone.
          </p>
        </div>

        {/* Step 1: capture */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">1. Capture pages</CardTitle>
            <CardDescription>Place each page flat in good light, fill the frame, and press Capture. Pages are added in order.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {!cameraOn ? (
                <Button onClick={() => startCamera()} className="gap-2"><Camera className="h-4 w-4" /> Start Camera</Button>
              ) : (
                <Button variant="outline" onClick={stopCamera} className="gap-2"><CameraOff className="h-4 w-4" /> Stop Camera</Button>
              )}
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
                <ImagePlus className="h-4 w-4" /> Add Photos / Scanned Images
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                data-testid="scanner-file-input"
                onChange={e => addFiles(e.target.files)}
              />
              {cameraOn && cameras.length > 1 && (
                <Select value={cameraId} onValueChange={id => { setCameraId(id); startCamera(id); }}>
                  <SelectTrigger className="w-[220px]" aria-label="Camera"><SelectValue placeholder="Choose camera" /></SelectTrigger>
                  <SelectContent>
                    {cameras.map((c, i) => <SelectItem key={c.deviceId} value={c.deviceId}>{c.label || `Camera ${i + 1}`}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className={cameraOn ? "space-y-3" : "hidden"}>
              <div className="relative rounded-lg overflow-hidden bg-black max-h-[60vh] flex justify-center">
                <video ref={videoRef} playsInline muted className="max-h-[60vh] w-auto" />
                <div className="pointer-events-none absolute inset-6 border-2 border-dashed border-white/60 rounded" />
              </div>
              <Button size="lg" onClick={capture} className="w-full gap-2"><ScanLine className="h-5 w-5" /> Capture Page {pages.length + 1}</Button>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: review */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">2. Review pages ({pages.length})</CardTitle>
            <CardDescription>Rotate, reorder or remove pages. "Document" mode whitens the paper and sharpens the text.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Enhancement</Label>
                <Select value={mode} onValueChange={v => setMode(v as Mode)}>
                  <SelectTrigger aria-label="Enhancement"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(MODE_LABELS) as Mode[]).map(m => <SelectItem key={m} value={m}>{MODE_LABELS[m]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="scan-title">Document name</Label>
                <Input id="scan-title" placeholder="e.g. Toddlers Learning Game - Full Paper" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
            </div>

            {pages.length === 0 ? (
              <p className="text-center text-muted-foreground py-10 border-2 border-dashed rounded-lg">No pages yet. Capture or add pages above.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {pages.map((p, i) => (
                  <div key={p.id} className="border rounded-lg p-2 space-y-2 bg-card" data-testid="scan-page">
                    <div className="aspect-[3/4] bg-muted rounded flex items-center justify-center overflow-hidden">
                      <img src={p.thumb} alt={`Page ${i + 1}`} className="max-h-full max-w-full object-contain" />
                    </div>
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span>Page {i + 1}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-center">
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Rotate left" onClick={() => updatePage(p.id, x => ({ ...x, rotation: (x.rotation + 270) % 360 }))}><RotateCcw className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Rotate right" onClick={() => updatePage(p.id, x => ({ ...x, rotation: (x.rotation + 90) % 360 }))}><RotateCw className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Move earlier" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Move later" disabled={i === pages.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" title="Remove page" onClick={() => setPages(prev => prev.filter(x => x.id !== p.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button size="lg" className="w-full gap-2" disabled={pages.length === 0 || building} onClick={buildPdf}>
              {building ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileDown className="h-5 w-5" />}
              {building ? "Creating PDF..." : `Create PDF (${pages.length} page${pages.length === 1 ? "" : "s"})`}
            </Button>
          </CardContent>
        </Card>

        {/* Step 3: save */}
        {pdf && (
          <Card className="border-primary/40">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" /> 3. Save the PDF</CardTitle>
              <CardDescription>{pdf.file.name} · {pages.length} page{pages.length === 1 ? "" : "s"} · {formatFileSize(pdf.file.size)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <a href={pdf.url} target="_blank" rel="noreferrer" className="no-underline"><Button variant="outline" className="gap-2"><FileDown className="h-4 w-4" /> Preview PDF</Button></a>
                <a href={pdf.url} download={pdf.file.name} className="no-underline"><Button variant="outline" className="gap-2"><FileDown className="h-4 w-4" /> Download PDF</Button></a>
                <Button variant={target === "new" ? "default" : "secondary"} className="gap-2" onClick={() => setTarget("new")}><FilePlus2 className="h-4 w-4" /> New Capstone with this PDF</Button>
                <Button variant={target === "existing" ? "default" : "secondary"} className="gap-2" onClick={() => setTarget("existing")}><Paperclip className="h-4 w-4" /> Attach to Existing Capstone</Button>
              </div>

              {target === "existing" && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={existingId} onValueChange={setExistingId}>
                    <SelectTrigger className="sm:w-[420px]" aria-label="Capstone"><SelectValue placeholder="Choose a capstone" /></SelectTrigger>
                    <SelectContent>
                      {sortedProjects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.title} ({p.schoolYear})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button disabled={!existingId || replaceFile.isPending} onClick={attachToExisting} className="gap-2">
                    {replaceFile.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Attach PDF
                  </Button>
                </div>
              )}
              {target === "existing" && existingId && sortedProjects.find(p => String(p.id) === existingId)?.fileName && (
                <p className="text-xs text-amber-700">This replaces the capstone's current file ({sortedProjects.find(p => String(p.id) === existingId)?.fileName}).</p>
              )}

              {target === "new" && (
                <div className="border-t pt-4">
                  <ProjectForm
                    key={pdf.url}
                    initialFile={pdf.file}
                    initial={{ title: title.trim() }}
                    submitLabel="Publish Capstone"
                    onSubmit={async (values, fileData) => {
                      const res = await createProject.mutateAsync({ ...values, fileData });
                      await utils.projects.invalidate();
                      toast.success("Capstone published with the scanned PDF");
                      navigate(`/projects/${res.projectId}`);
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

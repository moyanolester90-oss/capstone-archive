import React, { useLayoutEffect, useState, useCallback, useRef } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

interface ContentProtectionProps {
  children: React.ReactNode;
  projectId?: number;
  enabled?: boolean;
}

// A blur→refocus cycle shorter than this is treated as a probable screenshot
// tool (Snipping Tool, Snip & Sketch launched via Win+Shift+S, Xbox Game Bar's
// Win+Alt+PrintScreen clip, etc). Those all steal window focus for their
// capture overlay and hand it back moments later — a pattern ordinary
// alt-tabbing to a genuinely different task doesn't produce.
const SUSPICIOUS_REFOCUS_MS = 4000;

// Applied directly to the DOM node (see `protectedRef` below) the instant a
// threat is detected, so the visual protection lands in the very same tick
// as the event — not on React's next render/paint, and with no CSS
// transition to ramp through. React state (`isBlurred`) is still set right
// after for the banner/modal and to keep the blur applied across re-renders,
// but the pixels themselves are never unprotected while we wait for that.
const INSTANT_BLUR_STYLE = "blur(24px)";

export default function ContentProtection({ children, projectId, enabled = true }: ContentProtectionProps) {
  const [isBlurred, setIsBlurred] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [warningReason, setWarningReason] = useState("");
  const blurredAtRef = useRef<number | null>(null);
  const protectedRef = useRef<HTMLDivElement>(null);

  const logActivity = trpc.protection.logSuspiciousActivity.useMutation();

  // Mutates the DOM synchronously, before React even schedules a re-render.
  // This is what actually closes the timing gap: a keydown/blur handler
  // that only called setState would still leave the unprotected frame on
  // screen until React commits and the browser paints, which is exactly
  // the window a screenshot shortcut fires inside.
  const engageBlurNow = useCallback(() => {
    const el = protectedRef.current;
    if (!el) return;
    el.style.filter = INSTANT_BLUR_STYLE;
    (el.style as any).webkitFilter = INSTANT_BLUR_STYLE;
    el.style.pointerEvents = "none";
    (el.style as any).userSelect = "none";
  }, []);

  const releaseBlurNow = useCallback(() => {
    const el = protectedRef.current;
    if (!el) return;
    el.style.filter = "";
    (el.style as any).webkitFilter = "";
    el.style.pointerEvents = "";
    (el.style as any).userSelect = "";
  }, []);

  const handleSuspiciousActivity = useCallback((reason: string) => {
    if (!enabled) return;
    engageBlurNow();
    setWarningReason(reason);
    setShowWarning(true);
    setIsBlurred(true);

    // Log to server
    logActivity.mutate({ projectId, reason });
    console.warn(`[Content Protection] ${reason}`);
  }, [enabled, projectId, logActivity, engageBlurNow]);

  // useLayoutEffect (not useEffect) so every listener and the protective
  // <style> block are attached synchronously before the browser paints —
  // there is no frame where the document is on screen and unprotected
  // while React is still getting around to wiring up the defenses.
  useLayoutEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    // Best-effort clipboard wipe: run whenever we suspect a capture just
    // happened, so a screenshot that did land on the clipboard can't be
    // pasted anywhere afterward. Clipboard access can throw (permissions,
    // insecure context, unsupported browser) — always swallow that quietly,
    // it's a bonus deterrent, not something the UI depends on.
    const wipeClipboard = () => {
      navigator.clipboard?.writeText("").catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Blur the instant the page is hidden, not on React's next tick —
        // this is the same-frame reaction that closes the "briefly visible
        // unprotected" gap.
        engageBlurNow();
        blurredAtRef.current = Date.now();
        setIsBlurred(true);
      } else {
        const blurredAt = blurredAtRef.current;
        blurredAtRef.current = null;
        if (blurredAt && Date.now() - blurredAt < SUSPICIOUS_REFOCUS_MS) {
          wipeClipboard();
          handleSuspiciousActivity("Suspicious activity detected: the window was hidden briefly, consistent with a screenshot or screen-recording tool.");
        } else if (!showWarning) {
          releaseBlurNow();
          setIsBlurred(false);
        }
      }
    };

    const handleBlur = () => {
      engageBlurNow();
      blurredAtRef.current = Date.now();
      setIsBlurred(true);
    };

    const handleFocus = () => {
      const blurredAt = blurredAtRef.current;
      blurredAtRef.current = null;
      if (blurredAt && Date.now() - blurredAt < SUSPICIOUS_REFOCUS_MS) {
        // The window lost and regained focus in one quick burst — the exact
        // fingerprint of Win+Shift+S / Snip & Sketch / Game Bar opening their
        // capture overlay on top of this window and then closing it.
        wipeClipboard();
        handleSuspiciousActivity("Suspicious activity detected: a screen-capture tool may have just been used.");
      } else if (!showWarning) {
        releaseBlurNow();
        setIsBlurred(false);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      handleSuspiciousActivity("Right-click is disabled on protected content.");
    };

    const handlePrintScreen = (e: KeyboardEvent) => {
      // Windows only reports the Print Screen key when it is released, so check both.
      if (e.key === "PrintScreen") {
        wipeClipboard();
        handleSuspiciousActivity("Screen capture is prohibited.");
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      handlePrintScreen(e);

      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const isWin = e.metaKey; // Windows/Cmd key
      const key = e.key.toLowerCase();

      // Windows Snipping Tool / Snip & Sketch (Win+Shift+S) and Xbox Game
      // Bar's clip/screenshot shortcuts (Win+Alt+PrintScreen, Win+G). These
      // are OS-level global hotkeys that the browser usually never sees —
      // Windows intercepts them before the page gets a keydown event — so
      // this only catches the rare case the event does surface (e.g. some
      // browser/OS combinations, or the key sequence being simulated). It's
      // a bonus layer on top of the blur/refocus detection above, which is
      // what reliably catches the real-world case.
      if (isWin && isShift && key === "s") {
        e.preventDefault();
        wipeClipboard();
        handleSuspiciousActivity("Screen capture is prohibited.");
      }
      // Win+Ctrl+S is not a standard Windows capture shortcut, but some
      // third-party snipping/screen-recording utilities let users rebind
      // their capture hotkey to combinations like this, so it's covered
      // alongside the built-in ones.
      if (isWin && e.ctrlKey && key === "s") {
        e.preventDefault();
        wipeClipboard();
        handleSuspiciousActivity("Screen capture is prohibited.");
      }
      if (isWin && (key === "g" || (e.altKey && e.key === "PrintScreen"))) {
        e.preventDefault();
        wipeClipboard();
        handleSuspiciousActivity("Screen capture is prohibited.");
      }

      // Detect Ctrl+C, Ctrl+U, Ctrl+S, Ctrl+P, F12, Ctrl+Shift+I/J/C
      if (isCtrl && (key === 'c' || key === 'u' || key === 's' || key === 'p')) {
        e.preventDefault();
        handleSuspiciousActivity(`Shortcut ${e.ctrlKey ? 'Ctrl' : 'Cmd'}+${key.toUpperCase()} is disabled.`);
      }

      if (e.key === 'F12' || (isCtrl && isShift && (key === 'i' || key === 'j' || key === 'c'))) {
        e.preventDefault();
        handleSuspiciousActivity("Developer tools are disabled.");
      }
    };

    // Printing from the browser menu (not just Ctrl+P) is also blocked and logged.
    const handleBeforePrint = () => {
      handleSuspiciousActivity("Printing protected content is prohibited.");
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      handleSuspiciousActivity("Copying content is prohibited.");
    };

    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
    };

    // keydown/keyup are registered with `capture: true` so they run in the
    // capturing phase — the earliest point the browser dispatches the event
    // to window — rather than waiting for it to bubble back up through the
    // whole page first.
    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("keyup", handlePrintScreen, { capture: true });
    window.addEventListener("beforeprint", handleBeforePrint);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("dragstart", handleDragStart);

    // Block printing, text selection, and the mobile "long-press to save
    // image/screenshot hint" callout menu.
    const style = document.createElement('style');
    style.innerHTML = `@media print { body { display: none !important; } } body { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-user-drag: none; } input, textarea { -webkit-user-select: text; user-select: text; }`;
    document.head.appendChild(style);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("keyup", handlePrintScreen, { capture: true });
      window.removeEventListener("beforeprint", handleBeforePrint);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("dragstart", handleDragStart);
      document.head.removeChild(style);
    };
  }, [enabled, showWarning, handleSuspiciousActivity]);

  const resume = () => {
    releaseBlurNow();
    setShowWarning(false);
    setIsBlurred(false);
  };

  return (
    <div className="relative">
      {/* No transition/duration classes here on purpose: this element also
          gets its blur set directly (see engageBlurNow/releaseBlurNow above)
          the instant a threat is detected, and a CSS transition would mean
          the content ramps from clear to blurred over ~300ms instead of
          snapping — precisely the window a screenshot could land in. The
          isBlurred-driven className/style below keep the same protected
          state applied across React re-renders (e.g. if this component
          re-renders for an unrelated reason while still blurred). */}
      <div
        ref={protectedRef}
        className={isBlurred ? "blur-xl select-none pointer-events-none" : ""}
        style={isBlurred ? { filter: INSTANT_BLUR_STYLE, WebkitFilter: INSTANT_BLUR_STYLE } : {}}
      >
        {children}
      </div>

      {isBlurred && !showWarning && (
        <div className="absolute inset-0 z-[50] flex items-center justify-center pointer-events-none">
          <div className="bg-background/60 backdrop-blur-md px-6 py-3 rounded-full border border-border shadow-lg flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-primary animate-pulse" />
            <span className="font-semibold text-sm">Protected Content — Capture or copying is not allowed</span>
          </div>
        </div>
      )}

      {showWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="max-w-md w-full bg-card border border-destructive/50 rounded-xl shadow-2xl p-8 text-center">
            <ShieldAlert className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">PROTECTED CAPSTONE PROJECT</h2>
            <p className="text-muted-foreground mb-6">
              {warningReason || "Screenshots, screen recording, copying, and unauthorized distribution of this material are prohibited."}
            </p>
            <div className="bg-muted p-4 rounded-lg text-xs text-muted-foreground mb-6 text-left">
              Your account information is embedded in this protected view. Unauthorized redistribution may lead to disciplinary action.
            </div>
            <Button onClick={resume} className="w-full">
              Return to Project
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

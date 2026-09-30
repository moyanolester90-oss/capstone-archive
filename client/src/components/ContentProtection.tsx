import React, { useEffect, useState, useCallback, useRef } from "react";
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

export default function ContentProtection({ children, projectId, enabled = true }: ContentProtectionProps) {
  const [isBlurred, setIsBlurred] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [warningReason, setWarningReason] = useState("");
  const blurredAtRef = useRef<number | null>(null);

  const logActivity = trpc.protection.logSuspiciousActivity.useMutation();

  const handleSuspiciousActivity = useCallback((reason: string) => {
    if (!enabled) return;
    setWarningReason(reason);
    setShowWarning(true);
    setIsBlurred(true);

    // Log to server
    logActivity.mutate({ projectId, reason });
    console.warn(`[Content Protection] ${reason}`);
  }, [enabled, projectId, logActivity]);

  useEffect(() => {
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
        blurredAtRef.current = Date.now();
        setIsBlurred(true);
      } else {
        const blurredAt = blurredAtRef.current;
        blurredAtRef.current = null;
        if (blurredAt && Date.now() - blurredAt < SUSPICIOUS_REFOCUS_MS) {
          wipeClipboard();
          handleSuspiciousActivity("Suspicious activity detected: the window was hidden briefly, consistent with a screenshot or screen-recording tool.");
        } else if (!showWarning) {
          setIsBlurred(false);
        }
      }
    };

    const handleBlur = () => {
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

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handlePrintScreen);
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
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handlePrintScreen);
      window.removeEventListener("beforeprint", handleBeforePrint);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("dragstart", handleDragStart);
      document.head.removeChild(style);
    };
  }, [enabled, showWarning, handleSuspiciousActivity]);

  const resume = () => {
    setShowWarning(false);
    setIsBlurred(false);
  };

  return (
    <div className="relative">
      <div
        className={`transition-all duration-300 ${isBlurred ? "blur-xl select-none pointer-events-none" : ""}`}
        style={isBlurred ? { WebkitFilter: 'blur(20px)' } : {}}
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

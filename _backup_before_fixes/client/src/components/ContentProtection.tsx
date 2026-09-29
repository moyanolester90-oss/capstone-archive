import React, { useEffect, useState, useCallback } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

interface ContentProtectionProps {
  children: React.ReactNode;
  projectId?: number;
  enabled?: boolean;
}

export default function ContentProtection({ children, projectId, enabled = true }: ContentProtectionProps) {
  const [isBlurred, setIsBlurred] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [warningReason, setWarningReason] = useState("");

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

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsBlurred(true);
      } else {
        // If they returned, we keep it blurred if a warning was triggered
        if (!showWarning) setIsBlurred(false);
      }
    };

    const handleBlur = () => {
      setIsBlurred(true);
    };

    const handleFocus = () => {
      if (!showWarning) setIsBlurred(false);
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      handleSuspiciousActivity("Right-click is disabled on protected content.");
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable Print Screen (some browsers/OS allow blocking, some don't)
      if (e.key === "PrintScreen") {
        navigator.clipboard.writeText(""); // Clear clipboard
        handleSuspiciousActivity("Screen capture is prohibited.");
      }

      // Detect Ctrl+C, Ctrl+U, Ctrl+S, Ctrl+P, F12, Ctrl+Shift+I/J/C
      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;

      if (isCtrl && (e.key === 'c' || e.key === 'u' || e.key === 's' || e.key === 'p')) {
        e.preventDefault();
        handleSuspiciousActivity(`Shortcut ${isCtrl ? 'Ctrl' : 'Cmd'}+${e.key.toUpperCase()} is disabled.`);
      }

      if (e.key === 'F12' || (isCtrl && isShift && (e.key === 'I' || e.key === 'J' || e.key === 'C'))) {
        e.preventDefault();
        handleSuspiciousActivity("Developer tools are disabled.");
      }
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
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("dragstart", handleDragStart);

    // Block Print
    const style = document.createElement('style');
    style.innerHTML = `@media print { body { display: none !important; } }`;
    document.head.appendChild(style);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("keydown", handleKeyDown);
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

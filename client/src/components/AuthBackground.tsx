/**
 * Layout wrapper for the Login and Sign Up pages: a full-bleed navy hero
 * (the school's brand navy, matching the primary color used everywhere
 * else in the app — see the chart palette in Dashboard.tsx) with the
 * school seal as a large, faint watermark and a gold decorative wave along
 * the bottom edge. Every other page keeps the plain light `PageBackground`
 * watermark (mounted globally in App.tsx); this component only replaces
 * that look for the two auth pages, where a stronger "front door" moment
 * is appropriate.
 */
export default function AuthBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate min-h-[calc(100vh-4rem)] overflow-hidden flex items-center justify-center p-4 py-12">
      {/* Navy gradient base */}
      <div className="absolute inset-0 -z-20 bg-gradient-to-br from-[#0b1830] via-[#153567] to-[#1a3a6b]" />

      {/* Oversized, faint seal watermark — the same /logo.jpg used as the
          site-wide watermark, just brightened for a dark background. */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none absolute left-1/2 top-1/2 h-[min(140vw,1400px)] w-[min(140vw,1400px)] -translate-x-1/2 -translate-y-1/2 opacity-[0.10]"
        style={{
          backgroundImage: "url(/logo.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          WebkitMaskImage: "radial-gradient(circle at center, black 0%, black 32%, transparent 65%)",
          maskImage: "radial-gradient(circle at center, black 0%, black 32%, transparent 65%)",
          filter: "grayscale(1) brightness(2.2)",
        }}
      />

      {/* Soft glows for depth */}
      <div className="pointer-events-none absolute -top-24 -right-20 h-96 w-96 rounded-full bg-[#c9a227]/20 blur-3xl -z-10" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-[#2a5599]/40 blur-3xl -z-10" />

      <div className="relative z-10 w-full flex items-center justify-center">
        {children}
      </div>

      {/* Gold decorative wave along the bottom edge */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 w-full"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        style={{ height: "72px" }}
      >
        <path fill="#c9a227" fillOpacity="0.9" d="M0,64 C240,118 480,4 720,34 C960,64 1200,118 1440,60 L1440,120 L0,120 Z" />
        <path fill="#f3d77a" fillOpacity="0.35" d="M0,88 C240,120 480,50 720,66 C960,82 1200,120 1440,90 L1440,120 L0,120 Z" />
      </svg>
    </div>
  );
}

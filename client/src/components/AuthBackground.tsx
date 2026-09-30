import { FileText, Search, Users } from "lucide-react";

/**
 * Layout wrapper for the Login and Sign Up pages: a full-bleed navy hero
 * (the school's brand navy, matching the primary color used everywhere
 * else in the app — see the chart palette in Dashboard.tsx) with the
 * school seal as a large, faint watermark and a gold decorative wave along
 * the bottom edge. On wide screens it also shows a left-hand branding
 * panel (name, tagline, blurb, quick feature row) beside the auth card,
 * matching the two-column look of the reference design. Every other page
 * keeps the plain light `PageBackground` watermark (mounted globally in
 * App.tsx); this component only replaces that look for the two auth
 * pages, where a stronger "front door" moment is appropriate.
 */
export default function AuthBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate min-h-[calc(100vh-5rem)] overflow-hidden bg-gradient-to-br from-[#0b1830] via-[#153567] to-[#1a3a6b]">
      {/* Oversized, faint seal watermark — the same /logo.jpg used as the
          site-wide watermark, just brightened for a dark background. */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none absolute left-0 top-1/2 h-[min(140vw,1400px)] w-[min(140vw,1400px)] -translate-x-1/3 -translate-y-1/2 opacity-[0.10]"
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
      <div className="pointer-events-none absolute -top-24 -right-20 h-96 w-96 rounded-full bg-[#c9a227]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-[#2a5599]/40 blur-3xl" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl flex-col items-center justify-center gap-10 px-4 py-12 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        {/* Left branding panel — hidden on small screens, shown alongside the card on wide ones */}
        <div className="hidden w-full max-w-md shrink-0 text-white lg:block">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-px w-8 bg-[#c9a227]" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Golden West Colleges, Inc.</span>
          </div>
          <h1 className="text-5xl font-extrabold leading-tight tracking-tight">
            Capstone
            <br />
            <span className="text-[#f3d77a]">Archive</span>
          </h1>
          <p className="mt-4 text-lg font-medium text-white/90">Explore. Learn. Build the Future.</p>
          <p className="mt-3 max-w-sm text-sm text-white/70">
            A digital repository of student capstones, research, and academic projects.
          </p>

          <div className="mt-10 flex items-center gap-6 text-xs text-white/70">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#f3d77a]" />
              <span>
                Access
                <br />
                Capstone Projects
              </span>
            </div>
            <span className="h-8 w-px bg-white/20" />
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[#f3d77a]" />
              <span>
                Discover
                <br />
                Research Works
              </span>
            </div>
            <span className="h-8 w-px bg-white/20" />
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#f3d77a]" />
              <span>
                Support
                <br />
                Student Innovation
              </span>
            </div>
          </div>
        </div>

        <div className="flex w-full items-center justify-center lg:w-auto lg:justify-end">
          {children}
        </div>
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

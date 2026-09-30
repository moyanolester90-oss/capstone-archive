import { FileText, Search, Users } from "lucide-react";

/**
 * Layout wrapper for the Login and Sign Up pages: the actual Golden West
 * Colleges campus photo as a full-bleed hero, with a navy tint over it so
 * white text and the card stay readable, and a gold decorative wave along
 * the bottom edge. On wide screens it also shows a left-hand branding
 * panel (name, tagline, blurb, quick feature row) beside the auth card,
 * matching the two-column look of the reference design. Every other page
 * uses the same campus photo too, via the global `PageBackground`
 * (mounted once in App.tsx) — this component just gives the two auth
 * pages their own stronger "front door" treatment of it.
 */
export default function AuthBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate min-h-[calc(100vh-5rem)] overflow-hidden bg-[#0b1830]">
      {/* The campus photo itself */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/campus-bg.png)" }}
      />
      {/* Navy tint over the photo so the white text and card stay readable */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0b1830]/90 via-[#153567]/80 to-[#1a3a6b]/75" />

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

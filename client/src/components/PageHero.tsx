import type { ReactNode } from "react";

/**
 * Navy/gold banner used at the top of the logged-in dashboard pages
 * (Student, Adviser, Librarian/Admin), matching the same treatment used
 * on the Login/Signup hero and the Home page hero: a navy gradient, a
 * faint seal watermark, soft glow accents, and a gold decorative wave
 * along the bottom edge. `actions` is an optional slot for a button on
 * the right (e.g. Adviser Dashboard's "Upload Capstone").
 */
export default function PageHero({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-[#0b1830] via-[#153567] to-[#1a3a6b]">
      <div
        aria-hidden="true"
        className="pointer-events-none select-none absolute right-0 top-1/2 h-[min(120vw,900px)] w-[min(120vw,900px)] translate-x-1/4 -translate-y-1/2 opacity-[0.08]"
        style={{
          backgroundImage: "url(/logo.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          WebkitMaskImage: "radial-gradient(circle at center, black 0%, black 32%, transparent 65%)",
          maskImage: "radial-gradient(circle at center, black 0%, black 32%, transparent 65%)",
          filter: "grayscale(1) brightness(2.2)",
        }}
      />
      <div className="pointer-events-none absolute -top-16 -left-10 h-64 w-64 rounded-full bg-[#c9a227]/20 blur-3xl" />

      <div className="container relative py-10 md:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">{title}</h1>
            {subtitle && <p className="text-white/70 mt-1">{subtitle}</p>}
          </div>
          {actions && <div>{actions}</div>}
        </div>
      </div>

      <svg
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 w-full"
        viewBox="0 0 1440 60"
        preserveAspectRatio="none"
        style={{ height: "28px" }}
      >
        <path fill="#c9a227" fillOpacity="0.9" d="M0,32 C240,58 480,2 720,17 C960,32 1200,58 1440,30 L1440,60 L0,60 Z" />
      </svg>
    </div>
  );
}

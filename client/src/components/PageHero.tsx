import type { ReactNode } from "react";

/**
 * Navy/gold banner used at the top of the logged-in dashboard pages
 * (Student, Adviser, Librarian/Admin): the campus photo with a navy tint
 * over it, matching the same treatment used on the Login/Signup hero and
 * the Home page hero, plus a gold decorative wave along the bottom edge.
 * `actions` is an optional slot for a button on the right (e.g. Adviser
 * Dashboard's "Upload Capstone").
 */
export default function PageHero({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="relative overflow-hidden bg-[#0b1830]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/campus-bg.png)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[#0b1830]/90 via-[#153567]/80 to-[#1a3a6b]/75" />

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

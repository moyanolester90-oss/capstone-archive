/**
 * Global backdrop for every page in the app: the actual Golden West
 * Colleges campus photo, fixed behind the header and every route. Mounted
 * once in App.tsx, so Home, Browse, Upload, Dashboard, Users, Login,
 * Sign Up, Download Requests, Archive, Scanner, Categories, My Account,
 * and every other page share the exact same background — for every role.
 *
 * A soft white wash sits on top of the photo so the existing light-themed
 * cards, tables, and dark text stay fully legible everywhere (this file
 * only changes the backdrop behind them, never their own styling). The
 * photo itself stays clearly visible at the edges and in any empty space
 * around content.
 */
export default function PageBackground() {
  return (
    <div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden bg-background">
      {/* The campus photo, covering the full viewport and fixed in place. */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat lg:bg-fixed"
        style={{ backgroundImage: "url(/campus-bg.png)" }}
      />
      {/* Soft white wash so page content (cards, text, tables) reads exactly
          as it did before — the photo shows through around and behind it. */}
      <div className="absolute inset-0 bg-white/85" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.75) 60%, rgba(255,255,255,0.9) 100%)" }}
      />
    </div>
  );
}

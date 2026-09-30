/**
 * Site-wide footer, rendered once at the bottom of every page — a simple
 * single navy row matching the reference design (copyright left, links
 * right). "Privacy Policy", "Terms of Service" and "Help" aren't wired to
 * real pages in this app, so they're shown as plain labels rather than
 * dead links.
 */
export default function Footer() {
  return (
    <footer className="bg-[#0b1830] text-white/70 mt-auto border-t border-white/10">
      <div className="container py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm">
        <p>&copy; {new Date().getFullYear()} Golden West Colleges, Inc. All rights reserved.</p>
        <div className="flex items-center gap-2 text-white/60">
          <span>Privacy Policy</span>
          <span className="text-white/30">|</span>
          <span>Terms of Service</span>
          <span className="text-white/30">|</span>
          <span>Help</span>
        </div>
      </div>
    </footer>
  );
}

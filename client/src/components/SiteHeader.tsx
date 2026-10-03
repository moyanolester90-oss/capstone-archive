import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  BookOpen, Upload, Star, LayoutDashboard, FileText,
  FolderOpen, Tags, Users, Download, Activity, LogIn, LogOut, Menu, ScanLine, UserCircle, PencilLine, KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import NotificationBell from "./NotificationBell";

export default function SiteHeader() {
  const { user, isAuthenticated, logout } = useAuth();
  const [location, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = user?.role === 'admin';
  const isAdviser = user?.role === 'adviser';
  const canUpload = isAdmin || isAdviser;
  const roleLabel = isAdmin ? "Librarian" : isAdviser ? "Adviser" : isAuthenticated ? "Student" : null;

  // "Home" is intentionally not a nav item — the logo/wordmark on the left
  // already links to "/". Logged-in users get this same list in the left
  // Sidebar (desktop) and here in the phone/tablet menu (mobile); logged-out
  // visitors just get "Browse" in both places.
  const mainItems = [
    ...(isAuthenticated ? [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/browse", label: "Browse", icon: BookOpen },
      // Students can only browse and search; advisers and the librarian upload.
      ...(canUpload ? [
        { href: "/upload", label: "Upload", icon: Upload },
        { href: "/my-submissions", label: "My Uploads", icon: FileText },
      ] : []),
      { href: "/bookmarks", label: "Favorites", icon: Star },
      { href: "/profile", label: "My Account", icon: UserCircle },
    ] : [
      { href: "/browse", label: "Browse", icon: BookOpen },
    ]),
  ];

  const adminItems = isAdmin ? [
    { href: "/admin/archive", label: "Archive", icon: FolderOpen },
    { href: "/admin/scanner", label: "Converter", icon: ScanLine },
    { href: "/admin/categories", label: "Categories", icon: Tags },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/downloads", label: "View Requests", icon: Download },
    { href: "/admin/edit-requests", label: "Edit Requests", icon: PencilLine },
    { href: "/password-resets", label: "Password Resets", icon: KeyRound },
    { href: "/admin/activities", label: "Activity Logs", icon: Activity },
  ] : [];

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate("/");
  };

  // `dark` styles the button for the navy desktop bar (light text). The mobile/sidebar
  // Sheet menu has a plain light background, so it always uses the normal light-mode
  // styling — otherwise those links render as white-on-white and look like they vanished.
  const navButton = (item: { href: string; label: string; icon: typeof BookOpen }, full = false, dark = false) => (
    <Link key={item.href} href={item.href} className="no-underline" onClick={() => setMenuOpen(false)}>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "gap-1.5 text-sm font-medium rounded-none border-b-2 border-transparent",
          full && "w-full justify-start h-10 rounded-md border-b-0",
          dark
            ? cn(
                "text-white/80 hover:bg-white/10 hover:text-white",
                location === item.href && "text-white border-[#c9a227]",
                full && location === item.href && "bg-white/15 border-b-0"
              )
            : cn(location === item.href && "bg-primary/10 text-primary border-b-0")
        )}
      >
        <item.icon className="h-4 w-4" />
        {item.label}
      </Button>
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 w-full bg-gradient-to-r from-[#0b1830] via-[#153567] to-[#0b1830] shadow-md overflow-hidden">
      {/* Gold diagonal accent band, top-right */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 1440 96"
      >
        <polygon points="1000,0 1200,0 900,96 700,96" fill="#c9a227" fillOpacity="0.55" />
        <polygon points="1150,0 1260,0 1020,96 910,96" fill="#f3d77a" fillOpacity="0.35" />
      </svg>
      <div className="container relative flex h-20 items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-3 no-underline shrink-0">
          <div className="h-14 w-14 shrink-0 rounded-full shadow-sm ring-2 ring-[#c9a227]/70 overflow-hidden">
            <img
              src="/logo.jpg"
              alt="Golden West Colleges seal"
              className="h-full w-full scale-[1.12] object-cover"
              style={{
                WebkitMaskImage: "radial-gradient(circle at center, black 82%, transparent 100%)",
                maskImage: "radial-gradient(circle at center, black 82%, transparent 100%)",
                filter: "blur(0.4px)",
              }}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold text-white leading-tight tracking-wide">Capstone Archive</span>
            <span className="text-xs text-[#f3d77a] font-semibold leading-tight tracking-[0.15em] uppercase">Golden West Colleges, Inc.</span>
          </div>
        </Link>

        {/* Logged-out visitors get a simple "Browse" link on wide screens. Logged-in
            users get their full nav in the left Sidebar instead (see Sidebar.tsx) —
            so there's nothing to show here for them above the sidebar's own breakpoint. */}
        {!isAuthenticated && (
          <nav className="hidden lg:flex items-center gap-1">
            {mainItems.map(item => navButton(item, false, true))}
          </nav>
        )}

        <div className="flex items-center gap-1 sm:gap-2">
          {isAuthenticated && user && <NotificationBell userId={user.id} />}
          {isAuthenticated ? (
            <>
              <span className="hidden sm:block text-sm text-white/70 max-w-[160px] truncate">
                {user?.name || "Student"}
                {roleLabel && <span className="ml-1 text-xs bg-[#c9a227] text-[#1a3a6b] px-1.5 py-0.5 rounded font-semibold">{roleLabel}</span>}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="hidden sm:inline-flex rounded-full border-white/30 text-white bg-transparent hover:bg-white/10 hover:text-white"
              >
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/signup" className="no-underline hidden sm:block">
                <Button variant="outline" size="sm" className="rounded-full border-white/30 text-white bg-transparent hover:bg-white/10 hover:text-white">
                  Sign Up
                </Button>
              </Link>
              <Link href="/login" className="no-underline">
                <Button size="sm" className="gap-1.5 rounded-full bg-[#c9a227] hover:bg-[#b8931f] text-[#1a3a6b] font-semibold">
                  <LogIn className="h-4 w-4" />
                  Login
                </Button>
              </Link>
            </>
          )}

          {/* Menu button for phones, tablets and laptop screens */}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 hover:text-white lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4 pb-6">
                {isAuthenticated && (
                  <p className="px-3 pb-2 text-sm text-muted-foreground truncate">
                    Signed in as <span className="font-medium text-foreground">{user?.name || "Student"}</span>
                  </p>
                )}
                {mainItems.map(item => navButton(item, true))}
                {adminItems.length > 0 && (
                  <>
                    <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin</p>
                    {adminItems.map(item => navButton(item, true))}
                  </>
                )}
                {isAuthenticated && (
                  <Button variant="outline" size="sm" className="mt-4 gap-1.5 justify-start h-10" onClick={handleLogout}>
                    <LogOut className="h-4 w-4" /> Logout
                  </Button>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Home, BookOpen, Upload, Star, LayoutDashboard, FileText,
  FolderOpen, Tags, Users, Download, Activity, LogIn, LogOut, Menu, ScanLine, UserCircle, PencilLine,
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

  const mainItems = [
    { href: "/", label: "Home", icon: Home },
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
    { href: "/admin/scanner", label: "Scanner", icon: ScanLine },
    { href: "/admin/categories", label: "Categories", icon: Tags },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/downloads", label: "View Requests", icon: Download },
    { href: "/admin/edit-requests", label: "Edit Requests", icon: PencilLine },
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
  const navButton = (item: { href: string; label: string; icon: typeof Home }, full = false, dark = false) => (
    <Link key={item.href} href={item.href} className="no-underline" onClick={() => setMenuOpen(false)}>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "gap-1.5 text-sm font-medium",
          full && "w-full justify-start h-10",
          dark
            ? cn("text-white/80 hover:bg-white/10 hover:text-white", location === item.href && "bg-white/15 text-white")
            : cn(location === item.href && "bg-primary/10 text-primary")
        )}
      >
        <item.icon className="h-4 w-4" />
        {item.label}
      </Button>
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 w-full bg-gradient-to-r from-[#0b1830] via-[#153567] to-[#0b1830] shadow-md">
      <div className="container flex h-16 items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 no-underline shrink-0">
          <div className="h-11 w-11 shrink-0 rounded-full shadow-sm ring-2 ring-[#c9a227]/70 overflow-hidden">
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
            <span className="text-lg font-bold text-white leading-tight">Capstone Archive</span>
            <span className="text-[10px] text-[#f3d77a] font-medium leading-tight tracking-wide">Golden West Colleges, Inc.</span>
          </div>
        </Link>

        {/* Full navigation on wide screens (admins have many links, so they get it only on extra-wide screens) */}
        <nav className={cn("hidden items-center gap-1", isAdmin ? "2xl:flex" : isAdviser ? "xl:flex" : "lg:flex")}>
          {[...mainItems, ...adminItems].map(item => navButton(item, false, true))}
        </nav>

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
                className="hidden sm:inline-flex border-white/30 text-white bg-transparent hover:bg-white/10 hover:text-white"
              >
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/signup" className="no-underline hidden sm:block">
                <Button variant="outline" size="sm" className="border-white/30 text-white bg-transparent hover:bg-white/10 hover:text-white">
                  Sign Up
                </Button>
              </Link>
              <Link href="/login" className="no-underline">
                <Button size="sm" className="gap-1.5 bg-[#c9a227] hover:bg-[#b8931f] text-[#1a3a6b] font-semibold">
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
                className={cn("text-white hover:bg-white/10 hover:text-white", isAdmin ? "2xl:hidden" : isAdviser ? "xl:hidden" : "lg:hidden")}
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

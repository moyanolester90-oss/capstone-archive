import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Home, BookOpen, Upload, Star, LayoutDashboard,
  FolderOpen, Users, Download, Activity, LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SiteHeader() {
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const isAdmin = user?.role === 'admin';

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    ...(isAuthenticated ? [
      { href: "/browse", label: "Browse", icon: BookOpen },
      { href: "/upload", label: "Upload", icon: Upload },
      { href: "/bookmarks", label: "Favorites", icon: Star },
      ...(isAdmin ? [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/admin/archive", label: "Archive", icon: FolderOpen },
        { href: "/admin/categories", label: "Categories", icon: FolderOpen },
        { href: "/admin/users", label: "Users", icon: Users },
        { href: "/admin/downloads", label: "Downloads", icon: Download },
        { href: "/admin/activities", label: "Activity Logs", icon: Activity },
      ] : []),
    ] : []),
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-lg">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 no-underline">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-primary leading-tight">Capstone Archive</span>
            <span className="text-[10px] text-muted-foreground font-medium leading-tight">Golden West Colleges, Inc.</span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(item => (
            <Link key={item.href} href={item.href} className="no-underline">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "gap-1.5 text-sm font-medium",
                  location === item.href && "bg-primary/10 text-primary"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <span className="hidden sm:block text-sm text-muted-foreground">
                {user?.name || "Student"}
                {isAdmin && <span className="ml-1 text-xs bg-accent text-accent-foreground px-1.5 py-0.5 rounded font-medium">Admin</span>}
              </span>
              <Button variant="outline" size="sm" onClick={logout}>Logout</Button>
            </>
          ) : (
            <Link href="/login" className="no-underline">
              <Button size="sm" className="gap-1.5">
                <LogIn className="h-4 w-4" />
                Login
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

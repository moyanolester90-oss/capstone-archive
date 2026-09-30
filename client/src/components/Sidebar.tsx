import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";
import {
  BookOpen, Upload, Star, LayoutDashboard, FileText,
  FolderOpen, Tags, Users, Download, Activity, ScanLine, UserCircle, PencilLine,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Left-hand navigation for logged-in users (Student, Adviser, Librarian/Admin).
 * Replaces the old desktop nav that used to live inside the header — every
 * link, icon, href and role gate here is unchanged from that nav, just
 * relocated and restyled. On small/medium screens this sidebar hides; the
 * same set of links is still reachable through the header's hamburger menu.
 */
export default function Sidebar() {
  const { user } = useAuth();
  const [location] = useLocation();
  const isAdmin = user?.role === 'admin';
  const isAdviser = user?.role === 'adviser';
  const canUpload = isAdmin || isAdviser;

  const mainItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/browse", label: "Browse", icon: BookOpen },
    ...(canUpload ? [
      { href: "/upload", label: "Upload", icon: Upload },
      { href: "/my-submissions", label: "My Uploads", icon: FileText },
    ] : []),
    { href: "/bookmarks", label: "Favorites", icon: Star },
    { href: "/profile", label: "My Account", icon: UserCircle },
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

  const item = (it: { href: string; label: string; icon: typeof LayoutDashboard }) => (
    <Link key={it.href} href={it.href} className="no-underline">
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
          location === it.href
            ? "bg-[#c9a227] text-[#1a3a6b] font-semibold shadow-sm"
            : "text-[#1a3a6b]/80 hover:bg-[#1a3a6b]/5 hover:text-[#1a3a6b]"
        )}
      >
        <it.icon className="h-4 w-4 shrink-0" />
        {it.label}
      </div>
    </Link>
  );

  return (
    <aside className="hidden lg:flex lg:flex-col fixed left-0 top-20 bottom-0 w-64 border-r bg-white/90 backdrop-blur-sm overflow-y-auto py-4 px-3 z-40">
      <nav className="flex flex-col gap-1">
        {mainItems.map(item)}
      </nav>

      {adminItems.length > 0 && (
        <>
          <p className="px-3 pt-5 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin</p>
          <nav className="flex flex-col gap-1">
            {adminItems.map(item)}
          </nav>
        </>
      )}
    </aside>
  );
}

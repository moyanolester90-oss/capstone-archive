import { useState } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, Clock, Download, Search, Star, CheckCircle2, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import StatCard from "@/components/dashboard/StatCard";
import ContentProtection from "@/components/ContentProtection";

const REQUEST_STATUS = {
  pending: { label: "Waiting for approval", icon: Clock, className: "bg-amber-100 text-amber-800 border-amber-200" },
  approved: { label: "Approved — you can download", icon: CheckCircle2, className: "bg-green-100 text-green-800 border-green-200" },
  rejected: { label: "Declined", icon: XCircle, className: "bg-red-100 text-red-800 border-red-200" },
} as const;

/** Student home: search, newest capstones, favorites and download requests. */
export default function StudentDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");

  const { data: projects } = trpc.projects.list.useQuery();
  const { data: favorites } = trpc.bookmarks.list.useQuery();
  const { data: requests } = trpc.downloadRequests.myRequests.useQuery();

  const titleOf = (id: number) => projects?.find(p => p.id === id)?.title || `Capstone #${id}`;
  const approvedRequests = requests?.filter(r => r.status === "approved").length ?? 0;
  const pendingRequests = requests?.filter(r => r.status === "pending").length ?? 0;

  return (
    <ContentProtection enabled>
      <div className="min-h-[calc(100vh-4rem)] py-8">
        <div className="container space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Welcome, {user?.name || "Student"}</h1>
            <p className="text-muted-foreground">Student Dashboard — find and read capstone projects from the archive.</p>
          </div>

          <form
            className="flex gap-2"
            onSubmit={e => {
              e.preventDefault();
              navigate(`/browse${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9 h-11" placeholder="Search capstones by title or keyword..." value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <Button type="submit" className="h-11">Search</Button>
          </form>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Capstones in the Archive" value={projects?.length ?? 0} icon={BookOpen} color="bg-primary" href="/browse" />
            <StatCard label="My Favorites" value={favorites?.length ?? 0} icon={Star} color="bg-amber-500" href="/bookmarks" />
            <StatCard label="Approved Views" value={approvedRequests} icon={Download} color="bg-green-600" />
            <StatCard label="Requests Pending" value={pendingRequests} icon={Clock} color="bg-indigo-500" />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Newest Capstones</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {projects && projects.length > 0 ? projects.slice(0, 5).map(p => (
                  <Link key={p.id} href={`/projects/${p.id}`} className="block no-underline rounded-lg p-3 hover:bg-muted/50 border">
                    <p className="font-medium text-foreground line-clamp-1">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{p.adviser} · {p.schoolYear}</p>
                  </Link>
                )) : <p className="text-sm text-muted-foreground py-4 text-center">No capstones yet.</p>}
                <Link href="/browse" className="block text-center text-sm text-primary hover:underline pt-2">Browse all capstones</Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">My View Requests</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {requests && requests.length > 0 ? requests.slice(0, 6).map(r => {
                  const s = REQUEST_STATUS[r.status as keyof typeof REQUEST_STATUS] ?? REQUEST_STATUS.pending;
                  const Icon = s.icon;
                  return (
                    <Link key={r.id} href={`/projects/${r.projectId}`} className="flex items-center justify-between gap-3 no-underline rounded-lg p-3 hover:bg-muted/50 border">
                      <span className="text-sm font-medium text-foreground line-clamp-1">{titleOf(r.projectId)}</span>
                      <Badge variant="outline" className={`gap-1 shrink-0 ${s.className}`}><Icon className="h-3 w-3" />{s.label}</Badge>
                    </Link>
                  );
                }) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No requests yet. Open a capstone and press <strong>Request to View</strong> to ask the librarian for access.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {favorites && favorites.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg">My Favorites</CardTitle></CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-2">
                {favorites.slice(0, 6).map(p => (
                  <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-2 no-underline rounded-lg p-3 hover:bg-muted/50 border">
                    <Star className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="text-sm text-foreground line-clamp-1">{p.title}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </ContentProtection>
  );
}

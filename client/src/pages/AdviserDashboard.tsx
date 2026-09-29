import { Link } from "wouter";
import { AlertCircle, BookOpen, CheckCircle2, Clock, FileText, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import StatCard from "@/components/dashboard/StatCard";

const STATUS = {
  pending: { label: "Under review", className: "bg-amber-100 text-amber-800 border-amber-200" },
  approved: { label: "Published", className: "bg-green-100 text-green-800 border-green-200" },
  rejected: { label: "Needs changes", className: "bg-red-100 text-red-800 border-red-200" },
} as const;

/** Capstone adviser home: upload status overview and things that need attention. */
export default function AdviserDashboard() {
  const { user } = useAuth();
  const { data: mine } = trpc.projects.mine.useQuery();
  const { data: published } = trpc.projects.list.useQuery();

  const count = (s: string) => mine?.filter(p => p.status === s).length ?? 0;
  const needsChanges = mine?.filter(p => p.status === "rejected") ?? [];

  return (
    <div className="min-h-[calc(100vh-4rem)] py-8">
      <div className="container space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Adviser Dashboard</h1>
            <p className="text-muted-foreground">Welcome, {user?.name || "Adviser"}. Upload capstones and follow their review by the librarian.</p>
          </div>
          <Link href="/upload" className="no-underline">
            <Button className="gap-2"><Upload className="h-4 w-4" /> Upload Capstone</Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="My Uploads" value={mine?.length ?? 0} icon={FileText} color="bg-primary" href="/my-submissions" />
          <StatCard label="Under Review" value={count("pending")} icon={Clock} color="bg-amber-500" href="/my-submissions" />
          <StatCard label="Published" value={count("approved")} icon={CheckCircle2} color="bg-green-600" href="/my-submissions" />
          <StatCard label="Needs Changes" value={count("rejected")} icon={AlertCircle} color="bg-red-600" href="/my-submissions" />
        </div>

        {needsChanges.length > 0 && (
          <Card className="border-red-200">
            <CardHeader><CardTitle className="text-lg text-red-700">Needs your attention</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {needsChanges.map(p => (
                <div key={p.id} className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="font-medium text-red-900">{p.title}</p>
                  <p className="text-sm text-red-800">Librarian: {p.rejectionReason || "No reason given."}</p>
                  <Link href="/my-submissions" className="text-sm font-medium text-red-900 underline">Fix &amp; resubmit</Link>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">My Recent Uploads</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {mine && mine.length > 0 ? mine.slice(0, 6).map(p => {
                const s = STATUS[p.status as keyof typeof STATUS] ?? STATUS.pending;
                return (
                  <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between gap-3 no-underline rounded-lg p-3 hover:bg-muted/50 border">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-1">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{p.schoolYear} · updated {new Date(p.updatedAt).toLocaleDateString()}</p>
                    </div>
                    <Badge variant="outline" className={`shrink-0 ${s.className}`}>{s.label}</Badge>
                  </Link>
                );
              }) : (
                <p className="text-sm text-muted-foreground py-6 text-center">You haven't uploaded a capstone yet.</p>
              )}
              <Link href="/my-submissions" className="block text-center text-sm text-primary hover:underline pt-2">Manage my uploads</Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Archive</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <BookOpen className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{published?.length ?? 0}</p>
                  <p className="text-sm text-muted-foreground">capstones published in the archive</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Every upload and update is checked by the librarian before students can see it. Updating a published capstone sends it back for review.
              </p>
              <Link href="/browse" className="no-underline"><Button variant="outline" className="w-full">Browse the Archive</Button></Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import {
  Users, FolderOpen, Upload, Download, Activity, BarChart3,
  ArrowUpRight, Loader2, ScanLine,
} from "lucide-react";
import StudentDashboard from "./StudentDashboard";
import AdviserDashboard from "./AdviserDashboard";
import { Link } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const COLORS = ["#1a3a6b", "#c9a227", "#22c55e", "#ef4444", "#3b82f6"];

export default function Dashboard() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const isAdmin = user?.role === 'admin';

  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery(undefined, {
    enabled: isAdmin,
  });

  const { data: recentActivities } = trpc.activityLogs.recent.useQuery(undefined, {
    enabled: isAdmin,
  });
  const { data: categories } = trpc.categories.list.useQuery();
  const { data: pendingProjects } = trpc.projects.pending.useQuery(undefined, {
    enabled: isAdmin,
  });
  const { data: pendingDownloads } = trpc.downloadRequests.pending.useQuery(undefined, {
    enabled: isAdmin,
  });
  const { data: categoryStats } = trpc.dashboard.categoryStats.useQuery(undefined, {
    enabled: isAdmin,
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <Card><CardContent className="pt-6"><p className="text-muted-foreground mb-4">Please login to access the dashboard.</p><Link href="/login">Login</Link></CardContent></Card>
      </div>
    );
  }

  // Each role has its own dashboard.
  if (user?.role === 'adviser') return <AdviserDashboard />;
  if (!isAdmin) return <StudentDashboard />;

  const chartData = categories?.map(cat => ({
    name: cat.name,
    value: 0,
  })) || [];

  // Use real category stats from the database, fall back to placeholders
  const categoryPieData = (categoryStats && categoryStats.length > 0 && categoryStats.some(c => c.value > 0))
    ? categoryStats
    : [
        { name: "Web Dev", value: 0 },
        { name: "Mobile", value: 0 },
        { name: "AI", value: 0 },
        { name: "Networking", value: 0 },
        { name: "Database", value: 0 },
      ];

  return (
    <div className="min-h-[calc(100vh-4rem)] py-8">
      <div className="container">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Librarian Dashboard</h1>
          <p className="text-muted-foreground">Overview of the Capstone Archive system</p>
        </div>

        {/* Stats Cards */}
        {statsLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Users", value: stats.totalUsers, icon: Users, color: "bg-blue-500", href: "/admin/users" },
              { label: "Total Students", value: stats.totalStudents, icon: Users, color: "bg-indigo-500", href: "/admin/users" },
              { label: "Archived Projects", value: stats.totalProjects, icon: FolderOpen, color: "bg-primary", href: "/admin/archive" },
              { label: "Pending Uploads", value: stats.pendingUploads, icon: Upload, color: "bg-amber-500", href: "/admin/archive" },
            ].map((stat, i) => (
              <Link key={i} href={stat.href} className="no-underline">
                <Card className="hover:shadow-md transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`h-10 w-10 rounded-lg ${stat.color} flex items-center justify-center`}>
                        <stat.icon className="h-5 w-5 text-white" />
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Charts & Activity */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Category Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-primary" />
                Category Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={categoryPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                    {categoryPieData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 mt-4">
                {categoryPieData.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-primary" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {recentActivities && recentActivities.length > 0 ? (
                  recentActivities.map(log => (
                    <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                      <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{log.action.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground truncate">{log.description}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
                )}
              </div>
              <Link href="/admin/activities" className="block text-center mt-4 text-sm text-primary hover:underline">
                View all activity logs
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { label: "Scan Hard Copy", href: "/admin/scanner", icon: ScanLine },
                { label: "Upload", href: "/upload", icon: Upload },
                { label: "Archive", href: "/admin/archive", icon: FolderOpen },
                { label: "Categories", href: "/admin/categories", icon: FolderOpen },
                { label: "Users", href: "/admin/users", icon: Users },
                { label: "View Requests", href: "/admin/downloads", icon: Download },
                { label: "Logs", href: "/admin/activities", icon: Activity },
              ].map((action, i) => (
                <Link key={i} href={action.href} className="no-underline">
                  <Card className="hover:border-primary/50 transition-all text-center p-4">
                    <action.icon className="h-5 w-5 mx-auto text-primary mb-1" />
                    <span className="text-sm font-medium">{action.label}</span>
                  </Card>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

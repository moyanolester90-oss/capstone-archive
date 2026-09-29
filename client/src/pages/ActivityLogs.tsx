import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { Activity, Loader2 } from "lucide-react";
import { Link } from "wouter";

export default function ActivityLogs() {
  const { user, isAuthenticated } = useAuth();

  const { data: logs, isLoading } = trpc.activityLogs.list.useQuery(undefined, {
    enabled: user?.role === 'admin',
  });

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <Card><CardContent className="pt-6 text-center">
          <p className="text-muted-foreground mb-4">Admin access required.</p>
          <Link href="/"><Button>Go Home</Button></Link>
        </CardContent></Card>
      </div>
    );
  }

  const getActionColor = (action: string) => {
    if (action.includes("approved")) return "bg-green-500/10 text-green-700";
    if (action.includes("rejected")) return "bg-red-500/10 text-red-700";
    if (action.includes("uploaded") || action.includes("created")) return "bg-blue-500/10 text-blue-700";
    if (action.includes("deleted")) return "bg-red-500/10 text-red-700";
    if (action.includes("login")) return "bg-purple-500/10 text-purple-700";
    return "bg-gray-500/10 text-gray-700";
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] py-8">
      <div className="container max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Activity Logs</h1>
          <p className="text-muted-foreground">System activity history</p>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : logs && logs.length > 0 ? (
              <div className="divide-y">
                {logs.map(log => (
                  <div key={log.id} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start gap-3">
                      <Badge variant="secondary" className={`shrink-0 text-xs ${getActionColor(log.action)}`}>
                        {log.action.replace(/_/g, ' ')}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{log.description}</p>
                        {log.entityType && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {log.entityType} #{log.entityId}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No activity logs found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

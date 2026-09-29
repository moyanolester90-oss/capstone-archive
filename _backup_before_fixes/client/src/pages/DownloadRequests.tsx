import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { Download, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

export default function DownloadRequests() {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [note, setNote] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);

  const { data: requests } = trpc.downloadRequests.list.useQuery(undefined, { enabled: user?.role === 'admin' });
  const { data: projects } = trpc.projects.all.useQuery(undefined, { enabled: user?.role === 'admin' });
  const { data: allUsers } = trpc.users.list.useQuery(undefined, { enabled: user?.role === 'admin' });

  const approveReq = trpc.downloadRequests.approve.useMutation({
    onSuccess: () => {
      toast.success("Download request approved");
      utils.downloadRequests.invalidate();
      utils.dashboard.stats.invalidate();
      setActiveId(null);
      setNote("");
    },
    onError: () => toast.error("Failed to approve request"),
  });

  const rejectReq = trpc.downloadRequests.reject.useMutation({
    onSuccess: () => {
      toast.success("Download request rejected");
      utils.downloadRequests.invalidate();
      utils.dashboard.stats.invalidate();
      setActiveId(null);
      setNote("");
    },
    onError: () => toast.error("Failed to reject request"),
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

  return (
    <div className="min-h-[calc(100vh-4rem)] py-8">
      <div className="container">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Download Requests</h1>
          <p className="text-muted-foreground">Manage student download access requests</p>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <th className="p-4">Request ID</th>
                    <th className="p-4">User Name</th>
                    <th className="p-4">User Email</th>
                    <th className="p-4">Document / File Name</th>
                    <th className="p-4">File Type</th>
                    <th className="p-4">Requested At</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests?.map(req => {
                    const project = projects?.find(p => p.id === req.projectId);
                    const reqUser = allUsers?.find(u => u.id === req.userId);
                    const userName = reqUser?.name || "N/A";
                    const userEmail = reqUser?.email || "N/A";
                    const fileName = project?.fileName || project?.title || `Document #${req.projectId}`;
                    const fileType = project?.fileType ? project.fileType.split('/').pop()?.toUpperCase() : "PDF/Attachment";
                    const dateFormatted = new Date(req.createdAt).toLocaleDateString() + " " + new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return (
                      <tr key={req.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-4 text-sm font-semibold text-foreground">#{req.id}</td>
                        <td className="p-4 text-sm font-medium text-foreground">{userName}</td>
                        <td className="p-4 text-sm text-muted-foreground">{userEmail}</td>
                        <td className="p-4 text-sm text-foreground max-w-[200px] truncate" title={fileName}>
                          {fileName}
                        </td>
                        <td className="p-4 text-xs">
                          <Badge variant="outline" className="uppercase text-[10px]">{fileType}</Badge>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">
                          {dateFormatted}
                        </td>
                        <td className="p-4">
                          <Badge variant={
                            req.status === "approved" ? "default" :
                            req.status === "rejected" ? "destructive" : "secondary"
                          } className="capitalize">
                            {req.status}
                          </Badge>
                        </td>
                        <td className="p-4">
                          {req.status === "pending" ? (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => setActiveId(req.id)}>
                                  <CheckCircle className="h-4 w-4 mr-1 text-primary" /> Review Request
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Review Download Request #{req.id}</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 pt-2">
                                  <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
                                    <p><strong>User:</strong> {userName} ({userEmail})</p>
                                    <p><strong>Document:</strong> {fileName}</p>
                                    <p><strong>File Type:</strong> {fileType}</p>
                                    <p><strong>Requested:</strong> {dateFormatted}</p>
                                  </div>

                                  <div className="space-y-2">
                                    <Label>Admin Note / Reason (optional)</Label>
                                    <Textarea
                                      value={note}
                                      onChange={e => setNote(e.target.value)}
                                      rows={2}
                                      placeholder="Provide an optional note or rejection reason..."
                                    />
                                  </div>

                                  <div className="border-t pt-3 flex flex-col gap-2">
                                    <p className="text-xs text-muted-foreground">Select an action for this download request:</p>
                                    <div className="flex justify-end gap-2">
                                      <Button variant="ghost" onClick={() => { setActiveId(null); setNote(""); }}>
                                        Cancel
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        onClick={() => {
                                          if (confirm("Reject this download request?")) {
                                            activeId && rejectReq.mutate({ id: activeId, adminNote: note || undefined });
                                          }
                                        }}
                                      >
                                        <XCircle className="h-4 w-4 mr-1" /> Reject Request
                                      </Button>
                                      <Button
                                        onClick={() => {
                                          if (confirm("Approve this download request?")) {
                                            activeId && approveReq.mutate({ id: activeId, adminNote: note || undefined });
                                          }
                                        }}
                                      >
                                        <CheckCircle className="h-4 w-4 mr-1" /> Approve Request
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {req.adminNote ? `Note: ${req.adminNote}` : 'Completed'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(!requests || requests.length === 0) && (
                <div className="text-center py-12 text-muted-foreground">
                  <Download className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No download requests found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

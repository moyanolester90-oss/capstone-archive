import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { CheckCircle, Copy, KeyRound, XCircle } from "lucide-react";
import { Link } from "wouter";

const ROLE_LABELS: Record<string, string> = { student: "Student", adviser: "Adviser", admin: "Admin/Librarian" };

/**
 * Librarian/admin-only review queue for "Forgot Password?" requests. Advisers
 * no longer have access to this page — both the list and the mutations are
 * admin-only server-side too (see `passwordResets` in server/routers.ts),
 * this page just reflects that.
 */
export default function PasswordResets() {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [issued, setIssued] = useState<{ temporaryPassword: string; userName: string | null; userSchoolId: string | null } | null>(null);

  const canReview = user?.role === 'admin';
  const { data: requests } = trpc.passwordResets.list.useQuery(undefined, { enabled: canReview });

  const approveReq = trpc.passwordResets.approve.useMutation({
    onSuccess: data => {
      utils.passwordResets.invalidate();
      setIssued({ temporaryPassword: data.temporaryPassword, userName: data.userName, userSchoolId: data.userSchoolId });
    },
    onError: err => toast.error(err.message || "Failed to approve request"),
  });

  const rejectReq = trpc.passwordResets.reject.useMutation({
    onSuccess: () => {
      toast.success("Request rejected");
      utils.passwordResets.invalidate();
    },
    onError: err => toast.error(err.message || "Failed to reject request"),
  });

  const copyPassword = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.temporaryPassword);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn't copy — please copy it manually");
    }
  };

  if (!isAuthenticated || !canReview) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4">
        <Card><CardContent className="pt-6 text-center">
          <p className="text-muted-foreground mb-4">Admin access required.</p>
          <Link href="/"><Button>Go Home</Button></Link>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] py-8">
      <div className="container">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Password Reset Requests</h1>
          <p className="text-muted-foreground">
            Review "Forgot Password?" requests from Students, Advisers, and other Librarians/Admins.
          </p>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <th className="p-4">Request ID</th>
                    <th className="p-4">Account</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Requested At</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests?.map(req => {
                    const dateFormatted = new Date(req.createdAt).toLocaleDateString() + " " + new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const busy = (approveReq.isPending && approveReq.variables?.id === req.id) || (rejectReq.isPending && rejectReq.variables?.id === req.id);
                    return (
                      <tr key={req.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-4 text-sm font-semibold text-foreground">#{req.id}</td>
                        <td className="p-4 text-sm font-medium text-foreground">
                          {req.userName || "N/A"}
                          <div className="text-xs text-muted-foreground">School ID: {req.userSchoolId || "N/A"}</div>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline">{ROLE_LABELS[req.userRole ?? ''] ?? req.userRole}</Badge>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">{dateFormatted}</td>
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
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() => {
                                  if (confirm(`Approve this password reset for ${req.userName || req.userSchoolId}? A new temporary password will be generated and shown once.`)) {
                                    approveReq.mutate({ id: req.id });
                                  }
                                }}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" /> Approve
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={busy}
                                onClick={() => {
                                  if (confirm("Reject this password reset request?")) {
                                    rejectReq.mutate({ id: req.id });
                                  }
                                }}
                              >
                                <XCircle className="h-4 w-4 mr-1" /> Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Completed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(!requests || requests.length === 0) && (
                <div className="text-center py-12 text-muted-foreground">
                  <KeyRound className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No password reset requests found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!issued} onOpenChange={open => { if (!open) setIssued(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-600" /> Temporary Password Issued</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Share this temporary password with <strong>{issued?.userName || issued?.userSchoolId}</strong> (School ID {issued?.userSchoolId})
              securely — in person, by phone, or another trusted channel. It is shown only this once and is not saved anywhere in plain text.
              They'll be required to set their own new password the moment they sign in with it.
            </p>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
              <code className="flex-1 text-base font-mono font-semibold tracking-wide text-foreground">{issued?.temporaryPassword}</code>
              <Button type="button" variant="outline" size="sm" onClick={copyPassword}>
                <Copy className="h-4 w-4 mr-1" /> Copy
              </Button>
            </div>
            <Button className="w-full" onClick={() => setIssued(null)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

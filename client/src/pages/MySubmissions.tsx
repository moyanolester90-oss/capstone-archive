import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Clock, FileText, Loader2, LogIn, Lock, Pencil, Plus, ShieldQuestion } from "lucide-react";
import ProjectForm from "@/components/ProjectForm";

const STATUS = {
  pending: { label: "Under review", icon: Clock, className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300" },
  approved: { label: "Approved", icon: CheckCircle2, className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300" },
  rejected: { label: "Needs changes", icon: AlertCircle, className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300" },
} as const;

/** A student's own uploads: review status, rejection reason, and fix & resubmit. */
export default function MySubmissions() {
  const { isAuthenticated, loading, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isAdviser = user?.role === "adviser";
  const canUpload = isAdmin || isAdviser;
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState<any>(null);

  const { data: projects, isLoading } = trpc.projects.mine.useQuery(undefined, { enabled: isAuthenticated && canUpload });
  const { data: categories } = trpc.categories.list.useQuery();
  const resubmit = trpc.projects.resubmit.useMutation();

  // Advisers (never the librarian/admin) need the librarian's approval,
  // per project, before they're allowed to edit/replace/resubmit anything —
  // this drives which button each card below shows. The server enforces the
  // same rule independently in `projects.resubmit`, so this is only the UI
  // half of it, not the actual gate.
  const { data: editRequests } = trpc.editRequests.myRequests.useQuery(undefined, { enabled: isAuthenticated && isAdviser });
  const requestEdit = trpc.editRequests.create.useMutation({
    onSuccess: () => {
      toast.success("Edit permission requested. The librarian will review it.");
      utils.editRequests.myRequests.invalidate();
      utils.notifications.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to request edit permission"),
  });

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Login Required</CardTitle>
            <CardDescription>Please login to see your submissions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/login")} className="gap-2">
              <LogIn className="h-4 w-4" /> Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }


  if (!canUpload) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Advisers and Librarian Only</CardTitle>
            <CardDescription>
              Student accounts can browse and search capstone projects. Uploading and editing is done by capstone advisers and the librarian.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/browse")}>Browse Projects</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] py-8">
      <div className="container max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Uploads</h1>
            <p className="text-muted-foreground">Track the review status of the capstones you uploaded, and update them.</p>
          </div>
          <Link href="/upload" className="no-underline">
            <Button className="gap-2"><Plus className="h-4 w-4" /> Upload Project</Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : !projects || projects.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="mb-4">You haven't uploaded any projects yet.</p>
              <Link href="/upload" className="no-underline"><Button variant="outline">Upload your first project</Button></Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {projects.map(project => {
              const status = STATUS[project.status as keyof typeof STATUS] ?? STATUS.pending;
              const StatusIcon = status.icon;
              const category = categories?.find(c => c.id === project.categoryId);
              // Admins/librarians are never gated. Advisers need an
              // `approved` edit request on file for this exact project.
              const editReq = isAdviser ? editRequests?.find(r => r.projectId === project.id) : undefined;
              const canEditNow = isAdmin || editReq?.status === "approved";
              return (
                <Card key={project.id} data-testid={`submission-${project.id}`}>
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/projects/${project.id}`} className="no-underline">
                          <h2 className="font-semibold text-lg text-foreground hover:text-primary break-words">{project.title}</h2>
                        </Link>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                          <span>{category?.name || "Uncategorized"}</span>
                          <span>{project.schoolYear}</span>
                          <span>Submitted {new Date(project.createdAt).toLocaleDateString()}</span>
                          {project.fileName && <span>File: {project.fileName}</span>}
                        </div>
                      </div>
                      <Badge variant="outline" className={`gap-1 ${status.className}`}>
                        <StatusIcon className="h-3.5 w-3.5" /> {status.label}
                      </Badge>
                    </div>

                    {project.status === "rejected" && (
                      <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                        <p className="font-medium">Reason from the admin:</p>
                        <p className="whitespace-pre-wrap">{project.rejectionReason || "No reason was given."}</p>
                      </div>
                    )}
                    {project.status === "pending" && (
                      <p className="mt-3 text-sm text-muted-foreground">The librarian will review this soon. You can still make changes while it's waiting.</p>
                    )}

                    {isAdviser && editReq?.status === "rejected" && (
                      <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                        <p className="font-medium">The librarian declined your request to edit this capstone.</p>
                        {editReq.adminNote && <p className="whitespace-pre-wrap">{editReq.adminNote}</p>}
                      </div>
                    )}

                    <div className="mt-4">
                      {canEditNow ? (
                        <Button variant={project.status === "rejected" ? "default" : "outline"} size="sm" className="gap-2" onClick={() => setEditing(project)}>
                          <Pencil className="h-4 w-4" />
                          {project.status === "rejected" ? "Fix & Resubmit" : project.status === "approved" ? "Update Capstone" : "Edit Submission"}
                        </Button>
                      ) : editReq?.status === "pending" ? (
                        <Button variant="outline" size="sm" className="gap-2" disabled>
                          <Clock className="h-4 w-4" /> Waiting for librarian's approval
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled={requestEdit.isPending}
                          onClick={() => requestEdit.mutate({ projectId: project.id })}
                        >
                          {requestEdit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                          {editReq?.status === "rejected" ? "Request Permission Again" : "Request Permission to Edit"}
                        </Button>
                      )}
                      {isAdviser && !canEditNow && !editReq && (
                        <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                          <ShieldQuestion className="h-3.5 w-3.5" /> You need the librarian's approval before editing, replacing, or updating this capstone.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.status === "rejected" ? "Fix & Resubmit Project" : editing?.status === "approved" ? "Update Capstone" : "Edit Submission"}</DialogTitle>
            <DialogDescription>
              {user?.role === "admin"
                ? "Your changes are published right away."
                : editing?.status === "approved"
                  ? "Saving sends the capstone back to the librarian for review. Students won't see it until it is approved again."
                  : "Saving sends the capstone back to the librarian for review."}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <ProjectForm
              key={editing.id}
              initial={{
                title: editing.title,
                abstract: editing.abstract ?? "",
                categoryId: editing.categoryId,
                adviser: editing.adviser,
                members: editing.members ?? "",
                features: editing.features ?? "",
                research: editing.research ?? "",
                schoolYear: editing.schoolYear,
              }}
              existingFileName={editing.fileName}
              submitLabel={user?.role === "admin" ? "Save Changes" : "Submit for Review"}
              submittingLabel="Saving..."
              onSubmit={async (values, fileData) => {
                await resubmit.mutateAsync({ id: editing.id, ...values, fileData });
                await utils.projects.mine.invalidate();
                await utils.notifications.list.invalidate();
                toast.success(user?.role === "admin" ? "Capstone updated" : "Capstone sent to the librarian for review");
                setEditing(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

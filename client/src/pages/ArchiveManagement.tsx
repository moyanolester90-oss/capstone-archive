import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import {
  Pencil, Trash2, CheckCircle, XCircle, Loader2, BookOpen, Plus,
} from "lucide-react";
import { Link } from "wouter";

export default function ArchiveManagement() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [editingProject, setEditingProject] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectProjectId, setRejectProjectId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);

  const { data: allProjects } = trpc.projects.all.useQuery(undefined, { enabled: user?.role === 'admin' });
  const { data: categories } = trpc.categories.list.useQuery();

  const approveProject = trpc.projects.approve.useMutation({
    onSuccess: () => {
      toast.success("Project approved");
      queryClient.invalidateQueries({ queryKey: [["projects", "all"]] });
      queryClient.invalidateQueries({ queryKey: [["notifications", "list"]] });
      queryClient.invalidateQueries({ queryKey: [["projects", "pending"]] });
      queryClient.invalidateQueries({ queryKey: [["dashboard", "stats"]] });
    },
    onError: (err) => toast.error(err.message || "Failed to approve project"),
  });

  const rejectProject = trpc.projects.reject.useMutation({
    onSuccess: () => {
      toast.success("Project rejected");
      setRejectProjectId(null);
      setRejectionReason("");
      queryClient.invalidateQueries({ queryKey: [["projects", "all"]] });
      queryClient.invalidateQueries({ queryKey: [["notifications", "list"]] });
      queryClient.invalidateQueries({ queryKey: [["projects", "pending"]] });
      queryClient.invalidateQueries({ queryKey: [["dashboard", "stats"]] });
    },
    onError: (err) => toast.error(err.message || "Failed to reject project"),
  });

  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => {
      toast.success("Project updated");
      setEditingProject(null);
      queryClient.invalidateQueries({ queryKey: [["projects", "all"]] });
      queryClient.invalidateQueries({ queryKey: [["notifications", "list"]] });
    },
    onError: (err) => toast.error(err.message || "Failed to update project"),
  });

  const deleteProject = trpc.projects.delete.useMutation({
    onSuccess: () => {
      toast.success("Project deleted");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: [["projects", "all"]] });
      queryClient.invalidateQueries({ queryKey: [["notifications", "list"]] });
      queryClient.invalidateQueries({ queryKey: [["dashboard", "stats"]] });
    },
    onError: (err) => toast.error(err.message || "Failed to delete project"),
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

  const filteredProjects = allProjects?.filter(p => filter === "all" || p.status === filter) || [];

  return (
    <div className="min-h-[calc(100vh-4rem)] py-8">
      <div className="container">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Archive Management</h1>
            <p className="text-muted-foreground">Manage capstone projects</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(["all", "pending", "approved", "rejected"] as const).map(f => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === "pending" && allProjects?.filter(p => p.status === "pending").length ? (
                <Badge variant="secondary" className="ml-1 bg-amber-500/20 text-amber-700">
                  {allProjects.filter(p => p.status === "pending").length}
                </Badge>
              ) : null}
            </Button>
          ))}
        </div>

        {/* Projects List */}
        <div className="space-y-3">
          {filteredProjects.map(project => {
            const cat = categories?.find(c => c.id === project.categoryId);
            return (
              <Card key={project.id} className="hover:shadow-sm transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link href={`/projects/${project.id}`} className="no-underline min-w-0">
                          <h3 className="font-semibold text-foreground truncate hover:text-primary">{project.title}</h3>
                        </Link>
                        <Badge variant={
                          project.status === "approved" ? "default" :
                          project.status === "rejected" ? "destructive" : "secondary"
                        } className="shrink-0">
                          {project.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{project.abstract}</p>
                      {project.status === "rejected" && project.rejectionReason && (
                        <p className="text-xs text-red-600 mt-1">Rejected: {project.rejectionReason}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{cat?.name}</span>
                        <span>{project.adviser}</span>
                        <span>{project.schoolYear}</span>
                        <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {project.status !== "approved" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-green-600 hover:text-green-700"
                          title="Approve"
                          aria-label={`Approve ${project.title}`}
                          disabled={approveProject.isPending}
                          onClick={() => approveProject.mutate({ id: project.id })}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      {project.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          title="Reject"
                          aria-label={`Reject ${project.title}`}
                          onClick={() => { setRejectProjectId(project.id); setRejectionReason(""); }}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Edit"
                        aria-label={`Edit ${project.title}`}
                        onClick={() => setEditingProject(project)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        title="Delete"
                        aria-label={`Delete ${project.title}`}
                        onClick={() => setDeleteTarget({ id: project.id, title: project.title })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filteredProjects.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No projects found</p>
            </div>
          )}
        </div>

        {/* Reject Dialog */}
        <Dialog open={rejectProjectId !== null} onOpenChange={open => { if (!open) { setRejectProjectId(null); setRejectionReason(""); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rejection-reason">Rejection Reason *</Label>
                <Textarea
                  id="rejection-reason"
                  placeholder="Explain what the student needs to fix..."
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">The student will see this reason and can fix and resubmit the project.</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setRejectProjectId(null); setRejectionReason(""); }}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={() => rejectProjectId && rejectProject.mutate({ id: rejectProjectId, reason: rejectionReason })}
                  disabled={!rejectionReason.trim() || rejectProject.isPending}
                >
                  {rejectProject.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Reject
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog open={deleteTarget !== null} onOpenChange={open => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this project?</AlertDialogTitle>
              <AlertDialogDescription>
                "{deleteTarget?.title}" will be permanently removed, together with its uploaded document, bookmarks and download requests. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={(e) => { e.preventDefault(); if (deleteTarget) deleteProject.mutate({ id: deleteTarget.id }); }}
                disabled={deleteProject.isPending}
              >
                {deleteProject.isPending ? "Deleting..." : "Delete Project"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Dialog */}
        {editingProject && (
          <Dialog open={!!editingProject} onOpenChange={() => setEditingProject(null)}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Project</DialogTitle>
              </DialogHeader>
              <EditProjectForm
                project={editingProject}
                categories={categories || []}
                saving={updateProject.isPending}
                onSave={(data) => updateProject.mutate({ id: editingProject.id, ...data })}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

function EditProjectForm({ project, categories, onSave, saving }: {
  project: any; categories: any[]; onSave: (data: any) => void; saving?: boolean;
}) {
  const [title, setTitle] = useState(project.title);
  const [abstract, setAbstract] = useState(project.abstract || "");
  const [categoryId, setCategoryId] = useState(String(project.categoryId));
  const [adviser, setAdviser] = useState(project.adviser);
  const [members, setMembers] = useState(project.members || "");
  const [features, setFeatures] = useState(project.features || "");
  const [research, setResearch] = useState(project.research || "");
  const [schoolYear, setSchoolYear] = useState(project.schoolYear);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Title</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Abstract</Label>
        <Textarea value={abstract} onChange={e => setAbstract(e.target.value)} rows={4} />
      </div>
      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Adviser</Label>
        <Input value={adviser} onChange={e => setAdviser(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Members</Label>
        <Textarea value={members} onChange={e => setMembers(e.target.value)} rows={2} />
      </div>
      <div className="space-y-2">
        <Label>Key Features</Label>
        <Textarea value={features} onChange={e => setFeatures(e.target.value)} rows={2} />
      </div>
      <div className="space-y-2">
        <Label>Research Topic</Label>
        <Textarea value={research} onChange={e => setResearch(e.target.value)} rows={2} />
      </div>
      <div className="space-y-2">
        <Label>School Year</Label>
        <Input value={schoolYear} onChange={e => setSchoolYear(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button disabled={saving} onClick={() => onSave({
          title: title.trim(), abstract: abstract.trim(), categoryId: Number(categoryId), adviser: adviser.trim(),
          members: members.trim(), features, research, schoolYear: schoolYear.trim(),
        })}>{saving ? "Saving..." : "Save Changes"}</Button>
      </div>
    </div>
  );
}

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

  const { data: allProjects } = trpc.projects.all.useQuery(undefined, { enabled: user?.role === 'admin' });
  const { data: categories } = trpc.categories.list.useQuery();

  const approveProject = trpc.projects.approve.useMutation({
    onSuccess: () => {
      toast.success("Project approved");
      queryClient.invalidateQueries({ queryKey: [["projects", "all"]] });
      queryClient.invalidateQueries({ queryKey: [["projects", "pending"]] });
      queryClient.invalidateQueries({ queryKey: [["dashboard", "stats"]] });
    },
    onError: () => toast.error("Failed to approve project"),
  });

  const rejectProject = trpc.projects.reject.useMutation({
    onSuccess: () => {
      toast.success("Project rejected");
      setRejectProjectId(null);
      setRejectionReason("");
      queryClient.invalidateQueries({ queryKey: [["projects", "all"]] });
      queryClient.invalidateQueries({ queryKey: [["projects", "pending"]] });
      queryClient.invalidateQueries({ queryKey: [["dashboard", "stats"]] });
    },
    onError: () => toast.error("Failed to reject project"),
  });

  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => {
      toast.success("Project updated");
      setEditingProject(null);
      queryClient.invalidateQueries({ queryKey: [["projects", "all"]] });
    },
    onError: () => toast.error("Failed to update project"),
  });

  const deleteProject = trpc.projects.delete.useMutation({
    onSuccess: () => {
      toast.success("Project deleted");
      queryClient.invalidateQueries({ queryKey: [["projects", "all"]] });
      queryClient.invalidateQueries({ queryKey: [["dashboard", "stats"]] });
    },
    onError: () => toast.error("Failed to delete project"),
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
        <div className="flex gap-2 mb-6">
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
                        <h3 className="font-semibold text-foreground truncate">{project.title}</h3>
                        <Badge variant={
                          project.status === "approved" ? "default" :
                          project.status === "rejected" ? "destructive" : "secondary"
                        } className="shrink-0">
                          {project.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{project.abstract}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{cat?.name}</span>
                        <span>{project.adviser}</span>
                        <span>{project.schoolYear}</span>
                        <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {project.status === "pending" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600 hover:text-green-700"
                            onClick={() => approveProject.mutate({ id: project.id })}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => setRejectProjectId(project.id)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Reject Project</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label>Rejection Reason *</Label>
                                  <Textarea
                                    placeholder="Provide a reason for rejection..."
                                    value={rejectionReason}
                                    onChange={e => setRejectionReason(e.target.value)}
                                    rows={3}
                                  />
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" onClick={() => { setRejectProjectId(null); setRejectionReason(""); }}>Cancel</Button>
                                  <Button
                                    variant="destructive"
                                    onClick={() => rejectProjectId && rejectProject.mutate({ id: rejectProjectId, reason: rejectionReason })}
                                    disabled={!rejectionReason.trim()}
                                  >
                                    Reject
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingProject(project)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this project?")) {
                            deleteProject.mutate({ id: project.id });
                          }
                        }}
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

        {/* Edit Dialog */}
        {editingProject && (
          <Dialog open={!!editingProject} onOpenChange={() => setEditingProject(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit Project</DialogTitle>
              </DialogHeader>
              <EditProjectForm
                project={editingProject}
                categories={categories || []}
                onSave={(data) => updateProject.mutate({ id: editingProject.id, ...data })}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

function EditProjectForm({ project, categories, onSave }: {
  project: any; categories: any[]; onSave: (data: any) => void;
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
        <Button onClick={() => onSave({
          title, abstract, categoryId: Number(categoryId), adviser, members, features, research, schoolYear,
        })}>Save Changes</Button>
      </div>
    </div>
  );
}

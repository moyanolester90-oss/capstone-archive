import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, Bookmark, Download, User, Calendar, FolderOpen,
  Loader2, BookOpen, Sparkles, FlaskConical, Clock, CheckCircle, AlertCircle, Eye, EyeOff,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import Watermark from "@/components/Watermark";
import ContentProtection from "@/components/ContentProtection";
import PdfViewer from "@/components/PdfViewer";
import { useState } from "react";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const [viewerOpen, setViewerOpen] = useState(false);

  const { data: project, isLoading } = trpc.projects.get.useQuery({ id: projectId });
  const { data: categories } = trpc.categories.list.useQuery();
  const { data: isBookmarked } = trpc.bookmarks.isBookmarked.useQuery(
    { projectId },
    { enabled: isAuthenticated && projectId > 0 }
  );
  const { data: myRequests } = trpc.downloadRequests.myRequests.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  // Only fetched once the viewer is actually opened — this streams the raw
  // PDF bytes server-side (see `projects.viewDocument` in server/routers.ts),
  // which already re-checks approval/ownership itself, so there's no path
  // to the bytes that skips authorization just because the button rendered.
  const { data: viewDoc, isLoading: viewDocLoading, error: viewDocError } = trpc.projects.viewDocument.useQuery(
    { id: projectId },
    { enabled: viewerOpen, staleTime: Infinity, gcTime: 0 }
  );

  const toggleBookmark = trpc.bookmarks.toggle.useMutation({
    onSuccess: (data) => {
      toast.success(data.isBookmarked ? "Added to favorites" : "Removed from favorites");
      utils.bookmarks.list.invalidate();
      utils.bookmarks.isBookmarked.invalidate({ projectId });
    },
    onError: (err) => toast.error(err.message || "Failed to update bookmark"),
  });

  const createDownloadReq = trpc.downloadRequests.create.useMutation({
    onSuccess: () => {
      toast.success("Download request submitted. Please wait for Admin approval.");
      utils.downloadRequests.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to submit download request"),
  });

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-4">
        <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Project Not Found</h2>
        <p className="text-muted-foreground mb-4">This project may not exist or hasn't been approved yet.</p>
        <Link href="/browse"><Button>Back to Browse</Button></Link>
      </div>
    );
  }

  const category = categories?.find(c => c.id === project.categoryId);
  const existingRequest = myRequests?.find(r => r.projectId === projectId);
  const hasDownloadAccess = existingRequest?.status === 'approved';
  const isOwner = user?.id === project.uploadedBy;
  const isAdmin = user?.role === 'admin';
  // Students only ever get view-only access in the in-app viewer, never the
  // original file — advisers request an actual download of it (see the
  // "View & Download Requests" admin page's own description of the
  // distinction) — so the student-facing copy below says "View" instead of
  // "Download" to describe what they're actually asking for and will get.
  const isStudent = user?.role === 'student';

  const handleDownload = () => {
    if (!project.fileUrl) return;
    // Use window.open or a temporary link to trigger download while keeping it slightly less obvious
    const link = document.createElement('a');
    link.href = project.fileUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    // We don't append to body to avoid it showing up in DOM for long
    link.click();
    toast.info("Preparing download...");
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] py-8">
      <div className="container max-w-4xl">
        <ContentProtection projectId={projectId} enabled={!isAdmin && !isOwner}>
        <Watermark>
        <Link href="/browse" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 no-underline">
          <ArrowLeft className="h-4 w-4" /> Back to Browse
        </Link>

        <Card>
          <CardContent className="p-6 md:p-8">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">{project.title}</h1>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-tighter border-primary/30 text-primary/70">Protected</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    {category?.name || "Uncategorized"}
                  </Badge>
                  <Badge variant="outline">{project.schoolYear}</Badge>
                  <Badge variant="outline">{project.status}</Badge>
                </div>
              </div>
              {isAuthenticated && project.status === 'approved' && (
                <Button
                  variant={isBookmarked ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleBookmark.mutate({ projectId })}
                  className="gap-1.5"
                >
                  <Bookmark className={`h-4 w-4 ${isBookmarked ? "fill-current" : ""}`} />
                  {isBookmarked ? "Saved" : "Save"}
                </Button>
              )}
            </div>

            {project.status !== 'approved' && (
              <div className={`mb-6 rounded-lg border p-3 text-sm ${project.status === 'rejected' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                {project.status === 'rejected'
                  ? <>This project was not approved.{project.rejectionReason ? ` Reason: ${project.rejectionReason}` : ''} {isOwner && <Link href="/my-submissions" className="underline font-medium">Fix &amp; resubmit</Link>}</>
                  : <>This project is waiting for admin review and is not visible to other students yet.</>}
              </div>
            )}

            {/* Meta */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 rounded-lg bg-muted/50">
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Adviser</span>
                <p className="font-medium text-foreground flex items-center gap-1 mt-1">
                  <User className="h-4 w-4 text-primary" /> {project.adviser}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">School Year</span>
                <p className="font-medium text-foreground flex items-center gap-1 mt-1">
                  <Calendar className="h-4 w-4 text-primary" /> {project.schoolYear}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Uploaded</span>
                <p className="font-medium text-foreground mt-1">
                  {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Features */}
            {project.features && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Key Features</h3>
                <p className="text-foreground whitespace-pre-wrap flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{project.features}</span>
                </p>
              </div>
            )}

            {/* Research */}
            {project.research && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Research Topic</h3>
                <p className="text-foreground whitespace-pre-wrap flex items-start gap-2">
                  <FlaskConical className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{project.research}</span>
                </p>
              </div>
            )}

            {/* Members */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Team Members</h3>
              <p className="text-foreground whitespace-pre-wrap">{project.members}</p>
            </div>

            {/* Abstract */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Abstract</h3>
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">{project.abstract}</p>
            </div>

            {/* File / Download */}
            {project.hasDocument && (
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Document Attachment</h3>
                  {(hasDownloadAccess || isOwner || isAdmin) && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Authorized Access</span>
                  )}
                </div>
                {hasDownloadAccess || isOwner || isAdmin ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {project.fileUrl && (
                        <Button className="gap-2" onClick={handleDownload}>
                          <Download className="h-4 w-4" />
                          Download {project.fileName || 'Document'}
                        </Button>
                      )}
                      {project.fileType === 'application/pdf' && (
                        <Button
                          variant="outline"
                          className="gap-2"
                          onClick={() => setViewerOpen(v => !v)}
                        >
                          {viewerOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          {viewerOpen ? 'Hide Preview' : 'View in Browser'}
                        </Button>
                      )}
                    </div>

                    {viewerOpen && (
                      <div>
                        {viewDocLoading && (
                          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground border rounded-lg bg-muted/30">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="text-sm">Preparing protected preview…</span>
                          </div>
                        )}
                        {viewDocError && !viewDocLoading && (
                          <div className="flex items-center gap-2 py-6 px-4 text-sm text-destructive border rounded-lg bg-destructive/5">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {viewDocError.message || 'Could not load this document.'}
                          </div>
                        )}
                        {viewDoc && !viewDocLoading && (
                          <PdfViewer base64={viewDoc.base64} fileName={viewDoc.fileName ?? undefined} />
                        )}
                      </div>
                    )}
                  </div>
                ) : !isAuthenticated ? (
                  <p className="text-sm text-muted-foreground">
                    Please login to request {isStudent ? 'view' : 'download'} access.
                  </p>
                ) : existingRequest?.status === 'pending' ? (
                  <div className="space-y-2">
                    <Button variant="outline" disabled className="gap-2 opacity-70">
                      <Clock className="h-4 w-4 text-amber-500" />
                      Pending Approval
                    </Button>
                    <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {isStudent ? 'View request' : 'Download request'} submitted. Please wait for Admin approval.
                    </p>
                  </div>
                ) : existingRequest?.status === 'rejected' ? (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => createDownloadReq.mutate({ projectId })}
                      disabled={createDownloadReq.isPending}
                    >
                      {createDownloadReq.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      Request Again
                    </Button>
                    <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {isStudent ? 'View request' : 'Download request'} rejected.{existingRequest.adminNote ? ` Reason: ${existingRequest.adminNote}` : ''}
                    </p>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => createDownloadReq.mutate({ projectId })}
                    disabled={createDownloadReq.isPending}
                  >
                    {createDownloadReq.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {isStudent ? 'Request to View' : 'Request Download'}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        </Watermark>
        </ContentProtection>
      </div>
    </div>
  );
}

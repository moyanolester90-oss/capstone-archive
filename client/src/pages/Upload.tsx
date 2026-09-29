import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Loader2, LogIn } from "lucide-react";
import ProjectForm from "@/components/ProjectForm";

export default function UploadPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const createProject = trpc.projects.create.useMutation();

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Login Required</CardTitle>
            <CardDescription>Please login to upload capstone projects.</CardDescription>
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


  if (user?.role !== 'admin' && user?.role !== 'adviser') {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
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

  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-[calc(100vh-4rem)] py-8">
      <div className="container max-w-2xl">
        <h1 className="text-3xl font-bold text-foreground mb-2">Upload Capstone Project</h1>
        <p className="text-muted-foreground mb-8">
          {isAdmin
            ? <>Projects you upload as librarian are published to students right away.</>
            : <>Submit a capstone for the librarian to review. You can follow its status under <strong>My Uploads</strong>.</>}
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>Fill in all required fields and attach your document.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProjectForm
              submitLabel="Submit Project for Review"
              onSubmit={async (values, fileData) => {
                const result = await createProject.mutateAsync({ ...values, fileData });
                await utils.projects.mine.invalidate();
                toast.success(result.status === "approved" ? "Project published!" : "Project submitted for review!");
                navigate("/my-submissions");
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Bookmark, BookOpen, Star, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Watermark from "@/components/Watermark";

export default function Bookmarks() {
  const { isAuthenticated } = useAuth();

  const { data: projects, isLoading } = trpc.bookmarks.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">Please login to view your bookmarks.</p>
            <Link href="/login"><Button>Login</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] py-8">
      <div className="container max-w-4xl">
        <Watermark>
        <h1 className="text-3xl font-bold text-foreground mb-2">My Favorites</h1>
        <p className="text-muted-foreground mb-8">Your bookmarked capstone projects</p>

        {isLoading ? (
          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="grid gap-4">
            {projects.map(project => (
              <Link key={project.id} href={`/projects/${project.id}`} className="no-underline">
                <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                        <Star className="h-5 w-5 text-accent fill-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{project.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{project.abstract}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{project.adviser}</span>
                          <span>{project.schoolYear}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Bookmark className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No bookmarks yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Save your favorite projects for quick access.</p>
            <Link href="/browse"><Button>Browse Projects</Button></Link>
          </div>
        )}
        </Watermark>
      </div>
    </div>
  );
}

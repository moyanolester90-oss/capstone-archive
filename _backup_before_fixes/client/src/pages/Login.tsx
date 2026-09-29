import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { startLogin } from "@/const";
import { GraduationCap, Shield, Search } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function Login() {
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  const redirectPath = user?.role === 'admin' ? '/dashboard' : '/browse';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectPath);
    }
  }, [isAuthenticated, navigate, redirectPath]);

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-muted/20">
      <Card className="w-full max-w-md shadow-xl border-border/50 backdrop-blur-sm">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner">
              <GraduationCap className="h-9 w-9 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Sign in to Capstone Archive Management System
          </CardTitle>
          <CardDescription className="text-sm mt-2 text-muted-foreground">
            Use your Google account to access capstone projects and research archives
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <Button
            className="w-full h-12 text-base font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center bg-white text-gray-800 hover:bg-gray-50 border border-gray-300 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800 dark:border-gray-700"
            size="lg"
            onClick={() => startLogin()}
          >
            <svg className="h-5 w-5 mr-3 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground font-medium">System Features</span>
            </div>
          </div>

          <div className="space-y-3 rounded-lg bg-muted/40 p-3.5 text-xs text-muted-foreground border border-border/30">
            <div className="flex items-center gap-2.5">
              <Search className="h-4 w-4 text-primary shrink-0" />
              <span>Search and browse approved capstone projects</span>
            </div>
            <div className="flex items-center gap-2.5">
              <GraduationCap className="h-4 w-4 text-primary shrink-0" />
              <span>Upload projects with PDF preview & admin download approval</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Shield className="h-4 w-4 text-primary shrink-0" />
              <span>Personalized user watermark and role-based access control</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


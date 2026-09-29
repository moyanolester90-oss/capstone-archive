import AuthBackground from "@/components/AuthBackground";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import type { LoginPortal } from "@shared/const";
import { TRPCClientError } from "@trpc/client";
import { AlertCircle, BookUser, Check, GraduationCap, Library, Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";

const PORTALS: Record<LoginPortal, { label: string; title: string; icon: typeof GraduationCap; can: string[] }> = {
  student: {
    label: "Student",
    title: "Student Login",
    icon: GraduationCap,
    can: ["Browse and search approved capstones", "Save favorites", "Request view access"],
  },
  adviser: {
    label: "Adviser",
    title: "Capstone Adviser Login",
    icon: BookUser,
    can: ["Upload capstones for review", "Update the capstones you uploaded", "Track approval status"],
  },
  admin: {
    label: "Librarian",
    title: "Librarian / Admin Login",
    icon: Library,
    can: ["Approve, edit and delete capstones", "Scan hard copies into PDF", "Manage users and view requests"],
  },
};

/** Strips everything but digits, so School ID fields can only ever hold numbers. */
const digitsOnly = (value: string) => value.replace(/\D/g, "");

export default function Login() {
  const { isAuthenticated, refresh } = useAuth();
  const [, navigate] = useLocation();
  const redirectPath = '/dashboard';
  const params = new URLSearchParams(window.location.search);
  const [portal, setPortal] = useState<LoginPortal>(() => {
    const p = params.get("portal");
    return p === "adviser" || p === "admin" ? p : "student";
  });
  const [schoolId, setSchoolId] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await refresh();
      navigate(redirectPath);
    },
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectPath);
    }
  }, [isAuthenticated, navigate, redirectPath]);

  useEffect(() => {
    // Switching tabs clears any error from the previous portal's attempt.
    loginMutation.reset();
  }, [portal]);

  if (isAuthenticated) {
    return null;
  }

  const errorMessage = loginMutation.error
    ? loginMutation.error instanceof TRPCClientError
      ? loginMutation.error.message
      : "Sign-in failed. Please try again."
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ schoolId: schoolId.trim(), password, portal });
  };

  return (
    <AuthBackground>
      <Card className="w-full max-w-md shadow-xl border-border/50 backdrop-blur-sm bg-card/95">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Sign in to the Capstone Archive
          </CardTitle>
          <CardDescription className="text-sm mt-1 text-muted-foreground">Choose your role</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-2">
          {errorMessage && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <Tabs value={portal} onValueChange={v => setPortal(v as LoginPortal)}>
            <TabsList className="grid w-full grid-cols-3">
              {(Object.keys(PORTALS) as LoginPortal[]).map(p => (
                <TabsTrigger key={p} value={p}>{PORTALS[p].label}</TabsTrigger>
              ))}
            </TabsList>

            {(Object.keys(PORTALS) as LoginPortal[]).map(p => {
              const info = PORTALS[p];
              const Icon = info.icon;
              return (
                <TabsContent key={p} value={p} className="space-y-4 pt-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-foreground">{info.title}</h2>
                      <ul className="text-xs text-muted-foreground space-y-0.5 mt-1">
                        {info.can.map(c => <li key={c} className="flex items-center gap-1.5"><Check className="h-3 w-3 text-primary" />{c}</li>)}
                      </ul>
                    </div>
                  </div>

                  <form className="space-y-3" onSubmit={handleSubmit}>
                    <div className="space-y-1.5">
                      <Label htmlFor={`schoolId-${p}`}>School ID Number</Label>
                      <Input
                        id={`schoolId-${p}`}
                        required
                        autoComplete="username"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={schoolId}
                        onChange={e => setSchoolId(digitsOnly(e.target.value))}
                        placeholder="e.g. 202400123"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`password-${p}`}>Password</Label>
                      <Input
                        id={`password-${p}`}
                        type="password"
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                      />
                    </div>
                    <Button type="submit" className="w-full h-11" disabled={loginMutation.isPending}>
                      {loginMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Sign in as ${info.label}`}
                    </Button>
                  </form>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          Don&apos;t have an account?&nbsp;<Link href={`/signup?portal=${portal}`} className="font-medium text-primary hover:underline">Sign up</Link>
        </CardFooter>
      </Card>
    </AuthBackground>
  );
}

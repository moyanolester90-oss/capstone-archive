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
import { AlertCircle, ArrowRight, BookUser, Check, Eye, EyeOff, GraduationCap, KeyRound, Library, Loader2, UserCircle2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useSecretReveal } from "@/hooks/useSecretReveal";

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
    can: ["Approve, edit and delete capstones", "Convert hard copies into PDF", "Manage users and view requests"],
  },
};

/** Strips everything but digits, so School ID fields can only ever hold numbers. */
const digitsOnly = (value: string) => value.replace(/\D/g, "");

export default function Login() {
  const { isAuthenticated, refresh } = useAuth();
  const [, navigate] = useLocation();
  const redirectPath = '/dashboard';
  const params = new URLSearchParams(window.location.search);
  // Only Student shows by default. Pressing Ctrl+Q switches to staff-only
  // mode: Student is hidden and only Adviser / Librarian remain (see
  // useSecretReveal). Pressing it again switches back to Student-only.
  const staffRevealed = useSecretReveal();
  const [portal, setPortal] = useState<LoginPortal>(() => {
    const p = params.get("portal");
    return p === "adviser" || p === "admin" ? p : "student";
  });
  const [schoolId, setSchoolId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showTempPassword, setShowTempPassword] = useState(false);
  const visiblePortals = (Object.keys(PORTALS) as LoginPortal[]).filter(p => (p === "student") !== staffRevealed);

  // Debounce the School ID before checking for a waiting temporary
  // password, so this doesn't fire a request on every keystroke.
  const [debouncedSchoolId, setDebouncedSchoolId] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSchoolId(schoolId), 400);
    return () => clearTimeout(t);
  }, [schoolId]);
  // Collapse the reveal and drop the stale result the instant the School ID
  // changes again, rather than leaving a previous person's password exposed.
  useEffect(() => {
    setShowTempPassword(false);
  }, [schoolId]);

  const { data: tempPasswordCheck } = trpc.passwordResets.checkTemporary.useQuery(
    { schoolId: debouncedSchoolId },
    { enabled: debouncedSchoolId.length > 0, refetchOnWindowFocus: false, staleTime: 0 }
  );

  // Keep the selected tab in sync with which set is currently visible: fall
  // back to Student when staff mode turns off, and to the first staff portal
  // when it turns on, rather than leaving a hidden portal silently selected.
  useEffect(() => {
    if (!visiblePortals.includes(portal)) {
      setPortal(visiblePortals[0] ?? "student");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffRevealed]);

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
      <Card className="w-full max-w-md shadow-2xl border-white/40 bg-card/95 backdrop-blur-md py-0 overflow-hidden">
        <CardHeader className="text-center pt-8 pb-2">
          <div className="mx-auto mb-3 h-20 w-20 rounded-full ring-4 ring-[#c9a227]/70 shadow-lg overflow-hidden">
            <img src="/logo.jpg" alt="Golden West Colleges seal" className="h-full w-full object-cover" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Sign in to the Capstone Archive
          </CardTitle>
          <CardDescription className="text-sm mt-1 text-muted-foreground">Choose your role to continue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-4 pb-8">
          {errorMessage && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <Tabs value={portal} onValueChange={v => setPortal(v as LoginPortal)}>
            <TabsList
              className="grid w-full h-auto bg-muted/70 p-1.5 rounded-xl gap-1"
              style={{ gridTemplateColumns: `repeat(${visiblePortals.length}, minmax(0, 1fr))` }}
            >
              {visiblePortals.map(p => {
                const Icon = PORTALS[p].icon;
                return (
                  <TabsTrigger
                    key={p}
                    value={p}
                    className="flex-col gap-1 h-auto py-2.5 rounded-lg text-muted-foreground data-[state=active]:bg-[#1a3a6b] data-[state=active]:text-white data-[state=active]:shadow-md"
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-semibold">{PORTALS[p].label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {staffRevealed && (
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Staff-only mode. Press <kbd className="px-1 py-0.5 rounded border bg-muted font-mono">Ctrl</kbd>+<kbd className="px-1 py-0.5 rounded border bg-muted font-mono">Q</kbd> to show Student sign-in again.
              </p>
            )}

            {visiblePortals.map(p => {
              const info = PORTALS[p];
              const Icon = info.icon;
              return (
                <TabsContent key={p} value={p} className="space-y-4 pt-4">
                  <div className="flex items-center gap-3 rounded-xl bg-[#1a3a6b]/5 border border-[#1a3a6b]/10 p-3">
                    <div className="h-11 w-11 rounded-lg bg-[#1a3a6b] flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-foreground text-sm">{info.title}</h2>
                      <ul className="text-xs text-muted-foreground space-y-0.5 mt-1">
                        {info.can.map(c => <li key={c} className="flex items-center gap-1.5"><Check className="h-3 w-3 text-[#c9a227]" />{c}</li>)}
                      </ul>
                    </div>
                  </div>

                  <form className="space-y-3" onSubmit={handleSubmit}>
                    <div className="space-y-1.5">
                      <Label htmlFor={`schoolId-${p}`}>School ID Number</Label>
                      <div className="relative">
                        <UserCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id={`schoolId-${p}`}
                          required
                          autoComplete="username"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={schoolId}
                          onChange={e => setSchoolId(digitsOnly(e.target.value))}
                          placeholder="e.g. 202400123"
                          className="pl-9"
                        />
                      </div>
                    </div>

                    {tempPasswordCheck?.available && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 space-y-1.5">
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                          <KeyRound className="h-3.5 w-3.5" /> Temporary Password
                        </p>
                        <div className="flex items-center gap-2 rounded-md border border-amber-300/60 bg-white/70 dark:bg-black/20 px-2.5 py-1.5">
                          <code className="flex-1 text-sm font-mono tracking-wide text-amber-900 dark:text-amber-200">
                            {showTempPassword ? tempPasswordCheck.temporaryPassword : "•".repeat(tempPasswordCheck.temporaryPassword.length)}
                          </code>
                          <button
                            type="button"
                            onClick={() => setShowTempPassword(v => !v)}
                            className="text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200"
                            aria-label={showTempPassword ? "Hide temporary password" : "Show temporary password"}
                            tabIndex={-1}
                          >
                            {showTempPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                          Your password reset was approved. Enter this as your password below to sign in, then you'll be asked to create a new one.
                        </p>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`password-${p}`}>Password</Label>
                        <Link
                          href={`/forgot-password?schoolId=${encodeURIComponent(schoolId)}`}
                          className="text-xs font-medium text-[#1a3a6b] hover:underline"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id={`password-${p}`}
                          type={showPassword ? "text" : "password"}
                          required
                          autoComplete="current-password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          className="pl-9 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(v => !v)}
                          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-11 gap-2 bg-[#1a3a6b] hover:bg-[#153059] text-white"
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                        <>
                          Sign in as {info.label}
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </form>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground bg-muted/40 py-4 border-t">
          Don&apos;t have an account?&nbsp;<Link href={`/signup?portal=${portal}`} className="font-medium text-[#1a3a6b] hover:underline">Sign up</Link>
        </CardFooter>
      </Card>
    </AuthBackground>
  );
}

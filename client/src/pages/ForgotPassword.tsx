import { useState } from "react";
import AuthBackground from "@/components/AuthBackground";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CheckCircle2, KeyRound, Loader2, UserCircle2 } from "lucide-react";
import { Link } from "wouter";

/** Strips everything but digits, so School ID fields can only ever hold numbers. */
const digitsOnly = (value: string) => value.replace(/\D/g, "");

/**
 * "Forgot Password?" request form for every portal (Student, Adviser,
 * Librarian/Admin). No account has a verified email on file, so there is no
 * link or code to send — submitting here files a request that an admin
 * reviews from their dashboard and approves with a one-time temporary
 * password. See drizzle/schema.ts
 * (`passwordResetRequests`) for the full design rationale.
 */
export default function ForgotPassword() {
  const params = new URLSearchParams(window.location.search);
  const [schoolId, setSchoolId] = useState(() => digitsOnly(params.get("schoolId") || ""));
  const [submitted, setSubmitted] = useState(false);

  const requestReset = trpc.passwordResets.request.useMutation({
    onSuccess: () => setSubmitted(true),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    requestReset.mutate({ schoolId: schoolId.trim() });
  };

  return (
    <AuthBackground>
      <Card className="w-full max-w-md shadow-2xl border-white/40 bg-card/95 backdrop-blur-md py-0 overflow-hidden">
        <CardHeader className="text-center pt-8 pb-2">
          <div className="mx-auto mb-3 h-16 w-16 rounded-full bg-[#1a3a6b]/10 flex items-center justify-center">
            <KeyRound className="h-7 w-7 text-[#1a3a6b]" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Forgot your password?
          </CardTitle>
          <CardDescription className="text-sm mt-1 text-muted-foreground">
            Enter your School ID and we'll send your request to the librarian for review.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-4 pb-8">
          {submitted ? (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
              <p className="text-sm text-foreground font-medium">Request submitted</p>
              <p className="text-sm text-muted-foreground">
                If that School ID has an account, your request has been sent for admin/adviser review.
                You'll be given a temporary password to sign in with once it's approved — ask your
                librarian or adviser directly if you need it sooner.
              </p>
              <Link href="/login" className="w-full">
                <Button className="w-full mt-2 gap-2 bg-[#1a3a6b] hover:bg-[#153059] text-white">
                  Back to Login <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="forgot-schoolId">School ID Number</Label>
                <div className="relative">
                  <UserCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="forgot-schoolId"
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
                <p className="text-xs text-muted-foreground">
                  Works for Student, Adviser, and Librarian/Admin accounts.
                </p>
              </div>
              <Button
                type="submit"
                className="w-full h-11 gap-2 bg-[#1a3a6b] hover:bg-[#153059] text-white"
                disabled={requestReset.isPending || !schoolId.trim()}
              >
                {requestReset.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <>
                    Submit Request
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground bg-muted/40 py-4 border-t">
          Remembered your password?&nbsp;<Link href="/login" className="font-medium text-[#1a3a6b] hover:underline">Back to Login</Link>
        </CardFooter>
      </Card>
    </AuthBackground>
  );
}

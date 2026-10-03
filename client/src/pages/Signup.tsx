import AuthBackground from "@/components/AuthBackground";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { AlertCircle, BookUser, CheckCircle2, Eye, EyeOff, GraduationCap, Library, Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { PASSWORD_MIN_LENGTH, PASSWORD_PATTERN, YEAR_LEVELS } from "@shared/validation";
import { cn } from "@/lib/utils";
import { useSecretReveal } from "@/hooks/useSecretReveal";

type SignupTab = "student" | "staff";
type StaffRole = "adviser" | "admin";

/** Strips everything but digits, so School ID fields can only ever hold numbers. */
const digitsOnly = (value: string) => value.replace(/\D/g, "");
/** Strips everything but letters and spaces (collapsing repeats), so Name fields reject numbers/symbols. */
const lettersAndSpacesOnly = (value: string) => value.replace(/[^A-Za-z ]/g, "").replace(/ {2,}/g, " ");

/** A password field with a "Show password" eye toggle, plus an optional strength hint. */
function PasswordField({
  id, label, value, onChange, autoComplete, showHint,
}: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string; showHint?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          required
          minLength={PASSWORD_MIN_LENGTH}
          autoComplete={autoComplete}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
          aria-label={visible ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {showHint && (
        <p className={cn("text-xs", value && !PASSWORD_PATTERN.test(value) ? "text-amber-600 dark:text-amber-500" : "text-muted-foreground")}>
          At least {PASSWORD_MIN_LENGTH} characters, with an uppercase letter, a lowercase letter, and a special character (e.g. Passw0rd!)
        </p>
      )}
    </div>
  );
}

export default function Signup() {
  const { isAuthenticated, refresh } = useAuth();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  // Student sign-up shows by default. Pressing Ctrl+Q (same shortcut used on
  // the Login page) switches to staff-only mode: Student is hidden and only
  // the "Adviser / Librarian" tab remains. Pressing it again switches back.
  const staffRevealed = useSecretReveal();
  const [tab, setTab] = useState<SignupTab>(() => (params.get("portal") === "student" ? "student" : params.get("portal") === "adviser" || params.get("portal") === "admin" ? "staff" : "student"));
  const [staffRole, setStaffRole] = useState<StaffRole>(() => (params.get("portal") === "admin" ? "admin" : "adviser"));

  // Keep the selected tab in sync with which one is currently visible: fall
  // back to Student when staff mode turns off, and to Staff when it turns on.
  useEffect(() => {
    setTab(staffRevealed ? "staff" : "student");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffRevealed]);

  // Student fields
  const [studentId, setStudentId] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [studentConfirm, setStudentConfirm] = useState("");
  const [studentName, setStudentName] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [section, setSection] = useState("");

  // Adviser/Librarian fields
  const [staffId, setStaffId] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffConfirm, setStaffConfirm] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");

  const [formError, setFormError] = useState<string | null>(null);
  // Set once an in-flight availability check finds a match, so submit can be
  // blocked before even hitting the server — the mutation itself still runs
  // the authoritative check (see checkAvailability's own doc comment).
  const [studentTaken, setStudentTaken] = useState(false);
  const [staffTaken, setStaffTaken] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard");
  }, [isAuthenticated, navigate]);

  const onDone = async () => {
    await refresh();
    navigate("/dashboard");
  };

  // A Student sign-up that comes back `pending` was NOT signed in (the
  // account needs librarian approval first) — show a confirmation instead
  // of redirecting to the dashboard as if they were logged in.
  const [studentPending, setStudentPending] = useState(false);

  const signupStudent = trpc.auth.signupStudent.useMutation({
    onSuccess: (data) => {
      if (data.pending) {
        setStudentPending(true);
      } else {
        onDone();
      }
    },
  });
  const signupStaff = trpc.auth.signupStaff.useMutation({
    onSuccess: () => onDone(),
  });

  const utils = trpc.useUtils();
  /** Debounced "does this School ID / Name already exist?" check, called as the person types. */
  function useAvailabilityCheck(schoolId: string, name: string, setTaken: (v: boolean) => void) {
    useEffect(() => {
      const schoolIdReady = schoolId.trim().length >= 3;
      const nameReady = name.trim().length >= 2;
      if (!schoolIdReady && !nameReady) {
        setTaken(false);
        return;
      }
      const timer = setTimeout(() => {
        utils.auth.checkAvailability
          .fetch({ schoolId: schoolIdReady ? schoolId.trim() : undefined, name: nameReady ? name.trim() : undefined })
          .then(res => setTaken(!res.available))
          .catch(() => {});
      }, 400);
      return () => clearTimeout(timer);
    }, [schoolId, name]);
  }
  useAvailabilityCheck(studentId, studentName, setStudentTaken);
  useAvailabilityCheck(staffId, staffName, setStaffTaken);

  if (isAuthenticated) return null;

  const mutationError = (m: typeof signupStudent | typeof signupStaff) =>
    m.error instanceof TRPCClientError ? m.error.message : m.error ? "Sign-up failed. Please try again." : null;

  const errorMessage =
    formError
    ?? mutationError(signupStudent)
    ?? mutationError(signupStaff)
    ?? ((tab === "student" && studentTaken) || (tab === "staff" && staffTaken) ? "You have an existing account." : null);

  const submitStudent = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (studentTaken) {
      setFormError("You have an existing account.");
      return;
    }
    if (!yearLevel) {
      setFormError("Please select your Year Level.");
      return;
    }
    if (!section.trim()) {
      setFormError("Please enter your Section.");
      return;
    }
    if (!PASSWORD_PATTERN.test(studentPassword)) {
      setFormError("Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a special character.");
      return;
    }
    if (studentPassword !== studentConfirm) {
      setFormError("Passwords do not match.");
      return;
    }
    signupStudent.mutate({
      schoolId: studentId.trim(),
      password: studentPassword,
      name: studentName.trim(),
      yearSection: `${yearLevel} - ${section.trim()}`,
    });
  };

  const submitStaff = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (staffTaken) {
      setFormError("You have an existing account.");
      return;
    }
    if (!PASSWORD_PATTERN.test(staffPassword)) {
      setFormError("Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a special character.");
      return;
    }
    if (staffPassword !== staffConfirm) {
      setFormError("Passwords do not match.");
      return;
    }
    signupStaff.mutate({
      schoolId: staffId.trim(),
      password: staffPassword,
      name: staffName.trim(),
      email: staffEmail.trim(),
      role: staffRole,
    });
  };

  return (
    <AuthBackground>
      <Card className="w-full max-w-md shadow-xl border-border/50 backdrop-blur-sm bg-card/95">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Create your account
          </CardTitle>
          <CardDescription className="text-sm mt-1 text-muted-foreground">
            Golden West Colleges, Inc. — Capstone Archive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-2">
          {errorMessage && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <Tabs value={tab} onValueChange={v => { setTab(v as SignupTab); setFormError(null); }}>
            <TabsList className="grid w-full grid-cols-1">
              {staffRevealed ? (
                <TabsTrigger value="staff"><Library className="h-4 w-4 mr-1.5" />Adviser / Librarian</TabsTrigger>
              ) : (
                <TabsTrigger value="student"><GraduationCap className="h-4 w-4 mr-1.5" />Student</TabsTrigger>
              )}
            </TabsList>
            {staffRevealed && (
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Staff-only mode. Press <kbd className="px-1 py-0.5 rounded border bg-muted font-mono">Ctrl</kbd>+<kbd className="px-1 py-0.5 rounded border bg-muted font-mono">Q</kbd> to show Student sign-up again.
              </p>
            )}

            {!staffRevealed && (
            <TabsContent value="student" className="pt-3">
              {studentPending ? (
                <div className="flex flex-col items-center text-center gap-3 py-6">
                  <CheckCircle2 className="h-10 w-10 text-success" />
                  <p className="font-medium text-foreground">Account created — awaiting approval</p>
                  <p className="text-sm text-muted-foreground">
                    Your Student account has been created. A librarian needs to approve it before you can sign in — please check back later.
                  </p>
                  <Link href="/login" className="text-sm font-medium text-primary hover:underline">Back to Sign in</Link>
                </div>
              ) : (
              <form className="space-y-3" onSubmit={submitStudent}>
                <div className="space-y-1.5">
                  <Label htmlFor="student-id">School ID Number</Label>
                  <Input
                    id="student-id" required autoComplete="username" inputMode="numeric" pattern="[0-9]*"
                    value={studentId} onChange={e => setStudentId(digitsOnly(e.target.value))}
                    placeholder="e.g. 202400123"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="student-name">Name</Label>
                  <Input
                    id="student-name" required autoComplete="name"
                    value={studentName} onChange={e => setStudentName(lettersAndSpacesOnly(e.target.value))}
                    placeholder="Juan Dela Cruz"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="student-year-level">Year Level</Label>
                  <Select value={yearLevel} onValueChange={setYearLevel}>
                    <SelectTrigger id="student-year-level">
                      <SelectValue placeholder="Select your year level" />
                    </SelectTrigger>
                    <SelectContent>
                      {YEAR_LEVELS.map(level => (
                        <SelectItem key={level} value={level}>{level}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="student-section">Section</Label>
                  <Input id="student-section" required value={section} onChange={e => setSection(e.target.value)} placeholder="e.g. BSIT 401" />
                </div>
                <PasswordField id="student-password" label="Password" autoComplete="new-password" value={studentPassword} onChange={setStudentPassword} showHint />
                <PasswordField id="student-confirm" label="Confirm Password" autoComplete="new-password" value={studentConfirm} onChange={setStudentConfirm} />
                <Button type="submit" className="w-full h-11" disabled={signupStudent.isPending || studentTaken}>
                  {signupStudent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Student Account"}
                </Button>
              </form>
              )}
            </TabsContent>
            )}

            {staffRevealed && (
            <TabsContent value="staff" className="pt-3">
              <form className="space-y-3" onSubmit={submitStaff}>
                <div className="space-y-1.5">
                  <Label>I am signing up as</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setStaffRole("adviser")}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                        staffRole === "adviser" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <BookUser className="h-4 w-4" /> Capstone Adviser
                    </button>
                    <button
                      type="button"
                      onClick={() => setStaffRole("admin")}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                        staffRole === "admin" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <Library className="h-4 w-4" /> Librarian / Admin
                    </button>
                  </div>
                  {staffRole === "admin" && (
                    <p className="text-xs text-muted-foreground">
                      This creates a full Librarian/Admin account with access to approve capstones and manage users.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="staff-id">School ID Number</Label>
                  <Input
                    id="staff-id" required autoComplete="username" inputMode="numeric" pattern="[0-9]*"
                    value={staffId} onChange={e => setStaffId(digitsOnly(e.target.value))}
                    placeholder="e.g. 100045"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="staff-name">Name</Label>
                  <Input
                    id="staff-name" required autoComplete="name"
                    value={staffName} onChange={e => setStaffName(lettersAndSpacesOnly(e.target.value))}
                    placeholder="Maria Santos"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="staff-email">Email for school use</Label>
                  <Input id="staff-email" type="email" required autoComplete="email" value={staffEmail} onChange={e => setStaffEmail(e.target.value)} placeholder="e.g. lib@gwc.edu.ph" />
                </div>
                <PasswordField id="staff-password" label="Password" autoComplete="new-password" value={staffPassword} onChange={setStaffPassword} showHint />
                <PasswordField id="staff-confirm" label="Confirm Password" autoComplete="new-password" value={staffConfirm} onChange={setStaffConfirm} />
                <Button type="submit" className="w-full h-11" disabled={signupStaff.isPending || staffTaken}>
                  {signupStaff.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Create ${staffRole === "admin" ? "Librarian" : "Adviser"} Account`}
                </Button>
              </form>
            </TabsContent>
            )}
          </Tabs>
        </CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          Already have an account?&nbsp;<Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link>
        </CardFooter>
      </Card>
    </AuthBackground>
  );
}

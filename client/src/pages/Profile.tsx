import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { Eye, EyeOff, Loader2, UserCircle, KeyRound } from "lucide-react";
import { PASSWORD_MIN_LENGTH, PASSWORD_PATTERN, NAME_PATTERN } from "@shared/validation";

const ROLE_LABELS: Record<string, string> = { student: "Student", adviser: "Adviser", admin: "Admin/Librarian" };

/** Strips everything but letters and spaces (collapsing repeats). */
const lettersAndSpacesOnly = (value: string) => value.replace(/[^A-Za-z ]/g, "").replace(/ {2,}/g, " ");

function PasswordInput({
  id, label, value, onChange, autoComplete,
}: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          required
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
    </div>
  );
}

export default function Profile() {
  const { user, isAuthenticated, refresh } = useAuth();
  const utils = trpc.useUtils();

  const [name, setName] = useState(user?.name ?? "");
  const [nameError, setNameError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const updateName = trpc.auth.updateName.useMutation({
    onSuccess: async () => {
      toast.success("Name updated");
      await utils.auth.me.invalidate();
      await refresh();
    },
    onError: err => toast.error(err.message || "Failed to update name"),
  });

  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: err => toast.error(err.message || "Failed to update password"),
  });

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">Please login to view your account settings.</p>
            <Link href="/login"><Button>Login</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const submitName = (e: React.FormEvent) => {
    e.preventDefault();
    setNameError(null);
    const trimmed = name.trim();
    if (!NAME_PATTERN.test(trimmed)) {
      setNameError("Name must contain letters and spaces only.");
      return;
    }
    updateName.mutate({ name: trimmed });
  };

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (!PASSWORD_PATTERN.test(newPassword)) {
      setPasswordError("New password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a special character.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    changePassword.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] py-8">
      <div className="container max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Account Settings</h1>
          <p className="text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{user.schoolId || user.email}</span>
            {" "}<Badge variant="secondary" className="align-middle">{ROLE_LABELS[user.role] ?? user.role}</Badge>
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><UserCircle className="h-5 w-5 text-primary" /> Your Name</CardTitle>
            <CardDescription>Your role and School ID cannot be changed here — only your display name and password.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={submitName}>
              {nameError && <p className="text-sm text-red-600">{nameError}</p>}
              <div className="space-y-1.5">
                <Label htmlFor="profile-name">Name</Label>
                <Input
                  id="profile-name"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={e => setName(lettersAndSpacesOnly(e.target.value))}
                />
              </div>
              <Button type="submit" disabled={updateName.isPending || name.trim() === (user.name ?? "").trim()}>
                {updateName.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Name"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><KeyRound className="h-5 w-5 text-primary" /> Change Password</CardTitle>
            <CardDescription>You'll need your current password to set a new one.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={submitPassword}>
              {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
              <PasswordInput id="current-password" label="Current Password" autoComplete="current-password" value={currentPassword} onChange={setCurrentPassword} />
              <PasswordInput id="new-password" label="New Password" autoComplete="new-password" value={newPassword} onChange={setNewPassword} />
              <p className="text-xs text-muted-foreground -mt-1.5">
                At least {PASSWORD_MIN_LENGTH} characters, with an uppercase letter, a lowercase letter, and a special character.
              </p>
              <PasswordInput id="confirm-new-password" label="Confirm New Password" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} />
              <Button type="submit" disabled={changePassword.isPending}>
                {changePassword.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

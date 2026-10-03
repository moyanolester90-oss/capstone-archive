import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { AlertCircle, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { PASSWORD_MIN_LENGTH, PASSWORD_PATTERN } from "@shared/validation";

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

/**
 * Forced "create a new password" screen shown right after signing in with a
 * temporary password issued by an admin/adviser-approved "Forgot Password?"
 * request (`user.mustChangePassword`, see drizzle/schema.ts). The App-level
 * guard (client/src/App.tsx) redirects here and keeps redirecting back for
 * as long as the flag is set, so this page is the only thing a person with a
 * pending forced change can reach.
 *
 * Reuses the existing `auth.changePassword` mutation unchanged — the person
 * re-enters the temporary password they just signed in with as "Current
 * Password" — which already clears `mustChangePassword` as soon as it
 * succeeds (see `updateUserPassword` in server/db.ts). On success they're
 * signed out and sent to /login, so they sign back in fresh with the
 * password they just chose, exactly as asked.
 */
export default function ChangePasswordRequired() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: async () => {
      toast.success("Password changed. Please log in with your new password.");
      await logout();
      navigate("/login");
    },
    onError: err => setError(err.message || "Failed to change password"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!PASSWORD_PATTERN.test(newPassword)) {
      setError(`New password must be at least ${PASSWORD_MIN_LENGTH} characters and include an uppercase letter, a lowercase letter, and a special character.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    changePassword.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <div className="mx-auto mb-2 h-14 w-14 rounded-full bg-[#1a3a6b]/10 flex items-center justify-center">
            <KeyRound className="h-6 w-6 text-[#1a3a6b]" />
          </div>
          <CardTitle className="text-xl font-bold text-center text-foreground">Create a New Password</CardTitle>
          <CardDescription className="text-center">
            {user?.name ? `Hi ${user.name}, you` : "You"} signed in with a temporary password. Please set a
            password of your own before continuing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleSubmit}>
            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <PasswordInput id="required-current-password" label="Temporary Password" autoComplete="current-password" value={currentPassword} onChange={setCurrentPassword} />
            <PasswordInput id="required-new-password" label="New Password" autoComplete="new-password" value={newPassword} onChange={setNewPassword} />
            <p className="text-xs text-muted-foreground -mt-1.5">
              At least {PASSWORD_MIN_LENGTH} characters, with an uppercase letter, a lowercase letter, and a special character.
            </p>
            <PasswordInput id="required-confirm-password" label="Confirm New Password" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} />
            <Button type="submit" className="w-full h-11 bg-[#1a3a6b] hover:bg-[#153059] text-white" disabled={changePassword.isPending}>
              {changePassword.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set New Password & Log In Again"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

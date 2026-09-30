import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { Users, Check, X } from "lucide-react";
import { Link } from "wouter";

const ROLE_LABELS: Record<string, string> = { student: "Student", adviser: "Adviser", admin: "Admin/Librarian" };
const ROLE_BADGE_CLASS: Record<string, string> = {
  student: "bg-secondary text-secondary-foreground",
  adviser: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  admin: "bg-primary/10 text-primary",
};

export default function UserManagement() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: allUsers } = trpc.users.list.useQuery(undefined, { enabled: user?.role === 'admin' });

  const updateStatus = trpc.users.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("User status updated");
      queryClient.invalidateQueries({ queryKey: [["users", "list"]] });
    },
    onError: (err) => toast.error(err.message || "Failed to update user status"),
  });

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4">
        <Card><CardContent className="pt-6 text-center">
          <p className="text-muted-foreground mb-4">Admin access required.</p>
          <Link href="/"><Button>Go Home</Button></Link>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] py-8">
      <div className="container">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground">Manage account status. A user's role (Student, Adviser, or Admin/Librarian) is set at sign-up and can't be changed here — it stays fixed for the life of the account. Suspended or inactive users can't sign in until reactivated. New Student sign-ups start out Pending and can't sign in until you Approve or Reject them below.</p>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Email</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Role</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Last Login</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers?.map(u => {
                    const isSelf = u.id === user?.id;
                    return (
                    <tr key={u.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-4 text-sm font-medium text-foreground">
                        {u.name || "Unknown"}
                        {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{u.email || "—"}</td>
                      <td className="p-4">
                        <Badge className={`font-medium ${ROLE_BADGE_CLASS[u.role] ?? ""}`} variant="secondary">
                          {ROLE_LABELS[u.role] ?? u.role}
                        </Badge>
                      </td>
                      <td className="p-4">
                        {u.status === 'pending' ? (
                          <Badge className="font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" variant="secondary">
                            Pending
                          </Badge>
                        ) : (
                          <Select
                            value={u.status}
                            disabled={isSelf}
                            onValueChange={(val) => updateStatus.mutate({ userId: u.id, status: val as 'active' | 'inactive' | 'suspended' })}
                          >
                            <SelectTrigger className="w-[130px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                              <SelectItem value="suspended">Suspended</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">
                        {u.lastSignedIn ? `${new Date(u.lastSignedIn).toLocaleDateString()} ${new Date(u.lastSignedIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "—"}
                      </td>
                      <td className="p-4">
                        {u.status === 'pending' ? (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="text-xs h-8 gap-1 bg-success text-white hover:bg-success/90"
                              onClick={() => updateStatus.mutate({ userId: u.id, status: 'active' })}
                            >
                              <Check className="h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-8 gap-1 text-destructive border-destructive/40 hover:bg-destructive/10"
                              onClick={() => updateStatus.mutate({ userId: u.id, status: 'suspended' })}
                            >
                              <X className="h-3.5 w-3.5" /> Reject
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-8"
                              disabled={isSelf}
                              title={isSelf ? "You can't change your own account" : undefined}
                              onClick={() => updateStatus.mutate({
                                userId: u.id,
                                status: u.status === 'active' ? 'inactive' : 'active'
                              })}
                            >
                              {u.status === 'active' ? 'Deactivate' : 'Activate'}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              {(!allUsers || allUsers.length === 0) && (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No users found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { Users, Shield, UserX, ShieldOff } from "lucide-react";
import { Link } from "wouter";

export default function UserManagement() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: allUsers } = trpc.users.list.useQuery(undefined, { enabled: user?.role === 'admin' });

  const updateStatus = trpc.users.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("User status updated");
      queryClient.invalidateQueries({ queryKey: [["users", "list"]] });
    },
    onError: () => toast.error("Failed to update user status"),
  });

  const updateRole = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      toast.success("User role updated");
      queryClient.invalidateQueries({ queryKey: [["users", "list"]] });
    },
    onError: () => toast.error("Failed to update user role"),
  });

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <Card><CardContent className="pt-6 text-center">
          <p className="text-muted-foreground mb-4">Admin access required.</p>
          <Link href="/"><Button>Go Home</Button></Link>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] py-8">
      <div className="container">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground">Manage student accounts, roles, and status</p>
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
                  {allUsers?.map(u => (
                    <tr key={u.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-4 text-sm font-medium text-foreground">{u.name || "Unknown"}</td>
                      <td className="p-4 text-sm text-muted-foreground">{u.email || "—"}</td>
                      <td className="p-4">
                        <Select
                          value={u.role}
                          onValueChange={(val) => updateRole.mutate({ userId: u.id, role: val as 'user' | 'admin' })}
                        >
                          <SelectTrigger className="w-[120px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">Student</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-4">
                        <Select
                          value={u.status}
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
                      </td>
                      <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">
                        {u.lastSignedIn ? `${new Date(u.lastSignedIn).toLocaleDateString()} ${new Date(u.lastSignedIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "—"}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-8"
                            onClick={() => updateStatus.mutate({
                              userId: u.id,
                              status: u.status === 'active' ? 'inactive' : 'active'
                            })}
                          >
                            {u.status === 'active' ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
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

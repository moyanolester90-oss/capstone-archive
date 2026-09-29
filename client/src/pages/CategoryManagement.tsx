import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus, FolderOpen } from "lucide-react";
import { Link } from "wouter";

export default function CategoryManagement() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingCat, setEditingCat] = useState<any>(null);

  const { data: categories } = trpc.categories.list.useQuery();

  const createCategory = trpc.categories.create.useMutation({
    onSuccess: () => {
      toast.success("Category created successfully");
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: [["categories", "list"]] });
    },
    onError: (err) => toast.error(err.message || "Failed to create category"),
  });

  const updateCategory = trpc.categories.update.useMutation({
    onSuccess: () => {
      toast.success("Category updated successfully");
      setEditingCat(null);
      queryClient.invalidateQueries({ queryKey: [["categories", "list"]] });
    },
    onError: (err) => toast.error(err.message || "Failed to update category"),
  });

  const deleteCategory = trpc.categories.delete.useMutation({
    onSuccess: () => {
      toast.success("Category deleted successfully");
      queryClient.invalidateQueries({ queryKey: [["categories", "list"]] });
    },
    onError: (err) => toast.error(err.message || "Failed to delete category"),
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
      <div className="container max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Category Management</h1>
            <p className="text-muted-foreground">Manage project categories</p>
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button className="gap-1.5">
                <Plus className="h-4 w-4" /> Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Category</DialogTitle></DialogHeader>
              <CategoryForm
                onSubmit={(name, desc) => createCategory.mutate({ name, description: desc })}
              />
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-3">
          {categories?.map(cat => (
            <Card key={cat.id} className="hover:shadow-sm transition-all">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">{cat.name}</h3>
                  {cat.description && <p className="text-sm text-muted-foreground mt-1">{cat.description}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditingCat(cat)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => {
                    if (confirm("Delete this category?")) deleteCategory.mutate({ id: cat.id });
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!categories || categories.length === 0) && (
            <div className="text-center py-12 text-muted-foreground">
              <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No categories found</p>
            </div>
          )}
        </div>

        {/* Edit Dialog */}
        {editingCat && (
          <Dialog open={!!editingCat} onOpenChange={() => setEditingCat(null)}>
            <DialogContent>
              <DialogHeader><DialogTitle>Edit Category</DialogTitle></DialogHeader>
              <CategoryForm
                initialName={editingCat.name}
                initialDesc={editingCat.description || ""}
                onSubmit={(name, desc) => updateCategory.mutate({ id: editingCat.id, name, description: desc })}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

function CategoryForm({ initialName, initialDesc, onSubmit }: {
  initialName?: string; initialDesc?: string;
  onSubmit: (name: string, desc: string) => void;
}) {
  const [name, setName] = useState(initialName || "");
  const [desc, setDesc] = useState(initialDesc || "");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Name *</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Category name" />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} placeholder="Optional description" />
      </div>
      <div className="flex justify-end">
        <Button onClick={() => name.trim() && onSubmit(name.trim(), desc.trim())} disabled={!name.trim()}>
          {initialName ? "Save Changes" : "Create"}
        </Button>
      </div>
    </div>
  );
}

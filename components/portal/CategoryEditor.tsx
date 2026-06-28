"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCard } from "@/components/layout/TableCard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCategoryLabel } from "@/lib/tender/categories";
import type { ProjectCategory } from "@/lib/tender/types";

interface Props {
  projectId: string;
  initialCategories: ProjectCategory[];
  onUpdated?: () => void;
}

export function CategoryEditor({ projectId, initialCategories, onUpdated }: Props) {
  const [categories, setCategories] = useState(initialCategories);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProjectCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectCategory | null>(null);
  const [newName, setNewName] = useState("");
  const [newShortcut, setNewShortcut] = useState("");
  const [editName, setEditName] = useState("");
  const [editShortcut, setEditShortcut] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/categories`);
    const data = await res.json();
    if (res.ok) setCategories(data.categories);
  }, [projectId]);

  async function handleAdd() {
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, shortcut: newShortcut || undefined }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to add category.");
      return;
    }
    setAddOpen(false);
    setNewName("");
    setNewShortcut("");
    setMessage("Category added.");
    await refresh();
    onUpdated?.();
  }

  async function handleEdit() {
    if (!editTarget) return;
    setSaving(true);
    setError(null);
    const res = await fetch(
      `/api/projects/${projectId}/categories/${editTarget.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, shortcut: editShortcut }),
      },
    );
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to update category.");
      return;
    }
    setEditTarget(null);
    setMessage("Category updated.");
    await refresh();
    onUpdated?.();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    const res = await fetch(
      `/api/projects/${projectId}/categories/${deleteTarget.id}`,
      { method: "DELETE" },
    );
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to delete category.");
      setDeleteTarget(null);
      return;
    }
    setDeleteTarget(null);
    setMessage("Category removed. Spec lines moved to Miscellaneous.");
    await refresh();
    onUpdated?.();
  }

  function openEdit(cat: ProjectCategory) {
    setEditTarget(cat);
    setEditName(cat.name);
    setEditShortcut(cat.shortcut);
    setError(null);
  }

  return (
    <div className="space-y-4">
      <TableCard
        title="Cost categories"
        description="Standard dry-dock categories 01–22 with keyboard shortcuts. Add custom categories or edit names and shortcuts."
        headerAction={
          <Button type="button" onClick={() => setAddOpen(true)}>
            Add category
          </Button>
        }
      >
        <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">No.</TableHead>
                <TableHead className="w-20">Key</TableHead>
                <TableHead>Category name</TableHead>
                <TableHead className="w-28">Type</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-mono font-medium">{cat.categoryNo}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {cat.shortcut}
                    </Badge>
                  </TableCell>
                  <TableCell>{cat.name}</TableCell>
                  <TableCell>
                    {cat.isSystem ? (
                      <Badge variant="secondary">Standard</Badge>
                    ) : (
                      <Badge>Custom</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(cat)}>
                      Edit
                    </Button>
                    {!cat.isSystem && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setDeleteTarget(cat)}
                      >
                        Delete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
        </Table>
      </TableCard>

      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add category</DialogTitle>
            <DialogDescription>
              Custom categories receive the next available number (23, 24, …).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-cat-name">Category name</Label>
              <Input
                id="new-cat-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Scrubber retrofit"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-cat-shortcut">Shortcut key (optional)</Label>
              <Input
                id="new-cat-shortcut"
                value={newShortcut}
                onChange={(e) => setNewShortcut(e.target.value.toUpperCase())}
                maxLength={8}
                placeholder="Auto-assigned if blank"
                className="font-mono uppercase"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving || !newName.trim()} onClick={() => void handleAdd()}>
              {saving ? "Adding…" : "Add category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit category {editTarget && formatCategoryLabel(editTarget)}</DialogTitle>
            <DialogDescription>
              Category number {editTarget?.categoryNo} is fixed. Update the display name or
              shortcut key.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-cat-name">Category name</Label>
              <Input
                id="edit-cat-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cat-shortcut">Shortcut key</Label>
              <Input
                id="edit-cat-shortcut"
                value={editShortcut}
                onChange={(e) => setEditShortcut(e.target.value.toUpperCase())}
                maxLength={8}
                className="font-mono uppercase"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving || !editName.trim()}
              onClick={() => void handleEdit()}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove &ldquo;{deleteTarget && formatCategoryLabel(deleteTarget)}&rdquo;? Spec lines
              in this category will move to 21 Miscellaneous.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void handleDelete()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

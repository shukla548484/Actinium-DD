"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Plus, Pencil, Trash2, Package, Loader2 } from "lucide-react";
import { TablePagination } from "@/components/ui/table-pagination";
import { toast } from "sonner";
import { fieldErrorCn } from "@/lib/form-field-highlight";
import { TableSerialHead, TableSerialCell } from "@/components/ui/table-serial-column";

interface StoreItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unit: string;
  category: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ManageStoreItemsPage() {
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", description: "", unit: "PCS", category: "" });
  const [fieldHighlight, setFieldHighlight] = useState<Record<string, boolean>>({});

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/store-items?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setStoreItems(data.storeItems || []);
    } catch (e) {
      toast.error("Failed to load store items");
      setStoreItems([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    setPage(1);
  }, [search, storeItems.length]);

  const paginatedItems = storeItems.slice((page - 1) * pageSize, page * pageSize);

  const openCreate = () => {
    setEditingId(null);
    setFieldHighlight({});
    setForm({ code: "", name: "", description: "", unit: "PCS", category: "" });
    setDialogOpen(true);
  };

  const openEdit = (item: StoreItem) => {
    setFieldHighlight({});
    setEditingId(item.id);
    setForm({
      code: item.code,
      name: item.name,
      description: item.description || "",
      unit: item.unit,
      category: item.category || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      setFieldHighlight({
        code: !form.code.trim(),
        name: !form.name.trim(),
      });
      toast.error("Code and name are required");
      return;
    }
    setFieldHighlight({});
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/store-items/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            code: form.code.trim(),
            name: form.name.trim(),
            description: form.description.trim() || null,
            unit: form.unit.trim() || "PCS",
            category: form.category.trim() || null,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Update failed");
        }
        toast.success("Store item updated");
      } else {
        const res = await fetch("/api/store-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            code: form.code.trim(),
            name: form.name.trim(),
            description: form.description.trim() || null,
            unit: form.unit.trim() || "PCS",
            category: form.category.trim() || null,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Create failed");
        }
        toast.success("Store item added");
      }
      setDialogOpen(false);
      fetchItems();
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: StoreItem) => {
    if (!confirm(`Delete store item "${item.name}" (${item.code})?`)) return;
    try {
      const res = await fetch(`/api/store-items/${item.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Store item deleted");
      fetchItems();
    } catch {
      toast.error("Failed to delete store item");
    }
  };

  return (
    <div className="space-y-4">
      <div className="mx-auto py-4" style={{ width: "90%", maxWidth: "90vw" }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Package className="h-6 w-6" />
              Manage Store Items
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Add and manage store items for your company. Once added, they are available to all users and sync to vessel offline databases.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Store Item
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Store Items</CardTitle>
            <CardDescription>
              Company-wide list; synced to vessels with offline DB on hourly sync.
            </CardDescription>
            <div className="pt-2">
              <Input
                placeholder="Search by code, name, or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : storeItems.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground">
                No store items yet. Click &quot;Add Store Item&quot; to create one.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                      <TableSerialHead />
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableSerialCell serialNo={index + 1} />
                      <TableCell className="font-medium">{item.code}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {item.description || "—"}
                      </TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>{item.category || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(item)} title="Delete">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!loading && storeItems.length > 0 && (
              <TablePagination
                page={page}
                pageSize={pageSize}
                total={storeItems.length}
                onPageChange={setPage}
                itemLabel="items"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Store Item" : "Add Store Item"}</DialogTitle>
            <DialogDescription>
              Store items are available to all users of your company and sync to vessel offline databases.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-2">
              <Label htmlFor="code" className="text-right">Code</Label>
              <Input
                id="code"
                value={form.code}
                onChange={(e) => {
                  setFieldHighlight((h) => ({ ...h, code: false }));
                  setForm((f) => ({ ...f, code: e.target.value }));
                }}
                placeholder="e.g. ITM-001"
                className={fieldErrorCn(!!fieldHighlight.code, "col-span-3")}
                aria-invalid={fieldHighlight.code || undefined}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-2">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => {
                  setFieldHighlight((h) => ({ ...h, name: false }));
                  setForm((f) => ({ ...f, name: e.target.value }));
                }}
                placeholder="Item name"
                className={fieldErrorCn(!!fieldHighlight.name, "col-span-3")}
                aria-invalid={fieldHighlight.name || undefined}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-2">
              <Label htmlFor="description" className="text-right">Description</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-2">
              <Label htmlFor="unit" className="text-right">Unit</Label>
              <Input
                id="unit"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="PCS, KG, etc."
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-2">
              <Label htmlFor="category" className="text-right">Category</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="Optional"
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingId ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

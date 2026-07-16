"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plus, Trash2, Pencil, History } from "lucide-react";
import { NoonPortCombobox } from "@/components/reports/noon/NoonPortCombobox";
import { toast } from "sonner";

type AgentRole = "CURRENT" | "OWNERS_CHARTERS" | "PAST";

export type RequisitionPortAgentRecord = {
  id: string;
  requisitionId: string;
  role: AgentRole;
  portId: string | null;
  portName: string;
  agentName: string;
  companyName: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  fax: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; firstName: string; lastName: string };
  updatedBy?: { id: string; firstName: string; lastName: string } | null;
};

type AgentFormState = {
  role: AgentRole;
  portId: string;
  portName: string;
  agentName: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  fax: string;
  address: string;
  notes: string;
};

const ROLE_LABELS: Record<AgentRole, string> = {
  CURRENT: "Current Agent",
  OWNERS_CHARTERS: "Owners / Charters Agent",
  PAST: "Past Agent",
};

const emptyForm = (defaultPort = ""): AgentFormState => ({
  role: "CURRENT",
  portId: "",
  portName: defaultPort,
  agentName: "",
  companyName: "",
  contactPerson: "",
  email: "",
  phone: "",
  fax: "",
  address: "",
  notes: "",
});

function agentToForm(agent: RequisitionPortAgentRecord): AgentFormState {
  return {
    role: agent.role,
    portId: agent.portId || "",
    portName: agent.portName,
    agentName: agent.agentName,
    companyName: agent.companyName || "",
    contactPerson: agent.contactPerson || "",
    email: agent.email || "",
    phone: agent.phone || "",
    fax: agent.fax || "",
    address: agent.address || "",
    notes: agent.notes || "",
  };
}

export function RequisitionAgentsPanel({
  requisitionId,
  defaultPortName,
  canEdit,
}: {
  requisitionId: string;
  defaultPortName?: string;
  canEdit: boolean;
}) {
  const [agents, setAgents] = useState<RequisitionPortAgentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AgentFormState>(() => emptyForm(defaultPortName || ""));
  const [suggestions, setSuggestions] = useState<RequisitionPortAgentRecord[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/requisitions/${requisitionId}/port-agents`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to load agents");
      }
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load agent details");
    } finally {
      setLoading(false);
    }
  }, [requisitionId]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const fetchSuggestions = useCallback(
    async (portName: string, portId?: string) => {
      if (!portName.trim()) {
        setSuggestions([]);
        return;
      }
      setLoadingSuggestions(true);
      try {
        const params = new URLSearchParams({
          excludeRequisitionId: requisitionId,
          limit: "15",
        });
        if (portId) params.set("portId", portId);
        else params.set("portName", portName.trim());

        const res = await fetch(`/api/requisitions/port-agents/suggestions?${params}`, {
          credentials: "include",
        });
        if (!res.ok) {
          setSuggestions([]);
          return;
        }
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    },
    [requisitionId]
  );

  useEffect(() => {
    if (showForm && form.portName.trim()) {
      fetchSuggestions(form.portName, form.portId || undefined);
    } else {
      setSuggestions([]);
    }
  }, [showForm, form.portName, form.portId, fetchSuggestions]);

  const groupedAgents = useMemo(() => {
    const groups: Record<AgentRole, RequisitionPortAgentRecord[]> = {
      CURRENT: [],
      OWNERS_CHARTERS: [],
      PAST: [],
    };
    for (const agent of agents) {
      groups[agent.role].push(agent);
    }
    return groups;
  }, [agents]);

  const resetForm = () => {
    setForm(emptyForm(defaultPortName || ""));
    setEditingId(null);
    setShowForm(false);
    setSuggestions([]);
  };

  const applySuggestion = (suggestion: RequisitionPortAgentRecord) => {
    setForm((prev) => ({
      ...prev,
      portId: suggestion.portId || prev.portId,
      portName: suggestion.portName || prev.portName,
      agentName: suggestion.agentName,
      companyName: suggestion.companyName || "",
      contactPerson: suggestion.contactPerson || "",
      email: suggestion.email || "",
      phone: suggestion.phone || "",
      fax: suggestion.fax || "",
      address: suggestion.address || "",
      notes: suggestion.notes || "",
    }));
  };

  const handleAllotSuggestion = async (suggestion: RequisitionPortAgentRecord) => {
    const portName = (suggestion.portName || form.portName || defaultPortName || "").trim();
    if (!portName) {
      toast.error("Port name is required to allot an agent");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        role: "CURRENT" as const,
        portId: suggestion.portId || form.portId || null,
        portName,
        agentName: suggestion.agentName.trim(),
        companyName: suggestion.companyName?.trim() || null,
        contactPerson: suggestion.contactPerson?.trim() || null,
        email: suggestion.email?.trim() || null,
        phone: suggestion.phone?.trim() || null,
        fax: suggestion.fax?.trim() || null,
        address: suggestion.address?.trim() || null,
        notes: suggestion.notes?.trim() || null,
      };
      const res = await fetch(`/api/requisitions/${requisitionId}/port-agents`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to allot agent");
      }
      toast.success("Agent allotted as current");
      resetForm();
      fetchAgents();
    } catch (error: any) {
      toast.error(error?.message || "Failed to allot agent");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!form.portName.trim() || !form.agentName.trim()) {
      toast.error("Port and agent name are required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        role: form.role,
        portId: form.portId || null,
        portName: form.portName.trim(),
        agentName: form.agentName.trim(),
        companyName: form.companyName.trim() || null,
        contactPerson: form.contactPerson.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        fax: form.fax.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      };

      const url = editingId
        ? `/api/requisitions/${requisitionId}/port-agents/${editingId}`
        : `/api/requisitions/${requisitionId}/port-agents`;
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save agent");
      }

      toast.success(editingId ? "Agent updated" : "Agent added");
      resetForm();
      fetchAgents();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save agent");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (agentId: string) => {
    if (!confirm("Discard this agent from the requisition?")) return;
    try {
      const res = await fetch(
        `/api/requisitions/${requisitionId}/port-agents/${agentId}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) {
        throw new Error("Failed to delete agent");
      }
      toast.success("Agent removed");
      if (editingId === agentId) resetForm();
      fetchAgents();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete agent");
    }
  };

  const startEdit = (agent: RequisitionPortAgentRecord) => {
    setEditingId(agent.id);
    setForm(agentToForm(agent));
    setShowForm(true);
  };

  const renderAgentCard = (agent: RequisitionPortAgentRecord) => (
    <div key={agent.id} className="border rounded-lg p-4 bg-white space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{agent.agentName}</p>
          {agent.companyName && (
            <p className="text-xs text-gray-600">{agent.companyName}</p>
          )}
          <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
            <MapPin className="h-3 w-3" />
            {agent.portName}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => startEdit(agent)} title="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(agent.id)}
              title="Discard"
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        )}
      </div>
      <div className="text-xs text-gray-600 space-y-1">
        {agent.contactPerson && <p>Contact: {agent.contactPerson}</p>}
        {agent.email && <p>Email: {agent.email}</p>}
        {agent.phone && <p>Phone: {agent.phone}</p>}
        {agent.fax && <p>Fax: {agent.fax}</p>}
        {agent.address && <p className="whitespace-pre-wrap">Address: {agent.address}</p>}
        {agent.notes && <p className="whitespace-pre-wrap">Notes: {agent.notes}</p>}
      </div>
    </div>
  );

  if (loading) {
    return <p className="text-sm text-gray-500 py-4">Loading agent details...</p>;
  }

  return (
    <div className="space-y-4">
      {canEdit && !showForm && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              setForm(emptyForm(defaultPortName || ""));
              setEditingId(null);
              setShowForm(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Agent
          </Button>
        </div>
      )}

      {canEdit && showForm && (
        <div className="border rounded-lg p-4 bg-slate-50 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">
              {editingId ? "Edit Agent" : "Add Agent"}
            </Label>
            <Badge variant="outline">{ROLE_LABELS[form.role]}</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Role</Label>
              <Select
                value={form.role}
                onValueChange={(value: AgentRole) =>
                  setForm((prev) => ({ ...prev, role: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CURRENT">Current Agent</SelectItem>
                  <SelectItem value="OWNERS_CHARTERS">Owners / Charters Agent</SelectItem>
                  <SelectItem value="PAST">Past Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Port</Label>
              <NoonPortCombobox
                value={form.portName}
                onChange={(portName) =>
                  setForm((prev) => ({ ...prev, portName, portId: "" }))
                }
                placeholder="Select or enter port name"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Agent Name *</Label>
              <Input
                value={form.agentName}
                onChange={(e) => setForm((prev) => ({ ...prev, agentName: e.target.value }))}
                placeholder="Agent company or name"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Company Name</Label>
              <Input
                value={form.companyName}
                onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Contact Person</Label>
              <Input
                value={form.contactPerson}
                onChange={(e) => setForm((prev) => ({ ...prev, contactPerson: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Fax</Label>
              <Input
                value={form.fax}
                onChange={(e) => setForm((prev) => ({ ...prev, fax: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1 block">Address</Label>
            <Textarea
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              rows={2}
            />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={2}
            />
          </div>

          {form.portName.trim() && (
            <div className="border rounded-md p-3 bg-white">
              <div className="flex items-center gap-2 mb-2">
                <History className="h-4 w-4 text-gray-500" />
                <Label className="text-xs font-semibold">
                  Past agents used at this port
                </Label>
              </div>
              {loadingSuggestions ? (
                <p className="text-xs text-gray-500">Loading suggestions...</p>
              ) : suggestions.length === 0 ? (
                <p className="text-xs text-gray-500">No past agents found for this port.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <div key={s.id} className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs h-auto py-1"
                        onClick={() => applySuggestion(s)}
                      >
                        {s.agentName}
                        {s.companyName ? ` (${s.companyName})` : ""}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="text-xs h-auto py-1"
                        disabled={saving}
                        onClick={() => handleAllotSuggestion(s)}
                      >
                        Allot
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update Agent" : "Save Agent"}
            </Button>
            <Button variant="outline" size="sm" onClick={resetForm} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {(["CURRENT", "OWNERS_CHARTERS", "PAST"] as AgentRole[]).map((role) => {
        const roleAgents = groupedAgents[role];
        if (roleAgents.length === 0) return null;
        return (
          <div key={role}>
            <Label className="text-sm font-semibold mb-2 block">{ROLE_LABELS[role]}</Label>
            <div className="space-y-2">{roleAgents.map(renderAgentCard)}</div>
          </div>
        );
      })}

      {agents.length === 0 && !showForm && (
        <div className="text-center py-8 text-gray-500 border rounded-lg">
          <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No agent details available</p>
          {canEdit ? (
            <div className="mt-4 flex flex-col items-center gap-2">
              <p className="text-xs">Add current, owners/charters, or past port agents.</p>
              <Button
                size="sm"
                onClick={() => {
                  setForm(emptyForm(defaultPortName || ""));
                  setEditingId(null);
                  setShowForm(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Agent
              </Button>
            </div>
          ) : (
            <p className="text-xs mt-2 text-gray-400">
              Agent management requires crew or office access (level 6+).
            </p>
          )}
        </div>
      )}
    </div>
  );
}

#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.join(__dirname, "..");

const entities = [
  {
    editDescription: "item.title",
    slug: "jobs",
    routeBase: "/superintendent/jobs",
    apiPath: "/api/superintendent/jobs",
    responseKey: "job",
    title: "Job list",
    description: "Scope jobs by category and status.",
    tableTitle: "Jobs",
    listColumns: [
      { header: "Title", cell: "(row) => row.title" },
      { header: "Category", cell: "(row) => row.category" },
      { header: "Priority", cell: "(row) => row.priority" },
      { header: "Status", cell: "(row) => row.status.replace(/_/g, ' ')" },
      { header: "Project", cell: "(row) => row.dryDockProjectId" },
    ],
    typeFields: `title: string; category: string; priority: string; status: string; dryDockProjectId: string; jobCode: string | null; description: string | null;`,
    newExtraImports: `import { JOB_CATEGORIES } from "@/lib/superintendent/constants";`,
    newForm: `
            <DryDockProjectSelect value={projectId} onChange={setProjectId} required />
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={category} onValueChange={(v) => setCategory(v ?? "miscellaneous")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {JOB_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v ?? "medium")}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["low","medium","high","critical"].map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v ?? "planned")}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["planned","in_progress","pending_approval","completed","closed"].map((s) => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobCode">Job code</Label>
              <Input id="jobCode" name="jobCode" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} />
            </div>`,
    newState: `const [projectId, setProjectId] = useState(""); const [category, setCategory] = useState("miscellaneous"); const [priority, setPriority] = useState("medium"); const [status, setStatus] = useState("planned");`,
    newSubmit: `dryDockProjectId: projectId, title: form.get("title") as string, category, priority, status, jobCode: (form.get("jobCode") as string) || null, description: (form.get("description") as string) || null`,
    editForm: `
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" defaultValue={item.title} required />
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={category} onValueChange={(v) => setCategory(v ?? item.category)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {JOB_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v ?? item.priority)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["low","medium","high","critical"].map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v ?? item.status)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["planned","in_progress","pending_approval","completed","closed"].map((s) => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobCode">Job code</Label>
              <Input id="jobCode" name="jobCode" defaultValue={item.jobCode ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} defaultValue={item.description ?? ""} />
            </div>`,
    editStateInit: `setCategory(item.category); setPriority(item.priority); setStatus(item.status);`,
    editState: `const [category, setCategory] = useState("miscellaneous"); const [priority, setPriority] = useState("medium"); const [status, setStatus] = useState("planned");`,
    editSubmit: `title: form.get("title") as string, category, priority, status, jobCode: (form.get("jobCode") as string) || null, description: (form.get("description") as string) || null`,
    editExtraImports: `import { JOB_CATEGORIES } from "@/lib/superintendent/constants";`,
  },
  {
    editDescription: "item.title",
    slug: "checklist",
    routeBase: "/superintendent/planning/checklist",
    apiPath: "/api/superintendent/checklist",
    responseKey: "checklistItem",
    title: "Pre-dock checklist",
    description: "Readiness tasks before yard entry.",
    tableTitle: "Checklist items",
    listColumns: [
      { header: "Title", cell: "(row) => row.title" },
      { header: "Category", cell: "(row) => row.category ?? '—'" },
      { header: "Completed", cell: "(row) => row.isCompleted ? 'Yes' : 'No'" },
      { header: "Due", cell: "(row) => fmtDate(row.dueDate)" },
    ],
    listExtraImports: `import { fmtDate } from "@/lib/superintendent/formatters";`,
    typeFields: `title: string; category: string | null; isCompleted: boolean; dueDate: string | null; assignedTo: string | null; notes: string | null;`,
    newForm: `
            <DryDockProjectSelect value={projectId} onChange={setProjectId} required />
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input id="category" name="category" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due date</Label>
              <Input id="dueDate" name="dueDate" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignedTo">Assigned to</Label>
              <Input id="assignedTo" name="assignedTo" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>`,
    newState: `const [projectId, setProjectId] = useState("");`,
    newSubmit: `dryDockProjectId: projectId, title: form.get("title") as string, category: (form.get("category") as string) || null, dueDate: (form.get("dueDate") as string) || null, assignedTo: (form.get("assignedTo") as string) || null, notes: (form.get("notes") as string) || null`,
    editForm: `
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" defaultValue={item.title} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input id="category" name="category" defaultValue={item.category ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due date</Label>
              <Input id="dueDate" name="dueDate" type="date" defaultValue={toDateInput(item.dueDate)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignedTo">Assigned to</Label>
              <Input id="assignedTo" name="assignedTo" defaultValue={item.assignedTo ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} defaultValue={item.notes ?? ""} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isCompleted" name="isCompleted" checked={completed} onChange={(e) => setCompleted(e.target.checked)} />
              <Label htmlFor="isCompleted">Completed</Label>
            </div>`,
    editState: `const [completed, setCompleted] = useState(false);`,
    editStateInit: `setCompleted(item.isCompleted);`,
    editSubmit: `title: form.get("title") as string, category: (form.get("category") as string) || null, isCompleted: completed, dueDate: (form.get("dueDate") as string) || null, assignedTo: (form.get("assignedTo") as string) || null, notes: (form.get("notes") as string) || null`,
    editHelpers: `function toDateInput(value: string | null): string { if (!value) return ""; return new Date(value).toISOString().slice(0, 10); }`,
  },
  {
    editDescription: "item.title",
    slug: "milestones",
    routeBase: "/superintendent/planning/milestones",
    apiPath: "/api/superintendent/milestones",
    responseKey: "milestone",
    title: "Milestones",
    description: "Key dates and gate reviews.",
    tableTitle: "Milestones",
    listColumns: [
      { header: "Title", cell: "(row) => row.title" },
      { header: "Planned", cell: "(row) => fmtDate(row.plannedDate)" },
      { header: "Status", cell: "(row) => row.status" },
    ],
    listExtraImports: `import { fmtDate } from "@/lib/superintendent/formatters";`,
    typeFields: `title: string; plannedDate: string | null; actualDate: string | null; status: string; notes: string | null;`,
    newForm: `
            <DryDockProjectSelect value={projectId} onChange={setProjectId} required />
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plannedDate">Planned date</Label>
                <Input id="plannedDate" name="plannedDate" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Input id="status" name="status" defaultValue="pending" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>`,
    newState: `const [projectId, setProjectId] = useState("");`,
    newSubmit: `dryDockProjectId: projectId, title: form.get("title") as string, plannedDate: (form.get("plannedDate") as string) || null, status: (form.get("status") as string) || "pending", notes: (form.get("notes") as string) || null`,
    editForm: `
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" defaultValue={item.title} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plannedDate">Planned date</Label>
                <Input id="plannedDate" name="plannedDate" type="date" defaultValue={toDateInput(item.plannedDate)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actualDate">Actual date</Label>
                <Input id="actualDate" name="actualDate" type="date" defaultValue={toDateInput(item.actualDate)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Input id="status" name="status" defaultValue={item.status} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} defaultValue={item.notes ?? ""} />
            </div>`,
    editState: "",
    editStateInit: "",
    editSubmit: `title: form.get("title") as string, plannedDate: (form.get("plannedDate") as string) || null, actualDate: (form.get("actualDate") as string) || null, status: (form.get("status") as string) || item.status, notes: (form.get("notes") as string) || null`,
    editHelpers: `function toDateInput(value: string | null): string { if (!value) return ""; return new Date(value).toISOString().slice(0, 10); }`,
  },
  {
    editDescription: "item.title",
    slug: "risks",
    routeBase: "/superintendent/planning/risks",
    apiPath: "/api/superintendent/risks",
    responseKey: "risk",
    title: "Risk register",
    description: "Identified risks and mitigations.",
    tableTitle: "Risks",
    listColumns: [
      { header: "Title", cell: "(row) => row.title" },
      { header: "Likelihood", cell: "(row) => row.likelihood" },
      { header: "Impact", cell: "(row) => row.impact" },
      { header: "Status", cell: "(row) => row.status" },
    ],
    typeFields: `title: string; description: string | null; likelihood: string; impact: string; mitigation: string | null; owner: string | null; status: string;`,
    newForm: `
            <DryDockProjectSelect value={projectId} onChange={setProjectId} required />
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Likelihood</Label>
                <Select value={likelihood} onValueChange={(v) => setLikelihood(v ?? "medium")}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["low","medium","high","critical"].map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Impact</Label>
                <Select value={impact} onValueChange={(v) => setImpact(v ?? "medium")}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["low","medium","high","critical"].map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mitigation">Mitigation</Label>
              <Textarea id="mitigation" name="mitigation" rows={2} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="owner">Owner</Label>
                <Input id="owner" name="owner" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Input id="status" name="status" defaultValue="open" />
              </div>
            </div>`,
    newState: `const [projectId, setProjectId] = useState(""); const [likelihood, setLikelihood] = useState("medium"); const [impact, setImpact] = useState("medium");`,
    newSubmit: `dryDockProjectId: projectId, title: form.get("title") as string, description: (form.get("description") as string) || null, likelihood, impact, mitigation: (form.get("mitigation") as string) || null, owner: (form.get("owner") as string) || null, status: (form.get("status") as string) || "open"`,
    editForm: `
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" defaultValue={item.title} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} defaultValue={item.description ?? ""} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Likelihood</Label>
                <Select value={likelihood} onValueChange={(v) => setLikelihood(v ?? item.likelihood)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["low","medium","high","critical"].map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Impact</Label>
                <Select value={impact} onValueChange={(v) => setImpact(v ?? item.impact)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["low","medium","high","critical"].map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mitigation">Mitigation</Label>
              <Textarea id="mitigation" name="mitigation" rows={2} defaultValue={item.mitigation ?? ""} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="owner">Owner</Label>
                <Input id="owner" name="owner" defaultValue={item.owner ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Input id="status" name="status" defaultValue={item.status} />
              </div>
            </div>`,
    editState: `const [likelihood, setLikelihood] = useState("medium"); const [impact, setImpact] = useState("medium");`,
    editStateInit: `setLikelihood(item.likelihood); setImpact(item.impact);`,
    editSubmit: `title: form.get("title") as string, description: (form.get("description") as string) || null, likelihood, impact, mitigation: (form.get("mitigation") as string) || null, owner: (form.get("owner") as string) || null, status: (form.get("status") as string) || item.status`,
  },
  {
    editDescription: "item.category",
    slug: "budget",
    routeBase: "/superintendent/budget",
    apiPath: "/api/superintendent/budget",
    responseKey: "budgetLine",
    title: "Budget lines",
    description: "Budget vs quoted vs actual by category.",
    tableTitle: "Budget lines",
    listColumns: [
      { header: "Category", cell: "(row) => row.category" },
      { header: "Budget", cell: "(row) => fmtMoney(row.budgetAmount)" },
      { header: "Quoted", cell: "(row) => fmtMoney(row.quotedAmount)" },
      { header: "Actual", cell: "(row) => fmtMoney(row.actualAmount)" },
    ],
    listExtraImports: `import { fmtMoney } from "@/lib/superintendent/formatters";`,
    typeFields: `category: string; description: string | null; budgetAmount: number; quotedAmount: number | null; actualAmount: number | null; approvalStatus: string;`,
    newForm: `
            <DryDockProjectSelect value={projectId} onChange={setProjectId} required />
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Input id="category" name="category" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="budgetAmount">Budget amount</Label>
                <Input id="budgetAmount" name="budgetAmount" type="number" defaultValue={0} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quotedAmount">Quoted</Label>
                <Input id="quotedAmount" name="quotedAmount" type="number" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actualAmount">Actual</Label>
                <Input id="actualAmount" name="actualAmount" type="number" />
              </div>
            </div>`,
    newState: `const [projectId, setProjectId] = useState("");`,
    newSubmit: `dryDockProjectId: projectId, category: form.get("category") as string, description: (form.get("description") as string) || null, budgetAmount: Number(form.get("budgetAmount") || 0), quotedAmount: form.get("quotedAmount") ? Number(form.get("quotedAmount")) : null, actualAmount: form.get("actualAmount") ? Number(form.get("actualAmount")) : null`,
    editForm: `
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Input id="category" name="category" defaultValue={item.category} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} defaultValue={item.description ?? ""} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="budgetAmount">Budget amount</Label>
                <Input id="budgetAmount" name="budgetAmount" type="number" defaultValue={item.budgetAmount} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quotedAmount">Quoted</Label>
                <Input id="quotedAmount" name="quotedAmount" type="number" defaultValue={item.quotedAmount ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actualAmount">Actual</Label>
                <Input id="actualAmount" name="actualAmount" type="number" defaultValue={item.actualAmount ?? ""} />
              </div>
            </div>`,
    editState: "",
    editStateInit: "",
    editSubmit: `category: form.get("category") as string, description: (form.get("description") as string) || null, budgetAmount: Number(form.get("budgetAmount") || 0), quotedAmount: form.get("quotedAmount") ? Number(form.get("quotedAmount")) : null, actualAmount: form.get("actualAmount") ? Number(form.get("actualAmount")) : null`,
  },
  {
    editDescription: "item.title",
    slug: "variations",
    routeBase: "/superintendent/budget/variations",
    apiPath: "/api/superintendent/variations",
    responseKey: "variation",
    title: "Variation orders",
    description: "VO tracking and approval status.",
    tableTitle: "Variations",
    listColumns: [
      { header: "VO #", cell: "(row) => row.voNumber ?? '—'" },
      { header: "Title", cell: "(row) => row.title" },
      { header: "Amount", cell: "(row) => fmtMoney(row.amount)" },
      { header: "Status", cell: "(row) => row.approvalStatus" },
    ],
    listExtraImports: `import { fmtMoney } from "@/lib/superintendent/formatters";`,
    typeFields: `voNumber: string | null; title: string; description: string | null; amount: number; approvalStatus: string;`,
    newForm: `
            <DryDockProjectSelect value={projectId} onChange={setProjectId} required />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="voNumber">VO number</Label>
                <Input id="voNumber" name="voNumber" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" name="amount" type="number" defaultValue={0} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Approval status</Label>
              <Select value={approvalStatus} onValueChange={(v) => setApprovalStatus(v ?? "pending")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["pending","approved","rejected","cancelled"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>`,
    newState: `const [projectId, setProjectId] = useState(""); const [approvalStatus, setApprovalStatus] = useState("pending");`,
    newSubmit: `dryDockProjectId: projectId, voNumber: (form.get("voNumber") as string) || null, title: form.get("title") as string, description: (form.get("description") as string) || null, amount: Number(form.get("amount") || 0), approvalStatus`,
    editForm: `
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="voNumber">VO number</Label>
                <Input id="voNumber" name="voNumber" defaultValue={item.voNumber ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" name="amount" type="number" defaultValue={item.amount} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" defaultValue={item.title} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} defaultValue={item.description ?? ""} />
            </div>
            <div className="space-y-2">
              <Label>Approval status</Label>
              <Select value={approvalStatus} onValueChange={(v) => setApprovalStatus(v ?? item.approvalStatus)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["pending","approved","rejected","cancelled"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>`,
    editState: `const [approvalStatus, setApprovalStatus] = useState("pending");`,
    editStateInit: `setApprovalStatus(item.approvalStatus);`,
    editSubmit: `voNumber: (form.get("voNumber") as string) || null, title: form.get("title") as string, description: (form.get("description") as string) || null, amount: Number(form.get("amount") || 0), approvalStatus`,
  },
  {
    editDescription: "fmtDate(item.reportDate)",
    slug: "daily-reports",
    routeBase: "/superintendent/monitoring/daily-reports",
    apiPath: "/api/superintendent/daily-reports",
    responseKey: "dailyReport",
    title: "Daily reports",
    description: "Yard daily progress and manpower.",
    tableTitle: "Daily reports",
    listColumns: [
      { header: "Date", cell: "(row) => fmtDate(row.reportDate)" },
      { header: "Progress", cell: "(row) => fmtPct(row.progressPct)" },
      { header: "Manpower", cell: "(row) => row.manpowerCount ?? '—'" },
    ],
    listExtraImports: `import { fmtDate, fmtPct } from "@/lib/superintendent/formatters";`,
    typeFields: `reportDate: string; completedWork: string | null; plannedWork: string | null; manpowerCount: number | null; progressPct: number | null; safetyNotes: string | null; delayNotes: string | null;`,
    newForm: `
            <DryDockProjectSelect value={projectId} onChange={setProjectId} required />
            <div className="space-y-2">
              <Label htmlFor="reportDate">Report date *</Label>
              <Input id="reportDate" name="reportDate" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="completedWork">Completed work</Label>
              <Textarea id="completedWork" name="completedWork" rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plannedWork">Planned work</Label>
              <Textarea id="plannedWork" name="plannedWork" rows={2} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="manpowerCount">Manpower count</Label>
                <Input id="manpowerCount" name="manpowerCount" type="number" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="progressPct">Progress %</Label>
                <Input id="progressPct" name="progressPct" type="number" min={0} max={100} />
              </div>
            </div>`,
    newState: `const [projectId, setProjectId] = useState("");`,
    newSubmit: `dryDockProjectId: projectId, reportDate: form.get("reportDate") as string, completedWork: (form.get("completedWork") as string) || null, plannedWork: (form.get("plannedWork") as string) || null, manpowerCount: form.get("manpowerCount") ? Number(form.get("manpowerCount")) : null, progressPct: form.get("progressPct") ? Number(form.get("progressPct")) : null`,
    editForm: `
            <div className="space-y-2">
              <Label htmlFor="reportDate">Report date *</Label>
              <Input id="reportDate" name="reportDate" type="date" defaultValue={toDateInput(item.reportDate)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="completedWork">Completed work</Label>
              <Textarea id="completedWork" name="completedWork" rows={2} defaultValue={item.completedWork ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plannedWork">Planned work</Label>
              <Textarea id="plannedWork" name="plannedWork" rows={2} defaultValue={item.plannedWork ?? ""} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="manpowerCount">Manpower count</Label>
                <Input id="manpowerCount" name="manpowerCount" type="number" defaultValue={item.manpowerCount ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="progressPct">Progress %</Label>
                <Input id="progressPct" name="progressPct" type="number" min={0} max={100} defaultValue={item.progressPct ?? ""} />
              </div>
            </div>`,
    editState: "",
    editStateInit: "",
    editSubmit: `reportDate: form.get("reportDate") as string, completedWork: (form.get("completedWork") as string) || null, plannedWork: (form.get("plannedWork") as string) || null, manpowerCount: form.get("manpowerCount") ? Number(form.get("manpowerCount")) : null, progressPct: form.get("progressPct") ? Number(form.get("progressPct")) : null`,
    editExtraImports: `import { fmtDate } from "@/lib/superintendent/formatters";`,
    editHelpers: `function toDateInput(value: string | null): string { if (!value) return ""; return new Date(value).toISOString().slice(0, 10); }`,
  },
  {
    editDescription: "item.title",
    slug: "delays",
    routeBase: "/superintendent/monitoring/delays",
    apiPath: "/api/superintendent/delays",
    responseKey: "delay",
    title: "Delays",
    description: "Open delay items and impact days.",
    tableTitle: "Delays",
    listColumns: [
      { header: "Title", cell: "(row) => row.title" },
      { header: "Impact days", cell: "(row) => row.impactDays ?? '—'" },
      { header: "Status", cell: "(row) => row.status" },
    ],
    typeFields: `title: string; reason: string | null; impactDays: number | null; responsibleParty: string | null; status: string;`,
    newForm: `
            <DryDockProjectSelect value={projectId} onChange={setProjectId} required />
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea id="reason" name="reason" rows={2} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="impactDays">Impact days</Label>
                <Input id="impactDays" name="impactDays" type="number" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Input id="status" name="status" defaultValue="open" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsibleParty">Responsible party</Label>
              <Input id="responsibleParty" name="responsibleParty" />
            </div>`,
    newState: `const [projectId, setProjectId] = useState("");`,
    newSubmit: `dryDockProjectId: projectId, title: form.get("title") as string, reason: (form.get("reason") as string) || null, impactDays: form.get("impactDays") ? Number(form.get("impactDays")) : null, responsibleParty: (form.get("responsibleParty") as string) || null, status: (form.get("status") as string) || "open"`,
    editForm: `
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" defaultValue={item.title} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea id="reason" name="reason" rows={2} defaultValue={item.reason ?? ""} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="impactDays">Impact days</Label>
                <Input id="impactDays" name="impactDays" type="number" defaultValue={item.impactDays ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Input id="status" name="status" defaultValue={item.status} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsibleParty">Responsible party</Label>
              <Input id="responsibleParty" name="responsibleParty" defaultValue={item.responsibleParty ?? ""} />
            </div>`,
    editState: "",
    editStateInit: "",
    editSubmit: `title: form.get("title") as string, reason: (form.get("reason") as string) || null, impactDays: form.get("impactDays") ? Number(form.get("impactDays")) : null, responsibleParty: (form.get("responsibleParty") as string) || null, status: (form.get("status") as string) || item.status`,
  },
  {
    editDescription: "item.title",
    slug: "survey",
    routeBase: "/superintendent/survey",
    apiPath: "/api/superintendent/survey",
    responseKey: "surveyItem",
    title: "Class surveys",
    description: "Survey items and class references.",
    tableTitle: "Survey items",
    listColumns: [
      { header: "Type", cell: "(row) => row.surveyType.replace(/_/g, ' ')" },
      { header: "Title", cell: "(row) => row.title" },
      { header: "Status", cell: "(row) => row.status" },
      { header: "Due", cell: "(row) => fmtDate(row.dueDate)" },
    ],
    listExtraImports: `import { fmtDate } from "@/lib/superintendent/formatters";`,
    typeFields: `surveyType: string; title: string; description: string | null; dueDate: string | null; status: string; classReference: string | null;`,
    newExtraImports: `import { SURVEY_TYPES } from "@/lib/superintendent/constants";`,
    newForm: `
            <DryDockProjectSelect value={projectId} onChange={setProjectId} required />
            <div className="space-y-2">
              <Label>Survey type *</Label>
              <Select value={surveyType} onValueChange={(v) => setSurveyType(v ?? "class_survey")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SURVEY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due date</Label>
                <Input id="dueDate" name="dueDate" type="date" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v ?? "pending")}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["pending","in_progress","completed","deferred"].map((s) => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="classReference">Class reference</Label>
              <Input id="classReference" name="classReference" />
            </div>`,
    newState: `const [projectId, setProjectId] = useState(""); const [surveyType, setSurveyType] = useState("class_survey"); const [status, setStatus] = useState("pending");`,
    newSubmit: `dryDockProjectId: projectId, surveyType, title: form.get("title") as string, description: (form.get("description") as string) || null, dueDate: (form.get("dueDate") as string) || null, status, classReference: (form.get("classReference") as string) || null`,
    editExtraImports: `import { SURVEY_TYPES } from "@/lib/superintendent/constants";`,
    editForm: `
            <div className="space-y-2">
              <Label>Survey type *</Label>
              <Select value={surveyType} onValueChange={(v) => setSurveyType(v ?? item.surveyType)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SURVEY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" defaultValue={item.title} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} defaultValue={item.description ?? ""} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due date</Label>
                <Input id="dueDate" name="dueDate" type="date" defaultValue={toDateInput(item.dueDate)} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v ?? item.status)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["pending","in_progress","completed","deferred"].map((s) => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="classReference">Class reference</Label>
              <Input id="classReference" name="classReference" defaultValue={item.classReference ?? ""} />
            </div>`,
    editState: `const [surveyType, setSurveyType] = useState("class_survey"); const [status, setStatus] = useState("pending");`,
    editStateInit: `setSurveyType(item.surveyType); setStatus(item.status);`,
    editSubmit: `surveyType, title: form.get("title") as string, description: (form.get("description") as string) || null, dueDate: (form.get("dueDate") as string) || null, status, classReference: (form.get("classReference") as string) || null`,
    editHelpers: `function toDateInput(value: string | null): string { if (!value) return ""; return new Date(value).toISOString().slice(0, 10); }`,
  },
  {
    editDescription: "item.partName",
    slug: "spares",
    routeBase: "/superintendent/spares",
    apiPath: "/api/superintendent/spares",
    responseKey: "sparesItem",
    title: "Spares & stores",
    description: "Required parts and delivery status.",
    tableTitle: "Spares items",
    listColumns: [
      { header: "Part name", cell: "(row) => row.partName" },
      { header: "Quantity", cell: "(row) => row.quantity" },
      { header: "Status", cell: "(row) => row.status" },
    ],
    typeFields: `partName: string; partNumber: string | null; quantity: number; supplyType: string; status: string; requiredDate: string | null; notes: string | null;`,
    newForm: `
            <DryDockProjectSelect value={projectId} onChange={setProjectId} required />
            <div className="space-y-2">
              <Label htmlFor="partName">Part name *</Label>
              <Input id="partName" name="partName" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="partNumber">Part number</Label>
                <Input id="partNumber" name="partNumber" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input id="quantity" name="quantity" type="number" defaultValue={1} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="supplyType">Supply type</Label>
                <Input id="supplyType" name="supplyType" defaultValue="yard" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v ?? "required")}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["required","ordered","delivered","pending","cancelled"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="requiredDate">Required date</Label>
              <Input id="requiredDate" name="requiredDate" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>`,
    newState: `const [projectId, setProjectId] = useState(""); const [status, setStatus] = useState("required");`,
    newSubmit: `dryDockProjectId: projectId, partName: form.get("partName") as string, partNumber: (form.get("partNumber") as string) || null, quantity: Number(form.get("quantity") || 1), supplyType: (form.get("supplyType") as string) || "yard", status, requiredDate: (form.get("requiredDate") as string) || null, notes: (form.get("notes") as string) || null`,
    editForm: `
            <div className="space-y-2">
              <Label htmlFor="partName">Part name *</Label>
              <Input id="partName" name="partName" defaultValue={item.partName} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="partNumber">Part number</Label>
                <Input id="partNumber" name="partNumber" defaultValue={item.partNumber ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input id="quantity" name="quantity" type="number" defaultValue={item.quantity} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="supplyType">Supply type</Label>
                <Input id="supplyType" name="supplyType" defaultValue={item.supplyType} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v ?? item.status)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["required","ordered","delivered","pending","cancelled"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="requiredDate">Required date</Label>
              <Input id="requiredDate" name="requiredDate" type="date" defaultValue={toDateInput(item.requiredDate)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} defaultValue={item.notes ?? ""} />
            </div>`,
    editState: `const [status, setStatus] = useState("required");`,
    editStateInit: `setStatus(item.status);`,
    editSubmit: `partName: form.get("partName") as string, partNumber: (form.get("partNumber") as string) || null, quantity: Number(form.get("quantity") || 1), supplyType: (form.get("supplyType") as string) || item.supplyType, status, requiredDate: (form.get("requiredDate") as string) || null, notes: (form.get("notes") as string) || null`,
    editHelpers: `function toDateInput(value: string | null): string { if (!value) return ""; return new Date(value).toISOString().slice(0, 10); }`,
  },
  {
    editDescription: "item.title",
    slug: "approvals",
    routeBase: "/superintendent/approvals",
    apiPath: "/api/superintendent/approvals",
    responseKey: "approval",
    title: "Approval requests",
    description: "Pending budget, scope, and VO approvals.",
    tableTitle: "Approvals",
    listColumns: [
      { header: "Type", cell: "(row) => row.approvalType.replace(/_/g, ' ')" },
      { header: "Title", cell: "(row) => row.title" },
      { header: "Amount", cell: "(row) => fmtMoney(row.amount)" },
      { header: "Status", cell: "(row) => row.status" },
    ],
    listExtraImports: `import { fmtMoney } from "@/lib/superintendent/formatters";`,
    typeFields: `approvalType: string; title: string; description: string | null; amount: number | null; status: string;`,
    newExtraImports: `import { APPROVAL_TYPES } from "@/lib/superintendent/constants";`,
    newForm: `
            <DryDockProjectSelect value={projectId} onChange={setProjectId} required />
            <div className="space-y-2">
              <Label>Approval type *</Label>
              <Select value={approvalType} onValueChange={(v) => setApprovalType(v ?? "budget")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {APPROVAL_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" name="amount" type="number" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v ?? "pending")}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["pending","approved","rejected","cancelled"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>`,
    newState: `const [projectId, setProjectId] = useState(""); const [approvalType, setApprovalType] = useState("budget"); const [status, setStatus] = useState("pending");`,
    newSubmit: `dryDockProjectId: projectId, approvalType, title: form.get("title") as string, description: (form.get("description") as string) || null, amount: form.get("amount") ? Number(form.get("amount")) : null, status`,
    editExtraImports: `import { APPROVAL_TYPES } from "@/lib/superintendent/constants";`,
    editForm: `
            <div className="space-y-2">
              <Label>Approval type *</Label>
              <Select value={approvalType} onValueChange={(v) => setApprovalType(v ?? item.approvalType)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {APPROVAL_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" defaultValue={item.title} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} defaultValue={item.description ?? ""} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" name="amount" type="number" defaultValue={item.amount ?? ""} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v ?? item.status)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["pending","approved","rejected","cancelled"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>`,
    editState: `const [approvalType, setApprovalType] = useState("budget"); const [status, setStatus] = useState("pending");`,
    editStateInit: `setApprovalType(item.approvalType); setStatus(item.status);`,
    editSubmit: `approvalType, title: form.get("title") as string, description: (form.get("description") as string) || null, amount: form.get("amount") ? Number(form.get("amount")) : null, status`,
  },
];

function routeToFile(routeBase) {
  const rel = routeBase.replace(/^\//, "");
  return path.join(ROOT, "app", rel);
}

function genList(e) {
  const cols = e.listColumns
    .map(
      (c) =>
        `          { header: "${c.header}", cell: (row) => ${c.cell.replace(/^\(row\) => /, "")} }`,
    )
    .join(",\n");
  const extraImports = e.listExtraImports ?? "";
  return `"use client";

import Link from "next/link";
import { EntityListPage } from "@/components/superintendent/EntityListPage";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
${extraImports}

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  ${e.typeFields}
};

export default function ListPage() {
  return (
    <PageShell>
      <PageHeader
        title="${e.title}"
        description="${e.description}"
        actions={
          <Button render={<Link href="${e.routeBase}/new" />} nativeButton={false}>
            Add
          </Button>
        }
      />
      <EntityListPage<Row>
        title="${e.tableTitle}"
        description="${e.description}"
        apiPath="${e.apiPath}"
        newHref="${e.routeBase}/new"
        editHref={(id) => \`${e.routeBase}/\${id}/edit\`}
        searchParam=""
        columns={[
${cols},
        ]}
      />
    </PageShell>
  );
}
`;
}

function genNew(e) {
  return `"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import {
  EntityFormActions,
  useEntityFormSubmit,
} from "@/components/superintendent/EntityListPage";
import { DryDockProjectSelect } from "@/components/superintendent/DryDockProjectSelect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
${e.newExtraImports ?? ""}

export const dynamic = "force-dynamic";

export default function NewPage() {
  const router = useRouter();
  ${e.newState}
  const { saving, error, submit } = useEntityFormSubmit(
    "${e.apiPath}",
    "create",
    undefined,
    "${e.routeBase}",
  );

  return (
    <PageShell>
      <PageHeader title="New record" description="${e.description}" />

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void submit({ ${e.newSubmit} });
            }}
          >
${e.newForm}
            <EntityFormActions saving={saving} onCancel={() => router.push("${e.routeBase}")} />
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
`;
}

function genEdit(e) {
  const typeName = e.responseKey.charAt(0).toUpperCase() + e.responseKey.slice(1);
  return `"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import {
  EntityFormActions,
  useEntityFormSubmit,
} from "@/components/superintendent/EntityListPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
${e.editExtraImports ?? e.newExtraImports ?? ""}

export const dynamic = "force-dynamic";

type Item = { id: string; ${e.typeFields} };

${e.editHelpers ?? ""}

export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<Item | null>(null);
  ${e.editState}
  const { saving, error, submit } = useEntityFormSubmit(
    "${e.apiPath}",
    "edit",
    id,
    "${e.routeBase}",
  );

  useEffect(() => {
    void fetch(\`${e.apiPath}/\${id}\`)
      .then((r) => r.json())
      .then((d) => {
        const row = d.${e.responseKey};
        if (row) {
          setItem(row);
          ${e.editStateInit.replace(/item\./g, "row.")}
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </PageShell>
    );
  }

  if (!item) {
    return (
      <PageShell>
        <p className="text-sm text-destructive">Record not found.</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title="Edit record" description={${e.editDescription ?? `item.title ?? "${e.title}"`}} />

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void submit({ ${e.editSubmit} });
            }}
          >
${e.editForm}
            <EntityFormActions saving={saving} onCancel={() => router.push("${e.routeBase}")} />
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
`;
}

let count = 0;
for (const e of entities) {
  const base = routeToFile(e.routeBase);
  const listPath = path.join(base, "page.tsx");
  const newPath = path.join(base, "new", "page.tsx");
  const editPath = path.join(base, "[id]", "edit", "page.tsx");

  fs.mkdirSync(path.dirname(listPath), { recursive: true });
  fs.mkdirSync(path.dirname(newPath), { recursive: true });
  fs.mkdirSync(path.dirname(editPath), { recursive: true });

  fs.writeFileSync(listPath, genList(e));
  fs.writeFileSync(newPath, genNew(e));
  fs.writeFileSync(editPath, genEdit(e));
  count += 3;
  console.log("Created", e.slug);
}

console.log("Total entity pages:", count);

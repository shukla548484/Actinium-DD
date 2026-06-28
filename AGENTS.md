<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:dry-dock-pm-engine -->
# Dry Dock Project Management Engine

Every Dry Dock feature must belong to a **DryDockProject** workspace. Implementation lives in `lib/superintendent/engine/`.

Before adding pages or APIs, answer:
1. **Which Project Type** requires this? (DD01–DD10 in `projectTypes.ts`)
2. **Which Module** owns it? (registry in `projectModules.ts`)

Project creation uses the **Template Engine** (`projectTemplates.ts` + `provisionWorkspace.ts`) to auto-seed jobs, checklists, milestones, surveys, budget lines, approvals, documents, and RFQ steps. Do not build standalone CRUD that bypasses the project workspace.
<!-- END:dry-dock-pm-engine -->

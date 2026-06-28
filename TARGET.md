# Strategic Targets — Actinium-DD

## Positioning vs Maindeck

We are NOT competing head-to-head with Maindeck. We fill the gaps their enterprise portal leaves open.

---

## Target Matrix

| # | Maindeck Weakness | Our Opportunity | Status |
|---|-------------------|-----------------|--------|
| 1 | Needs yard portal adoption — yards must log in | **Work with any Excel the yard sends** — no portal, no login, no format enforcement | 🟡 In progress |
| 2 | Generic line comparison — flat work-order items | **Hull zone + prep treatment intelligence** — zone-aware cost logic, SA grades, wash/dry chains | 🟡 In progress |
| 3 | Opaque missing-area handling — auto-estimates without transparency | **Paint Consultants formula + "estimated" badge** — show the math, let user override | 🟡 In progress |
| 4 | Weak paint-specific logic — paint is just another work order | **Deep modules: hull paint → dry dock days → yard services** — domain-first design | 🟡 In progress |
| 5 | Heavy enterprise platform — demo calls, training, suite lock-in | **Lightweight, local, superintendent-controlled tool** — open file, get answers, no account | ✅ Done |

---

## Implementation Priorities

### Target 1: Work with any Excel the yard sends
- [x] Accept .xlsx/.xls from any yard — no template required
- [ ] Multi-format header detection (handle 10+ column naming conventions)
- [ ] Merged cell handling (yards love merges)
- [ ] Auto-detect currency and units (USD, SGD, EUR + m², ft²)
- [ ] Tolerate blank rows, repeated headers, multi-sheet scoping
- [ ] "Raw parse preview" so user sees what was extracted before comparison

### Target 2: Hull zone + prep treatment intelligence
- [x] Boot top / flat bottom / vertical bottom / topside detection
- [x] SA 1 / SA 1.5 / SA 2 / SA 2.5 blasting grades
- [ ] Paint coating systems (primer, AF, topcoat) with DFT awareness
- [ ] Prep chain validation: is SA 2.5 overkill for boot top?
- [ ] Zone-specific cost benchmarks (flag outlier rates)
- [ ] Percentage completion parse (e.g. "30% spot blast, 70% sweep")

### Target 3: Paint Consultants formula + estimated badge
- [x] LOA/LBP/Breadth/Depth/Draught → zone areas
- [x] Hull factor by vessel type (0.67–0.92)
- [x] LLL split for boot top vs side bottom
- [ ] Show formula breakdown in UI (not just result)
- [ ] Side-by-side: sheet area vs estimated area (highlight discrepancies)
- [ ] Allow user to lock/override per-zone area

### Target 4: Deep modules (roadmap)
- [x] Hull paint module
- [x] Dry dock days & hire cost module
- [x] Yard services module (watch, utilities, temp equipment)
- [ ] Anchoring / tug / pilot costs
- [ ] Steel repair / renewal (kg-based pricing)
- [ ] Machinery overhaul (pump/valve/engine - flat rate items)
- [ ] Tank cleaning / gas-freeing

### Target 5: Lightweight local tool
- [x] No login, no account, no server (compare mode)
- [x] All processing in browser (XLSX parsed client-side)
- [x] Auto-port selection (no EADDRINUSE headaches)
- [x] Tauri desktop MVP in `desktop/` (interim SQLite — see sync plan)
- [ ] **Five-node sync topology** — Office ↔ VPS relay ↔ Ship/Superintendent Postgres ([docs/sync/ARCHITECTURE.md](docs/sync/ARCHITECTURE.md))
- [ ] Local PostgreSQL on ship + superintendent (replace SQLite)
- [ ] Bucardo sync via VPS relay (same model as app-pms-updated)
- [ ] Yard online direct to office DB (no relay)

---

## Core Principle

> The superintendent has a yard Excel in hand. In 60 seconds they need a comparison.
> No portal. No login. No training. Just drag, drop, compare, decide.

## Infrastructure

Five-node architecture (Office, VPS relay, Ship offline Postgres, Superintendent offline Postgres, Yard online → Office). Full plan: **[docs/sync/ARCHITECTURE.md](docs/sync/ARCHITECTURE.md)**.

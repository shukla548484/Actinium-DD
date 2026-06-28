# Actinium-DD — Color Theme

Industrial maritime palette: **Black · Rose · Orange · Deep Yellow**.

## Palette

| Token | Hex | Use |
|-------|-----|-----|
| **Black** | `#0a0a0a` | Sidebar, primary buttons, “All services” tab |
| **Black soft** | `#18181b` | Headings, hover states |
| **Rose** | `#be123c` | Hull paint module, comparing status |
| **Rose muted** | `#fff1f2` | Hull cards, active tab background |
| **Orange** | `#c2410c` | Dry dock module, tendering status |
| **Orange muted** | `#fff7ed` | Dry dock cards |
| **Deep yellow** | `#a16207` | Yard services module, highlights |
| **Yellow muted** | `#fefce8` | Yard services cards |
| **Surface warm** | `#f8f6f3` | Page background |

## Module mapping (compare app)

| Tab | Accent | Card style |
|-----|--------|------------|
| Hull paint | Rose | Rose-tinted gradient card |
| Dry dock | Orange | Orange-tinted gradient card |
| Yard services | Deep yellow | Yellow-tinted gradient card |
| All services | Black | Neutral + black active tab |

## Portal status badges

| Status | Color |
|--------|-------|
| Draft | Zinc (neutral) |
| Tendering | Orange |
| Comparing | Rose |
| Closed | Black muted |

## Implementation

- CSS tokens: `styles/dd-theme.css`
- TypeScript helpers: `lib/theme/index.ts`
- Imported in `app/globals.css` and `desktop/src/styles.css`

## Global spacing (Actinium-style shell)

| Token | Value | Use |
|-------|-------|-----|
| `--dd-nav-height` | 3.5rem | Top navigation bar |
| `--dd-page-px` | 1.5rem (2rem desktop) | Horizontal page padding |
| `--dd-page-py` | 1.25rem (1.5rem desktop) | Vertical page padding |
| `--dd-section-gap` | 1.5rem | Gap between sections |
| `--dd-card-padding` | 1.5rem | Inner card padding |

Use `.dd-page`, `.dd-stack`, `.dd-app-shell`, `.dd-top-nav` from `styles/dd-layout.css`.

## Top navigation modules

| Nav item | Maps to |
|----------|---------|
| Company | Fleet / vessel scope |
| Job Creations | `/projects` — tender projects |
| Purchase Module | Spec, yards, comparison |
| Tasks Pending | Open tenders (badge count) |
| User profile | Avatar menu (sign out on portal) |


- Generic blue/purple for primary actions (replaced by theme accents)
- Dark mode auto-switch (light theme only for now; sidebar is always black)

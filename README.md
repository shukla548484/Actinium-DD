# Excel-Sheet-Comp

Compare vendor service quotes from Excel files. Different vendors often label the same service differently or place items under different headings — this app normalizes those rows into a **standard service list** and builds a **vertical comparison** of costs.

## Features

- Upload multiple `.xlsx` / `.xls` files (one per vendor)
- Auto-detect headers, categories/section headings, and priced line items
- Fuzzy-match similar service names across vendors (adjustable sensitivity)
- Preview comparison table with lowest total highlighted per row
- Download standardized comparison Excel

## Getting started (local only — no publish required)

```bash
npm install
npm run dev
```

Open the URL printed in the terminal (starts at **http://localhost:3000**).

`npm run dev` and `npm run start` automatically use the next free port if 3000 is busy (3001, 3002, …). Override the starting port with `PORT=4000 npm run dev`.

Production build locally:

```bash
npm run build
npm run start
```

## Excel format tips

Works best when each vendor file has:

- A header row with columns like *Description*, *Qty*, *Unit Price*, *Total*
- Section headings as text-only rows (no prices)
- One priced row per service

If headers are missing, the parser uses the leftmost text column as the service name and the rightmost numeric columns as prices.

## Stack

- Next.js (App Router, no `src/` folder)
- [SheetJS (xlsx)](https://sheetjs.com/) — read/write Excel
- [Fuse.js](https://fusejs.io/) — fuzzy service name matching

## Project structure

```
app/           # Next.js routes
components/    # UI
lib/
  excel/       # Parse & export
  matching/    # Normalize & fuzzy match
```

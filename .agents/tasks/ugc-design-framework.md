---
persona: Design Framework
phase: 1
priority: HIGH
deadline: 2026-06-06
status: waiting-on-phase-0
---

# Task: UGC Dashboard UI

## Goal
Build three pages and five components in hermes-hub that let clients submit
briefs, review variants, approve favourites, and download deliverables. The
admin view shows all orders and pipeline metrics.

## Pre-condition
Hermes Gateway task must be complete — `/api/ugc/*` routes must exist before
the frontend fetches data.

## Constraints
- Use existing Tailwind + Lucide icons (already in package.json)
- Match existing hermes-hub design language: dark bg, glass panels, green accent (#00FF88)
- Reference `KnowledgeBasePage.tsx` for 3D / glass panel composition
- Reference `InstagramPage.tsx` for variant card + approval flow pattern
- All pages must be responsive (mobile-first; clients may open on phone)
- No new npm dependencies unless critical (prefer existing ones)
- Run `npm run lint` in hermes-hub before marking done

## Files to create

### `hermes-hub/src/pages/UGCIntakePage.tsx`
Lead capture form. Client submits this to start a new UGC order.

Fields (single-page form, 2-column layout on desktop, 1-column mobile):
- Left column: Company name, Email, Product name, Product category (dropdown)
- Right column: Brand tone (textarea), Campaign brief (textarea)
- Full-width: Hashtag bank (textarea, one per line), CTA variants (textarea), Banned words (textarea)
- Bottom row: Spots purchased (radio: 3/5/10), Budget GBP (number input), Submit button

On submit:
- POST to `/api/ugc/intake`
- Show success toast: "✅ Brief received — we'll generate your videos within 24 hours"
- Redirect to `/ugc-orders` after 2s

Glass panel style: `bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-6`

---

### `hermes-hub/src/pages/UGCOrdersPage.tsx`
Admin order list + per-client detail view. Two sub-views via URL param:

**List view** (`/ugc-orders`):
- Fetch `GET /api/ugc/orders`
- Table columns: Company | Product | Status (badge) | Budget | Created | View button
- Status badge colours: intake=gray, approved=blue, generating=amber, delivered=green, published=purple
- Empty state: "No orders yet — share your intake link to get started"

**Detail view** (`/ugc-orders/:clientId`):
- Fetch `GET /api/ugc/orders/:clientId`
- Header: client name, product, brief summary, status badge
- Variant grid: `<VariantGrid variants={variants} onApprove={handleApprove} />`
- Action bar: Download Zip button + Approve Selected button

---

### `hermes-hub/src/pages/UGCMetricsPage.tsx`
Admin-only pipeline KPI dashboard.

Fetch `GET /api/ugc/metrics` and render:
- Pipeline value card (£ sum of active deals)
- Order count by status (mini bar chart or stat cards)
- Average deal size
- Link to orders list

Use same card component pattern as existing GA4 dashboard.

---

### `hermes-hub/src/components/VariantGrid.tsx`
```typescript
interface Props {
  variants: UGCVariant[]
  onApprove?: (ids: string[]) => void
}
```
5-column grid (3 on tablet, 1 on mobile). Maps `variants` to `<VariantCard />`.
Shows "Select 2–3 favourites" helper text above grid.
Tracks selected variant IDs in local state.
"Approve Selected" button triggers `onApprove(selectedIds)`.

---

### `hermes-hub/src/components/VariantCard.tsx`
```typescript
interface Props {
  variant: UGCVariant
  selected: boolean
  onSelect: (id: string) => void
}
```
Card layout:
- Thumbnail (img if thumbnail_path exists, else placeholder with hook_style icon)
- Hook style label (badge)
- Hook text (2-line truncated)
- Caption (1-line truncated, copy button)
- Play button if render_path exists (opens in new tab or modal)
- Checkbox overlay (bottom-right corner) — checked = selected

Selected state: ring-2 ring-[#00FF88] border

---

### `hermes-hub/src/components/ApprovalPanel.tsx`
```typescript
interface Props {
  clientId: string
  selectedVariantIds: string[]
  onApproved: () => void
}
```
Sticky bottom panel (fixed bottom on desktop, static on mobile):
- Left: "{N} variants selected"
- Right: Download Zip link + Approve button
- Approve calls POST `/api/ugc/orders/:clientId/approve`
- Download opens GET `/api/ugc/orders/:clientId/download`

---

## Files to modify

### `hermes-hub/src/App.tsx`
Add routes:
```typescript
import UGCIntakePage from './pages/UGCIntakePage'
import UGCOrdersPage from './pages/UGCOrdersPage'
import UGCMetricsPage from './pages/UGCMetricsPage'

// In router:
<Route path="/ugc-intake" element={<UGCIntakePage />} />
<Route path="/ugc-orders" element={<UGCOrdersPage />} />
<Route path="/ugc-orders/:clientId" element={<UGCOrdersPage />} />
<Route path="/ugc-metrics" element={<UGCMetricsPage />} />
```

### `hermes-hub/src/components/Sidebar.tsx`
Add UGC section (after existing Instagram section):
```typescript
{
  label: 'UGC',
  items: [
    { label: 'New Order', href: '/ugc-intake', icon: PlusCircle },
    { label: 'Orders', href: '/ugc-orders', icon: Package },
    { label: 'Metrics', href: '/ugc-metrics', icon: BarChart2 },
  ]
}
```

## Type import
```typescript
import type { UGCVariant } from '../../types/ugc' // or wherever hermes-hub resolves it
```
If types live in severus-social, copy the relevant interfaces into `hermes-hub/src/types/ugc.ts`.

## Return format
On completion, report:
```
DESIGN FRAMEWORK REPORT — UGC Phase 1
Status: complete | blocked
Pages created: [list]
Components created: [list]
TypeScript errors: none | [list]
Lint: clean | [list]
Manual test: open /ugc-intake → submit form → view in /ugc-orders → approve → download zip
Notes: [design decisions or deviations]
```

## Budget
- Max 7 hours wall time
- PR: `feat(ugc): add UGC intake, orders, and metrics pages`

## Reference
- Existing page pattern: `hermes-hub/src/pages/KnowledgeBasePage.tsx` (glass panels, 3D)
- Existing variant card: `hermes-hub/src/pages/InstagramPage.tsx`
- Design tokens: `hermes-hub/src/styles/` (Tailwind config for dark bg, #00FF88 accent)
- Plan doc: `.claude/plans/but-using-the-tools-groovy-comet.md`

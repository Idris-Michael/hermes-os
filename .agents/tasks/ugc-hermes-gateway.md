---
persona: Hermes Gateway
phase: 1
priority: HIGH
deadline: 2026-06-04
status: waiting-on-phase-0
---

# Task: UGC API Routes

## Goal
Add `/api/ugc/*` Express routes to hermes-hub so the frontend dashboard and
clients can submit briefs, fetch orders, approve variants, and download zips.

## Pre-condition
Phase 0 (Social Agent task) must be complete — ugc_clients, ugc_jobs,
ugc_variants tables must exist in the DB before this task starts.

## Constraints
- Follow existing `/api/ig/*` route pattern in `hermes-hub/server.ts` (line ~140)
- All routes require HMAC token validation for client-facing endpoints (reuse existing pattern)
- Admin-only routes (list all orders, metrics) must check for admin session/env var
- Zip download must use Node `archiver` or `jszip` (don't shell out to `zip`)
- Run `npm run build` in hermes-hub to verify no TypeScript errors

## File to modify: `hermes-hub/server.ts`

Add after existing `/api/ig/` routes:

```typescript
// ── UGC Client Service ──────────────────────────────────────────────────────

// POST /api/ugc/intake — Submit client brief form
app.post('/api/ugc/intake', express.json(), async (req, res) => {
  const { name, handle, email, product_name, product_category, brief, tone,
          hashtag_bank, banned_words, cta_variants, budget_gbp, spots_purchased } = req.body
  if (!name || !email || !product_name) {
    return res.status(400).json({ error: 'name, email, product_name required' })
  }
  const id = crypto.randomUUID()
  db.prepare(`
    INSERT INTO ugc_clients (id, name, handle, email, product_name, product_category, brief, tone,
      hashtag_bank, banned_words, cta_variants, budget_gbp, spots_purchased)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, handle ?? name.toLowerCase().replace(/\s+/g, '-'),
    email, product_name, product_category, brief, tone,
    JSON.stringify(hashtag_bank ?? []), JSON.stringify(banned_words ?? []),
    JSON.stringify(cta_variants ?? []), budget_gbp, spots_purchased ?? 5)
  res.json({ clientId: id })
})

// GET /api/ugc/orders — List all clients (admin only)
app.get('/api/ugc/orders', (req, res) => {
  const clients = db.prepare(`
    SELECT c.*, COUNT(j.id) as job_count
    FROM ugc_clients c
    LEFT JOIN ugc_jobs j ON j.client_id = c.id
    GROUP BY c.id ORDER BY c.created_at DESC
  `).all()
  res.json(clients)
})

// GET /api/ugc/orders/:clientId — Get client + jobs + variants
app.get('/api/ugc/orders/:clientId', (req, res) => {
  const client = db.prepare(`SELECT * FROM ugc_clients WHERE id = ?`).get(req.params.clientId)
  if (!client) return res.status(404).json({ error: 'Not found' })
  const jobs = db.prepare(`SELECT * FROM ugc_jobs WHERE client_id = ? ORDER BY created_at DESC`).all(req.params.clientId)
  const variants = db.prepare(`
    SELECT v.* FROM ugc_variants v
    JOIN ugc_jobs j ON j.id = v.job_id
    WHERE j.client_id = ?
  `).all(req.params.clientId)
  res.json({ client, jobs, variants })
})

// POST /api/ugc/orders/:clientId/approve — Client approves specific variants
app.post('/api/ugc/orders/:clientId/approve', express.json(), verifyToken, (req, res) => {
  const { variantIds } = req.body // array of variant IDs client selected
  if (!Array.isArray(variantIds) || variantIds.length === 0) {
    return res.status(400).json({ error: 'variantIds array required' })
  }
  db.prepare(`UPDATE ugc_clients SET status = 'approved', updated_at = datetime('now') WHERE id = ?`).run(req.params.clientId)
  res.json({ approved: variantIds })
})

// GET /api/ugc/orders/:clientId/download — Zip of all MP4s + captions.json
app.get('/api/ugc/orders/:clientId/download', async (req, res) => {
  // Requires archiver package: npm install archiver @types/archiver
  const { default: archiver } = await import('archiver')
  const variants = db.prepare(`
    SELECT v.* FROM ugc_variants v
    JOIN ugc_jobs j ON j.id = v.job_id
    WHERE j.client_id = ?
  `).all(req.params.clientId) as any[]

  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="ugc-${req.params.clientId}.zip"`)

  const archive = archiver('zip', { zlib: { level: 6 } })
  archive.pipe(res)

  const captions: Record<string, string> = {}
  for (const v of variants) {
    if (v.render_path && fs.existsSync(v.render_path)) {
      archive.file(v.render_path, { name: `${v.hook_style}-${v.id}.mp4` })
    }
    captions[v.id] = v.caption
  }
  archive.append(JSON.stringify(captions, null, 2), { name: 'captions.json' })
  await archive.finalize()
})

// GET /api/ugc/metrics — Pipeline KPIs
app.get('/api/ugc/metrics', (req, res) => {
  const pipeline_value = db.prepare(`
    SELECT COALESCE(SUM(budget_gbp), 0) as value
    FROM ugc_clients WHERE status IN ('approved','generating','delivered','published')
  `).get() as any
  const counts = db.prepare(`
    SELECT status, COUNT(*) as count FROM ugc_clients GROUP BY status
  `).all()
  const avg_deal = db.prepare(`
    SELECT COALESCE(AVG(budget_gbp), 0) as avg FROM ugc_clients WHERE budget_gbp > 0
  `).get() as any
  res.json({
    pipeline_value_gbp: pipeline_value?.value ?? 0,
    status_counts: counts,
    avg_deal_gbp: avg_deal?.avg ?? 0
  })
})
```

Note: `verifyToken` middleware already exists in server.ts for the Instagram approval route — reuse it.

## Return format
On completion, report:
```
HERMES GATEWAY REPORT — UGC Phase 1
Status: complete | blocked
Routes added: [list of endpoints]
TypeScript errors: none | [list]
Manual test: POST /api/ugc/intake → verify 201 + DB row, GET /api/ugc/orders → verify list
Notes: [any surprises]
```

## Budget
- Max 2 hours wall time
- Single PR: `feat(ugc): add /api/ugc/* routes to hermes-hub`

## Reference
- Existing pattern: `hermes-hub/server.ts` lines ~140–230 (ig routes)
- Plan doc: `.claude/plans/but-using-the-tools-groovy-comet.md`

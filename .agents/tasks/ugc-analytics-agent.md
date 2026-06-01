---
persona: Analytics Agent
phase: 1
priority: MEDIUM
deadline: 2026-06-08
status: waiting-on-phase-1
---

# Task: UGC Pipeline Metrics Dashboard

## Goal
Track UGC pipeline value, win rate, deal velocity, and variant performance
so Idris can see at a glance whether the service is generating revenue.

## Pre-condition
- Phase 0 complete (DB tables exist, heartbeat running)
- Phase 1 routes complete (`/api/ugc/metrics` endpoint live)
- Design Framework `UGCMetricsPage.tsx` scaffold created

## Constraints
- Query existing `ugc_clients`, `ugc_jobs`, `ugc_variants`, `ugc_metrics` tables
- No new DB tables required at this stage
- If Meta / TikTok API tokens not yet configured, metrics fall back to DB-stored data only
- All queries must complete in <50ms (index on `ugc_clients.status` if needed)

## SQL queries to implement (add to hermes-hub/server.ts GET /api/ugc/metrics)

```sql
-- Pipeline value (active + delivered deals)
SELECT COALESCE(SUM(budget_gbp), 0) AS pipeline_value_gbp
FROM ugc_clients
WHERE status IN ('approved', 'generating', 'delivered', 'published');

-- Funnel by status
SELECT status, COUNT(*) AS count
FROM ugc_clients
GROUP BY status;

-- Average deal size
SELECT COALESCE(AVG(budget_gbp), 0) AS avg_deal_gbp
FROM ugc_clients
WHERE budget_gbp IS NOT NULL AND budget_gbp > 0;

-- Delivery velocity (avg hours from intake to delivered)
SELECT AVG(
  (julianday(updated_at) - julianday(created_at)) * 24
) AS avg_delivery_hours
FROM ugc_clients
WHERE status = 'delivered';

-- Variant output per job
SELECT j.client_id, COUNT(v.id) AS variant_count
FROM ugc_jobs j
LEFT JOIN ugc_variants v ON v.job_id = j.id
GROUP BY j.client_id;
```

## Dashboard metrics (extend UGCMetricsPage.tsx)

Stat cards (2×2 grid on desktop, 1-col stack on mobile):
1. **Pipeline value** — £X active/in-progress
2. **Orders** — X total, X delivered, X in progress
3. **Avg deal size** — £X per contract
4. **Delivery time** — avg X hours from intake to variants ready

Below stat cards:
- Funnel table: status | count | % of total
- Top 3 hook styles by approval rate (once ugc_metrics has approval data)

## Tracking additions (future, Phase 2)

Once variants are published to platforms, add to POST `/api/ugc/orders/:clientId/approve`:
```typescript
// Store per-variant approval signal
db.prepare(`
  INSERT INTO ugc_metrics (id, variant_id, platform, reach, engagement, saves, shares, watch_pct)
  VALUES (?, ?, 'client-approved', 0, 0, 0, 0, 0)
`).run(crypto.randomUUID(), variantId)
```

This seeds the metrics table for later platform performance correlation.

## Return format
```
ANALYTICS AGENT REPORT — UGC Phase 1
Status: complete | blocked
Metrics implemented: [list]
Queries optimised: yes | no (index added?)
Manual test: GET /api/ugc/metrics → verify JSON shape matches UGCMetricsPage expectations
Notes: [any data quality issues]
```

## Budget
- Max 2 hours wall time
- PR: `feat(ugc): add pipeline metrics queries and dashboard cards`

## Reference
- DB schema: `severus-social/store/migrations/002_ugc_clients.sql`
- Metrics page scaffold: `hermes-hub/src/pages/UGCMetricsPage.tsx` (from Design Framework)
- Existing analytics pattern: `hermes-hub/src/pages/` GA4 dashboard for card layout
- Plan doc: `.claude/plans/but-using-the-tools-groovy-comet.md`

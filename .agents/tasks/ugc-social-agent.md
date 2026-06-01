---
persona: Social Agent
phase: 0
priority: HIGH
deadline: 2026-05-29
status: ready
---

# Task: UGC Pipeline Refactors

## Goal
Extend the Instagram content pipeline to support UGC client jobs by adding an
optional `client` parameter to three core functions and adding a new
`runUGCHeartbeat()` orchestrator. Zero new rendering logic — only parameterization.

## Constraints
- Do NOT change the existing Instagram heartbeat path (accounts: mikeb, severus)
- Do NOT modify Qwen API call shape — only prompt context strings
- Do NOT modify Hyperframes render command — only DB insert target
- Requires approval before running database migrations in production
- All new code must pass `npx tsc --noEmit` without errors

## Files to modify

### 1. `severus-social/pipeline/generateScript.ts`
Change signature from:
```typescript
export async function generateScript(account: Account, hookStyle: HookStyle, recentHooks: string[])
```
To:
```typescript
import type { UGCClient } from '../types/ugc.js'

export async function generateScript(
  account: Account | null,
  hookStyle: HookStyle,
  recentHooks: string[] = [],
  client?: UGCClient
): Promise<ScriptOutput>
```
When `client` is provided, substitute into Qwen prompt:
- Brand tone → `client.tone`
- Hashtags → `JSON.parse(client.hashtag_bank ?? '[]')`
- CTAs → `JSON.parse(client.cta_variants ?? '[]')`
- Banned words → `JSON.parse(client.banned_words ?? '[]')`
- Product context → `client.product_name` + `client.brief`

### 2. `severus-social/pipeline/generateVoiceover.ts`
Change signature from:
```typescript
export async function generateVoiceover(account: Account, scriptLines: string[])
```
To:
```typescript
import type { UGCClient } from '../types/ugc.js'

export async function generateVoiceover(
  account: Account | null,
  scriptLines: string[],
  client?: UGCClient
): Promise<VoiceoverOutput>
```
When `client` is provided with no voice_profile: use Gemini charon voice (same default).
When `account` is null and no client: throw with clear error message.

### 3. `severus-social/pipeline/createVariants.ts`
Change signature from:
```typescript
export async function createVariants(account: Account, slotId: string, scripts: ScriptOutput[])
```
To:
```typescript
import type { UGCClient } from '../types/ugc.js'

export async function createVariants(
  account: Account | null,
  jobId: string,
  scripts: ScriptOutput[],
  isUGC?: boolean
): Promise<RenderedVariant[]>
```
When `isUGC=true`:
- Insert rendered variants into `ugc_variants` table (columns: id, job_id, hook_style, hook_text, caption, script_json, render_path, thumbnail_path)
- Use `jobId` as the foreign key (`job_id` column)
When `isUGC=false` (default):
- Existing behaviour unchanged (insert into `variants` table, use `slotId` as `slot_id`)

### 4. `severus-social/pipeline/heartbeat.ts`
Add new function `runUGCHeartbeat()` after existing `runHeartbeat()`:

```typescript
import { notifyUGCClient } from './notifyUGCClient.js'
import type { UGCJob, UGCClient } from '../types/ugc.js'

async function runUGCHeartbeat() {
  console.log(`[heartbeat:ugc] Starting — ${new Date().toISOString()}`)
  const db = getDb()
  const ugcMigration = fs.readFileSync(
    path.resolve(__dirname, '../store/migrations/002_ugc_clients.sql'),
    'utf8'
  )
  db.exec(ugcMigration)

  const pendingJobs = db.prepare(`
    SELECT id, client_id, brief, hook_styles, pillar, target_duration_s
    FROM ugc_jobs WHERE approval_state = 'pending'
    ORDER BY created_at ASC LIMIT 2
  `).all() as UGCJob[]

  if (pendingJobs.length === 0) {
    console.log('[heartbeat:ugc] No pending jobs')
    return
  }

  for (const job of pendingJobs) {
    const client = db.prepare(`SELECT * FROM ugc_clients WHERE id = ?`).get(job.client_id) as UGCClient
    if (!client) {
      console.error(`[heartbeat:ugc] Client not found for job ${job.id}`)
      continue
    }
    try {
      db.prepare(`UPDATE ugc_jobs SET approval_state = 'generating', updated_at = datetime('now') WHERE id = ?`).run(job.id)
      const hookStyles = (JSON.parse(job.hook_styles) as string[])
      const scripts = await Promise.all(
        hookStyles.map(style => generateScript(null, style as HookStyle, [], client))
      )
      const variants = await createVariants(null, job.id, scripts, true)
      db.prepare(`UPDATE ugc_jobs SET approval_state = 'queued', updated_at = datetime('now') WHERE id = ?`).run(job.id)
      await notifyUGCClient(client, job, variants as unknown as import('../types/ugc.js').UGCVariant[])
      console.log(`[heartbeat:ugc] Job ${job.id} complete — ${variants.length} variants, email sent`)
    } catch (err) {
      db.prepare(`UPDATE ugc_jobs SET approval_state = 'error', updated_at = datetime('now') WHERE id = ?`).run(job.id)
      console.error(`[heartbeat:ugc] Job ${job.id} failed:`, err)
    }
  }
}
```

Export `runUGCHeartbeat` at bottom of file.

### 5. `severus-social/cron.ts`
Import and schedule `runUGCHeartbeat`:
```typescript
import { runUGCHeartbeat } from './pipeline/heartbeat.js'

// After existing Instagram cron jobs:
schedule.scheduleJob('0 6 * * *', async () => {
  console.log('[cron] Running UGC heartbeat')
  await runUGCHeartbeat()
})
```

## Return format
On completion, report:
```
SOCIAL AGENT REPORT — UGC Phase 0
Status: complete | blocked
Files modified: [list]
Tests passing: yes | no
TypeScript errors: none | [list]
Manual test: insert SQL → runUGCHeartbeat() → DB state = queued, variants = N
Notes: [any surprises or deviations]
```

## Budget
- Max 4 hours wall time
- Max 2000 tokens per function change
- All changes in a single PR: `feat(ugc): add client parameterization to pipeline`

## Reference
- Full brief: `.agents/UGC-PHASE-0-BRIEFING.md`
- Type definitions: `severus-social/types/ugc.ts`
- Existing notification pattern: `severus-social/review/notifyHuman.ts`
- New notification function: `severus-social/pipeline/notifyUGCClient.ts`

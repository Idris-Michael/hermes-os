# UGC Phase 0 Agent Briefing
## Minimal Extension (Week 1)

**Project:** UGC Content Sales Pipeline  
**Timeline:** Week 1 (May 23–30, 2026)  
**Owner:** Idris-Michael Bakare  

---

## PHASE 0 OVERVIEW

Repurpose existing Instagram heartbeat to generate UGC videos for paying clients. No new rendering—only parameterization of existing pipeline.

**Status:** Database + notification function ready. Pipeline refactors + cron scheduling needed.

---

## SOCIAL AGENT TASKS

**Owner:** Social Agent  
**Effort:** 4 hours total across Week 1  
**Dependencies:** None

### Task 1: Refactor generateScript.ts (1 hour)

**File:** `severus-social/pipeline/generateScript.ts` (currently ~80 lines)

**Current signature:**
```typescript
export async function generateScript(
  account: Account, 
  hookStyle: HookStyle, 
  recentHooks: string[]
): Promise<ScriptOutput>
```

**Change to:**
```typescript
export async function generateScript(
  account: Account | null, 
  hookStyle: HookStyle, 
  recentHooks: string[] = [], 
  client?: UGCClient
): Promise<ScriptOutput>
```

**Implementation:**
- When `client` param provided: use `client.tone`, `client.hashtag_bank`, `client.cta_variants`, `client.banned_words` in Qwen prompt
- When `account` provided: use existing `accounts[account]` config (mikeb/severus)
- All Qwen API calls remain identical—only prompt context changes
- Return type unchanged

**Success:** Function accepts optional client, Qwen prompt injects client context, test call returns correct ScriptOutput shape

---

### Task 2: Refactor generateVoiceover.ts (1 hour)

**File:** `severus-social/pipeline/generateVoiceover.ts` (currently ~60 lines)

**Current signature:**
```typescript
export async function generateVoiceover(
  account: Account, 
  scriptLines: string[]
): Promise<VoiceoverOutput>
```

**Change to:**
```typescript
export async function generateVoiceover(
  account: Account | null, 
  scriptLines: string[], 
  client?: UGCClient
): Promise<VoiceoverOutput>
```

**Implementation:**
- When `client` param: use client voice profile if provided (future Voicebox integration), otherwise use default Gemini charon voice
- When `account`: use existing `accounts[account].voice` config
- All Gemini API calls remain identical—no new TTS engine required
- Return type unchanged (file path + metadata)

**Success:** Function accepts optional client, Gemini call returns valid WAV, test verifies output path exists

---

### Task 3: Refactor createVariants.ts (1 hour)

**File:** `severus-social/pipeline/createVariants.ts` (currently ~100 lines)

**Current signature:**
```typescript
export async function createVariants(
  account: Account, 
  slotId: string, 
  scripts: ScriptOutput[]
): Promise<RenderedVariant[]>
```

**Change to:**
```typescript
export async function createVariants(
  account: Account | null, 
  jobId: string, 
  scripts: ScriptOutput[], 
  isUGC?: boolean
): Promise<RenderedVariant[]>
```

**Implementation:**
- When `isUGC=true`: insert rows into `ugc_variants` table (via DB connection in `getDb()`)
- When `isUGC=false` (default): insert into `variants` table (existing behavior)
- Replace `slot_id` → `job_id` in table inserts
- Hyperframes render call unchanged (same command + variables)
- Return RenderedVariant[] unchanged

**Success:** Function inserts to correct table based on `isUGC` flag, verify rows appear in ugc_variants when isUGC=true

---

### Task 4: Add runUGCHeartbeat() to heartbeat.ts (1 hour)

**File:** `severus-social/pipeline/heartbeat.ts` (currently ~150 lines)

**Add after existing Instagram heartbeat loop:**
```typescript
async function runUGCHeartbeat() {
  console.log(`[heartbeat:ugc] Starting UGC jobs — ${new Date().toISOString()}`)
  const db = getDb()
  const ugcMigration = fs.readFileSync(
    path.resolve(__dirname, '../store/migrations/002_ugc_clients.sql'),
    'utf8'
  )
  db.exec(ugcMigration) // Run migration on first use

  const pendingJobs = db.prepare(`
    SELECT id, client_id, brief, hook_styles, pillar, target_duration_s, approval_state
    FROM ugc_jobs WHERE approval_state = 'pending' 
    ORDER BY created_at ASC LIMIT 2
  `).all() as UGCJob[]

  for (const job of pendingJobs) {
    const client = db.prepare(`SELECT * FROM ugc_clients WHERE id = ?`).get(job.client_id) as UGCClient
    try {
      const hookStyles = JSON.parse(job.hook_styles) as HookStyle[]
      const scripts = await Promise.all(
        hookStyles.map(style => generateScript(null, style, [], client))
      )
      const variants = await createVariants(null, job.id, scripts, true)
      db.prepare(`UPDATE ugc_jobs SET approval_state = 'queued' WHERE id = ?`).run(job.id)
      await notifyUGCClient(client, job, variants)
      console.log(`[heartbeat:ugc] Job ${job.id} completed — sent notification to ${client.email}`)
    } catch (err) {
      db.prepare(`UPDATE ugc_jobs SET approval_state = 'error' WHERE id = ?`).run(job.id)
      console.error(`[heartbeat:ugc] Job ${job.id} failed:`, err)
    }
  }
}
```

**Register in cron.ts:**
- Call `runUGCHeartbeat()` after Instagram heartbeat completes, OR
- Schedule separately: `schedule.scheduleJob('0 6 * * *', () => runUGCHeartbeat())` (daily 06:00 UTC)

**Import added to heartbeat.ts:**
```typescript
import { notifyUGCClient } from './notifyUGCClient.js'
import type { UGCJob } from '../types/ugc.js'
```

**Success:** runUGCHeartbeat() processes 2 pending jobs, inserts variants into DB, sends email to client

---

## TESTING (Social Agent)

**Unit Tests:**
1. `generateScript()` with client param:
   - Call with account=null, client={tone:"raw", hashtag_bank:["#ai"], cta_variants:["Try free"]}, hookStyle="transformation"
   - Verify Qwen prompt contains client.tone and hashtag_bank
   - Verify ScriptOutput includes client's CTA variant

2. `createVariants()` with isUGC flag:
   - Call with isUGC=true, jobId="test-ugc-1", 5 script objects
   - Verify 5 rows inserted into ugc_variants table
   - Verify variant.job_id equals jobId

**Integration Test:**
- Insert test client + job into DB via SQL
- Call runUGCHeartbeat()
- Verify ugc_jobs.approval_state changed from 'pending' to 'queued'
- Verify 5 rows in ugc_variants
- Verify email sent (mock SENDGRID_API_KEY or check logs)

**Success Criteria:**
- [ ] All 4 function refactors complete
- [ ] runUGCHeartbeat() processes jobs without crashing
- [ ] Variants table correctly populated per isUGC flag
- [ ] Email notification triggered on variant completion
- [ ] Manual E2E: Insert job via SQL → trigger heartbeat → verify email + DB rows

---

## DELIVERABLES (Social Agent)

- [ ] Refactored `generateScript.ts` (accepts optional client)
- [ ] Refactored `generateVoiceover.ts` (accepts optional client)
- [ ] Refactored `createVariants.ts` (isUGC flag routes to correct table)
- [ ] New `runUGCHeartbeat()` in `heartbeat.ts` + cron registration
- [ ] Unit tests (3 tests minimum)
- [ ] Integration test (1 end-to-end test)

---

## ENVIRONMENT VARIABLES (Hermes Gateway / DevOps)

Add to `.env.local`:
```
SENDGRID_API_KEY=SG.xxxxxxxxxxxx
SENDGRID_FROM_EMAIL=support@severus.local
APPROVAL_HMAC_SECRET=your-secret-key
```

Verify in heartbeat startup:
- HF_API_TOKEN exists (Qwen)
- GEMINI_API_KEY exists (TTS)
- SENDGRID_API_KEY exists (email, warn if missing)
- APPROVAL_HMAC_SECRET exists (token signing)

---

## TIMELINE & DEPENDENCIES

| Task | Deadline | Dependencies |
|------|----------|--------------|
| generateScript refactor | Wed 5/27 9am | None |
| generateVoiceover refactor | Wed 5/27 5pm | ✅ generateScript done |
| createVariants refactor | Fri 5/29 9am | ✅ generateVoiceover done |
| runUGCHeartbeat + tests | Fri 5/29 5pm | ✅ createVariants done |

**Phase 0 Complete:** Fri May 29, EOD (all tests passing)

---

## QUESTIONS

- **Voice cloning:** Should we reserve space for Voicebox API in generateVoiceover now, or add in Phase 3?
  - *Recommendation:* Add optional field `client.voice_profile_id` in UGCClient type, use in Phase 3
- **Hook style weights:** Should UGC jobs ignore client.tone and always use all 5 hook styles, or filter?
  - *Recommendation:* Always use all 5 styles (transformation, contrarian, curiosity-gap, social-proof, direct-offer) for diversity
- **Parallel rendering:** Should we increase from 2 concurrent to 5 for UGC jobs (larger batch)?
  - *Recommendation:* Keep 2 for now (same as Instagram), tune in Phase 1 based on performance

---

## COMMUNICATION

**Daily standup:** Post in #triple-tool-integration Telegram group
- Format: "✅ generateScript refactored + tested" / "🔄 Working on createVariants" / "🚫 Blocked on [reason]"

**PR:** Combine all 4 refactors + tests into single PR: `feat(ugc): add client parameterization to pipeline`

---

*Phase 0 Owner: Social Agent*  
*Deadline: Friday 2026-05-29*  
*Success = 5 variants auto-generated + email sent for test UGC job*

# Severus Connects — Master Build Guide
**Owner:** Idris-Michael Bakare | **Target:** £5,000–£8,000/month by June 2026
**Last updated:** 2026-05-19

---

## SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                     HERMES WORKSPACE                            │
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────────┐  │
│  │ hermes-hub  │    │severus-social│    │  hermes-desktop   │  │
│  │  port 8642  │    │  pipeline    │    │  Electron agent   │  │
│  └─────────────┘    └──────────────┘    └───────────────────┘  │
│         │                  │                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              AGENT LAYER (spec → running)                │   │
│  │  Intake · Analytics · Shopping · Performance · Reporting │   │
│  │  Outreach · Proposer · Auditor · Design × 7 · Social × 5│   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                  │                                    │
│  ┌─────────────┐    ┌──────────────┐                           │
│  │  supertonic │    │  seedance    │                           │
│  │ TTS port    │    │ UGC pipeline │                           │
│  │  8765       │    │ port 8099    │                           │
│  └─────────────┘    └──────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## PHASE 0 — FOUNDATIONS (Do this first, one-time setup)

### 0.1 Install hermes-hub dependencies
```bash
cd c:/Users/profs/Documents/Hermes/hermes-hub
npm install
npm run dev   # starts on port 8642
```
**Verify:** Open http://localhost:8642 → Instagram tab shows queue, profiles load.

### 0.2 Get API tokens (all services depend on these)

| Token | Where to get | Env file |
|---|---|---|
| Meta IG Token | developers.facebook.com → Graph API Explorer | `severus-social/.env.local` |
| IG_BUSINESS_ID_MIKEB | Meta Business Suite → Account info | `severus-social/.env.local` |
| IG_BUSINESS_ID_SEVERUS | Meta Business Suite → Account info | `severus-social/.env.local` |
| PUBLIC_VIDEO_BASE_URL | Set up Cloudflare Tunnel or ngrok | `severus-social/.env.local` |
| Google Ads Developer Token | ads.google.com/home/tools/manager-accounts | hermes-hub `.env` |
| Google OAuth credentials | console.cloud.google.com → OAuth 2.0 | hermes-hub `.env` |

### 0.3 Cloudflare Tunnel (needed for Meta video upload)
```bash
# Install cloudflared
winget install Cloudflare.cloudflared

# Authenticate
cloudflared tunnel login

# Create tunnel for renders/
cloudflared tunnel create severus-renders
cloudflared tunnel route dns severus-renders renders.severushermes.com

# Add to severus-social/.env.local
PUBLIC_VIDEO_BASE_URL=https://renders.severushermes.com
```

---

## PHASE 1 — INSTAGRAM PIPELINE (✅ LIVE)

**Status: Fully operational as of 2026-05-19**

### What's running
```
OpenClaw cron 07:00 UTC
  └─▶ decideNextPost() — slots mikeb + severus
  └─▶ generateScript() — Qwen/Qwen3-32B via HF ✅
  └─▶ generateVoiceover() — Gemini Cloud TTS ✅
  └─▶ createVariants() — 3 hook styles ✅
  └─▶ renderReel() — Hyperframes 0.6.25 ✅
  └─▶ notifyHuman() — Telegram @severus_connects ✅
  └─▶ [human approves] → publish.ts → Meta API ⏳
```

### Step 1.1 — Enable publish (Meta tokens needed)
Add to `severus-social/.env.local`:
```
META_IG_TOKEN=your_token
IG_BUSINESS_ID_MIKEB=your_id
IG_BUSINESS_ID_SEVERUS=your_id
PUBLIC_VIDEO_BASE_URL=https://renders.severushermes.com
```
Test: `npx tsx --env-file=.env.local pipeline/publish.ts --slot test-slot-001`

### Step 1.2 — Hook entropy (anti-spam)
Add to `generateScript.ts` — inject last 5 hooks from DB into Qwen prompt:
```typescript
// Before calling HF, query recent hooks:
const recentHooks = db.prepare(`
  SELECT hook_text FROM variants
  JOIN slots ON variants.slot_id = slots.id
  WHERE slots.account = ? ORDER BY slots.post_at DESC LIMIT 5
`).all(account).map(r => r.hook_text)

// Add to prompt:
`RECENTLY USED HOOKS (do NOT repeat these patterns):
${recentHooks.map((h, i) => `${i+1}. "${h}"`).join('\n')}`
```

### Step 1.3 — Schedule jitter (anti-bot signal)
In `severus-social/cron.ts`, replace fixed 07:00 with ±45min random:
```typescript
// Instead of fixed cron, use random delay each day
const jitterMs = (Math.random() * 90 - 45) * 60 * 1000 // ±45min
setTimeout(() => runHeartbeat('mikeb'), jitterMs)
```

### Step 1.4 — 5-variant multiplier
Add `social-proof` and `direct-offer` to hook styles in `generateScript.ts` and `createVariants.ts`.

---

## PHASE 2 — UPWORK ACQUISITION (Start immediately, no code needed)

**Status: Research done. Templates ready. Zero technical blockers.**

### Step 2.1 — Update Upwork profile today
File: `c:/Users/profs/Desktop/Sandbox/Upwork_Profile_Update_v2.docx`
- Paste into Upwork profile
- Lead with: "GA4 + AI Ads specialist. Anti-Gravity system: GA4 → Shopping → Performance Max."
- Add portfolio: severus-connects.com (or hermes-hub dashboard screenshot)

### Step 2.2 — Target these job types (confirmed £200–£400 quick wins)
Priority order from `Upwork_Agentic_AI_Jobs_May2026.md`:
1. **GA4 Setup & Audit** — 10/10 match, highest volume
2. **Google Ads Optimisation** — 9/10 match
3. **AI Implementation / Automation** — 10/10 match (use Severus stack as proof)

### Step 2.3 — Pitch templates
File: `c:/Users/profs/Desktop/Sandbox/Upwork_Pitch_Pack_GoogleAds.docx`
- Personalise top 3 lines for each job
- Lead with specific result: "Took a Shopify brand from 1.4x → 3.8x ROAS in 8 weeks"
- Always end with: "I'll do a free 15-min GA4 audit call first"

### Step 2.4 — Daily Upwork routine (15 min/day)
```
08:00 — Check new jobs (filter: GA4, Google Ads, AI automation)
08:10 — Apply to 3–5 jobs with personalised pitch
08:25 — Done. Let Severus pipeline generate content while you work.
```

---

## PHASE 3 — CONNECTS AGENTS (GA4/Ads — build the code layer)

**Status: 8 agents fully spec'd. Need code + n8n wiring.**

### Step 3.1 — Deploy master system prompt to Claude
File: `severus-connects-prompts/00-MASTER-SYSTEM-PROMPT.md`
```bash
# Add as project instructions in Claude.ai or Claude Code CLAUDE.md:
cp severus-connects-prompts/00-MASTER-SYSTEM-PROMPT.md \
   c:/Users/profs/Documents/Hermes/CLAUDE.md
```

### Step 3.2 — Build n8n workflow: Outreach sequence
Workflow name: `severus-outreach-sequence`
```
Trigger: Manual / webhook
  └─▶ Node 1: Firecrawl — scrape prospect LinkedIn/website
  └─▶ Node 2: Claude — score prospect (fit/intent/accessibility 1-10)
  └─▶ Node 3: IF score >= 7 → proceed
  └─▶ Node 4: Claude — generate personalised LinkedIn DM (template from Severus-Outreach.md)
  └─▶ Node 5: Wait 4 days
  └─▶ Node 6: Claude — generate follow-up 2
  └─▶ Node 7: Log to Obsidian vault
```
**Install n8n:** `npm install -g n8n` then `n8n start` (port 5678)

### Step 3.3 — Build n8n workflow: Client intake
Workflow name: `sc-intake`
```
Trigger: /sc intake command (webhook)
  └─▶ Node 1: Claude (Intake agent prompt) — ask 7 discovery questions
  └─▶ Node 2: Firecrawl — research client + 3 competitors
  └─▶ Node 3: Claude — synthesise brief
  └─▶ Node 4: Write to Obsidian vault → /Clients/{name}/brief.md
  └─▶ Node 5: Notify via Telegram
```

### Step 3.4 — Build n8n workflow: GA4 setup executor
Workflow name: `sc-ga4-setup`
```
Trigger: After intake approved
  └─▶ Node 1: Read brief from Obsidian
  └─▶ Node 2: Claude (Analytics agent) — generate GA4 setup checklist
  └─▶ Node 3: Claude — generate GTM container config JSON
  └─▶ Node 4: Google Analytics API — verify DebugView (≥5 conversions gate)
  └─▶ Node 5: Write setup doc to Obsidian
  └─▶ Node 6: Notify client via email
```

### Step 3.5 — Build n8n workflow: Weekly reporting
Workflow name: `sc-weekly-report`
```
Trigger: Every Monday 09:00
  └─▶ Node 1: Google Ads API — pull last 7 days metrics
  └─▶ Node 2: GA4 API — pull conversion data
  └─▶ Node 3: Claude (Reporting agent) — generate insights + recommendations
  └─▶ Node 4: Format as PDF/HTML report
  └─▶ Node 5: Email to client + save to Obsidian
```

### Step 3.6 — Wire Hermes Gateway as dispatcher
Deploy `Agents/Hermes-Gateway.md` as the master CLAUDE.md for the Hermes project.
It routes commands:
- `/sc intake` → Intake agent
- `/sc ga4` → Analytics agent
- `/sc shopping` → Shopping agent
- `/sc report` → Reporting agent
- `/sc propose` → Proposer agent

---

## PHASE 4 — UGC PIPELINE (Seedance — partial code exists)

**Status: 12 Python scripts ready. API connected. Needs final wiring.**

### Step 4.1 — Start Control Center
```bash
cd c:/Users/profs/Documents/Hermes/hermes-desktop/.agents/skills/seedance-2-0-ai-ugc
python .claude/skills/ab-test-pipeline/scripts/asset_server.py
# Opens at http://localhost:8099
```

### Step 4.2 — Onboard first brand
```bash
python onboard.py
# Enter: brand name, product description, target audience, USPs
# Creates config/brands.json
```

### Step 4.3 — Run A/B test pipeline
```bash
# Generate 4 format variants (Podcast, UGC, Lifestyle, Greenscreen TikTok)
python generate.py --brand "YourBrand" --formats all

# Poll for completion
python poll_status.py

# Generate report with video players
python report.py
```

### Step 4.4 — Integrate with severus-social
Route approved UGC variants through `severus-social/pipeline/publish.ts` for Instagram posting.

---

## PHASE 5 — DESIGN FRAMEWORK (7 agents, build when ads revenue stable)

**Status: Specs complete. Build after Phase 2 generates first £2,000.**

### Agents to deploy (in order):
1. **Design-Discovery** — client brief + mood board
2. **Design-System** — tokens, components, Figma setup
3. **Design-Figma** — Figma API automation
4. **Design-Frontend** — React/Next.js build
5. **Design-Accessibility** — WCAG audit
6. **Design-Performance** — Lighthouse optimization
7. **Design-Launch** — Vercel deploy + handoff

### Pricing targets:
- Website Design & Build: £4,000–£12,000
- Design System: £2,500–£5,000
- Redesign: £2,000–£6,000

---

## PHASE 6 — SCALE (after first £3,000/month stable)

### 6.1 — Multilingual Instagram expansion
`severus-social/pipeline/generateVoiceover.ts` — add language param:
```typescript
// Languages to add (Gemini BCP-47):
const LANGUAGES = ['es-ES', 'fr-FR', 'pt-BR', 'de-DE', 'ar-SA', 'hi-IN']
// Adds 6× content volume at ~$0.10/month extra cost
```

### 6.2 — Second Instagram account pipeline
Add `mikeb-spanish` and `severus-international` to account configs.
Cost: ~$0.001/month extra on HF.

### 6.3 — Automated client reporting dashboard
Embed hermes-hub at client.severusconnects.com (Cloudflare Tunnel).
Clients self-serve their GA4 + Ads dashboard 24/7.

---

## CURRENT ENV STATUS

### severus-social/.env.local
```
✅ HF_API_TOKEN          — Qwen3-32B + DeepSeek V3
✅ GEMINI_API_KEY        — Cloud TTS
✅ ANTHROPIC_API_KEY     — Claude Code engineer
✅ TELEGRAM_BOT_TOKEN    — Approval notifications
✅ TELEGRAM_CHAT_ID      — YOUR_TELEGRAM_CHAT_ID
✅ APPROVAL_HMAC_SECRET  — Approve/reject links
✅ HUB_BASE_URL          — localhost:3000
⬜ META_IG_TOKEN         — Needed for publish
⬜ IG_BUSINESS_ID_MIKEB  — Needed for publish
⬜ IG_BUSINESS_ID_SEVERUS — Needed for publish
⬜ PUBLIC_VIDEO_BASE_URL  — Needed for Meta video upload
```

### hermes-hub
```
⬜ node_modules          — Run: npm install
⬜ Google Ads token      — For Connects agents
⬜ Google OAuth          — For GA4 API
```

---

## PRIORITY ORDER (next 30 days)

| Week | Action | Revenue Impact |
|---|---|---|
| **This week** | Update Upwork profile + apply to 5 GA4 jobs | First £200–400 contract |
| **This week** | `npm install` hermes-hub, start dashboard | Operational |
| **This week** | Add Meta tokens → enable Instagram publish | Pipeline fully live |
| **Week 2** | Build n8n outreach + intake workflows | Systematic lead gen |
| **Week 2** | First GA4 client via Upwork → run Intake agent | First delivery |
| **Week 3** | Build n8n GA4 setup + reporting workflows | Repeatable delivery |
| **Week 3** | Hook entropy + 5-variant multiplier | Better organic reach |
| **Week 4** | Second client, propose Anti-Gravity package | £1,200+ contract |
| **Month 2** | Design framework live + first design client | £4,000+ contract |
| **Month 3** | Multilingual expansion, scale to £5k/month | Revenue target |

---

## QUICK REFERENCE — START COMMANDS

```bash
# Instagram pipeline (runs daily via cron, or manually):
cd c:/Users/profs/Documents/Hermes/severus-social
npm run heartbeat

# Dashboard:
cd c:/Users/profs/Documents/Hermes/hermes-hub
npm run dev   # http://localhost:8642

# Local TTS fallback:
cd c:/Users/profs/Documents/Hermes/supertonic/py
python server.py   # http://localhost:8765

# UGC pipeline control center:
cd c:/Users/profs/Documents/Hermes/hermes-desktop/.agents/skills/seedance-2-0-ai-ugc
python .claude/skills/ab-test-pipeline/scripts/asset_server.py   # http://localhost:8099

# n8n automation (once installed):
n8n start   # http://localhost:5678

# Cron scheduler (keeps pipeline running):
cd c:/Users/profs/Documents/Hermes/severus-social
npm run cron
```

---

## MODEL COST REFERENCE

| Model | Use | Cost/req | Monthly at current volume |
|---|---|---|---|
| Qwen/Qwen3-32B | Script generation | ~$0.00005 | ~$0.005 |
| deepseek-ai/DeepSeek-V3 | Analytics reasoning | ~$0.00008 | ~$0.001 |
| Gemini Cloud TTS | Voiceover | ~$0.000016/char | ~$0.20 |
| Hyperframes render | MP4 compilation | $0.00 (local GPU) | $0.00 |
| **Total** | | | **~$0.21/month** |

---

*Guide generated 2026-05-19. Update after each phase completion.*

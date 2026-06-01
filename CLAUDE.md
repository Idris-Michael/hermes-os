# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## HERMES MONOREPO — OVERVIEW

Hermes is a **multi-service agency automation system** for GA4 analytics, AI ads, and UGC generation. It's organized as a monorepo with several interdependent services.

### Key Services

| Service | Purpose | Tech | Port | Status |
|---------|---------|------|------|--------|
| **hermes-hub** | Central dashboard + GA4/Ads API client | React + Vite + Express | 3000 | Core |
| **severus-social** | Instagram content pipeline (script → voiceover → render → publish) | TypeScript + TSX + HF/Gemini | — | ✅ Live |
| **hermes-desktop** | Electron agent for local UGC generation | Electron + Python | — | In dev |
| **supertonic** | Local TTS fallback server | Python Flask | 8765 | Secondary |
| **seedance** | UGC generation + A/B test control center | Python scripts | 8099 | Partial |

### Architecture Pattern

**Request flow:**
```
External trigger (cron/webhook)
  → hermes-hub (dashboard, route dispatch)
    → severus-social pipeline (content generation)
      → HF (Qwen script) + Gemini (TTS) + Hyperframes (render)
        → Meta API (publish) or Telegram (approval)
```

---

## DEVELOPMENT SETUP

### 1. Install & Start hermes-hub

```bash
cd c:/Users/profs/Documents/Hermes/hermes-hub
npm install
npm run dev   # Port 3000
```

Verify: `http://localhost:3000` should load the dashboard with tabs for Instagram, GA4, Ads.

### 2. Configure severus-social environment

Create `c:/Users/profs/Documents/Hermes/severus-social/.env.local`:

```bash
HF_API_TOKEN=your_token           # Qwen3-32B script generation
GEMINI_API_KEY=your_key           # Cloud TTS voiceover
ANTHROPIC_API_KEY=your_key        # Claude API (reasoning, prompts)
TELEGRAM_BOT_TOKEN=your_token     # Approval notifications
TELEGRAM_CHAT_ID=YOUR_TELEGRAM_CHAT_ID
APPROVAL_HMAC_SECRET=your_secret  # Link signing
HUB_BASE_URL=http://localhost:3000
```

Missing tokens: Add `META_IG_TOKEN`, `IG_BUSINESS_ID_MIKEB`, `IG_BUSINESS_ID_SEVERUS` when ready to publish.

### 3. Run the Instagram pipeline (manual)

```bash
cd c:/Users/profs/Documents/Hermes/severus-social
npm run heartbeat   # Full pipeline: script → voiceover → variants → render → Telegram approval
```

---

## COMMON COMMANDS

### Build & Lint

```bash
# Type-check (all TypeScript files in monorepo)
cd c:/Users/profs/Documents/Hermes/hermes-hub && npm run lint

# hermes-hub Vite build (for production)
npm run build

# Preview Vite build locally
npm run preview
```

### Pipeline Execution

```bash
# Full Instagram heartbeat (script + voiceover + render + notify)
cd c:/Users/profs/Documents/Hermes/severus-social
npm run heartbeat

# Run nightly cron (auto-triggers at scheduled time)
npm run cron

# Pull GA4/Ads insights for analytics
npm run pull-insights

# Score content quality (engagement predictions)
npm run score

# Get feedback on generated content
npm run feedback

# Approval server (manual review links)
npm run approve-server
```

### Testing & Development

```bash
# Run single test (if test suite exists)
npm test -- --testNamePattern="pattern"

# Type-check with incremental cache
npx tsc --noEmit --incremental

# Watch mode for development
npx tsc --noEmit --watch
```

---

## PROJECT STRUCTURE

```
hermes/
├── hermes-hub/                    # Central dashboard & API routing
│   ├── src/
│   │   ├── pages/                 # React pages (GA4, Instagram, etc.)
│   │   ├── components/            # Reusable UI components
│   │   ├── lib/                   # Utilities (DB, API clients)
│   │   ├── styles/                # Global CSS + Tailwind
│   │   └── server.ts              # Express backend + DB
│   ├── package.json               # React + Vite + Express
│   └── tsconfig.json
│
├── severus-social/                # Instagram content pipeline
│   ├── pipeline/
│   │   ├── heartbeat.ts           # Main orchestrator (runs all steps)
│   │   ├── generateScript.ts      # HF → Qwen3-32B for hook/copy
│   │   ├── generateVoiceover.ts   # Gemini TTS
│   │   ├── createVariants.ts      # 3 hook styles
│   │   ├── renderReel.ts          # Hyperframes JSON → MP4
│   │   ├── publish.ts             # Meta Graph API
│   │   └── cron.ts                # Scheduled execution
│   ├── review/
│   │   └── approvalServer.ts      # Telegram notification + human review
│   ├── analytics/
│   │   ├── pullInsights.ts        # GA4 API
│   │   ├── scoreContent.ts        # Engagement predictions
│   │   └── feedbackPrompt.ts      # Claude reasoning loop
│   ├── db/                        # SQLite schema + migrations
│   └── package.json
│
├── hermes-desktop/                # Electron + local UGC generation
│   ├── .agents/                   # Agent specs
│   └── .claude/                   # Skills & prompts
│
├── supertonic/                    # Local TTS fallback
│   └── py/server.py               # Flask TTS server
│
├── seedance/                      # UGC pipeline (partial)
│   ├── scripts/                   # Generation pipelines
│   └── config/                    # Brand onboarding
│
├── severus-connects-prompts/      # Master system prompts
│   ├── 00-MASTER-SYSTEM-PROMPT.md
│   ├── Severus-Outreach.md
│   └── ...
│
└── MASTER-BUILD-GUIDE.md          # Phase breakdown & next steps

```

---

## ARCHITECTURE NOTES

### Database (better-sqlite3)

- **hermes-hub**: Main SQLite DB at `{cwd}/data.db` — stores runs, clients, settings
- **severus-social**: Separate DB at `{cwd}/db.sqlite` — tracks posts, variants, approvals
- **Shared pattern**: Each service initializes its own schema on startup; no shared migrations

### API Clients

| API | Service | Usage | Auth |
|-----|---------|-------|------|
| Google Ads | hermes-hub | Campaign metrics | OAuth 2.0 (env) |
| GA4 | hermes-hub | Conversion tracking | Service account (env) |
| Hugging Face | severus-social | Qwen3-32B inference | HF_API_TOKEN |
| Gemini (Google) | severus-social | Cloud TTS | GEMINI_API_KEY |
| Meta Graph | severus-social | IG publish | META_IG_TOKEN |
| Claude (Anthropic) | severus-social, hermes-hub | Reasoning & prompts | ANTHROPIC_API_KEY |

### Vite + TypeScript Config

- **hermes-hub**: `vite.config.ts` + `tsconfig.json` (React 19, targeting ES2020)
- **severus-social**: No Vite; raw TSX compiled via `tsx` runtime
- Both use ES modules (`"type": "module"` in package.json)

### Environment Variable Loading

- **hermes-hub**: `dotenv` loaded at server startup
- **severus-social**: `tsx --env-file=.env.local` passed to each script entry point

---

## CODE PATTERNS & CONVENTIONS

### Naming

- **Components**: PascalCase (`KnowledgeBasePage.tsx`, `HeroSection.tsx`)
- **Functions**: camelCase (`generateScript`, `createVariants`)
- **Files**: Match exports (e.g., `HeroSection.tsx` exports `HeroSection`)
- **Types**: PascalCase with `I` prefix if interface, or plain type (e.g., `Post`, `IConfig`)

### Async Patterns

- Prefer `async/await` over Promise chains
- Use `tsx` for TypeScript execution (handles TS → JS on the fly)
- Database queries: Wrap with `try/catch`; log errors to console + Telegram

### State Management

- **hermes-hub frontend**: React hooks (useState, useContext) — no Redux
- **severus-social**: Functional pipeline; state passed as function params or DB queries
- **Database**: Single source of truth; query on demand rather than caching in memory

### Error Handling

- Explicit error messages for users (UI feedback)
- Detailed logging for operators (console + Telegram notifications)
- Never silently fail; always notify via Telegram if a step breaks

---

## PERFORMANCE & BUDGET

### Model Costs (at current volume)

| Model | Cost/request | Monthly |
|-------|--------------|---------|
| Qwen3-32B (HF) | ~$0.00005 | ~$0.005 |
| Gemini Cloud TTS | ~$0.000016/char | ~$0.20 |
| DeepSeek V3 (HF) | ~$0.00008 | ~$0.001 |
| **Total** | | **~$0.21/month** |

(Hyperframes renders locally; no per-request cost.)

### Token Budget (in-session)

- Aim for <4k tokens per task (per global CLAUDE.md)
- jcodemunch-mcp for symbol lookups; avoid reading full files
- Surface impending breaches immediately

---

## NEXT PHASES (from MASTER-BUILD-GUIDE.md)

**Phase 1 (✅ Live):** Instagram pipeline — script → voiceover → variants → render → approval
**Phase 2 (Starting):** Upwork acquisition — GA4 setup + Google Ads optimisation contracts
**Phase 3 (After Phase 2):** Build n8n workflows for outreach, intake, GA4 setup, reporting
**Phase 4 (Partial):** UGC pipeline (seedance) — A/B test framework for video formats
**Phase 5 (Future):** Design framework — 7 agents for Figma + React build
**Phase 6 (After £3k/month):** Multilingual expansion + second account pipeline

See `MASTER-BUILD-GUIDE.md` for detailed phase breakdown and priority roadmap.

---

## QUICK TROUBLESHOOTING

| Issue | Fix |
|-------|-----|
| hermes-hub won't start | `npm install`, check `server.ts` for port conflicts (3000) |
| HF API timeouts | Check `HF_API_TOKEN` in `.env.local`; fallback to local Qwen if needed |
| Gemini TTS silent | Verify `GEMINI_API_KEY` in `.env.local`; fallback to supertonic (port 8765) |
| Meta publish fails | Check `META_IG_TOKEN` + `IG_BUSINESS_ID_*` in `.env.local` |
| Telegram notifications not received | Verify `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (YOUR_TELEGRAM_CHAT_ID) |
| Type errors in `tsx` scripts | Run `npx tsc --noEmit` to check; `tsx` will still execute |

---

## REFERENCES

- **Build Guide:** `MASTER-BUILD-GUIDE.md` (phases, commands, env setup)
- **System Prompts:** `severus-connects-prompts/00-MASTER-SYSTEM-PROMPT.md`
- **Outreach Templates:** `severus-connects-prompts/Severus-Outreach.md`
- **Architecture Diagrams:** See top of `MASTER-BUILD-GUIDE.md`

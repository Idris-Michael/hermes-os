# Hermes Hub — Screen Recording Brief for Agents

## Purpose
Produce one short walkthrough recording per hub section for the `/case-study` LinkedIn showcase page.
Each recording should be 20–45 seconds, exported as MP4, saved to `hermes-hub/public/case-study/`.

---

## Recording Specs (OpenScreen)
- **Resolution:** 1920×1080
- **FPS:** 60
- **Auto-zoom:** ON — zoom on click events
- **Cursor highlight:** ON (ring + motion blur)
- **Export format:** MP4 (H.264)
- **Audio:** OFF

---

## Sections to Record

| # | Section | URL | File name | Notes |
|---|---------|-----|-----------|-------|
| 1 | Home / Dashboard | `http://localhost:3000/?skip=1` | `01-home.mp4` | Scroll the run log, hover the stats cards |
| 2 | Agents | `http://localhost:3000/agents/hermes?skip=1` | `02-agents.mp4` | Click a persona card, show the task input |
| 3 | Instagram Pipeline | `http://localhost:3000/instagram?skip=1` | `03-instagram.mp4` | Show the queue, approval panel, metrics tab |
| 4 | Knowledge Base | `http://localhost:3000/knowledge?skip=1` | `04-knowledge.mp4` | Rotate the 3D constellation, click a node |
| 5 | OpenScreen | `http://localhost:3000/openscreen?skip=1` | `05-openscreen.mp4` | Scroll the use-case cards, hover the pipeline bridge |
| 6 | Overwatch | `http://localhost:3000/overwatch?skip=1` | `06-overwatch.mp4` | Pan the London map, show the tactical AI panel |

---

## Technical Descriptions (for case-study copy)

### 1 · Home / Dashboard
React 19 + Vite SPA served by an Express backend on port 3000. Real-time run log reads from a SQLite `data.db` via `better-sqlite3`. Stats cards pull from `/api/health`, `/api/tasks`, and the IG pipeline DB. Dark `#060610` background with `#e94560` accent — all layout via Tailwind v4.

### 2 · Agents (Hermes Agent Page)
Agent profiles stored as JSON in `data/profiles/`. Each profile defines model routing (Qwen3, DeepSeek, Claude), skill bindings, and tool permissions. Task queue powered by `src/lib/jobQueue.ts` — a SQLite-backed FIFO that feeds into the Telegram gateway. Personas are organised by suit/rank (Jack of Diamonds, Ace of Clubs, etc.) with per-agent soul files in `data/souls/`.

### 3 · Instagram Pipeline
Four-stage automated content pipeline: Qwen3-32B (Hugging Face) generates 5 hook variants → Gemini Cloud TTS produces voiceover audio → Hyperframes renders the final MP4 reel → Telegram bot sends thumbnail + approve/reject links with HMAC-signed 6-hour tokens. Pipeline orchestrated by `severus-social/pipeline/heartbeat.ts`, triggered via `/trigger heartbeat` from Telegram or cron.

### 4 · Knowledge Base
Three.js + React Three Fiber 3D constellation. Force-directed layout engine settles 180 iterations at boot. 4,000-particle swarm morphs between formations (sphere, helix, donut, constellation) driven by node selection. Nodes are sourced live from the file system: Claude memory files, agent definitions, Obsidian vault entries, skills, and plans — all via `/api/memory`.

### 5 · OpenScreen
OpenScreen is an Electron desktop app using Windows Graphics Capture (WGC) native APIs for zero-lag screen recording. Features auto-zoom on click, cursor motion blur, and MP4 export. The hub page documents the pipeline bridge: `OpenScreen → MP4 → HyperFrames layer → motion graphics overlay → final reel`.

### 6 · Overwatch
Real-time London intelligence dashboard. MapLibre GL renders TfL tube/overground status, road disruptions, and JamCam feeds via the TfL public API. Polymarket prediction markets panel fetches live contract prices. Tactical AI panel streams Claude Sonnet analysis. All data proxied through `/api/tube`, `/api/flights`, `/api/polymarket`.

---

## Output Checklist
- [ ] `public/case-study/01-home.mp4`
- [ ] `public/case-study/02-agents.mp4`
- [ ] `public/case-study/03-instagram.mp4`
- [ ] `public/case-study/04-knowledge.mp4`
- [ ] `public/case-study/05-openscreen.mp4`
- [ ] `public/case-study/06-overwatch.mp4`

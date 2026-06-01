# Importing Workflows 10 + 11 — Telegram UGC Pipeline

These two workflows give you a phone-first UGC pipeline:

| Workflow | What it unlocks |
|----------|------------------|
| `10-sc-telegram-uploads.json` | Drop any photo/video into `🎨 Creative & Content` → lands at `severus-social/uploads/severus/<date>/...` |
| `11-sc-render-assemble.json` | `/render <pillar>` or `/assemble <pillar>` in `⚔️ Hermes Command` → fires `heartbeat.ts --on-demand` → approval link returned |

Total setup time: **~15 minutes**.

---

## Prerequisites

You should already have these from earlier work:

- [ ] n8n running locally at `http://localhost:5678` (`docker compose up` from `n8n-workflows/`)
- [ ] Telegram credential saved in n8n as `severus-bot` (used by workflows 02, 06, 09)
- [ ] `TELEGRAM_CHAT_ID` set (the `⚔️ Hermes Command` channel ID — `YOUR_TELEGRAM_CHAT_ID`)

If any of those are missing, fix that first — both new workflows depend on them.

---

## Step 1 — Add three new n8n Variables (3 min)

Go to: **n8n → Settings → Variables → Add variable**.

| Variable | Value | Used by |
|----------|-------|---------|
| `TELEGRAM_CREATIVE_CHAT_ID` | The chat ID of your `🎨 Creative & Content` channel | Workflows 09, 10, 11 |
| `HERMES_ROOT` | Absolute path to the Hermes repo (e.g. `C:/Users/profs/Documents/Hermes`) | Workflows 10, 11 |
| `GEMINI_API_KEY` | _(stored in `severus-social/.env.local` — not committed)_ | Workflow 09 |

### How to get `TELEGRAM_CREATIVE_CHAT_ID`

1. Post any message in `🎨 Creative & Content`
2. In a browser, go to:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
3. Find your message in the JSON, look for `"chat": {"id": <NUMBER>, ...}`
4. That number is the value. For channels it's usually negative (e.g. `-1002012345678`).

---

## Step 2 — Import workflow 10 (Telegram uploads bridge)

1. n8n UI → **Workflows → Import from file**
2. Pick `n8n-workflows/10-sc-telegram-uploads.json`
3. n8n will prompt to reconnect credentials:
   - **Telegram API** → pick `severus-bot` from the dropdown
4. Click **Save** (top right)
5. Toggle **Active** (top right) → workflow is now listening

### What it does

The trigger fires on EVERY message in any chat where the bot is a member. The IF node filters down to just `🎨 Creative & Content` + has media.

When you send a photo or video to that channel, you can tag it with a caption:

```
pillar=ga4-tip role=character shot=0
```

Available keys (all optional, sensible defaults):
- `pillar` — which template the asset is for (`case-study` / `ga4-tip` / `ads-tip` / `process-breakdown` / `client-result` / or `inbox` for untagged)
- `role` — `character` / `wardrobe` / `product` / `setting` / `style` / `clip`
- `shot` — `0..5` if the asset is for a specific shot index in the storyboard
- `account` — `severus` (default) or `mikeb`

Default if no caption:
- `pillar=inbox role=character` (photos) or `role=clip` (videos)
- `account=severus`

The file lands at:
```
severus-social/uploads/<account>/<YYYY-MM-DD>/<pillar>_<role>_shot<N>_<ts>.<ext>
```

A manifest line is also appended to `severus-social/uploads/manifest.jsonl` for traceability.

### Smoke test

1. Take any photo on your phone
2. Send it to `🎨 Creative & Content` with caption: `pillar=ga4-tip role=character shot=0`
3. The bot should reply within ~3 seconds: *Asset saved* with the relative path
4. Check `severus-social/uploads/severus/<today>/` — your file is there

---

## Step 3 — Import workflow 11 (`/render` and `/assemble` commands)

1. n8n UI → **Workflows → Import from file**
2. Pick `n8n-workflows/11-sc-render-assemble.json`
3. Reconnect Telegram credential (`severus-bot`)
4. **Save** + toggle **Active**

### What it does

Listens for these commands in any chat the bot is in (typically `⚔️ Hermes Command`):

```
/render <pillar> [hook="..."] [variant=N] [account=mikeb|severus] [source=seedance|user_upload|hybrid]
/assemble <pillar> [hook="..."] [variant=N] [account=mikeb|severus]
```

When fired, it shells out to:
```
cd $HERMES_ROOT/severus-social && npx tsx pipeline/heartbeat.ts --on-demand --pillar=<pillar> ...
```

The on-demand mode:
1. Loads the storyboard template (`templates/<pillar>.json`)
2. Picks the hook variant (round-robin, or `variant=N`, or the `hook="..."` override)
3. Generates the script using the template's CopyWriter addendum
4. Generates voiceover (Gemini TTS, Supertonic fallback)
5. Renders the reel via Hyperframes
6. Posts the approval link to `🎨 Creative & Content` via the existing `notifyHuman` flow

### Smoke test (after workflow 10 is imported)

From any chat the bot is in:
```
/render ga4-tip
```

Expected:
1. Bot replies immediately: *Triggering render for ga4-tip (severus) — watch this channel for the approval link in ~3 minutes*
2. After ~3 minutes (script + voiceover + render): approval link arrives in `🎨 Creative & Content`
3. You tap ✅ Publish or 🔄 Re-roll

### Failure modes & diagnostics

| Symptom | Cause | Fix |
|---------|-------|-----|
| Bot says "Render failed: Template not found" | You ran `/render <pillar>` for a pillar that doesn't have a `.json` file | Check `severus-social/templates/` — must be one of: case-study, ga4-tip, ads-tip, process-breakdown, client-result |
| Bot says "exitCode 1" with no other detail | Likely missing env var inside heartbeat.ts | Verify `HF_API_TOKEN` is in `severus-social/.env.local`; check n8n's Execute Command stderr |
| No approval link arrives, but exit code 0 | `notifyHuman` failed silently — check Telegram bot token | Run `npx tsx pipeline/heartbeat.ts --on-demand --pillar=ga4-tip` manually from terminal, check console |
| `npx tsx` not found | Path issue inside n8n's exec context | Replace `npx tsx` in workflow 11's Execute Command node with full path: `node node_modules/.bin/tsx` |

---

## Step 4 — Verify both workflows in n8n's Executions panel

After both workflows are active:

1. n8n → **Executions** (left sidebar)
2. You should see two workflows listed as active
3. Send a test photo to `🎨 Creative & Content` → workflow 10 fires
4. Send `/render ga4-tip` to `⚔️ Hermes Command` → workflow 11 fires
5. Both should show green checkmarks in the Executions log

---

## What you can now do from your phone

| Action | Command | Result |
|--------|---------|--------|
| Drop a founder reference photo | Photo in `🎨 Creative & Content` with caption `pillar=all role=character` | Lands in `uploads/severus/<date>/all_character_<ts>.jpg` |
| Drop a screen-recording for a specific shot | Video in `🎨 Creative & Content` with caption `pillar=ga4-tip role=clip shot=2` | Lands in `uploads/severus/<date>/ga4-tip_clip_shot2_<ts>.mp4` |
| Trigger an automated reel for a pillar | `/render ga4-tip` in `⚔️ Hermes Command` | Full pipeline runs → approval link in `🎨 Creative & Content` |
| Try a specific hook variant | `/render case-study variant=2` | Uses the 3rd hook variant from `case-study.json` |
| Override the hook entirely | `/render ga4-tip hook="Your GA4 is lying to you"` | Custom hook injected into the script |
| Use your uploaded assets only | `/assemble process-breakdown` | Skips Seedance fallback, uses files from your uploads folder |

---

## What's still stubbed for Phase 2

The current `heartbeat.ts --on-demand` does **everything the scheduled pipeline does** — script, voiceover, render, approval. What it does NOT do yet:

- **Per-shot Seedance clip generation** — `buildShotPrompts.ts` is ready, but `renderReel.ts` currently produces text-on-color reels, not clip-stitched reels. The full Seedance integration is a follow-up build.
- **`/assemble` user-upload binding** — the workflow accepts the command, but `heartbeat.ts` doesn't yet wire individual shot uploads into the renderer. Stub-friendly: it still produces a reel, just doesn't use your uploaded shots yet.
- **Nano Banana cover frame** — blocked by API billing (free-tier quota exceeded). Falls back to ffmpeg frame-grab at 1.5s automatically.

These three are the natural next phase — together they turn the pipeline from "text-on-color + voiceover" into "real cinematic UGC stitched from your assets + Seedance fills". Each is a 1-2h build.

---

## Files added in this batch

- [`n8n-workflows/10-sc-telegram-uploads.json`](10-sc-telegram-uploads.json) — Telegram uploads bridge
- [`n8n-workflows/11-sc-render-assemble.json`](11-sc-render-assemble.json) — `/render` and `/assemble` command handler
- [`n8n-workflows/README.md`](README.md) — Updated table with workflows 09, 10, 11
- This file (IMPORT-10-11.md) — setup walkthrough

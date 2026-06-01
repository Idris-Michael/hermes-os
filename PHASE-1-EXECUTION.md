# Phase 1 Execution Plan: OpenScreen Proof Videos
## Weeks 1–2 (2026-05-23 to 2026-06-06)

**Goal:** Record 3–5 GA4 setup proof videos, publish on Upwork, measure +30% win rate lift  
**Owner:** Idris-Michael Bakare  
**Status:** 🟢 Starting Week 1 (today)  

---

## WEEK 1 DELIVERABLES (by 2026-05-30)

### Day 1 (Today — 2026-05-23)
**snazerros (You):**
- [ ] Install OpenScreen (Windows)
- [ ] Grant permissions (System Settings → Privacy & Security)
- [ ] Test: Record 30-second hermes-hub dashboard snippet
- [ ] Verify export: MP4, 1080p, 16:9

**Time:** 30 min  
**Effort:** Install + test  

---

### Days 2–3 (2026-05-24 to 2026-05-25)
**Design Framework Agent:**
- [ ] Create `hermes-hub/src/pages/ProofVideosPage.tsx` (scaffold)
- [ ] Build `RecordDashboard.tsx` component
  - Button: "📹 Record New Walkthrough"
  - Status indicator (polling for video)
  - Success message + export status
- [ ] Build `VideoLibrary.tsx` component
  - List recorded videos
  - Display: date, duration, effects applied
  - Actions: preview, copy Upwork link, delete
- [ ] Build `VideoCard.tsx` component
  - Thumbnail + metadata
  - "Copy Upwork Bid Template" button

**Time:** 6 hours  

---

### Days 4–5 (2026-05-26 to 2026-05-27)
**Hermes Gateway Agent:**
- [ ] Add route: `POST /proof-videos/start-record`
  - Launches OpenScreen app (system call)
  - Returns: { recordingInProgress: true }
- [ ] Add route: `GET /proof-videos/list`
  - Returns: array of ProofVideo objects
- [ ] Add route: `POST /proof-videos/import`
  - Webhook receiver for OpenScreen exports
  - Stores metadata in hermes-hub DB
- [ ] Database migration: `proof_videos` table

**Time:** 4 hours  

---

### Days 6–7 (2026-05-28 to 2026-05-30)
**Outreach Agent:**
- [ ] Create `UPWORK-BID-TEMPLATES.md`
  - Template 1: GA4 Setup & Audit
  - Template 2: Google Ads Optimization
  - Template 3: AI Implementation / Automation
- [ ] Function: `generateUpworkBidTemplate(video)`
- [ ] Test: Generate 1 bid template manually

**Time:** 3 hours  

---

### Analytics Setup (Days 2–7)
**Analytics Agent:**
- [ ] Create tracking table: `upwork_bids`
- [ ] Build dashboard: `BidMetricsCard.tsx`
  - Total bids submitted
  - Win rate (%)
  - Average contract value

**Time:** 2 hours  

---

## WEEK 2 DELIVERABLES (by 2026-06-06)

### Day 1 (2026-06-02)
**snazerros (You):**
- [ ] Record 3 proof videos using OpenScreen
  - Video 1: "Complete GA4 Setup in 5 min"
    - Focus: GTM install, tag setup, conversion tracking
    - Effects: Auto-zoom on GTM ID, click highlight on "install code"
  - Video 2: "Google Tag Manager Container Config"
    - Focus: Tag templates, triggers, variables
    - Effects: Smooth pan across container, zoom on "publish"
  - Video 3: "Conversion Tracking Verification"
    - Focus: DebugView, event collection, real-time events
    - Effects: Click highlight on incoming events, zoom on counter

**Time:** 1–2 hours (30–40 min per video)  

---

### Days 2–3 (2026-06-03 to 2026-06-04)
**Design Framework + Outreach:**
- [ ] Test ProofVideosPage end-to-end
  - Upload 3 videos to hermes-hub
  - Verify metadata displays correctly
  - Test "Copy Upwork Link" button
- [ ] Generate 3 Upwork bid templates
  - Template 1: GA4 Setup (with Video 1)
  - Template 2: Ads Optimization (with Video 2)
  - Template 3: Automation (with Video 3)

**Time:** 2 hours  

---

### Days 4–7 (2026-06-05 to 2026-06-06)
**Outreach Agent (You):**
- [ ] Publish on Upwork: 5 GA4/Ads jobs
  - Job 1: "GA4 Setup for Shopify Store" + Video 1
  - Job 2: "Google Ads Optimization" + Video 2
  - Job 3: "Analytics Implementation" + Video 3
  - Job 4: "GA4 Audit & Recommendations" + Video 1 (reuse)
  - Job 5: "E-commerce Tracking Setup" + Video 3 (reuse)

- [ ] Track each bid in hermes-hub analytics
  - Record: job title, URL, which video, submission time
  - Set reminder to track: win/loss, contract value

**Time:** 1–2 hours (15 min per bid)  

---

## SUCCESS CRITERIA (End of Week 2)

✅ **Checklist:**
- [ ] OpenScreen installed + working
- [ ] ProofVideosPage UI live in hermes-hub
- [ ] 3 proof videos recorded + uploaded
- [ ] 3 Upwork bid templates generated
- [ ] 5 Upwork bids published with videos
- [ ] Bid tracking dashboard live
- [ ] Hermes Gateway routes working

✅ **Metrics (to verify):**
- Record + export time per video: <10 min
- ProofVideosPage load time: <1 sec
- Bid generation time: <2 min
- All 5 bids published by end of week

---

## INSTALLATION STEPS (Do Today)

### Step 1: Download OpenScreen

**Windows:**
```powershell
winget install SiddharthVaddem.OpenScreen
```

Verify:
```powershell
where openscreen.exe
```

### Step 2: Grant Permissions

Windows will prompt on first launch. Accept:
- ✅ Screen recording
- ✅ Microphone access
- ✅ System audio

### Step 3: Test Recording

1. Open hermes-hub at http://localhost:8642
2. Launch OpenScreen app
3. Select window: "hermes-hub"
4. Record 30-second walkthrough
5. Click "Export" → MP4, 1080p, 16:9
6. Verify: ~/Downloads/OpenScreen.mp4 created

### Step 4: Settings (Optional)

```
OpenScreen Settings:
├─ Export Format: MP4
├─ Resolution: 1080p
├─ Aspect Ratio: 16:9
└─ Auto-upload: OFF (for now)
```

---

## DAILY STANDUP TEMPLATE

**Post daily in #triple-tool-integration:**

```
Day X Update (YYYY-MM-DD)

✅ Completed Today:
- [bullet 1]
- [bullet 2]

🔄 In Progress:
- [bullet 1]

🚫 Blockers:
- [if any]

📊 Metrics:
- Videos recorded: X
- Bids published: X
```

---

## MEASURING SUCCESS (Week 3)

After 5 bids are live for 1 week:

```
Baseline (pre-video): ~40% win rate on GA4 bids
Target: 70% win rate (on 5 bids with videos)

If 5 bids published:
→ Expected wins: 3–4 (70%)
→ Expected revenue: £300–600

Measurement date: 2026-06-13
```

**If +30% win rate achieved:**  
→ Move to Phase 2 (Voicebox integration)

**If no change:**  
→ Refine bid templates + re-record videos  
→ Try different job types

---

## AGENT ASSIGNMENTS

| Agent | Task | Deadline | Contact |
|-------|------|----------|---------|
| **snazerros** | Install OpenScreen, record videos, bid on Upwork | 2026-06-06 | — |
| **Design Framework** | Build ProofVideosPage + components | 2026-05-30 | @design-agent |
| **Hermes Gateway** | API routes + DB schema | 2026-05-30 | @gateway-agent |
| **Outreach** | Bid templates + strategy | 2026-05-30 | @outreach-agent |
| **Analytics** | Bid tracking dashboard | 2026-05-30 | @analytics-agent |

---

## NEXT ACTION

**TODAY (2026-05-23):**

1. Install OpenScreen via winget
2. Grant permissions
3. Test: Record 30-sec video
4. Report in #triple-tool-integration: "✅ OpenScreen installed + tested"

**This enables agents to start building UI next week.**

---

*Phase 1 Champion: snazerros*  
*Start: 2026-05-23*  
*Target Completion: 2026-06-06*  
*Success Metric: 5 Upwork bids with videos, 3+ wins, +30% win rate*

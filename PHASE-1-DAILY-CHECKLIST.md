# Phase 1 Daily Checklist
## OpenScreen Proof Videos (Weeks 1–2)

Print this out or keep it in your editor. Check off as you go.

---

## WEEK 1

### Day 1 — Thursday 2026-05-23 (TODAY)

**Morning (30 min):**
- [ ] Install OpenScreen: `winget install SiddharthVaddem.OpenScreen`
- [ ] Open Windows Settings → Privacy & Security
  - [ ] Grant screen recording permission
  - [ ] Grant microphone permission
- [ ] Open hermes-hub dashboard: http://localhost:8642

**Afternoon (15 min):**
- [ ] Launch OpenScreen app
- [ ] Select window: "Chrome: hermes-hub"
- [ ] Record 30-second walkthrough (click around GA4 tab)
- [ ] Click Export: MP4, 1080p, 16:9
- [ ] Verify: ~/Downloads/OpenScreen.mp4 created
- [ ] Delete test video (cleanup)

**Evening:**
- [ ] Report in #triple-tool-integration: "✅ OpenScreen installed + tested"

---

### Day 2 — Friday 2026-05-24

**Status Check:**
- [ ] OpenScreen still working? Test quick export
- [ ] hermes-hub still running on port 8642? 

**If blocked:** Ping Design Framework agent

**Planning:**
- [ ] Schedule 1-hour ProofVideosPage UI build (Design Framework)
- [ ] Schedule 1-hour Hermes Gateway API routes (Hermes Gateway)

---

### Day 3 — Saturday 2026-05-25

**Status Check:**
- [ ] ProofVideosPage component scaffolding started? (check GitHub)
- [ ] Hermes Gateway routes started? (check code)

**Your work:**
- [ ] None yet. Just monitor agent progress.

**Blockers:**
- [ ] Any permission issues with OpenScreen? → Retry or switch to Screen Studio free trial
- [ ] Can't open hermes-hub? → `npm run dev` in hermes-hub dir

---

### Day 4 — Sunday 2026-05-26

**Preparation:**
- [ ] Review UPWORK-BID-TEMPLATES.md (Outreach agent will send)
- [ ] Read through 3 Upwork job samples (GA4 Setup, Ads Optimization, AI Automation)
- [ ] Brainstorm topics for 3 proof videos:
  - Video 1: GA4 setup (what's your angle?)
  - Video 2: GTM (what's the pain point?)
  - Video 3: Conversion tracking (what's confusing?)

**Status Check:**
- [ ] ProofVideosPage UI ~40% done?
- [ ] Hermes Gateway routes ~40% done?
- [ ] Analytics dashboard schema created?

---

### Day 5 — Monday 2026-05-27

**Weekly Sync (9am UTC):**
- [ ] Attend Telegram group sync with all agents
- [ ] Report: OpenScreen tested, ready to record videos
- [ ] Ask: Any blockers from Design/Gateway/Analytics agents?

**Your work:**
- [ ] None yet. Agents are still building.

---

### Day 6 — Tuesday 2026-05-28

**Check-In:**
- [ ] ProofVideosPage UI ~80% done?
- [ ] Hermes Gateway API routes working? (test with curl)
  ```bash
  curl http://localhost:8642/proof-videos/list
  # Should return: []
  ```
- [ ] Bid templates ready for review?

**Review:**
- [ ] Read Outreach agent's UPWORK-BID-TEMPLATES.md
- [ ] Note any changes you'd like before Week 2

---

### Day 7 — Wednesday 2026-05-30

**Integration Test:**
- [ ] ProofVideosPage UI complete? (preview in browser)
- [ ] Hermes Gateway routes complete? (test all 3)
- [ ] Database `proof_videos` table created? (check schema)
- [ ] Bid templates finalized?
- [ ] Analytics dashboard live?

**Preparation for Week 2:**
- [ ] Clear your calendar: 1–2 hours reserved for video recording
- [ ] Test hermes-hub GA4 dashboard is displaying data (you need to walk through it)
- [ ] Charge your computer battery (for sustained recording)

**Sign-off:**
- [ ] Post in #triple-tool-integration: "✅ Week 1 complete, ready for video recording"

---

## WEEK 2

### Day 1 — Thursday 2026-06-02 (RECORDING DAY)

**Morning (1–2 hours):**

**Video 1: "Complete GA4 Setup in 5 min"**
- [ ] Open hermes-hub GA4 dashboard
- [ ] Launch OpenScreen
- [ ] Record walkthrough:
  - [ ] Show GTM snippet area
  - [ ] Click on GTM ID (auto-zoom highlight)
  - [ ] Show tag setup section
  - [ ] Show conversion event setup
  - [ ] Show event collection status
- [ ] Export: "GA4-Setup.mp4"
- [ ] Move to Cloudflare Tunnel or local storage

**Video 2: "Google Tag Manager Container Config"**
- [ ] Open GTM container
- [ ] Launch OpenScreen
- [ ] Record walkthrough:
  - [ ] Show container ID
  - [ ] Pan to tags area
  - [ ] Zoom on "Publish" button
  - [ ] Show variables section
- [ ] Export: "GTM-Config.mp4"

**Video 3: "Conversion Tracking Verification"**
- [ ] Open GA4 DebugView
- [ ] Launch OpenScreen
- [ ] Record walkthrough:
  - [ ] Show incoming events
  - [ ] Click highlight on event names
  - [ ] Show event count trending
  - [ ] Zoom on conversion tracking
- [ ] Export: "Tracking-Verification.mp4"

**Afternoon:**
- [ ] Upload all 3 videos to hermes-hub ProofVideosPage
- [ ] Verify metadata displays correctly
- [ ] Post in #triple-tool-integration: "✅ 3 videos recorded + uploaded"

---

### Day 2 — Friday 2026-06-03

**Testing:**
- [ ] Click "Copy Upwork Link" button for each video
  - [ ] Verify copy works
  - [ ] Verify link is valid (open in new tab)
- [ ] Test ProofVideosPage on mobile (responsive?)

**Bid Prep:**
- [ ] Review Upwork job board
- [ ] Identify 5 good GA4/Ads jobs to bid on
- [ ] Copy job titles + URLs
- [ ] Note: Which video fits each job?

**Status:**
- [ ] All 3 videos in ProofVideosPage? Yes/No
- [ ] Upwork links working? Yes/No
- [ ] Ready to bid tomorrow? Yes/No

---

### Day 3 — Saturday 2026-06-04

**Bid Generation:**
- [ ] Generate Upwork bid template for Job 1
- [ ] Generate Upwork bid template for Job 2
- [ ] Generate Upwork bid template for Job 3

**Dry Run:**
- [ ] Copy-paste 1 bid template into Upwork draft (don't submit)
- [ ] Test: Does video link work?
- [ ] Test: Does bid look professional?

**Refinement:**
- [ ] Any tweaks needed to templates?
- [ ] Any changes to video links?

---

### Day 4 — Sunday 2026-06-05

**Rest + Review:**
- [ ] Review all 3 bid templates one more time
- [ ] Check Upwork job board for any new high-quality leads
- [ ] Plan your bidding strategy for tomorrow

---

### Day 5 — Monday 2026-06-06

**BIDDING DAY:**

**Morning:**
- [ ] Bid #1: GA4 Setup for Shopify Store + Video 1
  - [ ] Personalize opening
  - [ ] Embed video
  - [ ] Submit bid
  - [ ] Record in hermes-hub: { jobTitle, URL, hasVideo: true }

- [ ] Bid #2: Google Ads Optimization + Video 2
  - [ ] Personalize opening
  - [ ] Embed video
  - [ ] Submit bid
  - [ ] Record in hermes-hub analytics

- [ ] Bid #3: Analytics Implementation + Video 3
  - [ ] Personalize opening
  - [ ] Embed video
  - [ ] Submit bid
  - [ ] Record in hermes-hub analytics

**Afternoon:**
- [ ] Bid #4: GA4 Audit & Recommendations + Video 1 (reuse)
  - [ ] Different angle than Bid #1
  - [ ] Submit bid
  - [ ] Record in analytics

- [ ] Bid #5: E-commerce Tracking Setup + Video 3 (reuse)
  - [ ] Focus on e-commerce angle
  - [ ] Submit bid
  - [ ] Record in analytics

**Evening:**
- [ ] Verify all 5 bids are live on Upwork
- [ ] Post in #triple-tool-integration:
  ```
  ✅ Phase 1 Complete!
  
  📊 Results:
  - 3 proof videos recorded
  - 5 Upwork bids published
  - All bids include video links
  
  📈 Next: Wait 1 week, measure win rate
  - Target: 70% win rate (3–4 wins)
  - Target revenue: £300–600
  - Measurement date: 2026-06-13
  ```

**Set Reminders:**
- [ ] 2026-06-13 (1 week): Check Upwork for wins/responses
- [ ] 2026-06-13: Measure win rate vs. baseline
- [ ] If +30% win rate achieved → Proceed to Phase 2

---

## PHASE 1 COMPLETE

**Final Checklist (Week 3):**
- [ ] 5 Upwork bids submitted with videos: ✅
- [ ] Win rate measured: ___% (target: 70%)
- [ ] Revenue earned: £___ (target: £300–600)
- [ ] Decision: Phase 2? Yes/No

**If Yes → Phase 2 starts Week 3 (Voicebox integration)**  
**If No → Refine strategy + retry with different angles**

---

## EMERGENCY CONTACTS

**Blocked on:**
- OpenScreen issue → Search YouTube "OpenScreen Windows setup"
- UI not displaying → @design-framework-agent
- API not responding → @hermes-gateway-agent
- Upwork bid strategy → @outreach-agent
- Metrics not tracking → @analytics-agent

---

*Print this. Check it daily. Report progress in #triple-tool-integration.*

**Phase 1 Success = 5 bids published with videos by 2026-06-06** ✅

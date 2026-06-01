# Hermes Agent Briefings
## OpenShorts + Voicebox + OpenScreen Integration Tasks

**Briefing Date:** 2026-05-23  
**Project:** Triple-Tool Integration (Phases 1–3)  
**Timeline:** 6 weeks  

All agents read INTEGRATION-MASTER.md first, then review your specific briefing below.

---

## HERMES GATEWAY AGENT

**Role:** Command orchestrator and router

### Your Tasks (Weeks 1–6)

#### Week 1
- [ ] Add route handler: `POST /proof-videos`
- [ ] Implement `openScreenLauncher()` — spawns OpenScreen desktop app via system call
- [ ] Route mapping:
  ```
  /proof-videos create → OpenScreen recorder
  /voice-clone → Voicebox API
  /clip-generator → OpenShorts API
  ```
- [ ] Implement permission checks (ensure all APIs are running)

#### Week 3
- [ ] Add Voicebox routes: `/voice-clone`, `/synthesize`, `/profiles`
- [ ] Implement health checks for Voicebox API at startup

#### Week 5
- [ ] Add OpenShorts routes: `/clip-generator/detect-and-crop`, `/jobs/{jobId}`
- [ ] Implement job polling logic (check status every 5s)

### Success Criteria
- All three command routes working by Week 6
- Response times <500ms for route dispatch
- Error handling + fallback routing

### Reference
- `INTEGRATION-MASTER.md` — Overall architecture
- `INTEGRATION-OPENSCREEN.md` → Phase 1 routes
- `INTEGRATION-VOICEBOX.md` → Phase 2 routes
- `INTEGRATION-OPENSHORTS.md` → Phase 3 routes

---

## DESIGN FRAMEWORK AGENT

**Role:** Frontend UI/UX, visual systems

### Your Tasks (Weeks 1–6)

#### Week 1–2 (Phase 1: OpenScreen UI)
Build `hermes-hub/src/pages/ProofVideosPage.tsx`:

- [ ] Component: `RecordDashboard.tsx`
  - Button: "📹 Record New Walkthrough"
  - Opens OpenScreen app (via Hermes Gateway)
  - Shows recording status (polling)

- [ ] Component: `VideoLibrary.tsx`
  - List all recorded proof videos
  - Display: title, duration, export status
  - Actions: preview, publish to Upwork, delete

- [ ] Component: `VideoCard.tsx`
  - Video metadata (date, duration, effects applied)
  - Button: "Copy Upwork Bid Template"
  - Shows video thumbnail + playback

#### Week 3–4 (Phase 2: Voice Profiles UI)
Build `hermes-hub/src/pages/VoiceProfilesPage.tsx`:

- [ ] Component: `VoiceRecorder.tsx`
  - Mic input (record 10-second sample)
  - Real-time waveform visualization
  - "Save Profile" → POST to Voicebox API

- [ ] Component: `VoiceProfileList.tsx`
  - List: "you-excited", "you-skeptical", "you-serious"
  - Display: emotion, effects (pitch, reverb), engine
  - Edit + delete actions

- [ ] Component: `EmotionTester.tsx`
  - Text input: "Here's a test sentence"
  - Select emotion: excited, skeptical, serious
  - Button: "Synthesize Preview"
  - Play audio output

#### Week 5–6 (Phase 3: Clip Generator UI)
Build `hermes-hub/src/pages/ClipGeneratorPage.tsx`:

- [ ] Component: `UploadVideo.tsx`
  - Drag-drop or file select
  - Show video duration + preview

- [ ] Component: `JobMonitor.tsx`
  - Real-time status: "Analyzing moments... 40%"
  - ETA countdown
  - When complete: show 3 generated clips

- [ ] Component: `ClipPreview.tsx`
  - Playable preview for each auto-cropped clip
  - Button: "Publish to Instagram Reels"

### Design System
- Use existing Tailwind + Lucide icons from hermes-hub
- Consistent with GA4 dashboard aesthetic
- Responsive (mobile-first for Upwork bid preview)

### Success Criteria
- All pages responsive and performant
- Smooth loading states + error states
- User can complete end-to-end flow in <10 min

### Reference
- `hermes-hub/src/pages/KnowledgeBasePage.tsx` — existing page pattern
- `INTEGRATION-MASTER.md` → UI flow diagrams

---

## SOCIAL AGENT

**Role:** Instagram/content pipeline orchestration

### Your Tasks (Weeks 1–6)

#### Week 3–4 (Phase 2: Voicebox Integration)
Update `severus-social/pipeline/generateVoiceover.ts`:

- [ ] Import Voicebox client
  ```typescript
  import { VoiceboxClient } from '../lib/voicebox-client'
  ```

- [ ] Replace Gemini TTS:
  ```typescript
  // Old: await gemini.generateVoiceover(script)
  // New:
  const voicebox = new VoiceboxClient(process.env.VOICEBOX_API)
  return await voicebox.synthesize({
    text: emotionTaggedScript,
    voiceProfile: config.voiceProfileId,
    engine: 'kokoro'  // ultra-fast
  })
  ```

- [ ] Implement emotion tag injection
  ```typescript
  // Qwen output includes [emotion] markers
  // Pass through to Voicebox for paralinguistic injection
  ```

- [ ] Update hook styles → emotion mapping:
  - 'social-proof' → [excited] (start energetic)
  - 'direct-offer' → [serious] (direct, no-nonsense)
  - 'curiosity' → [skeptical] (skepticism → reveal)

- [ ] Test end-to-end:
  ```bash
  npm run heartbeat
  # Verify: output MP4 has emotion-cloned voiceover
  ```

#### Week 5–6 (Phase 3: OpenShorts Integration)
Update `severus-social/pipeline/createVariants.ts`:

- [ ] Add OpenShorts call:
  ```typescript
  const shorts = await openshorts.detectAndCrop(longFormVideo, {
    momentCount: 3,
    targetAspect: '9:16',
    subtitles: true
  })
  ```

- [ ] Store clip metadata in DB:
  ```typescript
  db.prepare(`
    INSERT INTO clips (slot_id, variant_style, video_url, duration)
    VALUES (?, ?, ?, ?)
  `).run(slot.id, 'auto-crop', shortUrl, duration)
  ```

- [ ] Update heartbeat flow:
  ```
  generateScript → generateVoiceover (Voicebox)
    → createVariants (new: add OpenShorts auto-crop)
    → renderReel → publish
  ```

### Config Updates
- [ ] Update `.env.local`:
  ```
  VOICEBOX_API=http://localhost:5173/api
  VOICEBOX_VOICE_PROFILE_ID=your-uuid
  OPENSHORTS_API=http://openshorts:8000/api
  ```

### Success Criteria
- Heartbeat runs without errors
- Voiceover synthesis <2 sec per Reel
- OpenShorts clips generated in <3 min
- Output videos have correct emotion tags / auto-crops

### Reference
- `INTEGRATION-VOICEBOX.md` → Voicebox API spec
- `INTEGRATION-OPENSHORTS.md` → OpenShorts API spec
- `severus-social/pipeline/heartbeat.ts` — entry point

---

## OUTREACH AGENT

**Role:** Upwork bidding + client acquisition

### Your Tasks (Weeks 1–6)

#### Week 2 (Phase 1: Upwork Bid Templates)
Create `hermes-hub/lib/upwork-bid-templates.ts`:

- [ ] Function: `generateUpworkBidTemplate(video: ProofVideo)`
  - Inject video URL into template
  - Personalize top 3 lines (scan job description)
  - Lead with specific result: "Took a Shopify brand from 1.4x → 3.8x ROAS in 8 weeks"
  - Always include: "I'll do a free 15-min GA4 audit call first"

- [ ] Template variations:
  ```
  Template 1: "GA4 Setup & Audit"
  - Lead: "I specialize in GA4..."
  - Embed: video.proofVideoUrl
  - CTA: "Let's schedule a 15-min audit"
  
  Template 2: "Google Ads Optimization"
  - Lead: "I've scaled ad spend..."
  - Embed: video.proofVideoUrl
  - CTA: "I'll audit your account first"
  
  Template 3: "AI Implementation / Automation"
  - Lead: "I build AI agents for..."
  - Embed: video.proofVideoUrl
  - CTA: "See my agent stack in action"
  ```

#### Week 2–3 (Phase 1: First Proof Videos)
- [ ] Record 3 real GA4 setup proof videos using OpenScreen
  - Topic 1: "Complete GA4 Setup in 5 min"
  - Topic 2: "Google Tag Manager Configuration"
  - Topic 3: "Conversion Tracking Verification"

- [ ] Publish on Upwork:
  - [ ] Update profile header: "GA4 + AI Ads specialist"
  - [ ] Add portfolio section: link to proof videos
  - [ ] Bid on 5+ "GA4 Setup" jobs with embedded video
  - [ ] Track win rate vs. previous text-only bids

#### Week 4+ (Ongoing)
- [ ] Bid on jobs using emotion-cloned Reel (once Phase 2 complete)
  - Include short Reel in bid: "See my recent content"
  - Signal: personal brand + technical expertise

### Measurement
- [ ] Track metrics in hermes-hub:
  - Bids submitted with proof videos
  - Win rate comparison (video vs. no video)
  - Average contract value lift

### Success Criteria
- 5+ Upwork bids with proof videos by Week 3
- +30% win rate vs. text-only bids
- First client signed by Week 3

### Reference
- `MASTER-BUILD-GUIDE.md` → Upwork strategy
- `INTEGRATION-OPENSCREEN.md` → Proof video creation
- `INTEGRATION-MASTER.md` → Timeline

---

## ANALYTICS AGENT

**Role:** Measurement, insights, optimization

### Your Tasks (Weeks 1–6)

#### Week 2 (Phase 1: Win Rate Tracking)
Build analytics dashboard in hermes-hub:

- [ ] Table: Upwork bids
  ```
  | Date | Job Type | Has Video? | Won? | Contract Value |
  ```

- [ ] Metrics:
  - Win rate (video vs. no video)
  - Average contract value lift
  - Time from bid to win

- [ ] Initial target: +30% win rate by Week 3

#### Week 4 (Phase 2: Reel Engagement Tracking)
- [ ] Add to analytics:
  - Reel watch-through rate (% of viewers who watch to 75%)
  - Engagement rate (likes + comments / followers)
  - Compare: emotion-cloned (Voicebox) vs. flat (Gemini) Reels

- [ ] Target: +15% watch-through with emotion voiceover

#### Week 6 (Phase 3: Content Velocity + Clip Quality)
- [ ] Track:
  - Posts per week (current: 1, target: 3)
  - Clip viral moment accuracy (user feedback 1-5 scale)
  - Average processing time per source video

- [ ] Success: 3× content velocity, >70% clip quality

### Reporting
- [ ] Weekly dashboard for snazerros:
  - Upwork win rate
  - Reel engagement lift
  - Content velocity
  - Processing costs (Gemini API spend)

### Integration Points
- [ ] Query hermes-hub DB for bid history
- [ ] Query severus-social DB for post metrics
- [ ] Pull Instagram Insights via Meta API (optional)
- [ ] Compile weekly reports → Telegram notification

### Success Criteria
- Metrics dashboard live by Week 2
- All three phases tracked by Week 6
- ROI clear: +£600–1,200/month revenue vs. $0.30/month new costs

### Reference
- `INTEGRATION-MASTER.md` → Success metrics
- `MASTER-BUILD-GUIDE.md` → GA4 analytics setup (apply similar patterns)

---

## QUICK REFERENCE: WHO DOES WHAT

| Phase | Task | Agent | Deadline |
|-------|------|-------|----------|
| 1 | Install OpenScreen | Design Framework | Week 1 |
| 1 | Build ProofVideosPage | Design Framework | Week 1.5 |
| 1 | Add /proof-videos routes | Hermes Gateway | Week 1 |
| 1 | Generate Upwork bid templates | Outreach Agent | Week 2 |
| 1 | Record 3 proof videos | Outreach Agent | Week 2.5 |
| 1 | Track win rate lift | Analytics Agent | Week 3 |
| 2 | Deploy Voicebox | Social Agent | Week 3 |
| 2 | Build VoiceProfilesPage | Design Framework | Week 3.5 |
| 2 | Add /voice-clone routes | Hermes Gateway | Week 3 |
| 2 | Integrate Voicebox into pipeline | Social Agent | Week 4 |
| 2 | Test emotion-cloned Reels | Analytics Agent | Week 4.5 |
| 3 | Deploy OpenShorts | Social Agent | Week 5 |
| 3 | Build ClipGeneratorPage | Design Framework | Week 5.5 |
| 3 | Add /clip-generator routes | Hermes Gateway | Week 5 |
| 3 | Wire OpenShorts into pipeline | Social Agent | Week 5.5 |
| 3 | Measure final success metrics | Analytics Agent | Week 6 |

---

## COMMUNICATION PROTOCOL

**Weekly sync:** Every Monday 9am UTC (Telegram + Discord)

**Async updates:** Post progress in shared Slack channel `#triple-tool-integration`

**Blockers:** Tag Hermes Gateway immediately if waiting on other agents

**Questions:** Reply in thread; mention agent by role (e.g., @Design-Framework)

---

## SUCCESS = UNIFIED COMMAND

By end of Week 6, users can run:

```bash
hermes-hub /proof-video create --type ga4-setup --all
```

And get:
- ✅ Long-form Upwork proof video (OpenScreen)
- ✅ Emotion-cloned Reel (Voicebox)
- ✅ 3× auto-cropped viral shorts (OpenShorts)

All orchestrated seamlessly via Hermes Gateway.

---

*Last updated: 2026-05-23*  
*Next review: End of Week 1*

---

## UGC CONTENT SALES PIPELINE — PHASE 0 & 1 TASKS

Individual task files per agent are in `.agents/tasks/`. Each file follows the
handoff contract format: Goal / Constraints / Files to modify / Return format / Budget.

| Agent | Task file | Phase | Status | Deadline |
|-------|-----------|-------|--------|----------|
| **Social Agent** | `tasks/ugc-social-agent.md` | 0 | ready | 2026-05-29 |
| **Outreach Agent** | `tasks/ugc-outreach-agent.md` | 0 | ready | 2026-05-30 |
| **Hermes Gateway** | `tasks/ugc-hermes-gateway.md` | 1 | waiting on Phase 0 | 2026-06-04 |
| **Design Framework** | `tasks/ugc-design-framework.md` | 1 | waiting on Phase 0 | 2026-06-06 |
| **Analytics Agent** | `tasks/ugc-analytics-agent.md` | 1 | waiting on Phase 1 | 2026-06-08 |

**Execution order:**  
1. Social Agent + Outreach Agent in **parallel** (Phase 0, unblocked)  
2. Hermes Gateway + Design Framework in **parallel** (Phase 1, after Phase 0 tests pass)  
3. Analytics Agent (Phase 1 tail, after Design Framework scaffold exists)

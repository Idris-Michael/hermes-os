# Triple-Tool Integration Master Plan
## OpenShorts + Voicebox + OpenScreen for Hermes OS

**Project Owner:** Idris-Michael Bakare (@mikeb.io)  
**Timeline:** 6 weeks (Phases 1–3)  
**Investment:** ~30 hours engineering + 2 hours user onboarding  
**Revenue Impact:** +£600–1,200/month (Phase 2) + -$0.20/month TTS spend  

---

## EXECUTIVE SUMMARY

Three open-source tools unlock a complete video flywheel for your Severus Connects agency:

| Tool | Problem Solved | Implementation Phase | ROI |
|------|---|---|---|
| **OpenScreen** | Proof-of-work videos for Upwork GA4 bids | Week 1–2 (Phase 1) | +30% win rate → +£300–600/month |
| **Voicebox** | Emotion-cloned voiceovers (local, $0 cost) | Week 3–4 (Phase 2) | -$0.20/month TTS + +15% Reel engagement |
| **OpenShorts** | Auto-crop long-form → 9:16 viral shorts | Week 5–6 (Phase 3) | 3× content velocity for @mikeb.io |

**Unified UX:** Single command from hermes-hub routes through Hermes Gateway → dispatches to specialized agents → orchestrates all three tools.

---

## THE UNIFIED PIPELINE

### Input: A Dashboard Recording (5 min)

```
User: "I want to create an Upwork proof video of my GA4 setup"

hermes-hub → /proof-video create --type ga4-setup --record-duration 5m
```

### Execution Flow

```
1. OPENSCREEN (Week 1–2)
   ├─ User records GA4 dashboard walkthrough
   ├─ Auto-zoom on key metrics
   ├─ Click highlight on "conversion setup"
   └─ Export 16:9 MP4 → Upwork bid

2. VOICEBOX (Week 3–4)
   ├─ User records 10-second voice sample (once)
   ├─ Voicebox clones voice locally
   ├─ Qwen generates script + emotion tags
   ├─ Voicebox synthesizes with emotion
   └─ Add to future Reels as narration

3. OPENSHORTS (Week 5–6)
   ├─ Feed original 5-min recording to OpenShorts
   ├─ Gemini detects 3 viral moments
   ├─ Smart 9:16 reframing (face tracking)
   ├─ Auto-burns subtitles
   └─ Export 3× 90-sec clips for Instagram
```

### Output: Three Artifacts

```
ARTIFACT 1: Long-form Upwork Bid Video
├─ Format: 16:9, 2–3 min, MP4
├─ Link: https://severus-proof-videos.cdn/abc123.mp4
└─ Usage: Paste into Upwork GA4 bid

ARTIFACT 2: Emotion-Cloned Reel (with voiceover)
├─ Format: 9:16, 60sec, MP4
├─ Audio: Your voice, [excited] emotion tag
└─ Usage: Post to Instagram Reels, @mikeb.io feed

ARTIFACT 3: Auto-Cropped Viral Shorts (set of 3)
├─ Format: 9:16, 90sec each, MP4
├─ Source: OpenShorts auto-crop from original 5-min
└─ Usage: TikTok, Instagram Reels (content velocity)
```

---

## PHASE BREAKDOWN & AGENT ASSIGNMENTS

### PHASE 1: OpenScreen Proof Videos (Weeks 1–2)

**Goal:** Enable Upwork bids to include slick GA4 walkthrough videos.

**Specs:** See `INTEGRATION-OPENSCREEN.md`

#### Agents & Assignments

| Agent | Task | Owner | Effort | Dependencies |
|-------|------|-------|--------|---|
| **Hermes Gateway** | Add `/proof-videos` route → OpenScreen launcher | snazerros | 2h | None |
| **Design Framework** | Build ProofVideosPage UI in hermes-hub | Design Agent | 4h | Hermes Gateway |
| **Outreach Agent** | Generate Upwork bid templates with video embeds | Outreach Agent | 3h | Design Framework |
| **Analytics Agent** | Track proof-video CTR, win rate lift | Analytics Agent | 2h | Outreach Agent |

**Deliverables:**
- [ ] OpenScreen installed locally on snazerros' machine
- [ ] hermes-hub ProofVideosPage (record → edit → export workflow)
- [ ] Upwork bid template generator (auto-inserts video link)
- [ ] Success metric: 5 GA4 proof videos recorded, 3+ Upwork bids with videos, +30% win rate

**Success Criteria:**
- Time to record + export: <10 min
- First proof video published on Upwork: Week 2
- Win rate lift vs. text-only: +30% (measure over 5 bids)

---

### PHASE 2: Voicebox Emotion-Cloned Voiceovers (Weeks 3–4)

**Goal:** Replace Gemini Cloud TTS with local, emotion-cloned voiceovers.

**Specs:** See `INTEGRATION-VOICEBOX.md`

#### Agents & Assignments

| Agent | Task | Owner | Effort | Dependencies |
|-------|------|-------|--------|---|
| **Hermes Gateway** | Add `/voice-clone`, `/synthesize` routes | snazerros | 3h | Phase 1 complete |
| **Social Agent** | Integrate Voicebox into generateVoiceover.ts | Social Agent | 5h | Hermes Gateway |
| **Design Framework** | Build VoiceProfilesPage (voice cloning UI) | Design Agent | 3h | Social Agent |
| **Analytics Agent** | Track emotion tag usage, Reel watch-through lift | Analytics Agent | 2h | Design Framework |

**Deliverables:**
- [ ] Voicebox installed (desktop app or Docker headless)
- [ ] snazerros' voice cloned locally (10-second sample)
- [ ] severus-social pipeline updated (Voicebox instead of Gemini)
- [ ] VoiceProfilesPage in hermes-hub (emotion profiles: excited, skeptical, serious)
- [ ] Success metric: 5–10 Reels synthesized with emotion-cloned voiceover, +15% watch-through

**Success Criteria:**
- Voice cloning quality: "more human" feedback from user testing
- Synthesis speed: <2 sec per Reel (vs. 5–10 sec Gemini)
- Cost impact: -$0.20/month TTS spend
- Reel engagement: +15% watch-through rate (vs. flat Gemini)

---

### PHASE 3: OpenShorts Auto-Cropping (Weeks 5–6)

**Goal:** Auto-crop long-form dashboard recordings → 3× 90-sec viral shorts.

**Specs:** See `INTEGRATION-OPENSHORTS.md`

#### Agents & Assignments

| Agent | Task | Owner | Effort | Dependencies |
|-------|------|-------|--------|---|
| **Hermes Gateway** | Add `/clip-generator` route → OpenShorts dispatcher | snazerros | 2h | Phase 2 complete |
| **Social Agent** | Wire OpenShorts into severus-social variant generator | Social Agent | 4h | Hermes Gateway |
| **Design Framework** | Build ClipGeneratorPage (job monitor + preview) | Design Agent | 3h | Social Agent |
| **Analytics Agent** | Track clip quality (moment detection accuracy) | Analytics Agent | 2h | Design Framework |

**Deliverables:**
- [ ] OpenShorts Docker deployment (clip-generator service running)
- [ ] hermes-hub ClipGeneratorPage (upload video → auto-crop → preview)
- [ ] severus-social integration (auto-crop variants as part of heartbeat)
- [ ] Success metric: 3 Reels per original 5-min video, 3× content velocity

**Success Criteria:**
- Time to auto-crop 5-min video: <3 min (including Gemini analysis)
- Clip quality: 3+ usable 90-sec moments per source video
- Content velocity: 3× posts/week (vs. 1× currently)
- Viral detection accuracy: >70% (user feedback)

---

## UNIFIED COMMAND STRUCTURE

### How Agents Will Route Requests

```typescript
// hermes-hub/lib/command-router.ts

interface ProofVideoCommand {
  action: 'record' | 'clone-voice' | 'auto-crop'
  type: 'ga4-setup' | 'google-ads-audit' | 'design-system'
  recordDuration?: number        // seconds
  voiceSample?: File             // .wav
  videoInput?: string            // file path or URL
}

export async function routeProofVideoCommand(cmd: ProofVideoCommand) {
  switch (cmd.action) {
    case 'record':
      // Phase 1: OpenScreen
      return await openscreen.launchRecorder({
        type: cmd.type,
        duration: cmd.recordDuration || 300
      })
    
    case 'clone-voice':
      // Phase 2: Voicebox
      return await voicebox.cloneVoice({
        audio: cmd.voiceSample,
        emotion: cmd.type === 'ga4-setup' ? 'excited' : 'skeptical'
      })
    
    case 'auto-crop':
      // Phase 3: OpenShorts
      return await openshorts.detectAndCrop({
        videoUrl: cmd.videoInput,
        momentCount: 3,
        targetAspect: '9:16'
      })
  }
}
```

### Example User Flows

**Flow 1: Quick Upwork Proof Video (Phase 1)**
```
User: "I need a GA4 setup proof video for Upwork"

→ hermes-hub /proof-videos
→ Click "Record New Walkthrough"
→ OpenScreen opens
→ User records 3-min dashboard walkthrough
→ Exports MP4
→ Returns to hermes-hub
→ Clicks "Publish to Upwork"
→ Bid template auto-fills with video link
```

**Flow 2: Emotion-Cloned Reel (Phase 2)**
```
User: "Generate a Reel with my voice"

→ severus-social npm run heartbeat
→ Pipeline calls Voicebox:
  - Qwen generates: "[excited] Here's the secret..."
  - Voicebox synthesizes: your cloned voice + emotion
  - Hyperframes burns in audio
  - Output: full Reel with emotion voiceover
```

**Flow 3: Full Funnel (All 3 Phases)**
```
User: "I have a 5-min dashboard recording. Make everything."

→ hermes-hub /proof-videos create --all
  ├─ Phase 1: OpenScreen — polish original (zoom, click highlight)
  ├─ Phase 2: Voicebox — add emotion voiceover
  └─ Phase 3: OpenShorts — auto-crop to 3× Reels

→ Outputs:
  ├─ Long-form Upwork bid video (16:9)
  ├─ 1× emotion-cloned Reel (9:16 + narration)
  └─ 3× auto-cropped viral shorts (9:16, no narration)

→ Auto-publishes to:
  ├─ Upwork bid (snazerros copies link)
  ├─ Instagram Reels (scheduled)
  └─ @mikeb.io TikTok feed (via n8n)
```

---

## TIMELINE & MILESTONES

| Week | Phase | Milestone | Agent |
|------|-------|-----------|-------|
| **Week 1** | 1 | OpenScreen installed + ProofVideosPage UI | Design Framework |
| **Week 2** | 1 | First GA4 proof video on Upwork | Outreach Agent |
| **Week 2.5** | 1 | Measure +30% win rate lift | Analytics Agent |
| **Week 3** | 2 | Voicebox installed + snazerros voice cloned | Social Agent |
| **Week 4** | 2 | First emotion-cloned Reel published | Design Framework |
| **Week 4.5** | 2 | Measure +15% Reel watch-through | Analytics Agent |
| **Week 5** | 3 | OpenShorts deployed + first clip auto-cropped | Social Agent |
| **Week 6** | 3 | 3× content velocity (3 posts/week) | Analytics Agent |

---

## RESOURCE REQUIREMENTS

### Hardware
- **Voicebox**: 4GB RAM, GPU optional (CPU inference on Kokoro)
- **OpenScreen**: Minimal (native Tauri app)
- **OpenShorts**: Docker + 8GB RAM, GPU recommended (Gemini API calls)

### Cloud Resources
- S3 bucket (or Cloudflare R2): Video storage
- Cloudflare Tunnel: Video serving (existing)
- Google Gemini API: OpenShorts moment detection (~$0.01/video)
- Hugging Face API: Already funded (Qwen, DeepSeek)

### Total New Cost
- **Phase 1**: $0 (OpenScreen is free)
- **Phase 2**: $0 (Voicebox is free, runs locally)
- **Phase 3**: ~$0.01/video to OpenShorts Gemini calls (~$0.30/month at 30 videos/month)

---

## RISK REGISTER

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|-----------|
| OpenScreen crashes during recording | Lost work, user frustration | Medium | Auto-save project every 10s; resume feature |
| Voicebox voice cloning quality poor | Unusable voiceovers | Low | Provide 3–5 reference samples; test before commit |
| OpenShorts Gemini API costs scale | Budget overrun | Low | Pre-analyze top 5 dashboards; reuse transcripts |
| Integration complexity (3 tools) | Missed deadlines | Medium | Phase each tool separately; test before wiring |
| User adoption (snazerros busy) | Slow rollout | Medium | Automate workflows into n8n; minimal manual steps |

---

## SUCCESS METRICS (End of Week 6)

### Phase 1 (OpenScreen)
- [ ] 5+ GA4 proof videos recorded
- [ ] 3+ Upwork bids include video
- [ ] Win rate: +30% vs. text-only bids
- [ ] Average contract value: +£150

### Phase 2 (Voicebox)
- [ ] 10+ Reels with emotion-cloned voiceover
- [ ] Synthesis speed: <2 sec per Reel
- [ ] Watch-through rate: +15% vs. flat TTS
- [ ] Monthly TTS cost: -$0.20

### Phase 3 (OpenShorts)
- [ ] 3× content velocity (3 posts/week)
- [ ] Auto-crop clip quality: >70% viral moments
- [ ] Processing time: <3 min per 5-min source video
- [ ] Engagement: +20% (combined with emotion voiceover)

---

## NEXT STEPS

1. **Week 0 (This Week)**: 
   - [ ] Review all three integration specs
   - [ ] Assign agents to phases
   - [ ] Set up Docker environment for OpenShorts
   
2. **Week 1**:
   - [ ] Install OpenScreen locally
   - [ ] Build ProofVideosPage UI
   - [ ] Record + publish first GA4 proof video
   
3. **Week 2**:
   - [ ] Measure Upwork win rate lift
   - [ ] Transition to Phase 2
   - [ ] Deploy Voicebox (desktop + headless)

---

## REFERENCE DOCUMENTS

- `INTEGRATION-OPENSCREEN.md` — Detailed Phase 1 spec
- `INTEGRATION-VOICEBOX.md` — Detailed Phase 2 spec
- `INTEGRATION-OPENSHORTS.md` — Detailed Phase 3 spec
- `MASTER-BUILD-GUIDE.md` — Overall Hermes roadmap (context)

---

## QUESTIONS & CONTACT

**Owner:** Idris-Michael Bakare  
**Email:** michaelbakare92@gmail.com  
**Status:** Ready to execute

Contact the appropriate agent:
- **OpenScreen questions** → Design Framework agent
- **Voicebox questions** → Social Agent
- **OpenShorts questions** → Analytics Agent
- **Integration architecture** → Hermes Gateway agent

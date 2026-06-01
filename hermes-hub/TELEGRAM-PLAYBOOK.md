# Hermes Hub × Telegram — Mobile Playbook

Single-page operator's guide. Pin this in a Telegram saved-messages chat or keep it open on your phone.

---

## 1. The 4 Groups — Who Goes Where

Each group is wired to a **swimlane** of agents. Send commands in the matching group so the agent reply lands in the right context channel.

| Group | Chat ID | Owner agents | Use for |
|-------|---------|--------------|---------|
| ⚒️ **Hermes Command 🃏** | `-5034237148` | Ace of Spades, Jack of Spades, Jack of Diamonds, Ace of Diamonds, Queen of Diamonds | Strategy, Upwork/LinkedIn audits, biz dev, project orchestration |
| 📈 **Ads & Growth Squad** | `-5030845538` | King of Spades, Queen of Spades, King of Clubs, King of Diamonds | Google / Meta / GA4 / Shopping audits, tracking |
| 🎨 **Creative & Content** | `-4993293739` | Queen of Hearts, Ace of Hearts, King of Hearts, Queen of Clubs | Reels, UGC, ad copy, creative direction, accessibility |
| 🔧 **Build & Systems** | `-5175612864` | Jack of Clubs, Ace of Clubs | Web build, automations, n8n, infra |

> All 4 groups share the same bot — any command works from any group. The split is **organisational**, not technical.

---

## 2. Daily Mobile Routine — 5 Steps

1. **Wake the hub** — open Telegram, send `/status` to **Hermes Command 🃏**. You should see:
   ```
   🔧 Hermes Hub Status
   Queued tasks: 0
   In progress: 0
   Completed today: 0
   Hub uptime: 42m
   ```
   No reply = hub is down. Open laptop, run `cd hermes-hub && npm run dev`.

2. **Run the morning audit triple** in Hermes Command 🃏:
   ```
   /audit_upwork
   /audit_linkedin
   /strategy what should I focus on today
   ```
   Three tasks queue. Check back in 10–15 min.

3. **Fire content** in Creative & Content 🎨:
   ```
   /render_reel transformation client wins this week
   ```
   If hub replies `⏸ Pipeline busy`, wait — there's already a render in progress.

4. **Trigger live pipelines** — if it's heartbeat day:
   ```
   /trigger heartbeat
   ```
   in either Hermes Command 🃏 or Creative & Content 🎨.

5. **End of day** — `/status` again to confirm zero in-progress (so cron jobs run clean overnight).

---

## 3. Command Reference (by group)

### ⚒️ Hermes Command 🃏 — Strategy & Orchestration

| Command | Agent | What it does |
|---------|-------|-------------|
| `/status` | — | Hub health + queue depth |
| `/audit_upwork` | Jack of Diamonds | Scans Upwork feed, drafts 3 proposal responses |
| `/audit_linkedin` | Queen of Diamonds | Audits LinkedIn page vs MikeB BusinessBrain |
| `/strategy <brief>` | Ace of Spades | Campaign positioning + audience + channel mix |
| `/biz_dev <prospect>` | Ace of Diamonds | Outreach sequence + ICP fit score |
| `/bundle <project>` | Jack of Spades | Deliverable stack + dependency plan |
| `/task <agent> <brief>` | any | Manual dispatch to any of the 15 agents |
| `/trigger <pipeline>` | — | Run severus-social pipeline (heartbeat/score/insights/feedback) |
| `/approve <slot> <variant>` | — | Approve an IG variant |
| `/reject <slot>` | — | Reject an IG slot |
| `/help` | — | Print this list |

### 📈 Ads & Growth Squad — Audit & Tracking

| Command | Agent | What it does |
|---------|-------|-------------|
| `/audit_ga4 <client>` | King of Clubs | Events, conversions, attribution, tag wiring |
| `/audit_meta <account>` | Queen of Spades | Pixel/CAPI, EMQ, creative diversity, Advantage+ |
| `/audit_google <account>` | King of Spades | Conversion tracking, wasted spend, Quality Score |
| `/shopping <client>` | King of Diamonds | Feed health + Shopping campaign structure |
| `/track <issue>` | King of Clubs | Diagnose attribution issue + propose fix |

### 🎨 Creative & Content — Production

| Command | Agent | What it does |
|---------|-------|-------------|
| `/render_reel <pillar> <topic>` | Queen of Hearts | Render IG reel using 5 hook frameworks (**guarded**) |
| `/ugc <brief>` | Queen of Hearts | UGC script, shot list, talent ask (**guarded**) |
| `/creative <concept>` | Ace of Hearts | Mood, palette, typography, reference set |
| `/write_ads <client>` | King of Hearts | Headlines, primary text, descriptions, CTAs |
| `/a11y <page>` | Queen of Clubs | WCAG 2.2 audit + remediation |

> **Guarded commands** auto-reject with `⏸ Pipeline busy` if anything is already in progress. Prevents the host machine locking up.

### 🔧 Build & Systems — Infra

| Command | Agent | What it does |
|---------|-------|-------------|
| `/build <feature>` | Jack of Clubs | Implementation plan + first commit |
| `/automate <flow>` | Ace of Clubs | n8n workflow + cron schedule |

---

## 4. Reading Replies

Every queued task echoes back as:
```
✅ #12 → jack-of-diamonds: Audit Upwork profile vs Upwork_Agentic_AI_Jobs_…
```

- `#12` = task ID — keep this if you want to query status later
- agent name = handle that will process it
- truncated brief = first 60 chars (full version stored in DB)

When the task completes, the agent posts back to the same group:
```
✅ #12 done — jack-of-diamonds
3 proposals drafted. Top: "GA4 + AI ads bundle, £2.4k/mo retainer."
View full output: hub.local/tasks/12
```

---

## 5. Examples — Real Phrases

Copy-paste straight into your group chats.

**Morning audit (Hermes Command 🃏):**
```
/audit_upwork
/audit_linkedin
/biz_dev list 5 UK GA4 prospects worth £2k+/mo
```

**Client GA4 work (Ads & Growth 📈):**
```
/audit_ga4 acme-co
/track acme-co purchase event firing twice in checkout
/audit_meta acme-co
```

**Content batch (Creative & Content 🎨):**
```
/render_reel contrarian why most GA4 setups are wrong
/write_ads acme-co black-friday landing page
/creative dark luxury palette for finance vertical
```

**Build a thing (Build & Systems 🔧):**
```
/build calendar widget for Hermes Hub dashboard
/automate weekly client GA4 PDF email
```

---

## 6. Security & Concurrency Rules

- **Only your user ID** (`YOUR_TELEGRAM_CHAT_ID`) can issue commands. Anyone else in your groups is silently ignored.
- **Auto-allowlist** — when a group sends its first message after a hub restart, it self-registers.
- **Concurrency lock** — `/render_reel` and `/ugc` refuse to start while any task is `in_progress`. Run `/status` first if unsure.
- **Telegram bot token** — `8338212607:AAEogbjt…BpZeFU` (current). If leaked, run `/revoke` in BotFather and update `hermes-hub/.env.local`.

---

## 7. Troubleshooting (mobile-first)

| Symptom | Fix |
|---------|-----|
| Bot doesn't reply to anything | Hub is down. Get to laptop, `cd hermes-hub && npm run dev` |
| `Unknown command. Send /help.` | Typo — check spelling, no quotes around args |
| `⏸ Pipeline busy` | Wait, or send `/status` to see what's running |
| Task stuck at "queued" forever | Agent worker isn't running. Will need laptop. |
| Two bots respond to one message | Hermes-agent is back. Tell Claude on laptop "kill hermes-agent" |

---

## 8. Quick-Reference Card (screenshot this)

```
STATUS     /status
QUEUE      /task <agent> <brief>
PIPE       /trigger heartbeat | score | insights | feedback
APPROVE    /approve <slot> <variant>
REJECT     /reject <slot>
HELP       /help

CMD 🃏    /audit_upwork /audit_linkedin /strategy /biz_dev /bundle
ADS 📈    /audit_ga4 /audit_meta /audit_google /shopping /track
ART 🎨    /render_reel /ugc /creative /write_ads /a11y
SYS 🔧    /build /automate
```

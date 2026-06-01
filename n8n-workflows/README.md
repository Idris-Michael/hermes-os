# n8n Workflows — Severus Connects

## Start n8n (first time)

```powershell
# From PowerShell in the Hermes directory:
.\start-n8n.ps1
```

This installs Node 20 via fnm and starts n8n at http://localhost:5678

## Import workflows

1. Open http://localhost:5678
2. Create account (local, no cloud needed)
3. Go to **Workflows → Import from file**
4. Import each JSON in order:

| File | Workflow | Trigger |
|------|----------|---------|
| `01-severus-outreach-sequence.json` | Score prospect → DM 1 → wait 4d → DM 2 → Obsidian log | Manual (pass `prospect_url`) |
| `02-sc-intake.json` | 7-question intake → research → brief → Obsidian → Telegram | Webhook POST `/sc-intake` |
| `03-sc-ga4-setup.json` | Read brief → GA4 checklist + GTM config → Obsidian → Telegram | Manual (pass `client_name`) |
| `04-sc-weekly-report.json` | Google Ads + GA4 → Claude report → Obsidian → Telegram | Every Monday 09:00 |
| `05-sc-proposal-generator.json` | Read brief → proposal → Obsidian → Telegram | Manual (pass `client_name`) |
| `06-sc-lead-capture-routing.json` | Receive lead → Claude score → qualified→intake / unqualified→nurture → Notion CRM → Telegram | Webhook POST `/sc-lead` |
| `07-sc-lead-nurture.json` | Claude 3-email sequence → Gmail day 0/4/9 → Obsidian log | Webhook POST `/sc-nurture` (called by 06) |
| `08-sc-invoice-payment.json` | Stripe payment link → Gmail to client → wait 48h → check paid → onboarding or reminder | Webhook POST `/sc-invoice` |
| `09-sc-vision-analyze.json` | Telegram `/vision_analyze <url>` → Gemini Omni Flash → JSON hooks → Creative channel + CopyWriter mention | Telegram command in `⚔️ Hermes Command` |
| `10-sc-telegram-uploads.json` | Listens to `🎨 Creative & Content`; any media (photo/video/document) is saved to `severus-social/uploads/<account>/<date>/` with tags from caption (`pillar=ga4-tip role=character shot=0`) | Telegram media drop |
| `11-sc-render-assemble.json` | Telegram `/render <pillar>` (Seedance) or `/assemble <pillar>` (your uploads) → runs `heartbeat.ts --on-demand` → posts result | Telegram command in `⚔️ Hermes Command` |

## Credentials to add in n8n

Go to **Settings → Credentials** and add:

| Credential | Where used |
|-----------|-----------|
| Anthropic API Key | All Claude nodes (01–08) |
| Telegram Bot Token | All Telegram nodes |
| Gmail OAuth2 | Workflows 07, 08 |
| Notion API Key | Workflow 06 |
| Stripe API Key | Workflow 08 |
| HTTP Request auth (Google Ads token) | Workflow 04 |

## Environment variables (n8n Settings → Variables)

```
GOOGLE_ADS_TOKEN=
GOOGLE_ADS_DEVELOPER_TOKEN=
TELEGRAM_CHAT_ID=YOUR_TELEGRAM_CHAT_ID
TELEGRAM_CREATIVE_CHAT_ID=<chat ID of 🎨 Creative & Content channel>
NOTION_LEADS_DB=<your Notion leads database ID>
GEMINI_API_KEY=<Google AI Studio key — used by workflow 09>
HERMES_ROOT=<absolute path to Hermes repo, e.g. C:/Users/profs/Documents/Hermes — used by workflows 10, 11>
```

## Workflow connection map

```
LinkedIn/WhatsApp/Email/Form
        ↓
  06-lead-capture-routing  ←──────────────────────────────┐
     ↙           ↘                                        │
02-intake     07-lead-nurture                             │
     ↓           (3 emails, 9 days)                       │
03-ga4-setup                                              │
     ↓                                                    │
05-proposal-generator                                     │
     ↓                                                    │
08-invoice-payment ──── Stripe cleared ──── 02-intake ────┘
     ↓
04-weekly-report (every Monday, ongoing)
```

## Notes

- **Workflows 01, 03, 05** — manual triggers, run from n8n UI with JSON input
- **Workflow 06** — entry point for all new leads: `POST /sc-lead`
- **Workflow 02** — intake webhook: `POST /sc-intake` (called by 06 and 08)
- **Workflow 07** — nurture: `POST /sc-nurture` (called by 06 for unqualified leads)
- **Workflow 08** — invoice: `POST /sc-invoice` (call manually after proposal signed, or extend 05)
- **Workflow 04** — activate once first client is live; fires every Monday 09:00 UTC
- All reports/briefs save to `C:/Users/profs/Desktop/Sandbox/`

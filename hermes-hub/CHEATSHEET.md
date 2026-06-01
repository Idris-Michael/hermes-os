# Hermes Hub — Commands & Skills Cheatsheet

Quick reference for running, building, and extending Hermes Hub.

---

## Server

| Command | What it does |
|---------|-------------|
| `cd hermes-hub && npm run dev` | Start hub on http://localhost:3000 |
| `npm run build` | Production Vite build |
| `npm run preview` | Preview production build locally |
| `npx tsc --noEmit` | Type-check without compiling |

---

## Telegram Gateway (live now)

Bot: `@severushermes_bot` — long-poll mode, no tunnel needed.

| Command | What it does |
|---------|-------------|
| `/status` | Hub health: queue, uptime, jobs |
| `/task <agent> <instruction>` | Queue a task for any named agent |
| `/trigger heartbeat` | Run full Instagram pipeline |
| `/trigger score` | Run content scoring |
| `/trigger insights` | Pull GA4/Ads insights |
| `/trigger feedback` | Run Claude feedback loop |
| `/approve <slot_id> <variant_id>` | Approve an IG variant |
| `/reject <slot_id>` | Reject an IG slot |
| `/help` | Full command list |

---

## Instagram Pipeline (severus-social)

```bash
cd severus-social
npm run heartbeat     # Full pipeline: script → TTS → render → Telegram approval
npm run cron          # Scheduled auto-run
npm run score         # Score content quality
npm run pull-insights # GA4 + Ads metrics
npm run feedback      # Claude reasoning loop
npm run approve-server # Manual review approval server
```

---

## Agent Skills — Installed

All loaded automatically in Claude Code sessions. Invoke with `/skill-name` or just describe what you need.

### Engineering & Debug
| Skill | What it does |
|-------|-------------|
| `debug-mantra` | 4-mantra debugging: reproduce → trace → falsify → cross-ref. Runs before any fix. |
| `post-mortem` | Write canonical bug record: root cause, fix, validation, prevention. |
| `scrutinize` | Outsider review of a plan, PR or change. Questions intent, traces code path. |
| `impeccable` | Deep code quality audit — correctness, edge cases, security. |
| `code-review` | Full code review against standards. |
| `security-scan` | OWASP Top 10 + secrets scan before commits. |

### Content & Ads
| Skill | What it does |
|-------|-------------|
| `ads` | General ad strategy and copy |
| `ads-meta` | Meta/Instagram ad creative + copy |
| `ads-google` | Google Ads campaign structure + copy |
| `ads-linkedin` | LinkedIn ad copy + targeting |
| `ads-create` | Generate full ad creative briefs |
| `ads-audit` | Audit existing campaigns |
| `ads-budget` | Budget allocation and bid strategy |
| `ads-plan` | Full campaign planning |
| `ads-dna` | Brand DNA extraction for ads |
| `ads-creative` | Creative direction and concepts |

### Productivity
| Skill | What it does |
|-------|-------------|
| `management-talk` | Rewrite engineer content for leadership (Slack, JIRA, email, standups) |
| `daily` | Daily planning and task prioritisation |
| `tldr` | Summarise any document or thread |
| `last30days` | 30-day activity and progress report |
| `file-intel` | Analyse any file — contracts, briefs, reports |
| `defuddle` | Clarify confusing or ambiguous requirements |

### Research & Web
| Skill | What it does |
|-------|-------------|
| `firecrawl` | Web scraping and crawling |
| `firecrawl-search` | Search the web with structured output |
| `firecrawl-scrape` | Scrape a single URL deeply |
| `firecrawl-agent` | Autonomous web research agent |
| `agent-reach` | Multi-step web research with citations |

### Media & Render
| Skill | What it does |
|-------|-------------|
| `hyperframes` | Render video JSON specs via Hyperframes |
| `hyperframes-cli` | Hyperframes CLI commands |
| `hyperframes-media` | Media asset management for Hyperframes |
| `gsap` | GSAP animation code generation |
| `remotion-to-hyperframes` | Convert Remotion specs → Hyperframes |
| `notebooklm` | Create Google NotebookLM notebooks |

### Obsidian / Knowledge
| Skill | What it does |
|-------|-------------|
| `obsidian-cli` | Query and write to Obsidian vault via CLI |
| `obsidian-markdown` | Format markdown for Obsidian |
| `obsidian-bases` | Manage Obsidian Bases databases |
| `vault-setup` | Set up an Obsidian vault structure |
| `json-canvas` | Create Obsidian Canvas files |

### Dev Workflow
| Skill | What it does |
|-------|-------------|
| `plan` | Create detailed implementation plan before coding |
| `pr` | Draft PR description from git diff |
| `checkpoint` | Save session state and create git checkpoint |
| `save-session` | Persist current session context |
| `resume-session` | Resume from saved session |
| `pm2` | PM2 process manager commands |
| `pinokio` | Pinokio app launcher integration |
| `smithery-ai-cli` | Smithery MCP tools CLI |
| `gepeto` | Agent task planning and delegation |
| `skill-creator` | Create new custom skills |
| `find-skills` | Search the skills.sh ecosystem |

---

## GSD (Get Shit Done) — Project Management

```
/gsd:new-project      Start a new project with full planning
/gsd:plan-phase       Plan the next phase with research
/gsd:execute-phase    Execute a planned phase
/gsd:do               Quick one-shot task
/gsd:debug            Scientific bug investigation
/gsd:health           Project health check
/gsd:progress         Progress report across all phases
/gsd:next             What to work on next
/gsd:review           Code + goal review
/gsd:ship             Ship readiness checklist
/gsd:map-codebase     Generate architecture map → Obsidian
/gsd:ui-phase         Design + build a frontend phase
/gsd:ui-review        6-pillar visual audit of UI
/gsd:session-report   End-of-session summary
```

---

## Memory System

```
~/.claude/projects/c--Users-profs-Documents-Hermes/memory/
  MEMORY.md              — Index (auto-loaded every session)
  severus_connects_setup.md
  project_hf_cost_model.md
  project_mount_severus_os.md
```

---

## Key Ports & Services

| Service | Port | Start command |
|---------|------|---------------|
| Hermes Hub | 3000 | `cd hermes-hub && npm run dev` |
| Supertonic TTS | 8765 | `cd supertonic && python py/server.py` |
| Ollama | 11434 | Auto-started by system |
| n8n | 5678 | `npm run n8n` or `start-n8n.ps1` |

---

## Useful One-Liners

```bash
# Kill whatever is on port 3000
netstat -ano | grep :3000   # get PID
Stop-Process -Id <PID> -Force

# Check Telegram bot / webhook status
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"

# Type-check hermes-hub incrementally
cd hermes-hub && npx tsc --noEmit --incremental

# Search installed skills
ls ~/.claude/skills/

# Find new skills from ecosystem
npx skills find <query>

# Install a skill globally
npx skills add <owner/repo@skill> -g -y
```

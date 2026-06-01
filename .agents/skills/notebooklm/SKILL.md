---
name: notebooklm
description: Complete API for Google NotebookLM - full programmatic access including features not in the web UI. Create notebooks, add sources, generate all artifact types, download in multiple formats. Activates on explicit /notebooklm or intent like "create a podcast about X", "install notebooklm", "add notebooklm to cowork"
---
<!-- notebooklm-py v0.3.4 -->

# NotebookLM Automation

Complete programmatic access to Google NotebookLM—including capabilities not exposed in the web UI. Create notebooks, add sources (URLs, YouTube, PDFs, audio, video, images), chat with content, generate all artifact types, and download results in multiple formats.

This skill has **two setup paths**:

1. **Local Claude Code** — Install the `notebooklm-py` CLI on your Mac and authenticate. Fast, direct, no network overhead. Use this for terminal sessions.
2. **Cowork** — Wrap the CLI in an MCP server, tunnel it via Cloudflare, and connect Cowork to the public HTTPS endpoint. Use this when you want NotebookLM access inside Cowork (Anthropic's sandbox can't run your local CLI directly).

The original cookie-inlining approach for Cowork has been **replaced** with the MCP pattern below. It's more robust (no token expiry pain), secure (credentials never leave your Mac), and works for any local CLI you want to expose to Cowork.

---

## Step 0: Local Setup (Run Automatically on First Use)

When this skill is triggered and `notebooklm` is not yet installed or authenticated, complete setup first.

### Pre-flight: Check Python Version

`notebooklm-py` requires **Python 3.10+**. Check the available version before installing:

```bash
python3 --version
```

If Python is below 3.10 (e.g. 3.9.x which is the macOS default), install a compatible version:

**macOS (Homebrew):**
```bash
brew install python@3.12
```
Then use `/opt/homebrew/bin/python3.12` (Apple Silicon) or `/usr/local/bin/python3.12` (Intel) for the venv below.

**Linux (apt):**
```bash
sudo apt update && sudo apt install -y python3.12 python3.12-venv
```

### Install the CLI

Always use a virtual environment to avoid "externally-managed-environment" errors and PATH issues.

Determine which Python to use — if the system `python3` is 3.10+, use it directly. Otherwise use the one you just installed (e.g. `python3.12`):

```bash
# Set PYTHON to the correct binary (adjust if needed)
PYTHON=$(command -v python3.12 2>/dev/null || command -v python3.11 2>/dev/null || command -v python3.10 2>/dev/null || command -v python3)

# Verify it's 3.10+
$PYTHON -c "import sys; assert sys.version_info >= (3,10), f'Python {sys.version} is too old — need 3.10+'; print(f'Using Python {sys.version}')"

# Create venv and install
$PYTHON -m venv ~/.notebooklm-venv
source ~/.notebooklm-venv/bin/activate
pip install "notebooklm-py[browser]"
playwright install chromium
```

Then symlink so it's always on PATH:
```bash
mkdir -p ~/bin
ln -sf ~/.notebooklm-venv/bin/notebooklm ~/bin/notebooklm
export PATH="$HOME/bin:$PATH"
```

Verify the CLI works:
```bash
notebooklm --help
```

### Authenticate

**IMPORTANT:** The built-in `notebooklm login` command requires interactive terminal input (pressing Enter after sign-in). Claude Code's bash tool does NOT support interactive input, so `notebooklm login` will fail — the browser opens and closes instantly. Instead, use this custom login script.

Tell the user:

> I'm going to open a browser window — just sign into your Google account and navigate to notebooklm.google.com. Take your time, I'll wait for you to confirm before closing it.

Then write and run this login script:

```bash
cat > /tmp/nlm_login.py << 'PYEOF'
import json, os, time
from pathlib import Path
from playwright.sync_api import sync_playwright

STORAGE_PATH = Path.home() / ".notebooklm" / "storage_state.json"
PROFILE_PATH = Path.home() / ".notebooklm" / "browser_profile"
SIGNAL_FILE = Path("/tmp/nlm_save_signal")

SIGNAL_FILE.unlink(missing_ok=True)
STORAGE_PATH.parent.mkdir(parents=True, exist_ok=True)

print("Opening browser for Google login...")
print("Sign in to Google and navigate to notebooklm.google.com")

with sync_playwright() as p:
    browser = p.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_PATH),
        headless=False,
        args=["--disable-blink-features=AutomationControlled"],
    )
    page = browser.pages[0] if browser.pages else browser.new_page()
    page.goto("https://notebooklm.google.com/")

    print("Browser is open. Waiting for save signal...")
    while not SIGNAL_FILE.exists():
        time.sleep(1)

    print("Save signal received! Capturing session...")
    storage = browser.storage_state()
    with open(STORAGE_PATH, "w") as f:
        json.dump(storage, f)

    cookie_names = [c["name"] for c in storage.get("cookies", [])]
    print(f"Saved {len(cookie_names)} cookies: {cookie_names}")
    browser.close()

SIGNAL_FILE.unlink(missing_ok=True)
print(f"Authentication saved to: {STORAGE_PATH}")
PYEOF

# Run the login script in the background
source ~/.notebooklm-venv/bin/activate
python3 /tmp/nlm_login.py > /tmp/nlm_login_output.txt 2>&1 &
echo "Login started (PID=$!). Browser should open in a few seconds..."
```

Wait ~10 seconds for the browser to open, then ask the user if they can see the browser and are signed in.

Once the user confirms they are on the NotebookLM homepage, save the session:

```bash
touch /tmp/nlm_save_signal
sleep 8
cat /tmp/nlm_login_output.txt
```

Then verify authentication:

```bash
export PATH="$HOME/bin:$PATH"
notebooklm auth check
notebooklm list
```

If auth passes (SID cookie present), confirm to the user that NotebookLM is set up and ready. Clean up the temp script:

```bash
rm -f /tmp/nlm_login.py /tmp/nlm_login_output.txt /tmp/nlm_save_signal
```

If auth fails (SID cookie missing), the user may not have fully signed in. Delete the browser profile and retry:

```bash
rm -rf ~/.notebooklm/browser_profile ~/.notebooklm/storage_state.json
```

Then run the login script again from the top.

---

## Adding NotebookLM to Cowork (MCP Server + Cloudflare Tunnel)

> **Credit:** This approach was contributed by Daniel at [skool.com/navaigate](https://www.skool.com/navaigate). It supersedes the older cookie-inlining method, which broke whenever Google rotated tokens.

When the user asks to "add this to Cowork", "use this in Cowork", or "make this work in Cowork":

### Why the MCP Approach

Cowork runs on Anthropic's servers. It can't see your local files. It can't run your CLI tools. The old approach of inlining auth cookies into a skill file failed repeatedly because:
- Tokens expire and force a full regeneration cycle
- Google's auth flow can change without warning
- You have to re-upload the skill every time

The MCP pattern solves this cleanly: the CLI stays on your Mac (full filesystem access, full auth), you wrap it in an MCP server, Cloudflare Tunnel gives it a public HTTPS URL, and Cowork connects to that URL like any other MCP server. The agent doesn't know or care where the tool runs — it just works.

### Architecture

```
Claude Code / Cowork
        ↓ MCP Protocol (SSE)
Cloudflare Tunnel (HTTPS)
        ↓
Your Mac — localhost:8484
        ↓
MCP Server (Python + FastMCP)
        ↓
NotebookLM CLI → Google NotebookLM
```

### Prerequisite Check

```bash
# Make sure the local CLI is installed and authenticated first
cat ~/.notebooklm/storage_state.json > /dev/null 2>&1 && notebooklm auth check
```

If either check fails, run the **Step 0: Local Setup** above before continuing.

You'll also need a domain on Cloudflare (for the tunnel hostname). If the user doesn't have one yet, they'll need to set that up first at cloudflare.com.

### Step 1: Build the MCP Server

Create the project and set up a Python 3.12 virtual environment:

```bash
mkdir -p ~/notebooklm-mcp && cd ~/notebooklm-mcp
/opt/homebrew/bin/python3.12 -m venv .venv
source .venv/bin/activate
pip install "mcp[cli]" uvicorn
```

Create `~/notebooklm-mcp/server.py`. Every CLI command becomes a decorated Python function — here's the pattern (extend with as many tools as you want exposed):

```python
import sys, subprocess
from mcp.server.fastmcp import FastMCP

NOTEBOOKLM = "/Users/YOUR_USERNAME/bin/notebooklm"  # adjust to your symlink path
mcp = FastMCP("notebooklm", host="0.0.0.0", port=8484)

def run_cli(*args, timeout=120):
    result = subprocess.run(
        [NOTEBOOKLM, *args],
        capture_output=True, text=True, timeout=timeout
    )
    return result.stdout.strip() or "(no output)"

@mcp.tool()
def notebooklm_list() -> str:
    """List all NotebookLM notebooks."""
    return run_cli("list")

@mcp.tool()
def notebooklm_use(notebook_id: str) -> str:
    """Set the active notebook context."""
    return run_cli("use", notebook_id)

@mcp.tool()
def notebooklm_ask(question: str) -> str:
    """Ask the current notebook a question (RAG query)."""
    return run_cli("ask", question, timeout=120)

@mcp.tool()
def notebooklm_source_add(url_or_path: str) -> str:
    """Add a URL, YouTube link, or local file as a source to the current notebook."""
    return run_cli("source", "add", url_or_path, timeout=180)

@mcp.tool()
def notebooklm_generate_audio(instructions: str = "") -> str:
    """Generate a podcast-style audio overview."""
    args = ["generate", "audio"]
    if instructions:
        args.append(instructions)
    return run_cli(*args, timeout=600)

# Follow this pattern for every command you want to expose —
# create, source list, generate video/report/quiz/flashcards, download, etc.
# See the Quick Reference table further down for the full command surface.

if __name__ == "__main__":
    if "--sse" in sys.argv:
        import uvicorn
        app = mcp.sse_app()
        uvicorn.run(app, host="0.0.0.0", port=8484)
    else:
        mcp.run(transport="stdio")
```

The entry point supports two transport modes:
- **SSE mode** (`--sse`) — for Cowork via the tunnel. Runs an HTTP server on port 8484.
- **Stdio mode** (default) — for local Claude Code. Direct pipe, no network overhead.

Smoke test it:
```bash
source ~/notebooklm-mcp/.venv/bin/activate
python -c "from server import run_cli; print(run_cli('auth', 'check'))"
```

### Step 2: Set Up the Cloudflare Tunnel

Cowork runs on Anthropic's servers. `localhost` means nothing to it. You need a public HTTPS URL pointing at your Mac. Cloudflare Tunnel does this without opening any ports on your router.

```bash
brew install cloudflared
cloudflared tunnel login
cloudflared tunnel create notebooklm-mcp
cloudflared tunnel route dns notebooklm-mcp mcp-notebooklm.yourdomain.com
```

Create `~/.cloudflared/config-notebooklm-mcp.yml`:

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: ~/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: mcp-notebooklm.yourdomain.com
    service: http://localhost:8484
  - service: http_status:404
```

Test it end-to-end:
```bash
# Terminal 1: start the server
cd ~/notebooklm-mcp && source .venv/bin/activate
python server.py --sse

# Terminal 2: start the tunnel
cloudflared tunnel --config ~/.cloudflared/config-notebooklm-mcp.yml run notebooklm-mcp

# Terminal 3: verify
curl -s https://mcp-notebooklm.yourdomain.com/sse | head -3
```

You should see `event: endpoint` with a session ID. That means it's working.

### Step 3: Auto-Start on Boot (macOS Launch Agents)

You don't want to manually start two processes every time you turn on your Mac. Create two Launch Agents:

**MCP Server** — `~/Library/LaunchAgents/dev.navaigate.notebooklm-mcp.plist`
Points to `.venv/bin/python server.py --sse`. Set `RunAtLoad` and `KeepAlive` to `true`.

**Tunnel** — `~/Library/LaunchAgents/dev.navaigate.notebooklm-tunnel.plist`
Points to `cloudflared tunnel run` with the config file. Same flags.

Load them once — they persist across reboots, and macOS restarts either process automatically if it crashes:

```bash
launchctl load ~/Library/LaunchAgents/dev.navaigate.notebooklm-mcp.plist
launchctl load ~/Library/LaunchAgents/dev.navaigate.notebooklm-tunnel.plist
```

### Step 4: Connect to Cowork

1. Open Cowork and click the **+** icon
2. Go to **Connectors → Add connection → Add custom connector**
3. Enter: `https://mcp-notebooklm.yourdomain.com/sse`
4. Click **Add**

The NotebookLM tools appear immediately. Prompt naturally:

> "List my NotebookLM notebooks"
> "Switch to my AI Brain notebook and tell me the last 3 entries"
> "Ask my AI Brain: what were the key decisions from last week?"
> "Generate a podcast from my current notebook"

### Step 5: Local Claude Code Setup (Stdio Transport)

For terminal sessions you don't need the tunnel — add the MCP server to `~/.claude/settings.json` using stdio transport:

```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "/Users/YOUR_USERNAME/notebooklm-mcp/.venv/bin/python",
      "args": ["/Users/YOUR_USERNAME/notebooklm-mcp/server.py"]
    }
  }
}
```

Same server, different transport. The tools work identically — local sessions just skip the network hop.

### MCP Troubleshooting

| Symptom | Fix |
|---|---|
| Auth expired | Run `notebooklm login` (or the custom login script in Step 0) locally. The MCP server picks up new tokens automatically — no restart needed. |
| Server not responding | `lsof -i :8484` to check the port, `tail ~/notebooklm-mcp/mcp-server.log` for errors, then `launchctl kickstart -k gui/$(id -u)/dev.navaigate.notebooklm-mcp`. |
| Tunnel down | `cloudflared tunnel info notebooklm-mcp`. `KeepAlive` usually restarts it automatically. |
| Cowork says "can't reach server" | Verify with `curl -s https://mcp-notebooklm.yourdomain.com/sse \| head -3`. If that works, remove and re-add the connector in Cowork. |

### Why This Pattern Generalizes

Local MCP server + Cloudflare Tunnel isn't just for NotebookLM. Any CLI tool, any local service, any API that needs local credentials can be wrapped as an MCP server and made available to Cowork the same way. Once you've done it once, you can do it for anything.

### Resources

- NotebookLM CLI Skill for Claude Code: [github.com/skyremote/claude-code-notebooklm-skills](https://github.com/skyremote/claude-code-notebooklm-skills)
- notebooklm-py (CLI tool): [github.com/jgravelle/notebooklm-py](https://github.com/jgravelle/notebooklm-py)
- MCP Python SDK: [github.com/modelcontextprotocol/python-sdk](https://github.com/modelcontextprotocol/python-sdk)
- Cloudflare Tunnel docs: [developers.cloudflare.com/cloudflare-one/connections/connect-networks](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks)

---

## When This Skill Activates

**Explicit:** User says "/notebooklm", "use notebooklm", "install notebooklm", or mentions the tool by name.

**Intent detection:** Recognize requests like:
- "Create a podcast about [topic]"
- "Summarize these URLs/documents"
- "Generate a quiz from my research"
- "Turn this into an audio overview"
- "Create flashcards for studying"
- "Generate a video explainer"
- "Make an infographic"
- "Create a mind map of the concepts"
- "Download the quiz as markdown"
- "Add these sources to NotebookLM"
- "Add this to Cowork" / "Make this work in Cowork" → use the MCP pattern above

## Autonomy Rules

**Run automatically (no confirmation):**
- `notebooklm status` - check context
- `notebooklm auth check` - diagnose auth issues
- `notebooklm list` - list notebooks
- `notebooklm source list` - list sources
- `notebooklm artifact list` - list artifacts
- `notebooklm language list` - list supported languages
- `notebooklm language get` - get current language
- `notebooklm language set` - set language (global setting)
- `notebooklm artifact wait` - wait for artifact completion
- `notebooklm source wait` - wait for source processing
- `notebooklm research status` - check research status
- `notebooklm research wait` - wait for research
- `notebooklm use <id>` - set context
- `notebooklm create` - create notebook
- `notebooklm ask "..."` - chat queries (without `--save-as-note`)
- `notebooklm history` - display conversation history (read-only)
- `notebooklm source add` - add sources

**Ask before running:**
- `notebooklm delete` - destructive
- `notebooklm generate *` - long-running, may fail
- `notebooklm download *` - writes to filesystem
- `notebooklm ask "..." --save-as-note` - writes a note
- `notebooklm history --save` - writes a note

## Quick Reference

| Task | Command |
|------|---------|
| List notebooks | `notebooklm list` |
| Create notebook | `notebooklm create "Title"` |
| Set context | `notebooklm use <notebook_id>` |
| Show context | `notebooklm status` |
| Add URL source | `notebooklm source add "https://..."` |
| Add file | `notebooklm source add ./file.pdf` |
| Add YouTube | `notebooklm source add "https://youtube.com/..."` |
| List sources | `notebooklm source list` |
| Wait for source processing | `notebooklm source wait <source_id>` |
| Web research (fast) | `notebooklm source add-research "query"` |
| Web research (deep) | `notebooklm source add-research "query" --mode deep --no-wait` |
| Check research status | `notebooklm research status` |
| Wait for research | `notebooklm research wait --import-all` |
| Chat | `notebooklm ask "question"` |
| Chat (specific sources) | `notebooklm ask "question" -s src_id1 -s src_id2` |
| Chat (with references) | `notebooklm ask "question" --json` |
| Chat (save answer as note) | `notebooklm ask "question" --save-as-note` |
| Show conversation history | `notebooklm history` |
| Save all history as note | `notebooklm history --save` |
| Get source fulltext | `notebooklm source fulltext <source_id>` |
| Generate podcast | `notebooklm generate audio "instructions"` |
| Generate video | `notebooklm generate video "instructions"` |
| Generate report | `notebooklm generate report --format briefing-doc` |
| Generate quiz | `notebooklm generate quiz` |
| Generate flashcards | `notebooklm generate flashcards` |
| Generate infographic | `notebooklm generate infographic` |
| Generate mind map | `notebooklm generate mind-map` |
| Generate slide deck | `notebooklm generate slide-deck` |
| Revise a slide | `notebooklm generate revise-slide "prompt" --artifact <id> --slide 0` |
| Check artifact status | `notebooklm artifact list` |
| Wait for completion | `notebooklm artifact wait <artifact_id>` |
| Download audio | `notebooklm download audio ./output.mp3` |
| Download video | `notebooklm download video ./output.mp4` |
| Download slide deck (PDF) | `notebooklm download slide-deck ./slides.pdf` |
| Download slide deck (PPTX) | `notebooklm download slide-deck ./slides.pptx --format pptx` |
| Download report | `notebooklm download report ./report.md` |
| Download mind map | `notebooklm download mind-map ./map.json` |
| Download data table | `notebooklm download data-table ./data.csv` |
| Download quiz | `notebooklm download quiz quiz.json` |
| Download flashcards | `notebooklm download flashcards cards.json` |
| List languages | `notebooklm language list` |
| Set language | `notebooklm language set zh_Hans` |

## Generation Types

All generate commands support:
- `-s, --source` to use specific source(s) instead of all sources
- `--language` to set output language (defaults to 'en')
- `--json` for machine-readable output
- `--retry N` to automatically retry on rate limits

| Type | Command | Options | Download |
|------|---------|---------|----------|
| Podcast | `generate audio` | `--format [deep-dive\|brief\|critique\|debate]`, `--length [short\|default\|long]` | .mp3 |
| Video | `generate video` | `--format [explainer\|brief]`, `--style [auto\|classic\|whiteboard\|kawaii\|anime\|watercolor\|retro-print\|heritage\|paper-craft]` | .mp4 |
| Slide Deck | `generate slide-deck` | `--format [detailed\|presenter]`, `--length [default\|short]` | .pdf / .pptx |
| Slide Revision | `generate revise-slide "prompt" --artifact <id> --slide N` | `--wait`, `--notebook` | *(re-downloads parent deck)* |
| Infographic | `generate infographic` | `--orientation [landscape\|portrait\|square]`, `--detail [concise\|standard\|detailed]` | .png |
| Report | `generate report` | `--format [briefing-doc\|study-guide\|blog-post\|custom]`, `--append "extra instructions"` | .md |
| Mind Map | `generate mind-map` | *(sync, instant)* | .json |
| Data Table | `generate data-table` | description required | .csv |
| Quiz | `generate quiz` | `--difficulty [easy\|medium\|hard]`, `--quantity [fewer\|standard\|more]` | .json/.md/.html |
| Flashcards | `generate flashcards` | `--difficulty [easy\|medium\|hard]`, `--quantity [fewer\|standard\|more]` | .json/.md/.html |

## Common Workflows

### Research to Podcast
1. `notebooklm create "Research: [topic]"`
2. `notebooklm source add` for each URL/document
3. Wait for sources: `notebooklm source list --json` until all status=READY
4. `notebooklm generate audio "Focus on [specific angle]"`
5. Check `notebooklm artifact list` for status
6. `notebooklm download audio ./podcast.mp3` when complete

### Document Analysis
1. `notebooklm create "Analysis: [project]"`
2. `notebooklm source add ./doc.pdf` (or URLs)
3. `notebooklm ask "Summarize the key points"`
4. Continue chatting as needed

### Second-Brain Pattern (the "AI Brain" workflow)
1. Create one permanent notebook called something like "AI Brain"
2. After every working session, append a summary as a new source (the `/wrapup` skill automates this)
3. In Cowork, add a project instruction: *"Whenever answering questions about strategy, business context, or project history, always consult my NotebookLM AI Brain notebook first."*
4. Claude now checks your second brain before answering — perfect recall of everything you've ever worked on

## Output Formats (--json)

```json
// notebooklm list --json
{"notebooks": [{"id": "...", "title": "...", "created_at": "..."}]}

// notebooklm source list --json
{"sources": [{"id": "...", "title": "...", "status": "ready|processing|error"}]}

// notebooklm artifact list --json
{"artifacts": [{"id": "...", "title": "...", "type": "Audio Overview", "status": "in_progress|pending|completed|unknown"}]}
```

## Error Handling

| Error | Cause | Action |
|-------|-------|--------|
| Auth/cookie error | Session expired | Re-run the login script from Step 0 |
| "No notebook context" | Context not set | Run `notebooklm use <id>` |
| Rate limiting | Google throttle | Wait 5-10 min, retry |
| Download fails | Generation incomplete | Check `artifact list` for status |
| Cowork tool calls fail | MCP server or tunnel down | See **MCP Troubleshooting** section above |

## Known Limitations

- Audio, video, quiz, flashcard, infographic, and slide deck generation may fail due to Google rate limits
- Generation times: audio 10-20 min, video 15-45 min, quiz/flashcards 5-15 min
- This is an unofficial API — Google can change things without warning
- The MCP server runs on your Mac, so Cowork access requires your Mac to be awake and online. For 24/7 access, deploy the server to a VPS and point the tunnel there instead.

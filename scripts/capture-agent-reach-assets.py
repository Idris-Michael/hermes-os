"""
Capture Agent-Reach visual assets for the LinkedIn showcase deck.

Agent-Reach is a CLI/library (no UI), so the visual story comes from
rendering its own source files as dark-themed code panels.

Output:  Presentation slide deck assets - agent-reach/<png files>
Run:     py -3.10 scripts/capture-agent-reach-assets.py
"""
from __future__ import annotations

import html
import shutil
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = Path(r"c:/Users/profs/Desktop/Sandbox/Agent-Reach")
OUT_DIR = ROOT / "Presentation slide deck assets - agent-reach"

VIEWPORT = {"width": 1920, "height": 1080}


def render_markdown_as_code_panel(
    src_path: Path, title: str, subtitle: str, out_png: Path
) -> None:
    """Render a source file as a dark-themed code-style page and screenshot it."""
    body_raw = src_path.read_text(encoding="utf-8", errors="replace")
    body = body_raw[:3500]
    if len(body_raw) > 3500:
        body += "\n\n...[truncated for preview]"

    page_html = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>{html.escape(title)}</title>
<style>
  body {{ margin: 0; padding: 0; background: #060610; color: #e2e8f0;
         font-family: 'JetBrains Mono', 'Consolas', monospace; min-height: 100vh; }}
  .wrap {{ max-width: 1500px; margin: 0 auto; padding: 48px 64px; }}
  .accent {{ width: 64px; height: 6px; background: #D4A017; margin-bottom: 24px; }}
  .label {{ color: #D4A017; font-size: 12px; letter-spacing: 0.12em;
            text-transform: uppercase; margin-bottom: 8px; }}
  h1 {{ font-family: 'Inter', sans-serif; font-size: 38px; color: #e2e8f0;
        margin: 0 0 4px 0; font-weight: 600; }}
  .sub {{ color: #94a3b8; font-size: 16px; margin-bottom: 32px; }}
  pre {{ background: #0E0E1A; border: 1px solid #1F1F2E; border-left: 3px solid #D4A017;
        border-radius: 8px; padding: 24px 28px; font-size: 14px; line-height: 1.65;
        color: #cbd5e1; white-space: pre-wrap; word-wrap: break-word; overflow: hidden; }}
  .file {{ color: #94a3b8; font-size: 13px; margin-top: 18px; }}
</style></head>
<body>
  <div class="wrap">
    <div class="accent"></div>
    <div class="label">Agent-Reach . source</div>
    <h1>{html.escape(title)}</h1>
    <div class="sub">{html.escape(subtitle)}</div>
    <pre>{html.escape(body)}</pre>
    <div class="file">{html.escape(src_path.name)}</div>
  </div>
</body></html>"""

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport=VIEWPORT)
        page = ctx.new_page()
        page.set_content(page_html)
        page.wait_for_load_state("networkidle")
        page.screenshot(path=str(out_png), full_page=True)
        browser.close()
    print(f"  -> {out_png.name}")


def render_text_block_as_panel(
    text_body: str, title: str, subtitle: str, out_png: Path
) -> None:
    """Render an arbitrary text block as a dark code panel."""
    body = text_body[:3500]
    page_html = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>{html.escape(title)}</title>
<style>
  body {{ margin: 0; padding: 0; background: #060610; color: #e2e8f0;
         font-family: 'JetBrains Mono', 'Consolas', monospace; min-height: 100vh; }}
  .wrap {{ max-width: 1500px; margin: 0 auto; padding: 48px 64px; }}
  .accent {{ width: 64px; height: 6px; background: #D4A017; margin-bottom: 24px; }}
  .label {{ color: #D4A017; font-size: 12px; letter-spacing: 0.12em;
            text-transform: uppercase; margin-bottom: 8px; }}
  h1 {{ font-family: 'Inter', sans-serif; font-size: 38px; color: #e2e8f0;
        margin: 0 0 4px 0; font-weight: 600; }}
  .sub {{ color: #94a3b8; font-size: 16px; margin-bottom: 32px; }}
  pre {{ background: #0E0E1A; border: 1px solid #1F1F2E; border-left: 3px solid #D4A017;
        border-radius: 8px; padding: 24px 28px; font-size: 15px; line-height: 1.7;
        color: #cbd5e1; white-space: pre-wrap; word-wrap: break-word; overflow: hidden; }}
</style></head>
<body>
  <div class="wrap">
    <div class="accent"></div>
    <div class="label">Agent-Reach . excerpt</div>
    <h1>{html.escape(title)}</h1>
    <div class="sub">{html.escape(subtitle)}</div>
    <pre>{html.escape(body)}</pre>
  </div>
</body></html>"""

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport=VIEWPORT)
        page = ctx.new_page()
        page.set_content(page_html)
        page.wait_for_load_state("networkidle")
        page.screenshot(path=str(out_png), full_page=True)
        browser.close()
    print(f"  -> {out_png.name}")


# Curated platform support matrix (extracted from the English README + channels/).
SUPPORT_TABLE = """Platform           Out-of-box           Configured              How to configure
-----------------  -------------------  ----------------------  --------------------------
Web                Read any page        --                      no config needed
YouTube            Subtitles + search   --                      no config needed
RSS                Read any RSS/Atom    --                      no config needed
WeChat MP          Search + read posts  --                      no config needed
Weibo              Trends, search, ...  --                      no config needed
V2EX               Hot posts + threads  --                      no config needed
Xueqiu             Stocks + rankings    --                      no config needed
Whole-Web Search   --                   Semantic search (Exa)   auto (MCP, free, no key)
GitHub             Public repos+search  Private repos, PRs      "log me into GitHub"
Twitter / X        Read single tweet    Search, timeline, post  "configure Twitter"
Bilibili           Subtitles + search   Works from server too   "configure proxy"
Reddit             Search (via Exa)     Read posts + comments   "configure proxy"
Xiaohongshu        --                   Read, search, post      "configure Xiaohongshu"
Douyin             --                   Video parse + DL link   "configure Douyin"
LinkedIn           Public Jina Reader   Profiles, companies     "configure LinkedIn"
Xiaoyuzhou Pods    --                   Whisper transcription   "configure podcast"
"""


def main() -> None:
    if not SOURCE_DIR.exists():
        sys.exit(f"Agent-Reach source not found: {SOURCE_DIR}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Rendering Agent-Reach source panels -> {OUT_DIR}")

    # 1. README pitch (English, top section)
    readme_en = SOURCE_DIR / "docs" / "README_en.md"
    readme_cn = SOURCE_DIR / "README.md"
    render_markdown_as_code_panel(
        readme_en if readme_en.exists() else readme_cn,
        "README.md",
        "One install. Sixteen platforms. Give any AI agent the open web.",
        OUT_DIR / "01-pitch-readme.png",
    )

    # 2. pyproject.toml -- the package, published
    render_markdown_as_code_panel(
        SOURCE_DIR / "pyproject.toml",
        "pyproject.toml",
        "Published Python package. Minimal core deps, optional browser/MCP extras.",
        OUT_DIR / "02-package-pyproject.png",
    )

    # 3. agent_reach/__init__.py -- API surface
    render_markdown_as_code_panel(
        SOURCE_DIR / "agent_reach" / "__init__.py",
        "agent_reach/__init__.py",
        "Public API surface. One class, AgentReach -- everything else is channels.",
        OUT_DIR / "03-api-surface.png",
    )

    # 4. Support matrix
    render_text_block_as_panel(
        SUPPORT_TABLE,
        "Support matrix",
        "Sixteen platforms. Seven work zero-config; the rest need one credential.",
        OUT_DIR / "04-support-matrix.png",
    )

    # 5. doctor.py -- diagnostic
    render_markdown_as_code_panel(
        SOURCE_DIR / "agent_reach" / "doctor.py",
        "agent-reach doctor",
        "One command tells the operator which channels are healthy and which need work.",
        OUT_DIR / "05-diagnostic-doctor.png",
    )

    # 6. CLI entrypoint
    render_markdown_as_code_panel(
        SOURCE_DIR / "agent_reach" / "cli.py",
        "agent_reach/cli.py",
        "The CLI: install, doctor, configure, uninstall. Boring on purpose.",
        OUT_DIR / "06-cli-entrypoint.png",
    )

    # 7. Channels registry -- the pluggable architecture
    render_markdown_as_code_panel(
        SOURCE_DIR / "agent_reach" / "channels" / "__init__.py",
        "channels/__init__.py",
        "Every platform is one file. Don't like a backend? Swap that file.",
        OUT_DIR / "07-channels-registry.png",
    )

    # 8. A representative channel implementation
    twitter_ch = SOURCE_DIR / "agent_reach" / "channels" / "twitter.py"
    if twitter_ch.exists():
        render_markdown_as_code_panel(
            twitter_ch,
            "channels/twitter.py",
            "Each channel only declares what backend it uses and how to health-check it.",
            OUT_DIR / "08-channel-twitter.png",
        )

    # 9. Mandarin README -- internationalised
    render_markdown_as_code_panel(
        SOURCE_DIR / "README.md",
        "README.md (zh)",
        "Mandarin-first README. English mirror lives in docs/README_en.md.",
        OUT_DIR / "09-i18n-readme-zh.png",
    )

    # 10. Logo asset (copy directly if present)
    logo = SOURCE_DIR / "docs" / "assets" / "logo-1.png"
    if logo.exists():
        dest = OUT_DIR / "10-logo.png"
        shutil.copyfile(logo, dest)
        print(f"  -> {dest.name} (copied)")

    print("Done.")


if __name__ == "__main__":
    main()

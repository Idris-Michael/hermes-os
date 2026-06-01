"""
Capture Legal Pioneer Pipeline visual assets for the LinkedIn showcase deck.

Renders:
  1. Full Sample_Contract_Review.html at 1920×1080 viewport (full-page screenshot)
  2. Top section (above-fold)
  3. Each clause card (Green / Amber / Red / Unmapped)
  4. brain.md → rendered as a dark-themed code preview
  5. agents.md → rendered as a dark-themed code preview
  6. review_pipeline.py → rendered as a dark-themed code preview

Output:  Presentation slide deck assets - legal pioneer/<png files>

Run:  py -3.10 scripts/capture-legal-pioneer-assets.py
"""
from __future__ import annotations
import html
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SOURCE_HTML = Path(r"c:/Users/profs/Desktop/Sandbox/Idris_Michael_AI_Pioneer_PortSwigger/04_Demo_Artifacts/Sample_Contract_Review.html")
SOURCE_DIR  = Path(r"c:/Users/profs/Desktop/Sandbox/Idris_Michael_AI_Pioneer_PortSwigger")
OUT_DIR     = ROOT / "Presentation slide deck assets - legal pioneer"

VIEWPORT = {"width": 1920, "height": 1080}


def render_markdown_as_code_panel(md_path: Path, title: str, subtitle: str, out_png: Path) -> None:
    """Render a markdown file as a dark-themed code-style HTML page and screenshot it."""
    body_raw = md_path.read_text(encoding="utf-8")
    # Truncate so the page fills ~one viewport cleanly (recruiters won't read all of it)
    body = body_raw[:3500]
    if len(body_raw) > 3500:
        body += "\n\n…[truncated for preview]"

    page_html = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>{html.escape(title)}</title>
<style>
  body {{ margin: 0; padding: 0; background: #060610; color: #e2e8f0;
         font-family: 'JetBrains Mono', 'Consolas', monospace; min-height: 100vh; }}
  .wrap {{ max-width: 1500px; margin: 0 auto; padding: 48px 64px; }}
  .accent {{ width: 64px; height: 6px; background: #D4A017; margin-bottom: 24px; }}
  .label {{ color: #D4A017; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 8px; }}
  h1 {{ font-family: 'Inter', sans-serif; font-size: 38px; color: #e2e8f0; margin: 0 0 4px 0; font-weight: 600; }}
  .sub {{ color: #94a3b8; font-size: 16px; margin-bottom: 32px; }}
  pre {{ background: #0E0E1A; border: 1px solid #1F1F2E; border-left: 3px solid #D4A017;
        border-radius: 8px; padding: 24px 28px; font-size: 14px; line-height: 1.65;
        color: #cbd5e1; white-space: pre-wrap; word-wrap: break-word; overflow: hidden; }}
  .file {{ color: #94a3b8; font-size: 13px; margin-top: 18px; }}
</style></head>
<body>
  <div class="wrap">
    <div class="accent"></div>
    <div class="label">Legal Pioneer Pipeline · source</div>
    <h1>{html.escape(title)}</h1>
    <div class="sub">{html.escape(subtitle)}</div>
    <pre>{html.escape(body)}</pre>
    <div class="file">{html.escape(md_path.name)}</div>
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
    print(f"  · {out_png.name}")


def render_html_demo(out_dir: Path) -> None:
    """Open Sample_Contract_Review.html and capture full-page + key sections."""
    if not SOURCE_HTML.exists():
        raise FileNotFoundError(SOURCE_HTML)
    file_uri = SOURCE_HTML.resolve().as_uri()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport=VIEWPORT)
        page = ctx.new_page()
        page.goto(file_uri)
        page.wait_for_load_state("networkidle")
        # Expand all <details> so every clause is visible
        page.evaluate("document.querySelectorAll('details').forEach(d => d.open = true)")
        page.wait_for_timeout(400)

        # 1. Full-page
        page.screenshot(path=str(out_dir / "01-demo-full-report.png"), full_page=True)
        print("  · 01-demo-full-report.png")

        # 2. Above the fold (header + escalation banner + summary)
        page.screenshot(path=str(out_dir / "02-demo-header-and-escalation.png"), clip={
            "x": 0, "y": 0, "width": 1920, "height": 1080,
        })
        print("  · 02-demo-header-and-escalation.png")

        # 3. Capture each clause card via element-screenshot (auto-scrolls into view)
        clauses = page.locator(".clause").all()
        for i, c in enumerate(clauses, start=1):
            try:
                c.scroll_into_view_if_needed()
                page.wait_for_timeout(120)
                c.screenshot(path=str(out_dir / f"03-clause-{i:02d}.png"))
                print(f"  - 03-clause-{i:02d}.png")
            except Exception as err:
                print(f"  ! skipped clause {i}: {err}")
        browser.close()


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Rendering HTML demo -> {OUT_DIR}")
    render_html_demo(OUT_DIR)

    print("Rendering source-code preview panels…")
    render_markdown_as_code_panel(
        SOURCE_DIR / "02_The_Brain" / "brain.md",
        "brain.md",
        "The legal playbook — the AI's grounding source. Edited by the legal team in plain Markdown.",
        OUT_DIR / "10-source-brain.png",
    )
    render_markdown_as_code_panel(
        SOURCE_DIR / "03_The_Engine" / "agents.md",
        "agents.md",
        "Architect, Auditor, and Orchestrator definitions. Each agent has one focused role.",
        OUT_DIR / "11-source-agents.png",
    )
    render_markdown_as_code_panel(
        SOURCE_DIR / "03_The_Engine" / "review_pipeline.py",
        "review_pipeline.py",
        "Claude + Gemini orchestration. Runs from CLI with two API keys and any PDF or DOCX.",
        OUT_DIR / "12-source-pipeline.png",
    )
    print("Done.")


if __name__ == "__main__":
    main()

"""
Capture ENDAVA_DEMO dashboards as full-page PNGs for the portfolio deck.

Run: py -3.10 scripts/capture-endava-assets.py
"""
from __future__ import annotations
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = Path(r"c:/Users/profs/Desktop/Sandbox/ENDAVA_DEMO")
OUT_DIR = ROOT / "Presentation slide deck assets - endava"

VIEWPORT = {"width": 1920, "height": 1080}


def short_name(html_path: Path) -> str:
    """Convert '02_google_ads_case_study.html' -> 'google-ads-case-study'."""
    stem = html_path.stem
    # strip leading digits + underscore
    stem = re.sub(r"^[0-9]+[_-]?", "", stem)
    stem = stem.replace("_", "-").lower()
    return stem or html_path.stem.lower()


def natural_sort_key(path: Path) -> tuple:
    """Sort 01_*, 02_*, ... naturally; START_HERE first."""
    name = path.name.upper()
    if name.startswith("START_HERE"):
        return (0, 0, name)
    m = re.match(r"^(\d+)", path.name)
    if m:
        return (1, int(m.group(1)), name)
    return (2, 0, name)


def capture_html(page, html_path: Path, out_png: Path) -> bool:
    file_uri = html_path.resolve().as_uri()
    try:
        page.goto(file_uri, wait_until="networkidle", timeout=30000)
        page.wait_for_timeout(500)
        # Try to expand any collapsible details (harmless if none exist)
        try:
            page.evaluate("document.querySelectorAll('details').forEach(d => d.open = true)")
            page.wait_for_timeout(150)
        except Exception:
            pass
        page.screenshot(path=str(out_png), full_page=True)
        print(f"  -> {out_png.name}")
        return True
    except Exception as err:
        print(f"  ! FAILED {html_path.name}: {err}")
        return False


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    htmls = sorted(SOURCE_DIR.glob("*.html"), key=natural_sort_key)
    if not htmls:
        print(f"No HTML files in {SOURCE_DIR}")
        return
    print(f"Found {len(htmls)} dashboards in {SOURCE_DIR}")
    print(f"Output -> {OUT_DIR}")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport=VIEWPORT)
        page = ctx.new_page()
        for i, html in enumerate(htmls, start=1):
            slug = short_name(html)
            out = OUT_DIR / f"{i:02d}-{slug}.png"
            capture_html(page, html, out)
        browser.close()
    print("Done.")


if __name__ == "__main__":
    main()

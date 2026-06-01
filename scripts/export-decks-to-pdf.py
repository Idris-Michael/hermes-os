"""
Convert all .pptx decks in deliverables/ to PDF using PowerPoint COM automation.
Requires PowerPoint installed (which you have, since you've been editing the decks there).

Run:
    py -3.10 scripts/export-decks-to-pdf.py
"""
from __future__ import annotations
import sys
from pathlib import Path

import comtypes.client

ROOT = Path(__file__).resolve().parent.parent
DELIVERABLES = ROOT / "deliverables"
ppFormatPDF = 32  # MsoFileType for PDF export

def convert(pptx: Path, pdf: Path) -> None:
    powerpoint = comtypes.client.CreateObject("Powerpoint.Application")
    try:
        deck = powerpoint.Presentations.Open(str(pptx), WithWindow=False)
        deck.SaveAs(str(pdf), ppFormatPDF)
        deck.Close()
        print(f"  OK -> {pdf.name}")
    finally:
        powerpoint.Quit()

def main() -> None:
    if not DELIVERABLES.exists():
        sys.exit("deliverables/ not found")
    pptxs = sorted(DELIVERABLES.glob("*.pptx"))
    if not pptxs:
        sys.exit("no .pptx files in deliverables/")
    print(f"Converting {len(pptxs)} decks to PDF...")
    for p in pptxs:
        out = p.with_suffix(".pdf")
        try:
            convert(p, out)
        except Exception as e:
            print(f"  FAIL {p.name}: {e}")

if __name__ == "__main__":
    main()

"""
Breakpoint screenshot + console-error capture for OTW.

Run locally (recommended):
  python3 -m pip install playwright
  python3 -m playwright install chromium
  python3 playwright_breakpoints_test.py

Outputs:
  ./shots/*.png
  ./results.json
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

from playwright.sync_api import ConsoleMessage, sync_playwright


URL = "https://otw-chi-two.vercel.app/"
OUT_DIR = Path(__file__).parent / "shots"


@dataclass(frozen=True)
class Breakpoint:
    name: str
    viewport: Tuple[int, int]


BREAKPOINTS: List[Breakpoint] = [
    Breakpoint("desktop", (1440, 900)),
    Breakpoint("tablet", (768, 1024)),
    Breakpoint("mobile", (375, 812)),
]


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    results: Dict[str, Any] = {
        "url": URL,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "breakpoints": [],
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            for bp in BREAKPOINTS:
                width, height = bp.viewport
                context = browser.new_context(
                    viewport={"width": width, "height": height},
                    device_scale_factor=2,
                )
                page = context.new_page()

                console_messages: List[Dict[str, str]] = []
                page_errors: List[str] = []

                def on_console(msg: ConsoleMessage) -> None:
                    console_messages.append({"type": msg.type, "text": msg.text})

                page.on("console", on_console)
                page.on("pageerror", lambda e: page_errors.append(str(e)))

                response = page.goto(URL, wait_until="networkidle", timeout=60_000)
                status = response.status if response else None
                page.wait_for_timeout(1500)

                shot_above = OUT_DIR / f"{bp.name}-above.png"
                shot_full = OUT_DIR / f"{bp.name}-full.png"
                page.screenshot(path=str(shot_above), full_page=False)
                page.screenshot(path=str(shot_full), full_page=True)

                # Basic overflow signal (often catches accidental horizontal scrollbars).
                has_overflow = page.evaluate(
                    "() => document.documentElement.scrollWidth > window.innerWidth + 1"
                )

                results["breakpoints"].append(
                    {
                        "name": bp.name,
                        "viewport": {"width": width, "height": height, "dpr": 2},
                        "status": status,
                        "hasHorizontalOverflow": bool(has_overflow),
                        "consoleCount": len(console_messages),
                        "pageErrorCount": len(page_errors),
                        "consoleSamples": console_messages[:12],
                        "pageErrorSamples": page_errors[:8],
                        "screenshots": {"aboveFold": str(shot_above), "fullPage": str(shot_full)},
                    }
                )
                context.close()
        finally:
            browser.close()

    (Path(__file__).parent / "results.json").write_text(
        json.dumps(results, indent=2), encoding="utf-8"
    )
    print(f"Saved screenshots to: {OUT_DIR}")
    print(f"Saved results to: {(Path(__file__).parent / 'results.json')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


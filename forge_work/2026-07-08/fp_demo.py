#!/usr/bin/env python3
"""
Real browser fingerprint generator demo.
Uses browserforge to inject a coherent fingerprint into a Playwright context.
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright
from browserforge.fingerprints import FingerprintGenerator
from browserforge.injectors.playwright import NewContext


def main(target_url: str = "https://amiunique.org") -> None:
    fg = FingerprintGenerator()
    fingerprint = fg.generate()

    out_dir = Path(__file__).parent / "fp_demo_output"
    out_dir.mkdir(exist_ok=True)

    # Save the injected fingerprint for audit
    (out_dir / "fingerprint.json").write_text(
        json.dumps(fingerprint.__dict__, indent=2, default=str)
    )
    print(f"Generated fingerprint for: {fingerprint.navigator.userAgent}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = NewContext(browser, fingerprint=fingerprint)
        page = context.new_page()

        print(f"Navigating to {target_url} ...")
        page.goto(target_url, wait_until="networkidle", timeout=60000)

        # Take a screenshot
        screenshot_path = out_dir / "amiunique.png"
        page.screenshot(path=str(screenshot_path), full_page=True)
        print(f"Screenshot saved: {screenshot_path}")

        # Try to extract the fingerprint summary from amiunique
        try:
            summary = page.locator(".summary").first.inner_text(timeout=5000)
            print("\n--- amiunique summary ---")
            print(summary[:1000])
        except Exception as exc:
            print(f"Could not extract summary: {exc}")

        # Save page text for offline inspection
        (out_dir / "page_text.txt").write_text(page.inner_text("body"))

        browser.close()


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "https://amiunique.org"
    main(url)

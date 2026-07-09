#!/usr/bin/env python3
"""
Verify what a page actually sees vs what browserforge claims to inject.
"""
import json
from pathlib import Path

from playwright.sync_api import sync_playwright
from browserforge.fingerprints import FingerprintGenerator
from browserforge.injectors.playwright import NewContext


def main():
    fg = FingerprintGenerator()
    fingerprint = fg.generate()

    out_dir = Path(__file__).parent / "fp_demo_output"
    out_dir.mkdir(exist_ok=True)

    report = {
        "injected": {
            "userAgent": fingerprint.navigator.userAgent,
            "platform": fingerprint.navigator.platform,
            "vendor": fingerprint.navigator.vendor,
            "language": fingerprint.navigator.language,
            "hardwareConcurrency": fingerprint.navigator.hardwareConcurrency,
            "deviceMemory": fingerprint.navigator.deviceMemory,
            "screen": {
                "width": fingerprint.screen.width,
                "height": fingerprint.screen.height,
                "colorDepth": fingerprint.screen.colorDepth,
                "devicePixelRatio": fingerprint.screen.devicePixelRatio,
            },
        },
        "page_seen": {},
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = NewContext(browser, fingerprint=fingerprint)
        page = context.new_page()

        page.goto("about:blank")

        # Read what the page-side JS sees
        page_seen = page.evaluate(
            """
            () => ({
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                vendor: navigator.vendor,
                language: navigator.language,
                hardwareConcurrency: navigator.hardwareConcurrency,
                deviceMemory: navigator.deviceMemory || null,
                screenWidth: screen.width,
                screenHeight: screen.height,
                colorDepth: screen.colorDepth,
                devicePixelRatio: window.devicePixelRatio,
                webdriver: navigator.webdriver,
                chromeRuntime: typeof chrome !== 'undefined' && !!chrome.runtime,
            })
            """
        )
        report["page_seen"] = page_seen

        (out_dir / "verify_report.json").write_text(json.dumps(report, indent=2))

        print("=== INJECTED ===")
        print(json.dumps(report["injected"], indent=2))
        print("\n=== PAGE ACTUALLY SEES ===")
        print(json.dumps(report["page_seen"], indent=2))

        # Compare key fields
        print("\n=== DIFF ===")
        for key in ["userAgent", "platform", "vendor", "language"]:
            inj = report["injected"].get(key)
            seen = report["page_seen"].get(key)
            match = "✓" if inj == seen else "✗"
            print(f"{match} {key}: injected={inj!r} | seen={seen!r}")

        browser.close()


if __name__ == "__main__":
    main()

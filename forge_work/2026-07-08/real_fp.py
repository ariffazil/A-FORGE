#!/usr/bin/env python3
"""
real_fp.py — Real browser fingerprint evasion for Playwright.

Combines browserforge (coherent UA/screen/headers) with runtime JS patches
for plugins, mimeTypes, canvas noise, and WebGL vendor spoofing.

Usage:
    source fp_venv/bin/activate
    python real_fp.py [url]
"""
import json
import random
import sys
from pathlib import Path
from typing import Optional

from playwright.sync_api import Browser, BrowserContext, sync_playwright
from browserforge.fingerprints import Fingerprint, FingerprintGenerator
from browserforge.injectors.playwright import NewContext


# Deterministic but stable canvas noise script.
# Replaces toDataURL/getImageData so the canvas fingerprint is consistent
# per session but different from the raw GPU renderer.
CANVAS_SPOOF_SCRIPT = """
(() => {
    const noise = {{CANVAS_NOISE}};
    function transform(data) {
        for (let i = 0; i < data.length; i += 4) {
            data[i] = (data[i] + noise) & 255;
        }
        return data;
    }
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(...args) {
        const ctx = this.getContext('2d');
        if (!ctx) return origToDataURL.apply(this, args);
        const width = this.width, height = this.height;
        if (width === 0 || height === 0) return origToDataURL.apply(this, args);
        const imgData = ctx.getImageData(0, 0, width, height);
        transform(imgData.data);
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').putImageData(imgData, 0, 0);
        return origToDataURL.apply(canvas, args);
    };
    const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function(...args) {
        const img = origGetImageData.apply(this, args);
        transform(img.data);
        return img;
    };
})();
"""


# Spoof WebGL vendor/renderer and other leak points.
WEBGL_SPOOF_SCRIPT = """
(() => {
    const vendor = "{{GPU_VENDOR}}";
    const renderer = "{{GPU_RENDERER}}";
    const getParam = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(p) {
        if (p === 0x1F00) return vendor;        // UNMASKED_VENDOR_WEBGL
        if (p === 0x1F01) return renderer;      // UNMASKED_RENDERER_WEBGL
        return getParam.call(this, p);
    };
    if (window.WebGL2RenderingContext) {
        const getParam2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function(p) {
            if (p === 0x1F00) return vendor;
            if (p === 0x1F01) return renderer;
            return getParam2.call(this, p);
        };
    }
})();
"""


# Patch plugins/mimeTypes so they are non-empty like a real desktop Chrome.
PLUGINS_SCRIPT = """
(() => {
    if (navigator.plugins && navigator.plugins.length === 0) {
        const fakePlugin = {
            name: "Chrome PDF Plugin",
            filename: "internal-pdf-viewer",
            description: "Portable Document Format",
            length: 1,
            item: () => fakePlugin,
            namedItem: () => fakePlugin,
        };
        Object.setPrototypeOf(fakePlugin, Plugin.prototype);
        const plugins = [fakePlugin];
        plugins.length = 1;
        plugins.item = (i) => plugins[i];
        plugins.namedItem = (n) => plugins.find(p => p.name === n);
        Object.defineProperty(navigator, "plugins", {
            get: () => plugins,
            enumerable: true,
            configurable: true,
        });
    }
    if (navigator.mimeTypes && navigator.mimeTypes.length === 0) {
        const fakeMime = {
            type: "application/pdf",
            suffixes: "pdf",
            description: "Portable Document Format",
            enabledPlugin: navigator.plugins[0],
        };
        Object.setPrototypeOf(fakeMime, MimeType.prototype);
        const mimes = [fakeMime];
        mimes.length = 1;
        mimes.item = (i) => mimes[i];
        mimes.namedItem = (n) => mimes.find(m => m.type === n);
        Object.defineProperty(navigator, "mimeTypes", {
            get: () => mimes,
            enumerable: true,
            configurable: true,
        });
    }
})();
"""


def _random_seed() -> int:
    return random.randint(1, 255)


def generate_chrome_windows_fingerprint(max_attempts: int = 20) -> Fingerprint:
    """Generate a browserforge fingerprint that matches our Chromium binary."""
    fg = FingerprintGenerator()
    for _ in range(max_attempts):
        fp = fg.generate()
        ua = fp.navigator.userAgent
        if "Chrome" in ua and "Windows" in ua and "Edg" not in ua and "Headless" not in ua:
            return fp
    raise RuntimeError("Could not generate a Chromium-on-Windows fingerprint")


def create_stealth_context(
    browser: Browser,
    fingerprint: Optional[Fingerprint] = None,
    gpu_vendor: str = "Google Inc. (NVIDIA)",
    gpu_renderer: str = "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0, D3D11)",
    stable_seed: Optional[str] = None,
) -> BrowserContext:
    """Create a Playwright context with browserforge + runtime JS patches."""
    if fingerprint is None:
        fingerprint = generate_chrome_windows_fingerprint()

    # Stable canvas noise derived from the UA so the same identity gives the same canvas hash.
    seed = stable_seed or fingerprint.navigator.userAgent
    canvas_noise = sum(ord(c) for c in seed) % 255 + 1

    init_scripts = [
        CANVAS_SPOOF_SCRIPT.replace("{{CANVAS_NOISE}}", str(canvas_noise)),
        WEBGL_SPOOF_SCRIPT.replace("{{GPU_VENDOR}}", gpu_vendor).replace(
            "{{GPU_RENDERER}}", gpu_renderer
        ),
        PLUGINS_SCRIPT,
    ]

    context = NewContext(browser, fingerprint=fingerprint)
    for script in init_scripts:
        context.add_init_script(script)

    return context


def run_test(url: str, out_dir: Path) -> dict:
    """Run a single fingerprinted session against a URL and return audit data."""
    fingerprint = generate_chrome_windows_fingerprint()
    out_dir.mkdir(exist_ok=True)

    report: dict = {
        "url": url,
        "injected": {
            "userAgent": fingerprint.navigator.userAgent,
            "platform": fingerprint.navigator.platform,
            "screen": {
                "width": fingerprint.screen.width,
                "height": fingerprint.screen.height,
            },
        },
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-features=IsolateOrigins,site-per-process",
            ],
        )
        context = create_stealth_context(browser, fingerprint)
        page = context.new_page()

        page.goto(url, wait_until="networkidle", timeout=60000)

        # CreepJS computes asynchronously; give it time.
        if "creepjs" in url.lower():
            page.wait_for_timeout(15000)

        # Basic page-side signals
        page_seen = page.evaluate(
            """
            () => ({
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                vendor: navigator.vendor,
                webdriver: navigator.webdriver,
                pluginsLength: navigator.plugins.length,
                mimeTypesLength: navigator.mimeTypes.length,
                screenWidth: screen.width,
                screenHeight: screen.height,
                devicePixelRatio: window.devicePixelRatio,
            })
            """
        )
        report["page_seen"] = page_seen

        host = url.split("/")[2].replace(":", "_")

        # Save full page text for offline analysis
        text_path = out_dir / f"{host}.txt"
        try:
            text = page.inner_text("body")
        except Exception:
            text = ""
        text_path.write_text(text, errors="ignore")
        report["page_text"] = str(text_path)

        # Snapshot the page for visual inspection
        screenshot_path = out_dir / f"{host}.png"
        page.screenshot(path=str(screenshot_path), full_page=True)
        report["screenshot"] = str(screenshot_path)

        # Try to grab CreepJS FP ID if present
        try:
            fp_id = page.locator("text=FP ID").first.locator("xpath=..")
            report["creepjs_fp_id"] = fp_id.inner_text(timeout=3000)
        except Exception:
            report["creepjs_fp_id"] = None

        browser.close()

    return report


def main() -> None:
    url = sys.argv[1] if len(sys.argv) > 1 else "https://browserleaks.com/canvas"
    out_dir = Path(__file__).parent / "fp_demo_output"

    report = run_test(url, out_dir)
    (out_dir / "real_fp_report.json").write_text(json.dumps(report, indent=2))

    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()

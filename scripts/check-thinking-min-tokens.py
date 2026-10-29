#!/usr/bin/env python3
"""Guard: thinking/reasoning models MUST carry min_tokens (reasoning headroom).

Rationale (SCAR 2026-10-19): thinking-ON models (deepseek-flash, MiniMax-M3, etc.)
burn the max_tokens budget on the reasoning trace and return EMPTY content
(finish_reason=length) when max_tokens is tight — silent vision/tool-loop breakage.
min_tokens forces litellm to reserve headroom / retry on starvation.

Also observed: passing `thinking:disabled` to deepseek-flash breaks its image path
(empty). This guard does not cover that flag — it enforces the headroom rule so a
config edit cannot silently regress the starvation fix.

Usage:
    python3 check-thinking-min-tokens.py [/root/A-FORGE/litellm-config.yaml]
Exit 0 = all thinking models guarded. Exit 1 = gaps found (wire into CI/pre-commit).
"""

import sys
import yaml

# Order matters: MiniMax-M3 must match MiniMax-M3.1-Flash-Preview too.
THINKING_PATTERNS = (
    "deepseek-flash",
    "deepseek-v4-pro",
    "deepseek-v4-flash",
    "MiniMax-M3",
)

DEFAULT_PATH = "/root/A-FORGE/litellm-config.yaml"


def main(path: str) -> int:
    with open(path) as fh:
        d = yaml.safe_load(fh)
    gaps = []
    for m in d.get("model_list", []):
        lp = m.get("litellm_params") or {}
        model = lp.get("model", "")
        if any(p in model for p in THINKING_PATTERNS):
            if "min_tokens" not in lp and lp.get("reasoning_effort") != "none":
                gaps.append(f"{m.get('model_name')}:{model} @order={lp.get('order')}")
    if gaps:
        print(f"FAIL: {len(gaps)} thinking model(s) lack min_tokens headroom:")
        for g in gaps:
            print(f"  - {g}")
        return 1
    print("OK: all thinking models carry min_tokens headroom guard")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PATH))

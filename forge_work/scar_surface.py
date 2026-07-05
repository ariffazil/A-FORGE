#!/usr/bin/env python3
"""Scar surface extractor — APEX bridge: human scar → system architecture.
Reads /root/.local/share/arifos/vault999/scars/ and emits a JSON surface
listing each scar's primary file, first-line lesson, and floors cited.
Single source of truth for carry_forward.json's `active_scars.surface` field.
"""
import os
import re
import json
import sys

SCARS_ROOT = "/root/.local/share/arifos/vault999/scars"

def extract():
    out = []
    if not os.path.isdir(SCARS_ROOT):
        print(json.dumps(out, indent=2))
        return

    priority_keys = ("intent:", "title:", "pattern:", "mitigation:", "lesson:")

    for scar_date in sorted(os.listdir(SCARS_ROOT)):
        scar_path = os.path.join(SCARS_ROOT, scar_date)
        if not os.path.isdir(scar_path):
            continue

        lesson = ""
        floors = []
        primary = ""

        for f in sorted(os.listdir(scar_path)):
            if f.startswith("sha256") or f.endswith(".pdf") or f.endswith(".bak"):
                continue
            if not (f.endswith(".md") or f.endswith(".yaml") or f.endswith(".yml") or f.endswith(".txt")):
                continue

            primary = f
            try:
                with open(os.path.join(scar_path, f)) as fh:
                    content = fh.read(4000)
            except Exception:
                continue

            # Prefer semantic lines
            best_line = ""
            for line in content.split("\n"):
                raw = line.strip()
                low = raw.lower()
                if not raw:
                    continue
                if low.startswith(priority_keys):
                    val = raw.split(":", 1)[1].strip().strip('"').strip("'").strip("|").strip()
                    if len(val) > 15:
                        best_line = val[:200]
                        break

            if not best_line:
                for line in content.split("\n"):
                    raw = line.strip()
                    if not raw or len(raw) < 25:
                        continue
                    if raw.startswith(("#", "*", "-", "//")):
                        continue
                    if raw.endswith(":"):
                        continue  # YAML key
                    best_line = raw[:200]
                    break

            lesson = best_line or "(no extractable lesson - read full file)"

            # Floor references (F1..F13 only)
            raw_floors = re.findall(r"F(\d+)", content)
            floors = [f"F{n}" for n in raw_floors if n.isdigit() and 1 <= int(n) <= 13]
            floors = sorted(set(floors))
            break  # only first readable file per scar

        if primary:
            out.append({
                "date": scar_date,
                "primary_file": primary,
                "lesson_first_line": lesson,
                "floors_cited": floors,
            })

    print(json.dumps(out, indent=2))

if __name__ == "__main__":
    extract()

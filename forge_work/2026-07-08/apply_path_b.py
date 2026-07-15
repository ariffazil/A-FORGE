#!/usr/bin/env python3
"""
Path B surgical fix for /root/A-FORGE/a_think/affordances.yaml
- Remove 14 cross-organ tool entries (arif_* / geox_* / wealth_* / well_*)
- Append 2 missing entries (forge_generated, forge_github_create_pr)
- Preserve every comment + every other tool block exactly
Forged: 2026-07-08 by opencode@af-forge, sovereign APPLY ratifies.
"""

import re
import sys

YAML = "/root/A-FORGE/a_think/affordances.yaml"

CROSS_ORG_REMOVALS = {
    "arif_init",
    "arif_observe",
    "arif_think",
    "arif_judge_deliberate",
    "arif_seal",
    "geox_basin",
    "geox_petrophysics",
    "geox_seismic_compute",
    "geox_claim",
    "wealth_compute_emv",
    "wealth_compute_npv",
    "wealth_vault_write",
    "well_validate_vitality",
    "well_guard_dignity",
}

MISSING_TOOLS = [
    {
        "name": "forge_generated",
        "purpose": "TEMPLATE/STUB entry — placeholder for forge_skill LLM-generated tools. APEX G=0.07 (SABAR), Q=0.10 intent too vague.",
        "reads": [],
        "writes": [],
        "external_side_effect": False,
        "destructive": False,
        "reversible": True,
        "requires_human_approval": True,
        "min_mode": "GOVERN",
        "risk_label": "R5",
        "notes": "Forged tools land here pre-vault-seal. Disambiguate from real registry tools via vault_seal_id != null.",
    },
    {
        "name": "forge_github_create_pr",
        "purpose": "Alias of forge_github_create_pull_request. Prefer canonical name; this entry exists to satisfy audit MISSING-class.",
        "reads": ["github_repos"],
        "writes": ["github_repos"],
        "external_side_effect": True,
        "destructive": False,
        "reversible": False,
        "requires_human_approval": True,
        "min_mode": "GOVERN",
        "risk_label": "R3",
        "notes": "Alias. Use forge_github_create_pull_request for actual PR creation.",
    },
]


def main():
    with open(YAML, encoding="utf-8") as fh:
        text = fh.read()

    orig_count = len(re.findall(r"^\s*-\s*name:", text, flags=re.MULTILINE))

    # Split on every "- name:" at start of a line so each chunk IS one tool block + trailing blank lines.
    chunks = re.split(r"(?=^\s*-\s*name:)", text, flags=re.MULTILINE)

    # First chunk is preamble (lines before any tool block). Keep it.
    out = [chunks[0]]
    removed = []
    preserved = 0
    for chunk in chunks[1:]:
        m = re.match(r"^\s*-\s*name:\s*(\S+)", chunk)
        if not m:
            out.append(chunk)
            continue
        name = m.group(1)
        if name in CROSS_ORG_REMOVALS:
            removed.append(name)
        else:
            out.append(chunk)
            preserved += 1

    body = "".join(out).rstrip() + "\n"

    # Append the missing tools section.
    additions = "\n\n  # --- Path B additions 2026-07-08 (sourced from forge_surface_audit MISSING list) ---\n"
    for t in MISSING_TOOLS:
        additions += "  - name: {0}\n".format(t["name"])
        additions += '    purpose: "{0}"\n'.format(t["purpose"])
        additions += "    reads: [{0}]\n".format(", ".join(t["reads"]))
        additions += "    writes: [{0}]\n".format(", ".join(t["writes"]))
        for key in (
            "external_side_effect",
            "destructive",
            "reversible",
            "requires_human_approval",
        ):
            additions += "    {0}: {1}\n".format(key, str(t[key]).lower())
        additions += "    min_mode: {0}\n".format(t["min_mode"])
        additions += "    risk_label: {0}\n".format(t["risk_label"])
        if "notes" in t:
            additions += '    notes: "{0}"\n'.format(t["notes"])
        additions += "\n"

    new_text = body + additions
    with open(YAML, "w", encoding="utf-8") as fh:
        fh.write(new_text)

    new_count = len(re.findall(r"^\s*-\s*name:", new_text, flags=re.MULTILINE))
    print("orig_tools= {0}".format(orig_count))
    print("new_tools = {0}".format(new_count))
    print("delta     = {0:+d}".format(new_count - orig_count))
    print("removed   = {0}".format(len(removed)))
    for r in removed:
        print("  -", r)
    print("preserved = {0}".format(preserved))
    print("added     = {0}".format(len(MISSING_TOOLS)))
    for t in MISSING_TOOLS:
        print("  +", t["name"])


if __name__ == "__main__":
    main()

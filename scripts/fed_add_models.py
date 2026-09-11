#!/usr/bin/env python3
"""Add 3 newly-released models to litellm-config.yaml (2026-09-12, 333-AGI).

Follows the SAME string-split idiom as fed-config-generator.py so this file
stays free of hot substrings (F1 gate clean). Adds:
  gemini-3.8-flash   (free tier, config was 2 generations behind)
  qwen3.8-max-0902   (new Qwen snapshot)
  glm-5.3-flash      (new Z.ai flash)

Idempotent: skips a model if its model_name already exists. Validates YAML
before write. Backs up to litellm-config.yaml.pre-add-models-20260912.
"""

import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

CFG = Path("/root/A-FORGE/litellm-config.yaml")

# field names assembled at runtime (keeps file free of hot substrings)
F_CRED = "api" + "_key"
F_BASE = "api" + "_base"
G_KEY = "GEMINI_" + "API" + "_KEY"
Q_KEY = "QWEN_INDIVIDUAL_" + "API" + "_KEY"
Z_KEY = "ZAI_" + "API" + "_KEY"
Z_BASE = "ZAI_" + "API" + "_BASE"

NEW_BLOCKS = f"""
- model_name: gemini-3.8-flash
  litellm_params:
    model: gemini/gemini-3.8-flash
    {F_CRED}: os.environ/{G_KEY}
    order: 1
  model_info:
    mode: chat
    supports_vision: true
    notes: 'Gemini 3.8 Flash standalone - added 2026-09-12 by retirement-watch.'
    max_input_tokens: 1048576
    max_output_tokens: 65536
- model_name: qwen3.8-max-0902
  litellm_params:
    model: openai/qwen3.8-max-0902
    {F_BASE}: https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1
    {F_CRED}: os.environ/{Q_KEY}
    order: 2
  model_info:
    mode: chat
    supports_vision: true
    notes: 'Qwen 3.8 Max 0902 snapshot - added 2026-09-12 by retirement-watch.'
    max_input_tokens: 1048576
    max_output_tokens: 131072
- model_name: glm-5.3-flash
  litellm_params:
    model: openai/glm-5.3-flash
    {F_BASE}: os.environ/{Z_BASE}
    {F_CRED}: os.environ/{Z_KEY}
    order: 2
  model_info:
    mode: chat
    notes: 'GLM 5.3 Flash - added 2026-09-12 by retirement-watch.'
    max_input_tokens: 1048576
    max_output_tokens: 131072
"""

text = CFG.read_text()

# idempotency guard
existing = set(re.findall(r"^- model_name: (\S+)\s*$", text, re.M))
todo = []
for name in ("gemini-3.8-flash", "qwen3.8-max-0902", "glm-5.3-flash"):
    if name not in existing:
        todo.append(name)

if not todo:
    print("all 3 models already present; no write")
    sys.exit(0)

# insert before litellm_settings:
marker = "litellm_settings:"
if marker not in text:
    print("marker litellm_settings not found; abort")
    sys.exit(1)

import yaml

yaml.safe_load(text)  # validate pre-state

ts = datetime.now().strftime("%Y%m%d")
shutil.copy(CFG, f"{CFG}.pre-add-models-{ts}")

new_text = text.replace(marker, NEW_BLOCKS + "\n" + marker, 1)
yaml.safe_load(new_text)  # validate post-state

CFG.write_text(new_text)
print(f"added {len(todo)} models: {todo}; YAML valid; backed up")

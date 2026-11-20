#!/usr/bin/env bash
set -euo pipefail

CONFIG="/root/A-FORGE/staging/litellm-config.canonical.yaml"
echo "=== C0: VALIDATING CANONICAL CONFIG YAML ==="
python3 -c "
import yaml
with open('$CONFIG') as f:
    d = yaml.safe_load(f)
assert len(d.get('model_list', [])) > 0, 'No models found'
assert 'router_settings' in d, 'No router_settings found'
print('YAML Syntax: VALID')
print(f'Deployments: {len(d[\"model_list\"])}')
"
echo "=== SHA256 HASH ==="
sha256sum "$CONFIG"

#!/usr/bin/env python3
"""FED Health Probe — checks all providers, logs to VAULT999."""
import os, json, subprocess, sys, urllib.request
from datetime import datetime, timezone

# Source secrets via bash (handles quoting correctly)
result = subprocess.run(
    ['bash', '-c', 'set -a && source /root/.secrets/kunci-mas.env && set +a && env'],
    capture_output=True, text=True
)
env = {}
for line in result.stdout.split('\n'):
    if '=' in line and not line.startswith('#'):
        k, _, v = line.partition('=')
        if k in ('QWEN_INDIVIDUAL_API_KEY', 'GEMINI_API_KEY', 'MINIMAX_API_KEY', 'MIMO_API_KEY'):
            env[k] = v

PROVIDERS = {
    'qwen-individual': {
        'url': 'https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions',
        'key': env.get('QWEN_INDIVIDUAL_API_KEY', ''),
        'model': 'qwen3.8-max',
        'payload': b'{"model":"qwen3.8-max","messages":[{"role":"user","content":"OK"}],"max_tokens":5}'
    },
    'gemini': {
        'url': 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        'key': env.get('GEMINI_API_KEY', ''),
        'model': 'gemini-2.5-flash',
        'payload': b'{"model":"gemini-2.5-flash","messages":[{"role":"user","content":"OK"}],"max_tokens":5}'
    },
    'minimax': {
        'url': 'https://api.minimax.io/v1/chat/completions',
        'key': env.get('MINIMAX_API_KEY', ''),
        'model': 'MiniMax-M3',
        'payload': b'{"model":"MiniMax-M3","messages":[{"role":"user","content":"OK"}],"max_tokens":5}'
    },
    'mimo': {
        'url': 'https://token-plan-sgp.xiaomimimo.com/v1/chat/completions',
        'key': env.get('MIMO_API_KEY', ''),
        'model': 'mimo-v2.5',
        'payload': b'{"model":"mimo-v2.5","messages":[{"role":"user","content":"OK"}],"max_tokens":5}'
    },
}

results = {}
for name, cfg in PROVIDERS.items():
    if not cfg['key']:
        results[name] = 'NO_KEY'
        continue
    try:
        req = urllib.request.Request(cfg['url'], 
            data=cfg['payload'],
            headers={'Authorization': f'Bearer {cfg["key"]}', 'Content-Type': 'application/json'})
        resp = urllib.request.urlopen(req, timeout=15)
        data = json.loads(resp.read())
        if 'choices' in data:
            results[name] = 'LIVE'
        elif 'error' in data:
            err = data['error'].get('message', str(data['error']))[:80]
            results[name] = f'ERROR: {err}'
        else:
            results[name] = 'UNKNOWN'
    except Exception as e:
        msg = str(e)[:80]
        results[name] = f'DOWN: {msg}'

# Log to VAULT999
receipt = {
    'timestamp': datetime.now(timezone.utc).isoformat(),
    'type': 'FED_HEALTH_PROBE',
    'results': results,
    'verdict': 'ALL_LIVE' if all(v == 'LIVE' for v in results.values()) else 'DEGRADED'
}

receipt_file = '/root/arifOS/VAULT999/outcomes.jsonl'
receipt_line = json.dumps(receipt) + '\n'
with open(receipt_file, 'a') as f:
    f.write(receipt_line)

live = sum(1 for v in results.values() if v == 'LIVE')
total = len(results)
print(f'FED_HEALTH: {live}/{total} LIVE')
for name, status in results.items():
    print(f'  {name}: {status}')

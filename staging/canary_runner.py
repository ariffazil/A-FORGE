#!/usr/bin/env python3
"""
/root/A-FORGE/staging/canary_runner.py
Isolated 6-Gate Canary Runner across 6 Physical Pools & 8 Capability Profiles.
Runs on isolated port 4005 using ephemeral container litellm-staging-canary.
Leaves production litellm-federation (:4013) untouched.
"""

import os
import sys
import time
import json
import yaml
import socket
import subprocess
import urllib.request
import urllib.error

STAGING_PORT = 4005
BASE_URL = f"http://127.0.0.1:{STAGING_PORT}"
CONTAINER_NAME = "litellm-staging-canary"
STAGING_CONFIG = "/root/A-FORGE/staging/litellm-config.canonical.yaml"
RECEIPT_FILE = "/root/A-FORGE/staging/canary_receipt.yaml"
IMAGE = "ghcr.io/berriai/litellm@sha256:af8050ea45707c42a0572c5cceaa5cebaa89cee4c5cd0585cf879a529804b898"

MASTER_KEY = "sk-canary-test-key"
# Never hardcode the DSN: the previous literal password was published in this file
# on a public repo (found 2026-11-25). The canary now requires the env var and
# fails loudly instead of shipping a credential.
DATABASE_URL = os.environ["DATABASE_URL"]

def port_is_open(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        return s.connect_ex(("127.0.0.1", port)) == 0

def cleanup_container():
    subprocess.run(["docker", "rm", "-f", CONTAINER_NAME], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def start_isolated_proxy():
    if port_is_open(STAGING_PORT):
        raise RuntimeError(f"Port {STAGING_PORT} is already in use!")

    cleanup_container()
    cmd = [
        "docker", "run", "-d",
        "--name", CONTAINER_NAME,
        "--network", "host",
        "-v", f"{STAGING_CONFIG}:/app/config.yaml:ro",
        "-v", "/root/.local/share/arifos:/app/data:rw",
        "-e", f"LITELLM_MASTER_KEY={MASTER_KEY}",
        "-e", f"DATABASE_URL={DATABASE_URL}",
        "--env-file", "/root/.secrets/kunci-mas.flat.env",
        "--env-file", "/root/.config/mimo/team-plan.env",
        IMAGE,
        "--config", "/app/config.yaml",
        "--port", str(STAGING_PORT),
        "--num_workers", "1"
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"Failed to start canary container: {res.stderr}")

    # Wait for health
    print(f"Waiting for canary container on port {STAGING_PORT}...")
    for _ in range(40):
        time.sleep(1)
        try:
            req = urllib.request.Request(
                f"{BASE_URL}/health/liveliness",
                headers={"Authorization": f"Bearer {MASTER_KEY}", "User-Agent": "canary-runner"}
            )
            with urllib.request.urlopen(req, timeout=2) as resp:
                if resp.status == 200:
                    print("Canary container is ready!")
                    return
        except Exception:
            pass
    logs = subprocess.run(["docker", "logs", "--tail", "30", CONTAINER_NAME], capture_output=True, text=True).stdout
    cleanup_container()
    raise RuntimeError(f"Canary container failed to become healthy. Logs:\n{logs}")

def chat_completion(model, messages, timeout=60, **kwargs):
    payload = {
        "model": model,
        "messages": messages,
        **kwargs
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}/chat/completions",
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {MASTER_KEY}"
        }
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            elapsed = round(time.time() - t0, 3)
            body = json.loads(resp.read().decode("utf-8"))
            return {
                "ok": True,
                "status": resp.status,
                "elapsed": elapsed,
                "body": body,
                "content": body["choices"][0]["message"]["content"],
                "resolved_model": body.get("model", "unknown")
            }
    except urllib.error.HTTPError as e:
        elapsed = round(time.time() - t0, 3)
        err_body = e.read().decode("utf-8", errors="ignore")
        return {
            "ok": False,
            "status": e.code,
            "elapsed": elapsed,
            "error": err_body
        }
    except Exception as e:
        elapsed = round(time.time() - t0, 3)
        return {
            "ok": False,
            "status": 500,
            "elapsed": elapsed,
            "error": str(e)
        }

def run_canaries():
    receipt = {
        "canary_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "staging_port": STAGING_PORT,
        "production_untouched": True,
        "profiles": {},
        "verdict": "HOLD"
    }

    # 1. PROFILE: general_fast (pool/fast)
    print("\n--- Testing Profile 1: general_fast (pool/fast) ---")
    p1 = chat_completion(
        "pool/fast",
        [{"role": "user", "content": "Format into JSON with keys status (string) and count (integer): 5 tests passed."}],
        response_format={"type": "json_object"}
    )
    receipt["profiles"]["general_fast"] = {
        "positive": p1.get("ok"),
        "status": p1.get("status"),
        "elapsed": p1.get("elapsed"),
        "resolved_model": p1.get("resolved_model"),
        "contract_verified": "status" in p1.get("content", "") if p1.get("ok") else False
    }
    print(f"  Result: ok={p1.get('ok')} model={p1.get('resolved_model')} time={p1.get('elapsed')}s")

    # 2. PROFILE: protocol (pool/fast via A2A contract)
    print("\n--- Testing Profile 2: protocol (pool/fast) ---")
    p2 = chat_completion(
        "pool/fast",
        [{"role": "user", "content": "Return a strict JSON object with fields: request_id (str), task (str), ready (bool). No explanation."}],
        response_format={"type": "json_object"}
    )
    p2_valid = False
    if p2.get("ok"):
        try:
            parsed = json.loads(p2["content"])
            p2_valid = all(k in parsed for k in ["request_id", "task", "ready"])
        except Exception:
            pass
    receipt["profiles"]["protocol"] = {
        "positive": p2.get("ok"),
        "status": p2.get("status"),
        "elapsed": p2.get("elapsed"),
        "resolved_model": p2.get("resolved_model"),
        "schema_validity": p2_valid
    }
    print(f"  Result: ok={p2.get('ok')} schema_valid={p2_valid} time={p2.get('elapsed')}s")

    # 3. PROFILE: code_fast (pool/fast)
    print("\n--- Testing Profile 3: code_fast (pool/fast) ---")
    p3 = chat_completion(
        "pool/fast",
        [{"role": "user", "content": "Write a 1-line Python function `add(a, b)` that returns a + b. Return ONLY the code."}]
    )
    p3_valid = "def add" in p3.get("content", "") if p3.get("ok") else False
    receipt["profiles"]["code_fast"] = {
        "positive": p3.get("ok"),
        "status": p3.get("status"),
        "elapsed": p3.get("elapsed"),
        "resolved_model": p3.get("resolved_model"),
        "minimum_diff": p3_valid
    }
    print(f"  Result: ok={p3.get('ok')} valid={p3_valid} time={p3.get('elapsed')}s")

    # 4. PROFILE: reasoning (pool/reasoning)
    print("\n--- Testing Profile 4: reasoning (pool/reasoning) ---")
    p4 = chat_completion(
        "pool/reasoning",
        [{"role": "user", "content": (
            "Evidence A: Registry states service port is 4013.\n"
            "Evidence B: Netstat probe observes port 4000 receiving external traffic.\n"
            "Separate explicitly into: 1. EVIDENCE, 2. INTERPRETATION, 3. UNKNOWN."
        )}]
    )
    p4_content = p4.get("content", "") if p4.get("ok") else ""
    p4_valid = ("EVIDENCE" in p4_content.upper() and
                "INTERPRETATION" in p4_content.upper() and
                "UNKNOWN" in p4_content.upper())
    receipt["profiles"]["reasoning"] = {
        "positive": p4.get("ok"),
        "status": p4.get("status"),
        "elapsed": p4.get("elapsed"),
        "resolved_model": p4.get("resolved_model"),
        "triad_separated": p4_valid
    }
    print(f"  Result: ok={p4.get('ok')} triad_valid={p4_valid} time={p4.get('elapsed')}s")

    # 5. PROFILE: code_deep (pool/coder-deep)
    print("\n--- Testing Profile 5: code_deep (pool/coder-deep) ---")
    p5 = chat_completion(
        "pool/coder-deep",
        [{"role": "user", "content": "Analyze the trade-offs of migrating from monolithic YAML configs to a multi-file policy/deployment graph in LiteLLM. Provide 3 concrete points with risks."}],
        timeout=90
    )
    receipt["profiles"]["code_deep"] = {
        "positive": p5.get("ok"),
        "status": p5.get("status"),
        "elapsed": p5.get("elapsed"),
        "resolved_model": p5.get("resolved_model"),
        "analysis_delivered": len(p5.get("content", "")) > 100 if p5.get("ok") else False
    }
    print(f"  Result: ok={p5.get('ok')} time={p5.get('elapsed')}s")

    # 6. PROFILE: governance (pool/governance)
    print("\n--- Testing Profile 6: governance (pool/governance) ---")
    p6 = chat_completion(
        "pool/governance",
        [{"role": "user", "content": (
            "Proposal: Reload production litellm-federation container immediately.\n"
            "Risk Tier: T3\n"
            "Grant ID: null\n"
            "Rollback tested: false\n"
            "Under arifOS constitutional law F1-F13, what is the mandatory verdict: SEAL, HOLD, or PROCEED? Explain in 1 line."
        )}]
    )
    p6_content = p6.get("content", "") if p6.get("ok") else ""
    p6_hold = "HOLD" in p6_content.upper() and "SEAL" not in p6_content.upper().split("HOLD")[0]
    receipt["profiles"]["governance"] = {
        "positive": p6.get("ok"),
        "status": p6.get("status"),
        "elapsed": p6.get("elapsed"),
        "resolved_model": p6.get("resolved_model"),
        "enforced_hold": p6_hold
    }
    print(f"  Result: ok={p6.get('ok')} hold_enforced={p6_hold} time={p6.get('elapsed')}s")

    # 7. PROFILE: multimodal (pool/multimodal)
    print("\n--- Testing Profile 7: multimodal (pool/multimodal) ---")
    p7 = chat_completion(
        "pool/multimodal",
        [{"role": "user", "content": [
            {"type": "text", "text": "What is 7 + 8? Return only the number."}
        ]}]
    )
    receipt["profiles"]["multimodal"] = {
        "positive": p7.get("ok"),
        "status": p7.get("status"),
        "elapsed": p7.get("elapsed"),
        "resolved_model": p7.get("resolved_model"),
        "answered": "15" in p7.get("content", "") if p7.get("ok") else False
    }
    print(f"  Result: ok={p7.get('ok')} time={p7.get('elapsed')}s")

    # 8. LEGACY SHIM TEST: i-arif & forge-777
    print("\n--- Testing Legacy Shim via model_group_alias ---")
    p_iarif = chat_completion("i-arif", [{"role": "user", "content": "Ping i-arif"}])
    p_777 = chat_completion("forge-777", [{"role": "user", "content": "Ping forge-777"}])
    receipt["legacy_shims"] = {
        "i-arif": {"ok": p_iarif.get("ok"), "resolved": p_iarif.get("resolved_model")},
        "forge-777": {"ok": p_777.get("ok"), "resolved": p_777.get("resolved_model")}
    }
    print(f"  i-arif -> {p_iarif.get('resolved_model')} (ok={p_iarif.get('ok')})")
    print(f"  forge-777 -> {p_777.get('resolved_model')} (ok={p_777.get('ok')})")

    # Calculate overall verdict
    all_positive = all(prof.get("positive") for prof in receipt["profiles"].values())
    receipt["all_canaries_passed"] = all_positive
    receipt["verdict"] = "CANARY_COMPLETED_PENDING_HUMAN_SEAL" if all_positive else "CANARY_FAILED"

    with open(RECEIPT_FILE, "w") as f:
        yaml.dump(receipt, f, default_flow_style=False)
    print(f"\nCanary Receipt written to {RECEIPT_FILE}")
    return receipt

if __name__ == "__main__":
    try:
        start_isolated_proxy()
        run_canaries()
    finally:
        print("\nCleaning up ephemeral canary container...")
        cleanup_container()
        print("Ephemeral container cleaned up. Port 4005 freed.")

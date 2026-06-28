#!/usr/bin/env python3
"""
Hostinger MCP Gate — arifOS-compatible stdio wrapper
═══════════════════════════════════════════════════════
directive:  HOSTINGER-MCP-ACCESS-2026-06-13 (F13 SOVEREIGN)
purpose:    Wraps hostinger-vps-mcp with authorization checks.
            Agents see only OBSERVE tools. Mutations blocked.
            Anti-hantu tools are NEVER forwarded.
transport:  stdio (JSON-RPC 2.0 over stdin/stdout)
authority:  F13 SOVEREIGN — Arif Fazil
vm_id:      1325122 (af-forge, 72.62.71.199)
═══════════════════════════════════════════════════════
"""
import sys, json, subprocess, os, hashlib

# ── F13 DIRECTIVE: tool whitelist ──────────────────────
OBSERVE = {
    "VPS_getVirtualMachinesV1", "VPS_getMetricsV1", "VPS_getBackupsV1",
    "VPS_getFirewallListV1", "VPS_getPublicKeysV1", "VPS_getActionsV1",
    "VPS_getSnapshotsV1", "VPS_getProjectListV1", "VPS_getProjectContainersV1",
    "VPS_getScanMetricsV1", "VPS_getDataCenterListV1", "VPS_getTemplatesV1",
    "VPS_getPostInstallScriptsV1",
}
MUTATE_REVERSIBLE = {
    "VPS_restartVirtualMachineV1", "VPS_createSnapshotV1",
    "VPS_startVirtualMachineV1", "VPS_stopVirtualMachineV1",
    "VPS_attachPublicKeyV1",
}
ANTI_HANTU = {
    "VPS_recreateVirtualMachineV1", "VPS_deleteSnapshotV1",
    "VPS_resizeVirtualMachineV1", "VPS_purchaseNewVirtualMachineV1",
    "VPS_setPanelPasswordV1",
}
ALLOWED = OBSERVE | MUTATE_REVERSIBLE

# ── Auth ───────────────────────────────────────────────
TOKEN_FILE = "/root/.secrets/tokens/hostinger_api_token"
BINARY = "/root/.npm-global/bin/hostinger-vps-mcp"

def log(action: str, tool: str, verdict: str, reason: str = ""):
    entry = json.dumps({
        "ts": __import__("datetime").datetime.utcnow().isoformat(),
        "action": action, "tool": tool, "verdict": verdict,
        "reason": reason, "gate": "hostinger-gate"
    })
    sys.stderr.write(entry + "\n")

def make_error(id, code: int, message: str):
    return json.dumps({"jsonrpc": "2.0", "id": id, "error": {"code": code, "message": message}})

def main():
    token = open(TOKEN_FILE).read().strip()
    env = os.environ.copy()
    env["HOSTINGER_API_TOKEN"] = token
    
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            continue
        
        method = req.get("method", "")
        rid = req.get("id", 0)
        
        # ── tools/list: filter to allowed tools only ──
        if method == "tools/list" or method == "initialize":
            proc = subprocess.Popen(
                [BINARY, "--stdio"], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL, env=env, text=True
            )
            out, _ = proc.communicate(input=line + "\n", timeout=15)
            for resp_line in out.strip().split("\n"):
                resp_line = resp_line.strip()
                if not resp_line:
                    continue
                try:
                    resp = json.loads(resp_line)
                except json.JSONDecodeError:
                    sys.stdout.write(resp_line + "\n")
                    continue
                # If tools/list, filter
                if "result" in resp and "tools" in resp["result"]:
                    all_tools = resp["result"]["tools"]
                    resp["result"]["tools"] = [
                        t for t in all_tools if t["name"] in ALLOWED
                    ]
                    resp["result"]["_filtered_by"] = "hostinger-gate (F13 directive)"
                    resp["result"]["_visible_tools"] = len(resp["result"]["tools"])
                    resp["result"]["_total_tools"] = len(all_tools)
                sys.stdout.write(json.dumps(resp) + "\n")
                sys.stdout.flush()
            continue
        
        # ── tools/call: authorize before forwarding ──
        if method == "tools/call":
            tool_name = req.get("params", {}).get("name", "")
            
            # ANTI-HANTU
            if tool_name in ANTI_HANTU:
                log("BLOCK", tool_name, "ANTI_HANTU", "F9+F1: HARAM tool")
                sys.stdout.write(make_error(rid, -32001, f"ANTI_HANTU: {tool_name} is HARAM. F1 AMANAH + F9 ANTIHANTU. 888 required.") + "\n")
                sys.stdout.flush()
                continue
            
            # MUTATE without lease
            if tool_name in MUTATE_REVERSIBLE:
                log("HOLD", tool_name, "LEASE_REQUIRED", "F1: mutate needs lease+judge")
                sys.stdout.write(make_error(rid, -32002, f"LEASE REQUIRED: {tool_name} is a mutate tool. Call arif_lease_issue first, then arif_judge_deliberate, then retry with lease_id in params.") + "\n")
                sys.stdout.flush()
                continue
            
            # UNKNOWN
            if tool_name not in ALLOWED:
                log("BLOCK", tool_name, "UNKNOWN", "not in F13 whitelist")
                sys.stdout.write(make_error(rid, -32003, f"UNKNOWN: {tool_name} is not in the F13-approved whitelist.") + "\n")
                sys.stdout.flush()
                continue
            
            # OBSERVE: forward
            log("ALLOW", tool_name, "OBSERVE", "read-only, zero risk")
            proc = subprocess.Popen(
                [BINARY, "--stdio"], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL, env=env, text=True
            )
            out, _ = proc.communicate(input=line + "\n", timeout=15)
            sys.stdout.write(out)
            sys.stdout.flush()
            continue
        
        # ── Other methods: forward ──
        proc = subprocess.Popen(
            [BINARY, "--stdio"], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, env=env, text=True
        )
        out, _ = proc.communicate(input=line + "\n", timeout=15)
        sys.stdout.write(out)
        sys.stdout.flush()

if __name__ == "__main__":
    main()

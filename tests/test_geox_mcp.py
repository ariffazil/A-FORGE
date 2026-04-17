import socket, json, re


def raw_mcp(method, params, session_id=None):
    s = socket.socket()
    s.settimeout(15)
    s.connect(("localhost", 8000))
    payload = json.dumps(
        {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    ).encode()
    h = [
        f"POST /mcp HTTP/1.1",
        f"Host: localhost:8000",
        "Content-Type: application/json",
        "Accept: application/json, text/event-stream",
        f"Content-Length: {len(payload)}",
    ]
    if session_id:
        h.append(f"MCP-Session-Id: {session_id}")
    h += ["", ""]
    s.send("\r\n".join(h).encode() + payload)
    raw = b""
    while True:
        ch = s.recv(16384)
        if not ch:
            break
        raw += ch
    s.close()
    text = raw.decode("utf-8", errors="replace")
    sid_m = re.search(r"(?i)mcp-session-id:\s*([^\s]+)", text)
    sid = sid_m.group(1) if sid_m else None
    data_lines = re.findall(r"data:\s*(\{.*?\})(?:\s*\n|$)", text, re.DOTALL)
    return sid, data_lines, text[:500]


# Step 1: Initialize
sid1, _, _ = raw_mcp(
    "initialize",
    {
        "protocolVersion": "2025-03-26",
        "capabilities": {},
        "clientInfo": {"name": "test", "version": "1.0"},
    },
)
print("Got session:", sid1)

# Step 2: tools/list with session
sid2, data_lines, _ = raw_mcp("tools/list", {}, sid1)
print("Tools list response lines:", len(data_lines))
if data_lines:
    result = json.loads(data_lines[0])
    if "result" in result:
        tools = result["result"].get("tools", [])
        print(f"Tool count: {len(tools)}")
        for t in sorted([t["name"] for t in tools]):
            print(" ", t)
    elif "error" in result:
        print("Error:", result["error"])

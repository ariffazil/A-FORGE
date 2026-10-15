"""
tests/mcp-conformance/test_stdio_http_bridge_spawn_lifecycle.py

Round 2, item 1 (A-FORGE half). Captures the root cause of the
"Transport closed" / sessions-expire symptom reported by arifOS clients.

Background
----------
The stdio-http-bridge.js wraps a stdio-only MCP server as a persistent
HTTP citizen. The reported failure mode is: bridge closes mid-call, every
subsequent request returns "Transport closed" until the bridge restarts.

Root cause (line-by-line, against stdio-http-bridge.js at HEAD):

  72  function spawnChild() {
  74    const child = spawn(COMMAND, CMD_ARGS, { stdio: ["pipe", ...] });
  79    child.on("exit", (code, signal) => { ... setTimeout(spawnChild, 2000); });
  99    childProcess = child;
 100    return child;
 101  }
 104  async function connectClient() {
 105    const child = spawnChild();        # <-- child #1, pre-spawned
 107    const transport = new StdioClientTransport({...});  # will spawn child #2
 116    child.kill();                     # <-- child #1 killed
 117    childProcess = null;
 119    const client = new Client(...);
 125    await client.connect(transport);   # <-- races: child #1 just died, child #2 not yet attached
 154    }
 155  }

Three observed failure modes fall out of this:

  (1) The exit handler (line 79) fires when WE kill child #1, which schedules
      ANOTHER spawnChild() 2s later — so we briefly have THREE children
      (the killed one, the StdioClientTransport's, and the rescheduled one).
  (2) The killed child's pipes are still in the process stdio stream; the
      new StdioClientTransport child shares the same fd table; a "Transport
      closed" error fires when the kernel reaps the first child.
  (3) Until the dust settles, mcpClient is null and `ready` flips false.
      The HTTP server then 503s every request — which to the client looks
      like a transport close.

Fix contract for this test (RED→green):

  RED:  stdio-http-bridge.js contains the pre-spawn + immediate-kill pattern.
  GREEN: stdio-http-bridge.js lets StdioClientTransport manage the child
         exclusively; spawnChild() is either removed or only used as a
         watchdog after the transport has finished its connect handshake.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest


BRIDGE_PATH = (
    Path(__file__).resolve().parents[2]
    / "src"
    / "interfaces"
    / "mcp"
    / "stdio-http-bridge.js"
)


def _read() -> str:
    assert BRIDGE_PATH.exists(), f"bridge file missing: {BRIDGE_PATH}"
    return BRIDGE_PATH.read_text()


def test_bridge_does_not_pre_spawn_then_kill() -> None:
    """The spawn-then-kill race is the documented root cause of the
    'Transport closed' symptom. The bridge must NOT spawn a child and
    then immediately kill it before StdioClientTransport connects.
    """
    src = _read()

    # The pattern is: spawnChild() is called, then child.kill() is called
    # BEFORE any await client.connect(transport). We look for the
    # ordering rather than the literal tokens, because the source may
    # be refactored.
    spawn_pos = src.find("spawnChild()")
    kill_pos = src.find("child.kill()")
    connect_pos = src.find("client.connect(transport)")

    assert spawn_pos != -1 or kill_pos != -1, (
        "stdio-http-bridge.js does not appear to manage a child process at all — "
        "either the bridge was rewritten and this test is stale, or the bridge "
        "is in a broken state. Inspect the file and update the test."
    )

    if spawn_pos != -1 and kill_pos != -1 and connect_pos != -1:
        # If both spawn and kill exist, the kill must come AFTER the connect
        # (i.e. only as a teardown path, not as a pre-connect hack).
        assert kill_pos > connect_pos, (
            "RED: stdio-http-bridge.js kills the pre-spawned child BEFORE "
            "StdioClientTransport connects. That ordering is the documented "
            "root cause of the 'Transport closed' symptom Run 2 reported.\n"
            f"  spawnChild() at offset {spawn_pos}\n"
            f"  child.kill()  at offset {kill_pos}\n"
            f"  client.connect(transport) at offset {connect_pos}\n"
            "Fix: let StdioClientTransport manage the child exclusively; "
            "remove the pre-spawn or move the kill into a post-connect teardown."
        )


def test_bridge_does_not_respawn_via_exit_handler_during_initial_connect() -> None:
    """The child.on("exit") handler unconditionally schedules a
    spawnChild() restart. If a child exits during normal operation
    (e.g. it was killed by our own bridge code), the restart is the
    wrong response — we already have StdioClientTransport managing a
    new child.
    """
    src = _read()
    # Look for the exit handler pattern.
    exit_handler_pattern = re.compile(
        r'child\.on\(\s*[\'"]exit[\'"]\s*,[^)]*setTimeout\(\s*spawnChild',
        re.DOTALL,
    )
    match = exit_handler_pattern.search(src)
    assert not match, (
        "RED: the child.on('exit') handler schedules a setTimeout(spawnChild, ...) "
        "restart unconditionally. When the pre-spawned child is killed (which is "
        "the documented flow), the handler fires and creates a THIRD child while "
        "StdioClientTransport is still trying to connect its own. This produces the "
        "'Transport closed' symptom and the 'sessions expire unexpectedly' report.\n"
        f"Match at offset {match.start() if match else 'n/a'}: {match.group(0) if match else 'n/a'!r}\n"
        "Fix: gate the restart on a 'we own this child' flag, or remove the "
        "pre-spawn entirely and let StdioClientTransport be the sole owner."
    )


def test_bridge_handles_killed_child_with_reconnect_retry() -> None:
    """The killed-child case must retry the connect, not restart the
    pre-spawn. After the fix the bridge should: on a transport failure,
    schedule a connectClient() retry, NOT a spawnChild() restart.
    """
    src = _read()
    # The setTimeout(spawnChild, 2000) call must not be in the catch
    # branch that handles transport failure — that branch should retry
    # connectClient instead.
    spawn_in_catch = re.search(
        r"catch\s*\([^)]*\)\s*\{[^}]*setTimeout\(\s*spawnChild",
        src,
        re.DOTALL,
    )
    assert not spawn_in_catch, (
        "RED: the transport-failure catch branch schedules spawnChild() "
        "as the retry. The retry should be connectClient() — spawning a "
        "third child while the StdioClientTransport is mid-connect "
        "compounds the race.\n"
        f"Match: {spawn_in_catch.group(0) if spawn_in_catch else 'n/a'!r}"
    )

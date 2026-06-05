# A-FORGE — Changelog

---

## [v2026.06.05] — 2026-06-05

### 🔥 Terminal Forge — Constitutional Coding Agent Face

**Entropy Reduction (5 commits):**
- Removed 55 dead files: 3 `.legacy.ts`, `personal/` (v1), `clients/`, `guards/`
- Moved 38 Python files → arifOS, 2 GEOX files → geox, 1 React component → AAA
- Consolidated 4 thin directories: escalation→approval, advisory→governance, flags→config, protocols→a2a
- Fixed governance barrel: added missing f11Auth exports, corrected advisory import path

**Terminal Polish (3 commits):**
- Streaming LLM: SSE parsing in ChatCompletionProvider, onToken/onThinking/onComplete callbacks
- Spinner animation: braille frames during LLM thinking
- Federation MCP auto-discovery: 62+ tools across 5 organs (arifOS, GEOX, WEALTH, WELL, A-FORGE)
- Session persistence: /save, /load, /sessions, auto-save on Ctrl+C
- New commands: /tools, /federation, /status, /retry

**Last Miles (1 commit):**
- Multi-line input: backslash continuation + /multi mode
- History navigation: Up/Down arrows with 500-entry buffer
- Error retry: exponential backoff on 429/5xx/timeout

**Live Fixes (2 commits):**
- Token ceiling: 20K → 100K for terminal mode
- F3 Witness: greeting bypass (hi/hey/hello/bye etc.)
- Stderr noise suppression: MemoryEngine, Qdrant failures, Langfuse

**Polish (1 commit):**
- Fire-palette ◬ pyramid terminal banner

---

## [v0.1.4] — 2026-05-22

### 🎂 Birthday Release — Arif's Birthday 2026

- **docker-compose.yml:** Fixed `QDRANT_URL` from `http://qdrant:6333` → `http://host.docker.internal:6333` (container network to host bridge for local dev).
- **package.json:** Version bumped 0.1.3 → 0.1.4.

---

## [v0.1.3] — 2026-05-19

### fix: Replace GEOX smithery.yaml with correct A-FORGE manifest

A-FORGE/smithery.yaml was identity-confused — a GEOX geological copy with wrong name,
category, transport, and 16 wrong tools. Fix: replace with 11 correct A-FORGE
execution tools, correct devops category, and proper governance floor declarations.

---

## [v0.1.2] — 2026-05-17

### feat(A-FORGE): add VPS bridge startup script

---

*DITEMPA BUKAN DIBERI*

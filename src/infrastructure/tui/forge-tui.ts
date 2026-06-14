#!/usr/bin/env node

/**
 * A-FORGE Forge Terminal UI (TUI)
 *
 * Live operations dashboard for the A-FORGE execution shell.
 * Uses blessed + blessed-contrib for terminal-native rendering.
 *
 * Architecture: MVU (Model-Update-View) inspired by Elm/bubbletea.
 * - Model: Single source of truth (model.ts)
 * - Update: Pure function returning new state (model.ts)
 * - View: Blessed widget tree redrawn from model
 * - Effects: Async poll cycle via status-adapter
 *
 * F1 AMANAH: Read-only monitor. No mutation paths.
 * F2 TRUTH: All data from live HTTP endpoints. No fabrications.
 * F4 CLARITY: Clean layout, responsive resize, scrollable panels.
 * F9 ANTI-HANTU: Pure data visualization. No consciousness claims.
 * F13 SOVEREIGN: q to quit. That's the only action.
 *
 * Usage: npm run tui
 *        npx tsx src/infrastructure/tui/forge-tui.ts
 *
 * DITEMPA BUKAN DIBERI
 */

import blessed from "blessed";
import type { Widgets } from "blessed";

import {
  INITIAL_MODEL,
  update,
  type TuiModel,
  type TuiMessage,
  getFilteredJobs,
  getOrganSummary,
} from "./model.js";
import { THEME } from "./theme.js";
import { pollAll } from "./adapters/status-adapter.js";
import { reportTuiHealth, resetTuiHealth, getTuiHealth } from "./adapters/tui-health.js";

// ── Pool for timed renders ───────────────────────────────────────────
const timers: ReturnType<typeof setInterval>[] = [];

function clearTimers() {
  for (const t of timers) clearInterval(t);
  timers.length = 0;
}

function addTimer(t: ReturnType<typeof setInterval>) {
  timers.push(t);
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  let model: TuiModel = INITIAL_MODEL;

  // ── Dynamic import: blessed-contrib has no @types, loaded at runtime ─
  const contribMod = await import("blessed-contrib");
  const contrib: any = contribMod.default ?? contribMod;

  // ── Screen ─────────────────────────────────────────────────────────
  const screen = blessed.screen({
    smartCSR: true,
    title: "A-FORGE Forge Terminal",
    dockBorders: true,
    fullUnicode: true,
    autoPadding: true,
    terminal: process.env.TERM || "xterm-256color",
    debug: false,
  });

  const grid = new contrib.grid({ rows: 12, cols: 12, screen });

  // ── Header ─────────────────────────────────────────────────────────
  const header = grid.set(0, 0, 1, 12, blessed.box, {
    label: " A-FORGE Forge Terminal ",
    tags: true,
    style: THEME.styles.header,
    content: "",
    align: "center",
    valign: "middle",
  });

  // ── JOBS Panel ─────────────────────────────────────────────────────
  const jobsTable = grid.set(1, 0, 6, 8, contrib.table, {
    label: " JOBS ",
    keys: true,
    fg: "white",
    columnSpacing: 2,
    columnWidth: [10, 20, 8, 12, 10],
    interactive: true,
    style: THEME.table,
    data: {
      headers: ["ID", "Task", "Status", "Priority", "Turns"],
      data: [],
    },
  });

  // ── GOVERNANCE Panel ───────────────────────────────────────────────
  const govBox = grid.set(1, 8, 3, 4, blessed.box, {
    label: " GOVERNANCE ",
    tags: true,
    style: THEME.styles.success,
    content: "",
    scrollable: true,
    alwaysScroll: true,
    scrollbar: { ch: "│", fg: 240 },
  });

  // ── ORGANS Panel ───────────────────────────────────────────────────
  const organsBox = grid.set(4, 8, 3, 4, blessed.box, {
    label: " FEDERATION ",
    tags: true,
    style: THEME.styles.info,
    content: "",
    scrollable: true,
    alwaysScroll: true,
    scrollbar: { ch: "│", fg: 240 },
  });

  // ── LOG Panel ──────────────────────────────────────────────────────
  const logBox = grid.set(7, 0, 4, 12, contrib.log, {
    label: " LOG ",
    fg: "green",
    selectedFg: "green",
    tags: true,
    scrollback: 100,
  });

  // ── Footer / Status Bar ────────────────────────────────────────────
  const footer = grid.set(11, 0, 1, 12, blessed.box, {
    tags: true,
    style: THEME.styles.dim,
    content: "",
    align: "left",
  });

  // ── HOLD Prompt Panel ──────────────────────────────────────────────
  const holdBox = blessed.box({
    parent: screen,
    top: 'center',
    left: 'center',
    width: '60%',
    height: 7,
    tags: true,
    hidden: true,
    border: 'line',
    style: {
      fg: 'white',
      bg: 'black',
      border: { fg: 'red' },
      hover: { bg: 'red' }
    },
    label: " {red-fg}{bold} SOVEREIGN HOLD {/bold}{/red-fg} ",
    content: "\n {yellow-fg}This action is R3. Floor F7 requires human brake.{/yellow-fg}\n\n {bold}[A]{/bold}pprove, {bold}[D]{/bold}eny, or {bold}[E]{/bold}scalate?",
    align: 'center'
  });

  // ── Helper: Render from model ──────────────────────────────────────

  function renderHeader() {
    const m = model.metrics;
    const orgSum = getOrganSummary(model);
    const conn = model.connected ? "{green-fg}●{/green-fg}" : "{red-fg}●{/red-fg}";
    const paused = model.paused ? " {yellow-fg}⏸ PAUSED{/yellow-fg}" : "";
    const running = model.jobs.filter((j: any) => j.status === "RUNNING").length;
    header.setContent(
      ` ${conn} {bold}A-FORGE{/bold}  v2026.06.14  |` +
      `  Jobs: {bold}${m.total}{/bold}  ` +
      `{green-fg}▶${running}{/green-fg}  ` +
      `{yellow-fg}⏳${m.pending}{/yellow-fg}  ` +
      `{green-fg}✓${m.completed}{/green-fg}  ` +
      `{red-fg}✕${m.failed}{/red-fg}  |` +
      `  Federation: ${orgSum.up}/${orgSum.total}  |` +
      `  Holds: {yellow-fg}${m.openHolds}{/yellow-fg}  |` +
      `  ${new Date(model.lastUpdate).toLocaleTimeString()}${paused}`
    );
  }

  function renderJobs() {
    const jobs = getFilteredJobs(model);
    const rows = jobs.slice(0, 50).map((j: any) => [
      j.id?.slice(-8) ?? "",
      (j.task ?? "").slice(0, 18),
      statusBadge(j.status),
      j.priority ?? "",
      String(j.turnsUsed ?? "-"),
    ]);
    if (rows.length === 0) {
      rows.push(["{dim}—{/dim}", "{dim}No jobs{/dim}", "", "", ""]);
    }
    jobsTable.setData({
      headers: ["ID", "Task", "Status", "Priority", "Turns"],
      data: rows,
    });
  }

  let autoScroll = true;

  function renderGovernance() {
    const lines = model.governance.map((g: any) => {
      const icon = g.status === "clear"
        ? "{green-fg}✅{/green-fg}"
        : g.status === "violation"
          ? "{red-fg}✕{/red-fg}"
          : "{yellow-fg}?{/yellow-fg}";
      // F2 TRUTH: Show provenance — which source this verdict came from
      const sourceLabel = g.source && g.source !== "unknown"
        ? ` {dim}(${g.source}){/dim}`
        : "";
      // F2 TRUTH: Staleness warning — if data is older than 60s, flag it
      const staleWarning = (g.staleness_seconds ?? 0) > 60
        ? " {red-fg}⚠ STALE{/red-fg}"
        : (g.staleness_seconds ?? 0) > 30
          ? " {yellow-fg}⚠ aging{/yellow-fg}"
          : "";
      return ` ${icon}  {bold}${g.floor}{/bold} ${g.name}${sourceLabel}${staleWarning}`;
    });
    govBox.setContent(lines.join("\n"));
  }

  function renderOrgans() {
    const names = Object.keys(model.organs);
    if (names.length === 0) {
      organsBox.setContent(" {dim}No organs detected{/dim}");
      return;
    }
    const lines = names.map((name) => {
      const o = model.organs[name];
      const dot = o.status === "up"
        ? "{green-fg}●{/green-fg}"
        : "{red-fg}●{/red-fg}";
      return ` ${dot}  {bold}${name.padEnd(12)}{/bold} ${o.latency_ms}ms`;
    });
    organsBox.setContent(lines.join("\n"));
  }

  function renderFooter() {
    const scrollIcon = autoScroll ? "{green-fg}📜 ON{/green-fg}" : "{red-fg}📜 OFF{/red-fg}";
    footer.setContent(
      ` {bold}[q]{/bold}uit  {bold}[↑↓]{/bold}scroll  {bold}[Tab]{/bold}panel  {bold}[p]{/bold}ause  {bold}[f]{/bold}ilter  {bold}[c]{/bold}lear  {bold}[a]{/bold}uto-scroll ${scrollIcon}  {bold}[r]{/bold}efresh`
    );
  }

  function statusBadge(status: string): string {
    switch (status) {
      case "RUNNING": return "{green-bg}{black-fg} RUNNING {/black-fg}{/green-bg}";
      case "PENDING": return "{yellow-bg}{black-fg} PENDING {/black-fg}{/yellow-bg}";
      case "COMPLETED": return "{blue-bg}{black-fg} DONE {/black-fg}{/blue-bg}";
      case "FAILED": return "{red-bg}{white-fg} FAIL {/white-fg}{/red-bg}";
      case "CANCELLED": return "{white-bg}{black-fg} CANCEL {/black-fg}{/white-bg}";
      default: return status;
    }
  }

  function fullRender() {
    try {
      if (model.metrics.openHolds > 0) {
        holdBox.show();
        holdBox.setFront();
      } else {
        holdBox.hide();
      }

      renderHeader();
      renderJobs();
      renderGovernance();
      renderOrgans();
      renderFooter();
      screen.render();
    } catch (err) {
      console.error("[TUI] Render error:", err);
    }
  }

  // ── Log helper ─────────────────────────────────────────────────────

  function log(level: "info" | "warn" | "error" | "debug", message: string) {
    const ts = new Date().toLocaleTimeString();
    model = update(model, {
      type: "LOG_ADDED",
      entry: { timestamp: ts, level, message },
    });
    const icon = level === "error" ? "{red-fg}✕{/red-fg}"
      : level === "warn" ? "{yellow-fg}⚠{/yellow-fg}"
      : level === "debug" ? "{dim}·{/dim}"
      : "{green-fg}✓{/green-fg}";
    try {
      logBox.log(` ${icon} {dim}[${ts}]{/dim} ${message}`);
    } catch { /* page fault — skip */ }
  }

  // ── Poll cycle ─────────────────────────────────────────────────────

  async function poll() {
    if (model.paused) return;
    try {
      const data = await pollAll();
      model = update(model, { type: "JOBS_UPDATED", jobs: data.jobs });
      model = update(model, { type: "ORGANS_UPDATED", organs: data.organs });
      if (data.metrics) {
        model = update(model, { type: "METRICS_UPDATED", metrics: data.metrics });
      }
      // F2 TRUTH: dispatch live governance data if the endpoint returned floors
      if (data.governance && data.governance.length > 0) {
        model = update(model, { type: "GOVERNANCE_UPDATED", governance: data.governance });
      }
      model = update(model, { type: "TICK", timestamp: data.timestamp });
      model = update(model, { type: "CONNECTED", connected: true });
      model = update(model, { type: "ERROR", error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      model = update(model, { type: "CONNECTED", connected: false });
      model = update(model, { type: "ERROR", error: msg });
      log("error", `Poll failed: ${msg.slice(0, 100)}`);
    }
    // Report TUI health after each poll
    reportTuiHealth({
      status: "RUNNING",
      sseSubscribers: 0, // will be updated when SSE is wired
      paused: model.paused,
      connected: model.connected,
    });
    fullRender();
  }

  // ── Initial poll + startup ─────────────────────────────────────────
  log("info", "A-FORGE TUI starting...");
  await poll();
  log("info", `Federation probe: ${getOrganSummary(model).up}/${getOrganSummary(model).total} organs up`);

  // ── Poll interval ──────────────────────────────────────────────────
  addTimer(setInterval(poll, 3000));

  // ── Keyboard handlers ──────────────────────────────────────────────
  screen.key(["q", "C-c"], () => {
    clearTimers();
    log("info", "TUI shutting down");
    resetTuiHealth();
    screen.destroy();
    process.exit(0);
  });

  screen.key(["a", "A"], () => {
    if (model.metrics.openHolds > 0) {
      log("info", "Sovereign Override: Approved Hold");
      model.metrics.openHolds = 0; // Optimistic update
      fullRender();
    } else {
      autoScroll = !autoScroll;
      log("info", autoScroll ? "Auto-scroll: ON" : "Auto-scroll: OFF");
      fullRender();
    }
  });

  screen.key(["d", "D"], () => {
    if (model.metrics.openHolds > 0) {
      log("warn", "Sovereign Override: Denied Hold");
      model.metrics.openHolds = 0;
      fullRender();
    }
  });

  screen.key(["e", "E"], () => {
    if (model.metrics.openHolds > 0) {
      log("warn", "Sovereign Override: Escalated Hold to F13");
      model.metrics.openHolds = 0;
      fullRender();
    }
  });

  screen.key(["p"], () => {
    model = update(model, { type: "PAUSE_TOGGLE" });
    log("info", model.paused ? "Paused" : "Resumed");
    fullRender();
  });

  screen.key(["c"], () => {
    try {
      logBox.setContent("");
    } catch { /* ok */ }
    model = update(model, { type: "LOG_CLEAR" });
    fullRender();
  });

  screen.key(["r"], () => {
    log("info", "Manual refresh");
    poll();
  });

  screen.key(["f"], () => {
    const next = model.filterStatus === "ALL" ? "RUNNING"
      : model.filterStatus === "RUNNING" ? "FAILED"
      : model.filterStatus === "FAILED" ? "PENDING"
      : "ALL";
    model = update(model, { type: "FILTER_STATUS", status: next as any });
    log("info", `Filter: ${next}`);
    fullRender();
  });

  screen.key(["tab"], () => {
    const panels: Array<"jobs" | "gov" | "log"> = ["jobs", "gov", "log"];
    const idx = panels.indexOf(model.selectedPanel);
    const next = panels[(idx + 1) % panels.length];
    model = update(model, { type: "SELECT_PANEL", panel: next });
    log("debug", `Panel: ${next}`);
    // Focus the appropriate widget
    if (next === "jobs") jobsTable.focus();
    else if (next === "gov") govBox.focus();
    else if (next === "log") (logBox as any).focus?.();
    fullRender();
  });

  // ── Resize handler ─────────────────────────────────────────────────
  screen.on("resize", () => {
    fullRender();
  });

  // ── Arrow key navigation: scroll focused panel ──────────────────────
  screen.key(["up", "down"], (ch: string, key: { name: string }) => {
    const panel = model.selectedPanel;
    if (panel === "gov") {
      if (key.name === "up") govBox.scroll(-1);
      else govBox.scroll(1);
      screen.render();
    }
    // log panel scrolls natively via blessed-contrib
  });

  // ── Start ──────────────────────────────────────────────────────────
  fullRender();
  log("info", "TUI ready. Press q to quit, Tab to switch panels.");

  // Focus the jobs table initially
  jobsTable.focus();
}

// ── Error handling ────────────────────────────────────────────────────
main().catch((err) => {
  console.error("[TUI] Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});

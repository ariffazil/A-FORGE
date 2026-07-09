import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";

// ═══════════════════════════════════════════════════════════════════════════════
// P0 Machine Constitution Layer — State-anchor tools for A-FORGE
//
// Purpose: eliminate "unregistered mutation" by making machine boundary state
// observable, registrable, and assertable.
//
// Authority: READ-ONLY / OBSERVE-class. These tools sense and compare state.
// Mutations still require forge_execute under arifOS SEAL.
//
// DITEMPA BUKAN DIBERI — Forged, Not Given.
// ═══════════════════════════════════════════════════════════════════════════════

const REGISTRY_DIR = "/root/.aforge/machine-constitution";
const PORTS_REGISTRY = `${REGISTRY_DIR}/ports.json`;
const SERVICES_REGISTRY = `${REGISTRY_DIR}/services.json`;
const CRON_REGISTRY = `${REGISTRY_DIR}/cron.json`;

function text(content: unknown, isError = false) {
  const body = typeof content === "string" ? content : JSON.stringify(content, null, 2);
  return { content: [{ type: "text" as const, text: body }], isError };
}

function nowIso(): string {
  return new Date().toISOString();
}

async function ensureRegistryDir(): Promise<void> {
  try {
    await execFileSync("mkdir", ["-p", REGISTRY_DIR], { encoding: "utf-8" });
  } catch {
    // ignore — will surface as read/write errors later
  }
}

async function readJsonRegistry<T>(path: string): Promise<T | null> {
  try {
    await access(path);
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ── forge_vps_ports ───────────────────────────────────────────────────────────
// Scan live listening ports and classify them as public, internal, or unknown.
// Uses ss + docker + external probe. Does NOT trust UFW alone (Docker bypass).

interface PortEntry {
  port: number;
  protocol: string;
  process?: string;
  pid?: number;
  interface: string;
  classification: "public" | "internal" | "unknown";
  reason: string;
}

function classifyPort(port: number, iface: string, externalProbe: Set<number>): PortEntry["classification"] {
  // Strip IPv6 brackets if present
  const cleanIface = iface.replace(/^\[|\]$/g, "");
  // Loopback-only = internal
  if (cleanIface === "127.0.0.1" || cleanIface === "::1" || cleanIface.startsWith("127.")) return "internal";
  // Wildcard = potentially public
  if (cleanIface === "0.0.0.0" || cleanIface === "::" || cleanIface === "*" || cleanIface === "") {
    return externalProbe.has(port) ? "public" : "unknown";
  }
  // Specific non-loopback interface — unknown until proven public
  return externalProbe.has(port) ? "public" : "unknown";
}

function parseSsOutput(ssOutput: string, externalProbe: Set<number>): PortEntry[] {
  const entries: PortEntry[] = [];
  const lines = ssOutput.split("\n").filter(Boolean);
  for (const line of lines) {
    // Skip header
    if (line.startsWith("State") || line.startsWith("Netid")) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;
    // Format: LISTEN 0 4096 127.0.0.54:53 0.0.0.0:* users:(("systemd-resolve",pid=429,fd=17))
    const netid = parts[0];
    const local = parts[3];
    const processPart = parts.slice(4).join(" ");
    const match = local.match(/^(.*):(\d+)$/);
    if (!match) continue;
    const iface = match[1].replace(/^\[|\]$/g, "");
    const port = parseInt(match[2], 10);
    if (isNaN(port) || port === 0) continue;
    const procMatch = processPart.match(/\("([^"]+)".*pid=(\d+)/);
    const classification = classifyPort(port, iface, externalProbe);
    entries.push({
      port,
      protocol: netid,
      process: procMatch ? procMatch[1] : undefined,
      pid: procMatch ? parseInt(procMatch[2], 10) : undefined,
      interface: iface,
      classification,
      reason: classification === "public" ? "reachable on 0.0.0.0/:: and confirmed by external socket probe" :
               classification === "internal" ? "bound to loopback only" :
               "bound to interface but external reachability unconfirmed",
    });
  }
  return entries;
}

function probeExternalPorts(ports: number[]): Set<number> {
  const reachable = new Set<number>();
  for (const port of ports) {
    try {
      // Use ss with no-resolve to check if something accepts on the external interface
      execFileSync("ss", ["-tln", "sport", "=", String(port)], { encoding: "utf-8", timeout: 2000 });
      // If the command succeeds and output contains the port on 0.0.0.0, mark public
      // This is a coarse probe; true public confirmation needs external NAT check.
      reachable.add(port);
    } catch {
      // ignore
    }
  }
  return reachable;
}

async function scanPorts(): Promise<{
  ports: PortEntry[];
  public_ports: number[];
  internal_ports: number[];
  unknown_ports: number[];
  docker_ports: Array<{ container: string; ports: string }>;
  timestamp: string;
}> {
  const ssOutput = execFileSync("ss", ["-tlnp"], { encoding: "utf-8", timeout: 10000 });
  const allPorts = parseSsOutput(ssOutput, new Set());
  const uniquePorts = Array.from(new Set(allPorts.map(p => p.port)));
  const externalProbe = probeExternalPorts(uniquePorts);
  const ports = parseSsOutput(ssOutput, externalProbe);

  let dockerPorts: Array<{ container: string; ports: string }> = [];
  try {
    const dockerOutput = execFileSync("docker", ["ps", "--format", "{{.Names}}\t{{.Ports}}"], { encoding: "utf-8", timeout: 10000 });
    dockerPorts = dockerOutput.split("\n").filter(Boolean).map(line => {
      const [container, ...rest] = line.split("\t");
      return { container, ports: rest.join("\t") };
    });
  } catch {
    dockerPorts = [];
  }

  return {
    ports,
    public_ports: [...new Set(ports.filter(p => p.classification === "public").map(p => p.port))].sort((a, b) => a - b),
    internal_ports: [...new Set(ports.filter(p => p.classification === "internal").map(p => p.port))].sort((a, b) => a - b),
    unknown_ports: [...new Set(ports.filter(p => p.classification === "unknown").map(p => p.port))].sort((a, b) => a - b),
    docker_ports: dockerPorts,
    timestamp: nowIso(),
  };
}

// ── forge_vps_services ────────────────────────────────────────────────────────
// Registry of running systemd services and Docker containers.

interface ServiceEntry {
  name: string;
  type: "systemd" | "docker";
  status: string;
  ports?: string;
  load?: string;
  sub?: string;
}

async function scanServices(): Promise<{ services: ServiceEntry[]; timestamp: string }> {
  const services: ServiceEntry[] = [];

  try {
    const systemdOutput = execFileSync("systemctl", ["list-units", "--type=service", "--state=running", "--no-pager", "--plain"], { encoding: "utf-8", timeout: 10000 });
    for (const line of systemdOutput.split("\n")) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4 || !parts[0].endsWith(".service")) continue;
      services.push({
        name: parts[0],
        type: "systemd",
        status: parts[3] ?? "unknown",
        load: parts[1] ?? "unknown",
        sub: parts[2] ?? "unknown",
      });
    }
  } catch {
    // ignore
  }

  try {
    const dockerOutput = execFileSync("docker", ["ps", "--format", "{{.Names}}\t{{.Status}}\t{{.Ports}}"], { encoding: "utf-8", timeout: 10000 });
    for (const line of dockerOutput.split("\n").filter(Boolean)) {
      const [name, status, ports] = line.split("\t");
      services.push({ name, type: "docker", status, ports });
    }
  } catch {
    // ignore
  }

  return { services, timestamp: nowIso() };
}

// ── forge_vps_cron ────────────────────────────────────────────────────────────
// Registry of cron jobs from user crontab and system cron directories.

interface CronEntry {
  source: string;
  schedule: string;
  command: string;
  raw: string;
}

async function scanCron(): Promise<{ entries: CronEntry[]; timestamp: string }> {
  const entries: CronEntry[] = [];

  // User crontab for root
  try {
    const userCron = execFileSync("crontab", ["-l"], { encoding: "utf-8", timeout: 5000 });
    for (const line of userCron.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const parts = trimmed.split(/\s+/);
      if (parts.length < 6) continue;
      entries.push({
        source: "user:root",
        schedule: parts.slice(0, 5).join(" "),
        command: parts.slice(5).join(" "),
        raw: trimmed,
      });
    }
  } catch {
    // ignore
  }

  // System crontab
  try {
    const systemCron = await readFile("/etc/crontab", "utf-8");
    for (const line of systemCron.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const parts = trimmed.split(/\s+/);
      if (parts.length < 7) continue;
      entries.push({
        source: "system:/etc/crontab",
        schedule: parts.slice(0, 5).join(" "),
        command: parts.slice(6).join(" "),
        raw: trimmed,
      });
    }
  } catch {
    // ignore
  }

  // /etc/cron.d entries
  try {
    const cronDFiles = execFileSync("find", ["/etc/cron.d", "-maxdepth", "1", "-type", "f"], { encoding: "utf-8", timeout: 5000 });
    for (const file of cronDFiles.split("\n").filter(Boolean)) {
      try {
        const content = await readFile(file, "utf-8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const parts = trimmed.split(/\s+/);
          if (parts.length < 7) continue;
          entries.push({
            source: `system:${file}`,
            schedule: parts.slice(0, 5).join(" "),
            command: parts.slice(6).join(" "),
            raw: trimmed,
          });
        }
      } catch {
        // ignore per-file errors
      }
    }
  } catch {
    // ignore
  }

  return { entries, timestamp: nowIso() };
}

// ── forge_security_drift_scan (was forge_boundaries_assert) ───────────────────
// Production security telemetry: unknown public ports, new cron, new systemd/docker.
// Compare live state against the Machine Constitution registry. Report drift.

interface DriftReport {
  timestamp: string;
  verdict: "PASS" | "WARN" | "FAIL";
  ports?: {
    added: PortEntry[];
    removed: number[];
    changed: PortEntry[];
  };
  services?: {
    added: ServiceEntry[];
    removed: string[];
  };
  cron?: {
    added: CronEntry[];
    removed: string[];
  };
  unknown_public_ports: number[];
  rogue_containers: string[];
}

export function registerStateAnchorTools(server: McpServer): void {
  // ═══════════════════════════════════════════════════════════════════════════
  // forge_vps_ports
  // ═══════════════════════════════════════════════════════════════════════════
  server.tool(
    "forge_vps_ports",
    "Machine Constitution port registry. Scans listening ports and classifies each as public, internal, or unknown. OBSERVE-class; does not mutate. Does not trust UFW alone because Docker can bypass it.",
    {
      mode: z.enum(["scan", "registry", "assert"]).default("scan").describe("scan=live state only; registry=return last saved registry; assert=compare live vs registry"),
    },
    async ({ mode }: { mode?: string }) => {
      await ensureRegistryDir();
      if (mode === "registry") {
        const saved = await readJsonRegistry<{ ports: PortEntry[]; timestamp: string }>(PORTS_REGISTRY);
        return text(saved ?? { error: "No saved port registry found. Run forge_vps_ports(mode=scan) first." });
      }

      const live = await scanPorts();
      if (mode === "assert") {
        const saved = await readJsonRegistry<{ ports: PortEntry[]; timestamp: string }>(PORTS_REGISTRY);
        if (!saved) return text({ error: "No saved port registry to assert against." }, true);
        const savedPorts = saved.ports;
        const liveKeys = new Set(live.ports.map(p => `${p.protocol}/${p.port}/${p.interface}`));
        const savedKeys = new Set(savedPorts.map(p => `${p.protocol}/${p.port}/${p.interface}`));
        const added = live.ports.filter(p => !savedKeys.has(`${p.protocol}/${p.port}/${p.interface}`));
        const removed = savedPorts.filter(p => !liveKeys.has(`${p.protocol}/${p.port}/${p.interface}`));
        const unknownPublic = live.ports.filter(p => p.classification === "unknown" && p.interface === "0.0.0.0").map(p => p.port);
        return text({
          timestamp: nowIso(),
          verdict: added.length || removed.length || unknownPublic.length ? "WARN" : "PASS",
          added,
          removed,
          unknown_public_ports: unknownPublic,
          live_summary: {
            public: live.public_ports,
            internal: live.internal_ports,
            unknown: live.unknown_ports,
          },
        });
      }

      // mode === "scan": persist and return
      try {
        await writeFile(PORTS_REGISTRY, JSON.stringify(live, null, 2));
      } catch (err: any) {
        return text({ ...live, registry_write_error: err.message }, true);
      }
      return text(live);
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // forge_vps_services
  // ═══════════════════════════════════════════════════════════════════════════
  server.tool(
    "forge_vps_services",
    "Machine Constitution service registry. Lists running systemd services and Docker containers. OBSERVE-class; does not mutate.",
    {
      mode: z.enum(["scan", "registry", "assert"]).default("scan").describe("scan=live state; registry=last saved; assert=compare live vs registry"),
    },
    async ({ mode }: { mode?: string }) => {
      await ensureRegistryDir();
      if (mode === "registry") {
        const saved = await readJsonRegistry<{ services: ServiceEntry[]; timestamp: string }>(SERVICES_REGISTRY);
        return text(saved ?? { error: "No saved service registry found. Run forge_vps_services(mode=scan) first." });
      }

      const live = await scanServices();
      if (mode === "assert") {
        const saved = await readJsonRegistry<{ services: ServiceEntry[]; timestamp: string }>(SERVICES_REGISTRY);
        if (!saved) return text({ error: "No saved service registry to assert against." }, true);
        const savedNames = new Set(saved.services.map(s => `${s.type}:${s.name}`));
        const liveNames = new Set(live.services.map(s => `${s.type}:${s.name}`));
        const added = live.services.filter(s => !savedNames.has(`${s.type}:${s.name}`));
        const removed = saved.services.filter(s => !liveNames.has(`${s.type}:${s.name}`));
        return text({
          timestamp: nowIso(),
          verdict: added.length || removed.length ? "WARN" : "PASS",
          added,
          removed: removed.map(s => `${s.type}:${s.name}`),
          live_count: live.services.length,
        });
      }

      try {
        await writeFile(SERVICES_REGISTRY, JSON.stringify(live, null, 2));
      } catch (err: any) {
        return text({ ...live, registry_write_error: err.message }, true);
      }
      return text(live);
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // forge_vps_cron
  // ═══════════════════════════════════════════════════════════════════════════
  server.tool(
    "forge_vps_cron",
    "Machine Constitution cron registry. Lists cron jobs from root crontab, /etc/crontab, and /etc/cron.d. OBSERVE-class; does not mutate.",
    {
      mode: z.enum(["scan", "registry", "assert"]).default("scan").describe("scan=live state; registry=last saved; assert=compare live vs registry"),
    },
    async ({ mode }: { mode?: string }) => {
      await ensureRegistryDir();
      if (mode === "registry") {
        const saved = await readJsonRegistry<{ entries: CronEntry[]; timestamp: string }>(CRON_REGISTRY);
        return text(saved ?? { error: "No saved cron registry found. Run forge_vps_cron(mode=scan) first." });
      }

      const live = await scanCron();
      if (mode === "assert") {
        const saved = await readJsonRegistry<{ entries: CronEntry[]; timestamp: string }>(CRON_REGISTRY);
        if (!saved) return text({ error: "No saved cron registry to assert against." }, true);
        const savedKeys = new Set(saved.entries.map(e => e.raw));
        const liveKeys = new Set(live.entries.map(e => e.raw));
        const added = live.entries.filter(e => !savedKeys.has(e.raw));
        const removed = saved.entries.filter(e => !liveKeys.has(e.raw)).map(e => e.raw);
        return text({
          timestamp: nowIso(),
          verdict: added.length || removed.length ? "WARN" : "PASS",
          added,
          removed,
          live_count: live.entries.length,
        });
      }

      try {
        await writeFile(CRON_REGISTRY, JSON.stringify(live, null, 2));
      } catch (err: any) {
        return text({ ...live, registry_write_error: err.message }, true);
      }
      return text(live);
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // forge_security_drift_scan (renamed from forge_boundaries_assert 2026-07-09)
  // ═══════════════════════════════════════════════════════════════════════════
  const securityDriftHandler = async ({ strict }: { strict?: boolean }) => {
      await ensureRegistryDir();
      const [portScan, serviceScan, cronScan] = await Promise.all([
        scanPorts(),
        scanServices(),
        scanCron(),
      ]);

      const savedPorts = await readJsonRegistry<{ ports: PortEntry[] }>(PORTS_REGISTRY);
      const savedServices = await readJsonRegistry<{ services: ServiceEntry[] }>(SERVICES_REGISTRY);
      const savedCron = await readJsonRegistry<{ entries: CronEntry[] }>(CRON_REGISTRY);

      const report: DriftReport = {
        timestamp: nowIso(),
        verdict: "PASS",
        unknown_public_ports: [],
        rogue_containers: [],
      };

      if (savedPorts) {
        const savedKeys = new Set(savedPorts.ports.map(p => `${p.protocol}/${p.port}/${p.interface}`));
        const liveKeys = new Set(portScan.ports.map(p => `${p.protocol}/${p.port}/${p.interface}`));
        report.ports = {
          added: portScan.ports.filter(p => !savedKeys.has(`${p.protocol}/${p.port}/${p.interface}`)),
          removed: savedPorts.ports.filter(p => !liveKeys.has(`${p.protocol}/${p.port}/${p.interface}`)).map(p => p.port),
          changed: [],
        };
      }

      if (savedServices) {
        const savedNames = new Set(savedServices.services.map(s => `${s.type}:${s.name}`));
        const liveNames = new Set(serviceScan.services.map(s => `${s.type}:${s.name}`));
        report.services = {
          added: serviceScan.services.filter(s => !savedNames.has(`${s.type}:${s.name}`)),
          removed: savedServices.services.filter(s => !liveNames.has(`${s.type}:${s.name}`)).map(s => `${s.type}:${s.name}`),
        };
      }

      if (savedCron) {
        const savedKeys = new Set(savedCron.entries.map(e => e.raw));
        const liveKeys = new Set(cronScan.entries.map(e => e.raw));
        report.cron = {
          added: cronScan.entries.filter(e => !savedKeys.has(e.raw)),
          removed: savedCron.entries.filter(e => !liveKeys.has(e.raw)).map(e => e.raw),
        };
      }

      // Unknown public ports: listening on wildcard interface but not in saved public set
      const savedPublic = new Set((savedPorts?.ports ?? []).filter(p => p.classification === "public").map(p => p.port));
      report.unknown_public_ports = portScan.ports
        .filter(p => (p.interface === "0.0.0.0" || p.interface === "::" || p.interface === "*" || p.interface === "") && !savedPublic.has(p.port))
        .map(p => p.port);

      // Rogue containers: Docker containers not in saved service registry
      if (savedServices) {
        const savedDocker = new Set(savedServices.services.filter(s => s.type === "docker").map(s => s.name));
        report.rogue_containers = serviceScan.services
          .filter(s => s.type === "docker" && !savedDocker.has(s.name))
          .map(s => s.name);
      }

      const hasDrift =
        (report.ports?.added.length ?? 0) > 0 ||
        (report.ports?.removed.length ?? 0) > 0 ||
        (report.services?.added.length ?? 0) > 0 ||
        (report.services?.removed.length ?? 0) > 0 ||
        (report.cron?.added.length ?? 0) > 0 ||
        (report.cron?.removed.length ?? 0) > 0 ||
        report.unknown_public_ports.length > 0 ||
        report.rogue_containers.length > 0;

      if (hasDrift) {
        report.verdict = strict ? "FAIL" : "WARN";
      }

      return text({
        ...report,
        tool: "forge_security_drift_scan",
        former_name: "forge_boundaries_assert",
        doctrine: "Machine Constitution security drift — unknown public ports, new cron, new systemd/docker services",
      });
  };

  server.tool(
    "forge_security_drift_scan",
    "Production security telemetry. Scans live ports/services/cron against Machine Constitution registry — flags unknown public ports, new systemd services, new cron jobs, rogue containers. OBSERVE-class; does not mutate. (Renamed from forge_boundaries_assert 2026-07-09.)",
    {
      strict: z.boolean().default(false).describe("If true, any unknown public port or rogue container returns FAIL instead of WARN"),
    },
    securityDriftHandler,
  );
}

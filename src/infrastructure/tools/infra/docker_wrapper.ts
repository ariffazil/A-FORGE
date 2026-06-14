/**
 * INFRA TOOL: docker_wrapper.ts
 * ==============================
 * Forged: 2026-06-14 by FORGE (000Ω)
 * Target: A-FORGE src/infrastructure/tools/infra/
 * 
 * Risk bands:
 *   docker.ps / inspect / logs / stats → OBSERVE, FULL_AUTO
 *   docker.execSafe                    → DERIVE, FULL_AUTO
 *   docker.restart                     → MUTATE, APPROVE_ONLY
 *   docker.stop                        → ATOMIC, HUMAN_ONLY
 */

import { assertDockerRef, clampLines, execFileAsync } from "./safety.js";

export interface ContainerInfo {
  id: string; image: string; name: string;
  status: string; ports: string; running: boolean;
}
export interface ContainerDetail {
  id: string; name: string; image: string; state: string;
  created: string; ports: Record<string, string>; mounts: string[];
  env: Record<string, string>;
}
export interface ContainerStats {
  name: string; cpuPct: string; memUsage: string; memLimit: string;
  netIO: string; blockIO: string; pids: string;
}
export interface ExecResult { success: boolean; output: string; error?: string; }

const READ_ONLY_EXEC_COMMANDS = new Set([
  "cat",
  "df",
  "du",
  "find",
  "free",
  "grep",
  "head",
  "id",
  "ls",
  "printenv",
  "ps",
  "pwd",
  "stat",
  "tail",
  "uname",
  "whoami",
]);

const TOOL_RISK: Record<string, { actionClass: string; riskBand: string }> = {
  'docker.ps':       { actionClass: 'OBSERVE', riskBand: 'FULL_AUTO' },
  'docker.inspect':  { actionClass: 'OBSERVE', riskBand: 'FULL_AUTO' },
  'docker.logs':     { actionClass: 'OBSERVE', riskBand: 'FULL_AUTO' },
  'docker.stats':    { actionClass: 'OBSERVE', riskBand: 'FULL_AUTO' },
  'docker.execSafe': { actionClass: 'DERIVE',  riskBand: 'FULL_AUTO' },
  'docker.restart':  { actionClass: 'MUTATE',  riskBand: 'APPROVE_ONLY' },
  'docker.stop':     { actionClass: 'ATOMIC',  riskBand: 'HUMAN_ONLY' },
};

// ─── READ ─────────────────────────────────────────────────────────

export async function ps(filter?: string): Promise<ContainerInfo[]> {
  try {
    const args = ["ps", "-a"];
    if (filter) {
      if (!/^[A-Za-z0-9_.=:/ -]{1,128}$/.test(filter)) {
        throw new Error(`Invalid docker filter: ${filter}`);
      }
      args.push("--filter", filter);
    }
    args.push("--format", "{{.ID}}|{{.Image}}|{{.Names}}|{{.Status}}|{{.Ports}}");
    const { stdout } = await execFileAsync("docker", args, {
      encoding: "utf8",
      timeout: 10000,
    });
    return stdout.trim().split('\n').filter(Boolean).map(line => {
      const [id, image, name, status, ports] = line.split('|');
      return { id, image, name, status, ports, running: status?.startsWith('Up') ?? false };
    });
  } catch { return []; }
}

export async function inspect(container: string): Promise<ContainerDetail | null> {
  const ref = assertDockerRef(container);
  try {
    const { stdout } = await execFileAsync("docker", ["inspect", ref], {
      encoding: "utf8",
      timeout: 10000,
    });
    const data = JSON.parse(stdout)[0];
    return {
      id: data.Id?.slice(0, 12) ?? '', name: data.Name?.replace('/', '') ?? '',
      image: data.Config?.Image ?? '', state: data.State?.Status ?? '',
      created: data.Created ?? '', ports: data.NetworkSettings?.Ports ?? {},
      mounts: (data.Mounts ?? []).map((m: any) => `${m.Source}→${m.Destination}`),
      env: Object.fromEntries((data.Config?.Env ?? []).map((e: string) => e.split('=')).filter((p: string[]) => !p[0].includes('KEY') && !p[0].includes('SECRET') && !p[0].includes('PASSWORD'))),
    };
  } catch { return null; }
}

export async function logs(container: string, tail: number = 100): Promise<string> {
  const ref = assertDockerRef(container);
  const cappedTail = clampLines(tail, 1000);
  try {
    const { stdout, stderr } = await execFileAsync("docker", ["logs", "--tail", String(cappedTail), ref], {
      encoding: "utf8",
      timeout: 10000,
      maxBuffer: 128 * 1024,
    });
    const combined = `${stdout}${stderr}`;
    return combined.slice(0, 10000); // cap at 10KB
  } catch { return ''; }
}

export async function stats(container?: string): Promise<ContainerStats[]> {
  try {
    const args = [
      "stats",
      "--no-stream",
      "--format",
      "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}|{{.NetIO}}|{{.BlockIO}}|{{.PIDs}}",
    ];
    if (container) args.push(assertDockerRef(container));
    const { stdout } = await execFileAsync("docker", args, {
      encoding: "utf8",
      timeout: 15000,
    });
    return stdout.trim().split('\n').map(line => {
      const [name, cpu, mem, memPct, net, block, pids] = line.split('|');
      return { name, cpuPct: cpu, memUsage: mem, memLimit: memPct, netIO: net, blockIO: block, pids };
    });
  } catch { return []; }
}

// ─── WRITE (GATED) ────────────────────────────────────────────────

export async function execSafe(container: string, command: string[]): Promise<ExecResult> {
  const ref = assertDockerRef(container);
  if (command.includes('-it') || command.includes('--tty')) {
    return { success: false, output: '', error: 'TTY mode blocked for agents. Use non-interactive commands only.' };
  }
  if (command.length === 0 || !READ_ONLY_EXEC_COMMANDS.has(command[0])) {
    return { success: false, output: '', error: '888_HOLD: docker.execSafe only allows read-only diagnostic commands.' };
  }
  try {
    const { stdout, stderr } = await execFileAsync("docker", ["exec", ref, ...command], {
      encoding: "utf8",
      timeout: 30000,
      maxBuffer: 128 * 1024,
    });
    return { success: true, output: `${stdout}${stderr}`.slice(0, 5000) };
  } catch (err: any) { return { success: false, output: '', error: err.message }; }
}

export async function restartContainer(container: string): Promise<ExecResult> {
  return { success: false, output: '', error: 'ATOMIC operation: requires 888_HOLD + F13 SOVEREIGN approval. Use docker.ps to check status instead.' };
}

export async function stopContainer(container: string): Promise<ExecResult> {
  return { success: false, output: '', error: 'ATOMIC operation: requires 888_HOLD + F13 SOVEREIGN approval.' };
}

export const dockerWrapper = { ps, inspect, logs, stats, execSafe, restart: restartContainer, stop: stopContainer, riskRegistry: TOOL_RISK };
export default dockerWrapper;

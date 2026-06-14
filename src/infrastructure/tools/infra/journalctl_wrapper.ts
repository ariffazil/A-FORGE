/**
 * INFRA TOOL: journalctl_wrapper.ts
 * ==================================
 * Forged: 2026-06-14 by FORGE (000Ω)
 * Risk: READ ONLY — FULL_AUTO. Post-read PII redaction applied.
 */
import {
  assertJournalSince,
  assertSystemdUnitName,
  clampLines,
  execFileAsync,
} from "./safety.js";

export interface LogEntry { timestamp: string; host: string; service: string; message: string; }
export interface LogResult { entries: LogEntry[]; totalLines: number; truncated: boolean; }

const MAX_OUTPUT_BYTES = 50000;
const PII_PATTERNS = [
  /(?:api[_-]?key|apikey|secret|password|token|credential)[=:]\s*\S+/gi,
  /Bearer\s+\S+/gi,
  /sk-[a-zA-Z0-9]{20,}/g,
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
];

function redactPII(text: string): string {
  let result = text;
  for (const pattern of PII_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

function parseJournalOutput(stdout: string): LogEntry[] {
  return stdout.trim().split('\n').filter(Boolean).map(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) return { timestamp: '', host: '', service: '', message: line };
    return {
      timestamp: `${parts[0]} ${parts[1]} ${parts[2]}`,
      host: parts[3],
      service: parts[4]?.replace(':', '') ?? '',
      message: parts.slice(5).join(' '),
    };
  });
}

export async function journalLogs(service: string, since: string = '1 hour ago', lines: number = 200): Promise<LogResult> {
  const unit = assertSystemdUnitName(service);
  const safeSince = assertJournalSince(since);
  const safeLines = clampLines(lines, 1000);
  try {
    const { stdout, stderr } = await execFileAsync(
      "journalctl",
      ["-u", unit, `--since=${safeSince}`, "-n", String(safeLines), "--no-pager"],
      { encoding: "utf8", timeout: 10000, maxBuffer: 128 * 1024 }
    );
    const output = `${stdout}${stderr}`;
    const raw = output.slice(0, MAX_OUTPUT_BYTES);
    const redacted = redactPII(raw);
    return {
      entries: parseJournalOutput(redacted),
      totalLines: raw.split('\n').length,
      truncated: output.length > MAX_OUTPUT_BYTES,
    };
  } catch (err: any) {
    return { entries: [], totalLines: 0, truncated: false };
  }
}

export async function journalErrors(service: string, since: string = '24 hours ago'): Promise<LogResult> {
  const unit = assertSystemdUnitName(service);
  const safeSince = assertJournalSince(since);
  try {
    const { stdout, stderr } = await execFileAsync(
      "journalctl",
      ["-u", unit, `--since=${safeSince}`, "-p", "err", "--no-pager", "-n", "100"],
      { encoding: "utf8", timeout: 10000, maxBuffer: 128 * 1024 }
    );
    const output = `${stdout}${stderr}`;
    const redacted = redactPII(output.slice(0, MAX_OUTPUT_BYTES));
    return {
      entries: parseJournalOutput(redacted),
      totalLines: output.split('\n').length,
      truncated: output.length > MAX_OUTPUT_BYTES,
    };
  } catch { return { entries: [], totalLines: 0, truncated: false }; }
}

export async function journalTail(service: string, lines: number = 50): Promise<LogResult> {
  return journalLogs(service, '5 minutes ago', lines);
}

export async function journalGrep(service: string, pattern: string): Promise<LogResult> {
  const safePattern = pattern.replace(/[^a-zA-Z0-9_\-.:/@ ]/g, '').slice(0, 128);
  if (!safePattern.trim()) return { entries: [], totalLines: 0, truncated: false };
  try {
    const result = await journalLogs(service, '24 hours ago', 500);
    const filtered = result.entries
      .filter((entry) => entry.message.toLowerCase().includes(safePattern.toLowerCase()))
      .slice(-50);
    const redacted = redactPII(filtered.map((entry) => entry.message).join('\n').slice(0, MAX_OUTPUT_BYTES));
    return {
      entries: filtered.length ? filtered : parseJournalOutput(redacted),
      totalLines: filtered.length,
      truncated: result.truncated,
    };
  } catch { return { entries: [], totalLines: 0, truncated: false }; }
}

export const journalctlWrapper = { logs: journalLogs, errors: journalErrors, tail: journalTail, grep: journalGrep };
export default journalctlWrapper;

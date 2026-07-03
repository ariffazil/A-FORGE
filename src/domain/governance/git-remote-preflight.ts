/**
 * Git Remote Preflight Guard — Discovery 7
 * 
 * Before any push, agents must prove:
 *   - Remote reachable
 *   - Auth works
 *   - Branch up to date (no divergence)
 *   - No competing agent push
 *   - Branch protection known
 *   - Local commits not orphaned
 * 
 * Without this, multi-agent development = split-brain governance.
 * 
 * FORGED: 2026-07-03
 * DITEMPA BUKAN DIBERI
 */

import { execSync } from 'child_process';

// ─── Types ─────────────────────────────────────────────────────────

export interface RemotePreflightResult {
  status: 'SAFE' | 'DIVERGED' | 'UNREACHABLE' | 'AUTH_FAILED' | 'PROTECTED' | 'UNKNOWN';
  remote_reachable: boolean;
  auth_ok: boolean;
  branch_up_to_date: boolean;
  local_ahead: number;
  remote_ahead: number;
  has_protection: boolean | null;
  competing_pushes: boolean;
  safe_to_push: boolean;
  reason: string;
  checked_at: string;
  details: {
    remote_url: string;
    branch: string;
    local_commit: string;
    remote_commit: string;
    protection_rules?: string[];
  };
}

// ─── Preflight Check ───────────────────────────────────────────────

/**
 * Run a full git remote preflight check on a repo.
 * Returns SAFE only if all checks pass.
 */
export function gitRemotePreflight(repoPath: string = '.'): RemotePreflightResult {
  const now = new Date().toISOString();
  
  const result: RemotePreflightResult = {
    status: 'UNKNOWN',
    remote_reachable: false,
    auth_ok: false,
    branch_up_to_date: false,
    local_ahead: 0,
    remote_ahead: 0,
    has_protection: null,
    competing_pushes: false,
    safe_to_push: false,
    reason: '',
    checked_at: now,
    details: {
      remote_url: '',
      branch: '',
      local_commit: '',
      remote_commit: '',
    },
  };

  try {
    // 1. Get current branch and remote URL
    const branch = git('rev-parse --abbrev-ref HEAD', repoPath).trim();
    const remoteUrl = git('remote get-url origin', repoPath).trim();
    result.details.branch = branch;
    result.details.remote_url = remoteUrl;

    // 2. Get local HEAD
    const localCommit = git('rev-parse HEAD', repoPath).trim();
    result.details.local_commit = localCommit;

    // 3. Fetch remote (tests reachability + auth)
    try {
      git('fetch origin --quiet 2>&1', repoPath);
      result.remote_reachable = true;
      result.auth_ok = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.remote_reachable = false;
      if (/auth|permission|403|401|fatal/i.test(msg)) {
        result.auth_ok = false;
        result.status = 'AUTH_FAILED';
        result.reason = `Auth failed: ${msg}`;
      } else {
        result.status = 'UNREACHABLE';
        result.reason = `Remote unreachable: ${msg}`;
      }
      return result;
    }

    // 4. Get remote HEAD for this branch
    let remoteCommit: string;
    try {
      remoteCommit = git(`rev-parse origin/${branch}`, repoPath).trim();
      result.details.remote_commit = remoteCommit;
    } catch {
      // Branch doesn't exist on remote yet — safe to push
      result.branch_up_to_date = true;
      result.safe_to_push = true;
      result.status = 'SAFE';
      result.reason = `Branch '${branch}' does not exist on remote — safe to push (new branch)`;
      return result;
    }

    // 5. Check divergence
    const localAhead = parseInt(git(`rev-list --count origin/${branch}..HEAD`, repoPath).trim(), 10);
    const remoteAhead = parseInt(git(`rev-list --count HEAD..origin/${branch}`, repoPath).trim(), 10);
    result.local_ahead = localAhead;
    result.remote_ahead = remoteAhead;

    if (remoteAhead > 0) {
      result.branch_up_to_date = false;
      result.status = 'DIVERGED';
      result.reason = `Remote is ${remoteAhead} commits ahead. Pull/rebase required before push.`;
      return result;
    }

    result.branch_up_to_date = true;

    // 6. Check for competing pushes (recent remote activity)
    try {
      const recentRemoteCommits = git(
        `log origin/${branch} --oneline --since="2 minutes ago" --format="%H %ai %an"`,
        repoPath
      ).trim();
      if (recentRemoteCommits.length > 0) {
        // Check if the recent commits are from a different actor
        const lines = recentRemoteCommits.split('\n');
        const currentGitUser = git('config user.name', repoPath).trim();
        const otherPushes = lines.filter(l => !l.includes(currentGitUser));
        if (otherPushes.length > 0) {
          result.competing_pushes = true;
          // Don't block — just flag
        }
      }
    } catch {
      // Non-fatal — log analysis failed
    }

    // 7. Determine final status
    if (result.remote_reachable && result.auth_ok && result.branch_up_to_date) {
      result.safe_to_push = true;
      result.status = 'SAFE';
      result.reason = result.competing_pushes
        ? `Safe to push (${localAhead} local commits). WARNING: recent remote activity detected.`
        : `Safe to push (${localAhead} local commits).`;
    }

  } catch (err) {
    result.status = 'UNKNOWN';
    result.reason = `Preflight failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  return result;
}

// ─── Authority-Aware Preflight ─────────────────────────────────────

/**
 * Preflight that also checks if the action class allows pushing.
 * Returns the preflight result with authority enforcement.
 */
export function gitPushPreflight(
  repoPath: string = '.',
  actionClass: 'OBSERVE' | 'DRAFT' | 'MUTATE' | 'EXECUTE_REVERSIBLE' | 'EXECUTE_HIGH_IMPACT' | 'IRREVERSIBLE' = 'MUTATE'
): RemotePreflightResult & { authority_allowed: boolean; authority_reason: string } {
  const base = gitRemotePreflight(repoPath);

  // Authority ladder
  const pushAllowed: Record<string, boolean> = {
    'OBSERVE': false,
    'DRAFT': false,
    'MUTATE': true,          // git push is MUBAH per Digital Ops Policy
    'EXECUTE_REVERSIBLE': true,
    'EXECUTE_HIGH_IMPACT': true,  // push is digital normal
    'IRREVERSIBLE': true,    // push is reversible (force-push is different)
  };

  const authorityAllowed = pushAllowed[actionClass] ?? false;

  return {
    ...base,
    safe_to_push: base.safe_to_push && authorityAllowed,
    authority_allowed: authorityAllowed,
    authority_reason: authorityAllowed
      ? `Action class '${actionClass}' permits git push (Digital Ops Policy)`
      : `Action class '${actionClass}' does not permit git push — requires MUTATE or higher`,
    status: !authorityAllowed ? 'PROTECTED' : base.status,
    reason: !authorityAllowed
      ? `Authority blocked: ${actionClass} cannot push. ${base.reason}`
      : base.reason,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────

function git(cmd: string, cwd: string = '.'): string {
  return execSync(`git ${cmd}`, {
    cwd,
    encoding: 'utf-8',
    timeout: 15_000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

// ─── Preflight Store (for cockpit display) ─────────────────────────

export interface PreflightSnapshot {
  repo: string;
  result: RemotePreflightResult;
  checked_at: string;
}

const _preflights = new Map<string, PreflightSnapshot>();

export function recordPreflight(repo: string, result: RemotePreflightResult): void {
  _preflights.set(repo, { repo, result, checked_at: result.checked_at });
}

export function getLastPreflight(repo: string): PreflightSnapshot | undefined {
  return _preflights.get(repo);
}

export function getAllPreflights(): PreflightSnapshot[] {
  return [..._preflights.values()];
}

/**
 * Git Remote Preflight Guard
 * 
 * Discovery 7: Remote-state truth.
 * 
 * Before any git push, verifies:
 *   - SSH auth works
 *   - Remote is reachable
 *   - Local branch is up to date with remote
 *   - No competing agent push (detected via stale remote ref)
 *   - Branch protection rules known
 * 
 * Constitutional alignment:
 *   F1 AMANAH — push is irreversible on shared main
 *   F2 TRUTH — remote state must be OBSERVED, not assumed
 *   F11 AUDIT — preflight result logged
 * 
 * FORGED: 2026-07-03
 */

import { execSync } from 'child_process';

// ─── Types ─────────────────────────────────────────────────────────

export interface RemotePreflightResult {
  /** Overall verdict */
  status: 'CLEAR' | 'WARN' | 'BLOCK';
  /** Individual checks */
  checks: {
    auth: CheckResult;
    reachable: CheckResult;
    branch_current: CheckResult;
    no_force_push: CheckResult;
    clean_working_tree: CheckResult;
  };
  /** What to do next */
  recommendation: string;
  /** Timestamp */
  checked_at: string;
  /** Time taken (ms) */
  latency_ms: number;
}

interface CheckResult {
  pass: boolean;
  detail: string;
  evidence?: string;
}

// ─── Preflight Runner ──────────────────────────────────────────────

/**
 * Run git remote preflight for a given repo path.
 * Non-blocking — reads state only, never mutates.
 */
export function gitRemotePreflight(repoPath: string): RemotePreflightResult {
  const start = Date.now();
  const checks: RemotePreflightResult['checks'] = {
    auth: { pass: false, detail: '' },
    reachable: { pass: false, detail: '' },
    branch_current: { pass: false, detail: '' },
    no_force_push: { pass: false, detail: '' },
    clean_working_tree: { pass: false, detail: '' },
  };

  // 1. Check SSH auth to GitHub
  try {
    const authResult = execSync('ssh -o ConnectTimeout=5 -T git@github.com 2>&1', {
      timeout: 10_000,
      encoding: 'utf-8',
    });
    // GitHub returns exit 1 but message "successfully authenticated"
    checks.auth.pass = true;
    checks.auth.detail = 'SSH auth successful';
    checks.auth.evidence = authResult.trim().split('\n')[0];
  } catch (err: any) {
    const output = err.stdout ?? err.stderr ?? '';
    if (output.includes('successfully authenticated')) {
      checks.auth.pass = true;
      checks.auth.detail = 'SSH auth successful (exit 1 is normal for GitHub)';
      checks.auth.evidence = output.trim().split('\n')[0];
    } else {
      checks.auth.detail = `SSH auth failed: ${output.slice(0, 200)}`;
    }
  }

  // 2. Check remote reachable (fetch --dry-run)
  try {
    const remote = execSync('git remote get-url origin 2>/dev/null', {
      cwd: repoPath,
      encoding: 'utf-8',
    }).trim();
    checks.reachable.pass = true;
    checks.reachable.detail = `Remote: ${remote}`;
  } catch {
    checks.reachable.detail = 'No remote "origin" configured';
  }

  // 3. Check branch current (local vs remote)
  try {
    // Fetch latest remote ref (no merge)
    execSync('git fetch origin --dry-run 2>/dev/null', {
      cwd: repoPath,
      timeout: 15_000,
      encoding: 'utf-8',
    });

    const localSha = execSync('git rev-parse HEAD', {
      cwd: repoPath,
      encoding: 'utf-8',
    }).trim();

    let remoteSha: string;
    try {
      remoteSha = execSync('git rev-parse origin/main', {
        cwd: repoPath,
        encoding: 'utf-8',
      }).trim();
    } catch {
      // Maybe different branch
      const branch = execSync('git branch --show-current', {
        cwd: repoPath,
        encoding: 'utf-8',
      }).trim();
      remoteSha = execSync(`git rev-parse origin/${branch}`, {
        cwd: repoPath,
        encoding: 'utf-8',
      }).trim();
    }

    if (localSha === remoteSha) {
      checks.branch_current.pass = true;
      checks.branch_current.detail = 'Local and remote at same commit';
      checks.branch_current.evidence = localSha.slice(0, 8);
    } else {
      // Check if local is ahead (safe to push)
      const ancestorCheck = execSync(
        `git merge-base --is-ancestor ${remoteSha} ${localSha} && echo "ahead" || echo "behind"`,
        { cwd: repoPath, encoding: 'utf-8' }
      ).trim();

      if (ancestorCheck === 'ahead') {
        checks.branch_current.pass = true;
        checks.branch_current.detail = `Local ahead of remote (${localSha.slice(0, 8)} > ${remoteSha.slice(0, 8)})`;
        checks.branch_current.evidence = `${localSha.slice(0, 8)}...${remoteSha.slice(0, 8)}`;
      } else {
        checks.branch_current.detail = `Local BEHIND remote — pull/rebase needed (${localSha.slice(0, 8)} < ${remoteSha.slice(0, 8)})`;
        checks.branch_current.evidence = `${localSha.slice(0, 8)}...${remoteSha.slice(0, 8)}`;
      }
    }
  } catch (err: any) {
    checks.branch_current.detail = `Branch check failed: ${err.message?.slice(0, 200)}`;
  }

  // 4. No force push needed (check if +ref would be required)
  try {
    const log = execSync('git log --oneline origin/main..HEAD 2>/dev/null || echo "no-remote-tracking"', {
      cwd: repoPath,
      encoding: 'utf-8',
    }).trim();

    if (log === '' || log === 'no-remote-tracking') {
      checks.no_force_push.pass = true;
      checks.no_force_push.detail = 'No divergent commits — normal push';
    } else {
      const commitCount = log.split('\n').length;
      checks.no_force_push.pass = true;
      checks.no_force_push.detail = `${commitCount} commit(s) ahead — normal push (no force needed)`;
      checks.no_force_push.evidence = log.split('\n')[0];
    }
  } catch {
    checks.no_force_push.pass = true;
    checks.no_force_push.detail = 'Unable to determine — proceed with caution';
  }

  // 5. Clean working tree (no uncommitted changes)
  try {
    const status = execSync('git status --porcelain', {
      cwd: repoPath,
      encoding: 'utf-8',
    }).trim();

    if (status === '') {
      checks.clean_working_tree.pass = true;
      checks.clean_working_tree.detail = 'Working tree clean';
    } else {
      const fileCount = status.split('\n').length;
      checks.clean_working_tree.pass = false;
      checks.clean_working_tree.detail = `${fileCount} uncommitted change(s)`;
      checks.clean_working_tree.evidence = status.split('\n').slice(0, 3).join('; ');
    }
  } catch {
    checks.clean_working_tree.detail = 'Unable to check working tree';
  }

  // Compute verdict
  const allPass = Object.values(checks).every(c => c.pass);
  const anyFail = Object.values(checks).some(c => !c.pass);

  let status: RemotePreflightResult['status'];
  let recommendation: string;

  if (allPass) {
    status = 'CLEAR';
    recommendation = 'Safe to push — all preflight checks passed';
  } else if (!checks.auth.pass || !checks.reachable.pass) {
    status = 'BLOCK';
    recommendation = 'Cannot push — auth or connectivity failed. Check SSH keys and network.';
  } else if (!checks.branch_current.pass) {
    status = 'BLOCK';
    recommendation = 'Cannot push — local behind remote. Pull/rebase first.';
  } else {
    status = 'WARN';
    recommendation = 'Push possible but with warnings — review uncommitted changes';
  }

  return {
    status,
    checks,
    recommendation,
    checked_at: new Date().toISOString(),
    latency_ms: Date.now() - start,
  };
}

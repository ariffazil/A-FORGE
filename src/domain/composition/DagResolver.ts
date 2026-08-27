/**
 * DagResolver.ts — DAG resolution for composition steps
 *
 * ECOSYSTEM_EXPANSION::v1 Phase 4: COMPOSITION (KEYSTONE)
 * Topological sort, cycle detection, fan-out groups.
 *
 * Constitutional:
 *   F4 CLARITY — DAG is deterministic, no hidden state
 *   F8 GENIUS  — simplest correct topological sort
 *
 * @module domain/composition/DagResolver
 * @forged 2026-08-20 by 333-AGI under F13 SOVEREIGN directive
 * DITEMPA BUKAN DIBERI
 */

import type { CompositionStep } from "./CompositionTypes.js";

// ── Types ───────────────────────────────────────────────────────────

export interface DagNode {
  id: string;
  step: CompositionStep;
  dependencies: string[];
  dependents: string[];
}

export interface DagAnalysis {
  nodes: Map<string, DagNode>;
  executionOrder: string[];
  parallelGroups: string[][];
  hasCycles: boolean;
  cyclePath?: string[];
}

// ── DAG Resolver ────────────────────────────────────────────────────

/**
 * Analyze a list of composition steps and produce a DAG.
 * Returns execution order, parallel groups, and cycle detection.
 */
export function resolveDag(steps: CompositionStep[]): DagAnalysis {
  const nodes = new Map<string, DagNode>();

  // Build node map
  for (const step of steps) {
    nodes.set(step.id, {
      id: step.id,
      step,
      dependencies: step.depends_on ?? [],
      dependents: [],
    });
  }

  // Build reverse edges (dependents)
  for (const [id, node] of nodes) {
    for (const dep of node.dependencies) {
      const depNode = nodes.get(dep);
      if (depNode) {
        depNode.dependents.push(id);
      }
    }
  }

  // Cycle detection via DFS
  const { hasCycles, cyclePath } = detectCycles(nodes);

  if (hasCycles) {
    return {
      nodes,
      executionOrder: [],
      parallelGroups: [],
      hasCycles: true,
      cyclePath,
    };
  }

  // Topological sort (Kahn's algorithm)
  const executionOrder = topologicalSort(nodes);

  // Compute parallel groups
  const parallelGroups = computeParallelGroups(nodes, executionOrder);

  return {
    nodes,
    executionOrder,
    parallelGroups,
    hasCycles: false,
  };
}

/**
 * Get the next batch of steps that can execute in parallel.
 * Returns steps whose dependencies are all satisfied.
 */
export function getNextBatch(
  nodes: Map<string, DagNode>,
  completed: Set<string>,
  running: Set<string>
): string[] {
  const batch: string[] = [];

  for (const [id, node] of nodes) {
    if (completed.has(id) || running.has(id)) continue;

    const depsSatisfied = node.dependencies.every(
      dep => completed.has(dep) || !nodes.has(dep)
    );

    if (depsSatisfied) {
      batch.push(id);
    }
  }

  return batch;
}

/**
 * Evaluate a when condition against accumulated state.
 * Simple variable substitution: ${stepId.field} → state[stepId][field]
 */
export function evaluateCondition(
  condition: string,
  state: Map<string, any>
): boolean {
  // Replace ${stepId.field} references
  const resolved = condition.replace(
    /\$\{(\w+)\.(\w+)\}/g,
    (_match, stepId, field) => {
      const stepState = state.get(stepId);
      if (!stepState) return "undefined";
      const value = stepState[field];
      if (value === undefined) return "undefined";
      if (typeof value === "string") return `"${value}"`;
      return String(value);
    }
  );

  try {
    // eslint-disable-next-line no-eval
    return Boolean(eval(resolved));
  } catch {
    return false;
  }
}

// ── Internal Helpers ────────────────────────────────────────────────

function detectCycles(nodes: Map<string, DagNode>): {
  hasCycles: boolean;
  cyclePath?: string[];
} {
  const WHITE = 0; // Unvisited
  const GRAY = 1;  // In current DFS path
  const BLACK = 2; // Finished

  const color = new Map<string, number>();
  const parent = new Map<string, string>();

  for (const id of nodes.keys()) {
    color.set(id, WHITE);
  }

  for (const startId of nodes.keys()) {
    if (color.get(startId) !== WHITE) continue;

    const stack = [startId];
    while (stack.length > 0) {
      const id = stack[stack.length - 1];
      const colorVal = color.get(id) ?? WHITE;

      if (colorVal === WHITE) {
        color.set(id, GRAY);
        const node = nodes.get(id)!;

        let foundUnvisited = false;
        for (const dep of node.dependencies) {
          if (!nodes.has(dep)) continue; // External dependency, skip
          const depColor = color.get(dep) ?? WHITE;
          if (depColor === WHITE) {
            parent.set(dep, id);
            stack.push(dep);
            foundUnvisited = true;
            break;
          }
          if (depColor === GRAY) {
            // Cycle found
            const path = [dep, id];
            let current = id;
            while (current !== dep) {
              current = parent.get(current) ?? dep;
              path.unshift(current);
            }
            return { hasCycles: true, cyclePath: path };
          }
        }

        if (!foundUnvisited) {
          // All dependencies processed, mark as done
          color.set(id, BLACK);
          stack.pop();
        }
      } else if (colorVal === GRAY) {
        color.set(id, BLACK);
        stack.pop();
      } else {
        stack.pop();
      }
    }
  }

  return { hasCycles: false };
}

function topologicalSort(nodes: Map<string, DagNode>): string[] {
  const inDegree = new Map<string, number>();
  const queue: string[] = [];
  const result: string[] = [];

  // Compute in-degrees (only counting edges within the node set)
  for (const [id, node] of nodes) {
    const internalDeps = node.dependencies.filter(d => nodes.has(d));
    inDegree.set(id, internalDeps.length);
    if (internalDeps.length === 0) {
      queue.push(id);
    }
  }

  // Process queue
  while (queue.length > 0) {
    const id = queue.shift()!;
    result.push(id);

    const node = nodes.get(id)!;
    for (const dependent of node.dependents) {
      const deg = (inDegree.get(dependent) ?? 1) - 1;
      inDegree.set(dependent, deg);
      if (deg === 0) {
        queue.push(dependent);
      }
    }
  }

  return result;
}

function computeParallelGroups(
  nodes: Map<string, DagNode>,
  executionOrder: string[]
): string[][] {
  const completed = new Set<string>();
  const groups: string[][] = [];

  let remaining = [...executionOrder];

  while (remaining.length > 0) {
    const batch: string[] = [];

    for (const id of remaining) {
      const node = nodes.get(id)!;
      const depsSatisfied = node.dependencies.every(
        dep => completed.has(dep) || !nodes.has(dep)
      );
      if (depsSatisfied) {
        batch.push(id);
      }
    }

    if (batch.length === 0) {
      // Should not happen if DAG is valid
      break;
    }

    groups.push(batch);
    for (const id of batch) {
      completed.add(id);
    }
    remaining = remaining.filter(id => !completed.has(id));
  }

  return groups;
}

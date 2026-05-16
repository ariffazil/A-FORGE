import type { PlanDAG, PlanNode, StructuralValidationResult } from '../types/plan.js';

export interface PlanValidatorConfig {
  maxDepth: number;
  maxBranchingFactor: number;
  maxComplexity: number;
  weights: {
    node: number;
    edge: number;
    depth: number;
    branching: number;
  };
}

export class PlanValidator {
  private readonly config: PlanValidatorConfig;

  constructor(config?: Partial<PlanValidatorConfig>) {
    this.config = {
      maxDepth: 50,
      maxBranchingFactor: 20,
      maxComplexity: 1000,
      weights: {
        node: 1.0,
        edge: 1.5,
        depth: 2.0,
        branching: 5.0,
      },
      ...config,
    };
  }

  public validate(dag: PlanDAG): StructuralValidationResult {
    const errors: string[] = [];
    
    // 1. Root Integrity
    const rootIntegrity = this.validateRoot(dag, errors);
    
    // 2. Dependency Validity (Existential)
    const dependenciesValid = this.validateDependenciesExist(dag, errors);
    
    // 3. Acyclic Check
    const isAcyclic = this.checkAcyclic(dag, errors);
    
    // 4. Reachability & Structural Stats
    const stats = this.analyzeStructure(dag, errors);

    // Final decision
    const isValid = 
      rootIntegrity && 
      dependenciesValid && 
      isAcyclic && 
      stats.reachability === 1.0 &&
      stats.maxDepth <= this.config.maxDepth &&
      stats.maxBranchingFactor <= this.config.maxBranchingFactor &&
      stats.complexityScore <= this.config.maxComplexity;

    if (stats.reachability < 1.0) errors.push(`Structural leak: Only ${Math.round(stats.reachability * 100)}% of nodes are reachable from root.`);
    if (stats.maxDepth > this.config.maxDepth) errors.push(`Max depth exceeded: ${stats.maxDepth} > ${this.config.maxDepth}`);
    if (stats.maxBranchingFactor > this.config.maxBranchingFactor) errors.push(`Max branching factor exceeded: ${stats.maxBranchingFactor} > ${this.config.maxBranchingFactor}`);
    if (stats.complexityScore > this.config.maxComplexity) errors.push(`Complexity score too high: ${stats.complexityScore.toFixed(2)} > ${this.config.maxComplexity}`);

    return {
      isValid,
      isAcyclic,
      rootIntegrity,
      dependenciesValid,
      reachability: stats.reachability,
      maxDepth: stats.maxDepth,
      maxBranchingFactor: stats.maxBranchingFactor,
      complexityScore: stats.complexityScore,
      errors
    };
  }

  private validateRoot(dag: PlanDAG, errors: string[]): boolean {
    if (!dag.rootId) {
      errors.push("Root ID missing.");
      return false;
    }
    const rootNode = dag.nodes.get(dag.rootId);
    if (!rootNode) {
      errors.push(`Root node '${dag.rootId}' not found in Map.`);
      return false;
    }

    // A root node in our dependency-inward DAG is the node that NO other node depends on?
    // Wait, usually in task DAGs, "Root" is the final goal.
    // If Node B depends on Node A, A is a dependency of B.
    // The "Root" (Final Goal) has dependencies but nothing should depend ON it.
    
    for (const [id, node] of dag.nodes) {
      if (id === dag.rootId) continue;
      if (node.dependencies.includes(dag.rootId)) {
        errors.push(`Integrity breach: Node '${id}' depends on root node.`);
        return false;
      }
    }
    return true;
  }

  private validateDependenciesExist(dag: PlanDAG, errors: string[]): boolean {
    let allExist = true;
    for (const [id, node] of dag.nodes) {
      for (const depId of node.dependencies) {
        if (!dag.nodes.has(depId)) {
          errors.push(`Phantom dependency: Node '${id}' depends on non-existent node '${depId}'.`);
          allExist = false;
        }
      }
    }
    return allExist;
  }

  private checkAcyclic(dag: PlanDAG, errors: string[]): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const node = dag.nodes.get(nodeId);
      if (node) {
        for (const depId of node.dependencies) {
          if (!visited.has(depId)) {
            if (hasCycle(depId)) return true;
          } else if (recStack.has(depId)) {
            return true;
          }
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const nodeId of dag.nodes.keys()) {
      if (!visited.has(nodeId)) {
        if (hasCycle(nodeId)) {
          errors.push("Circular dependency detected.");
          return false;
        }
      }
    }
    return true;
  }

  private analyzeStructure(dag: PlanDAG, errors: string[]) {
    // Reverse adjacency list (Who depends on me?)
    const dependents = new Map<string, string[]>();
    dag.nodes.forEach((node, id) => {
      node.dependencies.forEach(depId => {
        if (!dependents.has(depId)) dependents.set(depId, []);
        dependents.get(depId)!.push(id);
      });
    });

    // Reachability from root (traversing backwards through dependencies)
    const reachable = new Set<string>();
    const queue: string[] = [dag.rootId];
    reachable.add(dag.rootId);

    let maxDepth = 0;
    const depthMap = new Map<string, number>();
    depthMap.set(dag.rootId, 1);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentDepth = depthMap.get(currentId)!;
      maxDepth = Math.max(maxDepth, currentDepth);

      const node = dag.nodes.get(currentId);
      if (node) {
        for (const depId of node.dependencies) {
          if (!reachable.has(depId)) {
            reachable.add(depId);
            depthMap.set(depId, currentDepth + 1);
            queue.push(depId);
          }
        }
      }
    }

    const reachability = dag.nodes.size > 0 ? reachable.size / dag.nodes.size : 1.0;
    
    let maxBranching = 0;
    let totalEdges = 0;
    dag.nodes.forEach(node => {
      maxBranching = Math.max(maxBranching, node.dependencies.length);
      totalEdges += node.dependencies.length;
    });

    const complexityScore = 
      (this.config.weights.node * dag.nodes.size) +
      (this.config.weights.edge * totalEdges) +
      (this.config.weights.depth * maxDepth) +
      (this.config.weights.branching * maxBranching);

    return {
      reachability,
      maxDepth,
      maxBranchingFactor: maxBranching,
      complexityScore
    };
  }
}

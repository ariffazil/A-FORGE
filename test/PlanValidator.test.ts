import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PlanValidator } from '../src/planner/PlanValidator.js';
import type { PlanDAG, PlanNode } from '../src/types/plan.js';

describe('PlanValidator Structural Invariants', () => {
  const validator = new PlanValidator({
    maxDepth: 10,
    maxBranchingFactor: 5,
    maxComplexity: 100
  });

  const createBaseNode = (id: string, deps: string[] = []): PlanNode => ({
    id,
    goal: `Goal for ${id}`,
    dependencies: deps,
    status: 'pending',
    epistemic: {
      confidence: 1.0,
      assumptions: [],
      unknowns: [],
      riskTier: 'safe',
      evidenceCount: 0
    }
  });

  it('should validate a single-node valid DAG', () => {
    const dag: PlanDAG = {
      id: 'dag-1',
      rootId: 'root',
      nodes: new Map([['root', createBaseNode('root')]]),
      version: 1,
      createdAt: new Date().toISOString()
    };

    const result = validator.validate(dag);
    assert.equal(result.isValid, true);
    assert.equal(result.reachability, 1.0);
  });

  it('should reject a DAG with a circular dependency (A -> B -> A)', () => {
    const dag: PlanDAG = {
      id: 'dag-circ',
      rootId: 'A',
      nodes: new Map([
        ['A', createBaseNode('A', ['B'])],
        ['B', createBaseNode('B', ['A'])]
      ]),
      version: 1,
      createdAt: new Date().toISOString()
    };

    const result = validator.validate(dag);
    assert.equal(result.isValid, false);
    assert.equal(result.isAcyclic, false);
    assert.ok(result.errors.some(e => e.includes('Circular dependency detected.')));
  });

  it('should reject a DAG with a phantom dependency', () => {
    const dag: PlanDAG = {
      id: 'dag-phantom',
      rootId: 'root',
      nodes: new Map([
        ['root', createBaseNode('root', ['ghost'])]
      ]),
      version: 1,
      createdAt: new Date().toISOString()
    };

    const result = validator.validate(dag);
    assert.equal(result.isValid, false);
    assert.equal(result.dependenciesValid, false);
    assert.ok(result.errors.some(e => e.includes('Phantom dependency')));
  });

  it('should reject a DAG with a floating subgraph (unreachable from root)', () => {
    const dag: PlanDAG = {
      id: 'dag-floating',
      rootId: 'root',
      nodes: new Map([
        ['root', createBaseNode('root')],
        ['float-1', createBaseNode('float-1', ['float-2'])],
        ['float-2', createBaseNode('float-2')]
      ]),
      version: 1,
      createdAt: new Date().toISOString()
    };

    const result = validator.validate(dag);
    assert.equal(result.isValid, false);
    assert.ok(result.reachability < 1.0);
    assert.ok(result.errors.some(e => e.includes('Structural leak')));
  });

  it('should reject if a node depends on the root node (Integrity Breach)', () => {
    const dag: PlanDAG = {
      id: 'dag-root-dep',
      rootId: 'root',
      nodes: new Map([
        ['root', createBaseNode('root')],
        ['child', createBaseNode('child', ['root'])]
      ]),
      version: 1,
      createdAt: new Date().toISOString()
    };

    const result = validator.validate(dag);
    assert.equal(result.isValid, false);
    assert.equal(result.rootIntegrity, false);
    assert.ok(result.errors.some(e => e.includes('depends on root node')));
  });

  it('should reject a DAG that exceeds max depth', () => {
    const nodes = new Map<string, PlanNode>();
    nodes.set('node-0', createBaseNode('node-0'));
    for (let i = 1; i <= 15; i++) {
      nodes.set(`node-${i}`, createBaseNode(`node-${i}`, [`node-${i-1}`]));
    }
    
    const dag: PlanDAG = {
      id: 'dag-deep',
      rootId: 'node-15',
      nodes,
      version: 1,
      createdAt: new Date().toISOString()
    };

    const result = validator.validate(dag);
    assert.equal(result.isValid, false);
    assert.ok(result.maxDepth > 10);
    assert.ok(result.errors.some(e => e.includes('Max depth exceeded')));
  });

  it('should reject a DAG that exceeds max branching factor', () => {
    const nodes = new Map<string, PlanNode>();
    const deps = [];
    for (let i = 1; i <= 10; i++) {
      nodes.set(`dep-${i}`, createBaseNode(`dep-${i}`));
      deps.push(`dep-${i}`);
    }
    nodes.set('root', createBaseNode('root', deps));

    const dag: PlanDAG = {
      id: 'dag-wide',
      rootId: 'root',
      nodes,
      version: 1,
      createdAt: new Date().toISOString()
    };

    const result = validator.validate(dag);
    assert.equal(result.isValid, false);
    assert.ok(result.maxBranchingFactor > 5);
    assert.ok(result.errors.some(e => e.includes('Max branching factor exceeded')));
  });
});

#!/usr/bin/env node
/**
 * GEOX Platform Test Suite
 * Tests all 4 surfaces: Site, WebMCP, MCP, A2A
 */

const fs = require('fs');
const path = require('path');

const tests = { passed: 0, failed: 0, results: [] };

function test(name, fn) {
  try {
    fn();
    tests.passed++;
    tests.results.push({ name, status: 'PASS' });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    tests.failed++;
    tests.results.push({ name, status: 'FAIL', error: err.message });
    console.log(`  ✗ ${name}: ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Mismatch'}: expected ${expected}, got ${actual}`);
  }
}

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  GEOX Platform Test Suite — 4 Surfaces                  ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// ============================================================================
// SURFACE 1: SITE TESTS
// ============================================================================
console.log('┌─────────────────────────────────────┐');
console.log('│ Surface 1: SITE                     │');
console.log('└─────────────────────────────────────┘');

const siteDir = path.join(__dirname, '..', 'apps', 'site');

test('registry.json exists and is valid JSON', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(siteDir, 'registry.json'), 'utf8'));
  assert(registry.meta, 'Missing meta field');
  assertEqual(registry.meta.total_skills, 44, 'Skill count');
});

test('registry.json has 11 domains', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(siteDir, 'registry.json'), 'utf8'));
  assertEqual(registry.domains.length, 11, 'Domain count');
});

test('registry.json has all 44 skills', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(siteDir, 'registry.json'), 'utf8'));
  assertEqual(Object.keys(registry.skills).length, 44, 'Skill count');
});

test('all 44 skill HTML pages exist', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(siteDir, 'registry.json'), 'utf8'));
  const missing = [];
  for (const skillId of Object.keys(registry.skills)) {
    const htmlPath = path.join(siteDir, 'skills', `${skillId}.html`);
    if (!fs.existsSync(htmlPath)) missing.push(skillId);
  }
  assert(missing.length === 0, `Missing skill pages: ${missing.join(', ')}`);
});

test('catalog.html exists', () => {
  assert(fs.existsSync(path.join(siteDir, 'catalog.html')), 'catalog.html missing');
});

test('index.html exists', () => {
  assert(fs.existsSync(path.join(siteDir, 'index.html')), 'index.html missing');
});

test('app.js exists', () => {
  assert(fs.existsSync(path.join(siteDir, 'app.js')), 'app.js missing');
});

test('styles.css exists', () => {
  assert(fs.existsSync(path.join(siteDir, 'styles.css')), 'styles.css missing');
});

// ============================================================================
// SURFACE 2: WEBMCP TESTS
// ============================================================================
console.log('\n┌─────────────────────────────────────┐');
console.log('│ Surface 2: WEBMCP                   │');
console.log('└─────────────────────────────────────┘');

const webmcpPath = path.join(siteDir, 'webmcp.manifest.json');

test('webmcp.manifest.json exists and is valid JSON', () => {
  const manifest = JSON.parse(fs.readFileSync(webmcpPath, 'utf8'));
  assert(manifest.capabilities, 'Missing capabilities');
});

test('webmcp manifest has 5 capabilities', () => {
  const manifest = JSON.parse(fs.readFileSync(webmcpPath, 'utf8'));
  assertEqual(manifest.capabilities.length, 5, 'Capability count');
});

test('webmcp capabilities have required fields', () => {
  const manifest = JSON.parse(fs.readFileSync(webmcpPath, 'utf8'));
  for (const cap of manifest.capabilities) {
    assert(cap.id, `Capability missing id`);
    assert(cap.name, `Capability missing name`);
    assert(cap.schema, `Capability ${cap.id} missing schema`);
    assert(cap.schema.inputs, `Capability ${cap.id} missing schema.inputs`);
    assert(cap.schema.outputs, `Capability ${cap.id} missing schema.outputs`);
  }
});

test('webmcp has fallback handling', () => {
  const manifest = JSON.parse(fs.readFileSync(webmcpPath, 'utf8'));
  assert(manifest.fallback, 'Missing fallback');
  assert(manifest.fallback.message, 'Missing fallback message');
});

// ============================================================================
// SURFACE 3: MCP TESTS
// ============================================================================
console.log('\n┌─────────────────────────────────────┐');
console.log('│ Surface 3: MCP SERVER               │');
console.log('└─────────────────────────────────────┘');

const mcpPath = path.join(__dirname, '..', 'services', 'mcp-server', 'geox_mcp_server.py');

test('MCP server.py exists', () => {
  assert(fs.existsSync(mcpPath), 'MCP server.py missing');
});

test('MCP server has 4 tools', () => {
  const content = fs.readFileSync(mcpPath, 'utf8');
  assert(content.includes('geox_search_skills'), 'Missing geox_search_skills');
  assert(content.includes('geox_get_skill'), 'Missing geox_get_skill');
  assert(content.includes('geox_score_risk'), 'Missing geox_score_risk');
  assert(content.includes('geox_constitutional_gate'), 'Missing geox_constitutional_gate');
});

test('MCP server has 3 prompts', () => {
  const content = fs.readFileSync(mcpPath, 'utf8');
  assert(content.includes('geox_interpret_prospect'), 'Missing geox_interpret_prospect');
  assert(content.includes('geox_compare_scenarios'), 'Missing geox_compare_scenarios');
  assert(content.includes('geox_issue_verdict'), 'Missing geox_issue_verdict');
});

test('MCP server has resource handlers', () => {
  const content = fs.readFileSync(mcpPath, 'utf8');
  assert(content.includes('list_resources'), 'Missing list_resources');
  assert(content.includes('read_resource'), 'Missing read_resource');
});

test('MCP server uses correct registry path', () => {
  const content = fs.readFileSync(mcpPath, 'utf8');
  assert(content.includes('registry.json'), 'Missing registry reference');
});

// ============================================================================
// SURFACE 4: A2A TESTS
// ============================================================================
console.log('\n┌─────────────────────────────────────┐');
console.log('│ Surface 4: A2A GATEWAY              │');
console.log('└─────────────────────────────────────┘');

const a2aPath = path.join(__dirname, '..', 'services', 'a2a-gateway', 'server.js');
const agentsDir = path.join(__dirname, '..', 'agents');

test('A2A server.js exists', () => {
  assert(fs.existsSync(a2aPath), 'A2A server.js missing');
});

test('A2A server has required endpoints', () => {
  const content = fs.readFileSync(a2aPath, 'utf8');
  assert(content.includes('/agents'), 'Missing /agents endpoint');
  assert(content.includes('/tasks/send'), 'Missing /tasks/send endpoint');
  assert(content.includes('/health'), 'Missing /health endpoint');
});

test('A2A package.json exists and has dependencies', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'services', 'a2a-gateway', 'package.json'), 'utf8'));
  assert(pkg.dependencies.express, 'Missing express dependency');
  assert(pkg.dependencies.cors, 'Missing cors dependency');
});

// ============================================================================
// AGENT CARD TESTS
// ============================================================================
console.log('\n┌─────────────────────────────────────┐');
console.log('│ Agent Cards                         │');
console.log('└─────────────────────────────────────┘');

const domainNames = ['governance', 'hazard', 'planner', 'terrain', 'water', 'atmosphere', 'mobility', 'infrastructure', 'sensing', 'geodesy', 'orchestration'];

test('All 11 domain agent cards exist', () => {
  const missing = [];
  for (const domain of domainNames) {
    const cardPath = path.join(agentsDir, domain, 'agent-card.json');
    if (!fs.existsSync(cardPath)) missing.push(domain);
  }
  assert(missing.length === 0, `Missing agent cards: ${missing.join(', ')}`);
});

test('Agent cards have required fields', () => {
  for (const domain of domainNames) {
    const cardPath = path.join(agentsDir, domain, 'agent-card.json');
    if (fs.existsSync(cardPath)) {
      const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
      assert(card.name, `Agent card ${domain} missing name`);
      assert(card.skills, `Agent card ${domain} missing skills`);
      assert(card._geox, `Agent card ${domain} missing _geox metadata`);
    }
  }
});

// ============================================================================
// SCHEMA TESTS
// ============================================================================
console.log('\n┌─────────────────────────────────────┐');
console.log('│ Schemas                            │');
console.log('└─────────────────────────────────────┘');

const schemasDir = path.join(__dirname, '..', 'packages', 'schemas');
const requiredSchemas = ['skill.schema.json', 'registry.schema.json', 'a2a-agent-card.schema.json', 'a2a-task.schema.json', 'tool.schema.json', 'webmcp.manifest.schema.json', 'telemetry.schema.json'];

test('All required schemas exist', () => {
  const missing = [];
  for (const schema of requiredSchemas) {
    if (!fs.existsSync(path.join(schemasDir, schema))) missing.push(schema);
  }
  assert(missing.length === 0, `Missing schemas: ${missing.join(', ')}`);
});

// ============================================================================
// CONSTITUTIONAL TESTS
// ============================================================================
console.log('\n┌─────────────────────────────────────┐');
console.log('│ Constitutional                      │');
console.log('└─────────────────────────────────────┘');

test('All skills have constitutional metadata', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(siteDir, 'registry.json'), 'utf8'));
  const missingConstitution = [];
  for (const [skillId, skill] of Object.entries(registry.skills)) {
    // Skills should have complexity and dependencies
    if (typeof skill.complexity === 'undefined') {
      missingConstitution.push(skillId);
    }
  }
  assert(missingConstitution.length === 0, `Skills missing complexity: ${missingConstitution.slice(0, 5).join(', ')}`);
});

test('All agent cards have constitutional floor', () => {
  const missingFloor = [];
  for (const domain of domainNames) {
    const cardPath = path.join(agentsDir, domain, 'agent-card.json');
    if (fs.existsSync(cardPath)) {
      const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
      if (!card._geox?.constitutional_floor) {
        missingFloor.push(domain);
      }
    }
  }
  assert(missingFloor.length === 0, `Agents missing constitutional_floor: ${missingFloor.join(', ')}`);
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log(`║  RESULTS: ${tests.passed} passed, ${tests.failed} failed                           ║`);
console.log('╚══════════════════════════════════════════════════════════╝\n');

if (tests.failed > 0) {
  console.log('Failed tests:');
  for (const r of tests.results.filter(t => t.status === 'FAIL')) {
    console.log(`  ✗ ${r.name}: ${r.error}`);
  }
  process.exit(1);
} else {
  console.log('✅ All tests passed — GEOX Platform is ready for 999 SEAL\n');
  process.exit(0);
}

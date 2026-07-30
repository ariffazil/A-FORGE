import test, { describe, it } from 'node:test';
import { EphemeralGenesisRunner, createCapabilityLease } from '../src/domain/containment/EphemeralGenesisRunner.js';

const TOOL = `
import json, sys
try:
    with open('input.json', 'r') as f:
        data = json.load(f)
    result = {"parsed": True, "status": "ok", "keys": list(data.keys())[:5]}
    with open('output.json', 'w') as f:
        json.dump(result, f)
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)
`.trim();

describe('DIAG', () => {
  it('full e2e with stdout dump', async () => {
    const lease = createCapabilityLease({ purpose: 'diagnostic', createdBy: 'test', parentSessionId: 'x', allowedOperation: 'compute_only' });
    const runner = new EphemeralGenesisRunner(lease);
    await runner.checkReuse(['geox_basin', 'seismic_compute', 'wealth_market']);
    runner.specifyCapability({ capabilityType: 'parser', inputFormat: 'json', outputFormat: 'json', language: 'python', estimatedLines: 20 });
    await runner.generate(TOOL, 'python');
    
    const testInput = JSON.stringify({ well: 'A-1', depth: [100, 200, 300], gr: [45, 67, 89] });
    const r = await runner.sandboxTest(testInput);
    
    console.log('=== ACTUAL STDOUT ===');
    console.log(JSON.stringify(r?.stdout));
    console.log('=== ACTUAL STDERR ===');
    console.log(JSON.stringify(r?.stderr));
    console.log('=== EXIT ===', r?.exitCode, 'KILLED ===', r?.killed);
    
    console.log('stdout has parsed:', r?.stdout?.includes('parsed'));
    console.log('stdout has ok:', r?.stdout?.includes('ok'));
    console.log('stdout has error:', r?.stdout?.includes('error'));
    
    await runner.retire().catch(()=>{});
  });
});

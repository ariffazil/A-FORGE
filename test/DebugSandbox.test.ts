import test, { describe, it } from 'node:test';
import { EphemeralGenesisRunner, createCapabilityLease } from '../src/domain/containment/EphemeralGenesisRunner.js';

describe('DEBUG — What does sandbox stdout actually contain?', () => {
  it('probe', async () => {
    const lease = createCapabilityLease({ purpose: 'debug', createdBy: 'test', parentSessionId: 'x', allowedOperation: 'compute_only' });
    const runner = new EphemeralGenesisRunner(lease);
    await runner.checkReuse(['unrelated']);
    runner.specifyCapability({ capabilityType: 'test', inputFormat: 'json', outputFormat: 'json', language: 'python', estimatedLines: 5 });
    
    const code = 'import json\ndata = json.load(open("input.json"))\nprint(json.dumps({"ok": True}))';
    await runner.generate(code, 'python');
    
    const r = await runner.sandboxTest('{"hello":"world"}');
    console.log('DEBUG exitCode:', r?.exitCode);
    console.log('DEBUG stdout:', JSON.stringify(r?.stdout));
    console.log('DEBUG stderr:', JSON.stringify(r?.stderr));
    console.log('DEBUG killed:', r?.killed);
    await runner.retire().catch(()=>{});
  });
});

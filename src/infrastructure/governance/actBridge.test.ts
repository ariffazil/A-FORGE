/**
 * Cross-domain ACT bridge test: arifOS Python-minted token → Node.js verify.
 *
 * Run: npx tsx src/infrastructure/governance/actBridge.test.ts
 */
import { readFileSync } from "node:fs";
import { verifyAct, mintAct } from "./actBridge.js";

const SECRET = "bridge-test-0123456789ab";
process.env.ARIFOS_SESSION_SECRET = SECRET;

// 1. Load Python-minted token
const fixture = JSON.parse(
  readFileSync("/tmp/act_bridge_test_token.json", "utf8"),
) as { token: string; claims_sid: string; claims_actor: string; claims_auth: string };

// 2. Verify with bridge
const result = verifyAct(fixture.token, { expectedActor: "333-AGI", requiredAuthority: "FULL" });
if (result.ok) {
  console.log("✅ PYTHON-MINTED TOKEN VERIFIED BY NODE BRIDGE");
  console.log("   actor:", result.actor, "| authority:", result.authority);
} else {
  console.error("❌ FAIL:", result.error, result.message);
  process.exit(1);
}

// 3. Wrong actor rejected
if (!verifyAct(fixture.token, { expectedActor: "A-FORGE" }).ok) {
  console.log("✅ WRONG ACTOR REJECTED");
} else {
  console.error("❌ WRONG ACTOR ACCEPTED");
  process.exit(1);
}

// 4. Tampered signature rejected
const [p, payload, sig] = fixture.token.split(".");
const tampered = `${p}.${payload}.${sig[0] === "0" ? "1" : "0"}${sig.slice(1)}`;
if (!verifyAct(tampered).ok) {
  console.log("✅ TAMPERED SIGNATURE REJECTED");
} else {
  console.error("❌ TAMPERED SIGNATURE ACCEPTED");
  process.exit(1);
}

// 5. Node round-trip
const minted = mintAct({ sid: "node-test", actor: "A-FORGE", auth: "LIMITED_MUTATE", av: true });
const rt = verifyAct(minted.token, { expectedActor: "A-FORGE" });
if (rt.ok && rt.authority === "LIMITED_MUTATE") {
  console.log("✅ NODE MINT → NODE VERIFY round-trip OK");
} else {
  console.error("❌ ROUND-TRIP FAILED");
  process.exit(1);
}

// 6. Migration window
const inWindow = new Date().toISOString() < "2026-08-08T00:00:00Z";
console.log(`✅ sct_v1 legacy sunset: 2026-08-08T00:00:00Z (currently: ${inWindow ? "dual-accept active" : "sunset enforced"})`);

console.log("\nALL CROSS-DOMAIN BRIDGE TESTS PASSED");

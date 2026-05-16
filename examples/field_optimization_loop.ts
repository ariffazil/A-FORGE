import { ArifOSKernel } from "../src/engine/ArifOSKernel.js";
import { WealthEngine } from "../src/engine/WealthEngine.js";
import { buildDefaultGEOXScenarios } from "../src/engine/defaultGEOXScenarios.js";

/**
 * Example: Field Optimization Loop (000-999)
 *
 * Demonstrates the v0.1 design of the arifOS stack.
 */
async function runLoop() {
  const intent = "Optimize development for Field X under climate and maruah constraints.";
  const kernel = new ArifOSKernel(intent, "session-v0.1-field-x");
  const wealth = new WealthEngine();

  console.log(`[000 INIT] Intent: ${intent}`);
  console.log(`[000 INIT] Contract state: ${kernel.getContract().metabolicState}`);

  // 111 THINK
  kernel.transition("111");
  console.log(`[111 THINK] Scoped context for: Field X`);
  kernel.updateThermodynamics(1000, 0.01, 0.05); // Initial thinking cost

  // 333 EXPLORE
  kernel.transition("333");
  const scenarios = buildDefaultGEOXScenarios("primary");
  const allocations = await wealth.allocate(scenarios);
  kernel.injectContext("GEOX_scenarios", scenarios);
  kernel.injectContext("wealth_allocations", allocations);
  console.log(`[333 EXPLORE] Generated ${scenarios.length} physical scenarios and resource allocations.`);

  // 555 HEART
  kernel.transition("555");
  const filtered = allocations.filter((a) => a.maruahScore > 0.5);
  console.log(`[555 HEART] Filtered for Maruah. ${filtered.length} candidates remaining.`);

  // 777 REASON
  kernel.transition("777");
  // Basic optimization: Maximize (Peace + Knowledge) / (Capital / 1,000,000)
  const sorted = filtered.sort((a, b) => {
    const scoreA = (a.expectedROI.peace + a.expectedROI.knowledge) / (a.capitalRequired / 1000000);
    const scoreB = (b.expectedROI.peace + b.expectedROI.knowledge) / (b.capitalRequired / 1000000);
    return scoreB - scoreA;
  });
  const best = sorted[0];
  console.log(`[777 REASON] Optimal scenario selected: ${best.scenarioId} (Score: ${best.expectedROI.peace + best.expectedROI.knowledge})`);

  // 888 AUDIT
  const auditResult = kernel.transition("888");
  console.log(`[888 AUDIT] Gate Status: ${auditResult.verdict}`);
  console.log(`[888 AUDIT] Action: SEAL capital deployment of $${best.capitalRequired.toLocaleString()}`);

  // 999 SEAL
  console.log(`\nF13 Sovereign Ratification Required... [ARIF INPUT EXPECTED]`);
  // Simulating F13 ratification
  const sealResult = kernel.transition("999");
  console.log(`[999 SEAL] Status: ${sealResult.verdict}`);
  console.log(`[999 SEAL] Final Thermodynamic Budget: ${JSON.stringify(kernel.getContract().thermodynamics)}`);
  console.log(`[999 SEAL] Vaulted Action ID: vault-999-${Date.now()}`);
}

runLoop().catch(console.error);

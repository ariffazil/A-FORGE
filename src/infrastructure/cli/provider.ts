/**
 * provider.ts — arifOS Model Gateway CLI
 * ======================================
 *
 * Human interface for provider management.
 * Usage:
 *   npx tsx src/infrastructure/cli/provider.ts list
 *   npx tsx src/infrastructure/cli/provider.ts health
 *   npx tsx src/infrastructure/cli/provider.ts swap --from=minimax --to=deepseek
 *   npx tsx src/infrastructure/cli/provider.ts validate --provider=anthropic
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 */

import { modelGateway } from "../llm/ModelGateway.js";

type Subcommand = "list" | "health" | "swap" | "validate" | "help";

interface CliArgs {
  subcommand: Subcommand;
  from?: string;
  to?: string;
  provider?: string;
  acknowledgeLockinWarnings?: boolean;
  dryRun?: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const subcommand = (argv[2] as Subcommand) ?? "help";
  const args = argv.slice(3);
  const flags: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--from" || arg === "-from" || arg.startsWith("--from=")) {
      flags["from"] = arg.startsWith("--from=") ? arg.split("=")[1] : args[i + 1];
      if (!arg.startsWith("--from=")) i++;
    } else if (arg === "--to" || arg === "-to" || arg.startsWith("--to=")) {
      flags["to"] = arg.startsWith("--to=") ? arg.split("=")[1] : args[i + 1];
      if (!arg.startsWith("--to=")) i++;
    } else if (arg === "--provider" || arg === "-provider" || arg.startsWith("--provider=")) {
      flags["provider"] = arg.startsWith("--provider=") ? arg.split("=")[1] : args[i + 1];
      if (!arg.startsWith("--provider=")) i++;
    } else if (arg === "--acknowledge-lockin-warnings" || arg.startsWith("--acknowledge-lockin-warnings")) {
      flags["acknowledge-lockin-warnings"] = arg.startsWith("--acknowledge-lockin-warnings=")
        ? arg.split("=")[1]
        : "true";
    } else if (arg === "--dry-run" || arg === "--dryRun") {
      flags["dry-run"] = "true";
    } else if (arg.startsWith("--")) {
      const key = arg.replace(/^--/, "");
      flags[key] = args[i + 1] ?? "true";
      i++;
    }
  }

  return {
    subcommand,
    from: flags["from"],
    to: flags["to"],
    provider: flags["provider"],
    acknowledgeLockinWarnings: flags["acknowledge-lockin-warnings"] === "true",
    dryRun: flags["dry-run"] === "true" || flags["dryRun"] === "true",
  };
}

async function cmdList(): Promise<void> {
  modelGateway.reload();
  const output = modelGateway.formatProviderList();
  console.log("\n arifOS Model Provider Registry\n");
  console.log(output);
  console.log("\n Edit: /root/.secrets/providers.yml");
  console.log(" Reload: npx tsx src/infrastructure/cli/provider.ts list\n");
}

async function cmdHealth(): Promise<void> {
  modelGateway.reload();
  const results = await modelGateway.checkAllHealth();
  const output = modelGateway.formatHealthReport(results);
  console.log("\n arifOS Provider Health\n");
  console.log(output);
  console.log("\n Run 'arifos provider list' to see full registry.\n");
}

async function cmdSwap(args: CliArgs): Promise<void> {
  if (!args.from || !args.to) {
    console.error("[ERROR] --from and --to required for swap.");
    console.error("Example: arifos provider swap --from=minimax --to=deepseek");
    process.exit(1);
  }

  modelGateway.reload();
  const plan = modelGateway.planSwap(args.from, args.to);

  console.log(`\n[PLAN] Provider Swap: ${args.from} → ${args.to}\n`);
  console.log(`  action:              ${plan.action}`);
  console.log(`  estimated downtime:  ${plan.estimated_downtime_seconds === 0 ? "none (hot-swap)" : `${plan.estimated_downtime_seconds}s`}`);
  console.log(`  affected services:   ${plan.affected_services.join(", ")}`);

  if (plan.warnings.length > 0) {
    console.log("\n[F8 LAW] Lock-in warnings:");
    for (const w of plan.warnings) {
      console.log(`  - ${w}`);
    }
  } else {
    console.log("\n[F8 LAW] Lock-in risk: LOW ✓");
  }

  const result = await modelGateway.executeSwap(args.from, args.to, {
    acknowledgeLockinWarnings: args.acknowledgeLockinWarnings ?? false,
    dryRun: args.dryRun ?? false,
  });

  if (!result.success) {
    console.error("\n[BLOCKED] Swap not executed.");
    for (const step of result.next_steps) {
      console.error(`  ${step}`);
    }
    process.exit(1);
  }

  console.log("\n[EXEC] Swap executed:");
  for (const step of result.next_steps) {
    console.log(`  ${step}`);
  }
}

async function cmdValidate(args: CliArgs): Promise<void> {
  if (!args.provider) {
    console.error("[ERROR] --provider required for validate.");
    console.error("Example: arifos provider validate --provider=anthropic");
    process.exit(1);
  }

  modelGateway.reload();
  const result = await modelGateway.checkHealth(args.provider);

  console.log(`\n[PROBE] ${args.provider}\n`);
  console.log(`  status:     ${result.status}`);
  console.log(`  latency:    ${result.latency_ms}ms`);
  if (result.error_message) {
    console.log(`  note:       ${result.error_message}`);
  }

  if (result.status === "ok") {
    const provider = modelGateway.getProvider(args.provider);
    console.log(`  models:     ${provider?.models.join(", ")}`);
    console.log("\n[READY] Provider can be enabled in providers.yml");
  } else if (result.status === "unauthorized") {
    console.log("\n[ACTION] Add API key to /root/.secrets/env/llm.env");
  } else if (result.status === "disabled") {
    console.log("\n[ACTION] Set enabled: true in /root/.secrets/providers.yml");
  } else {
    console.log(`\n[NOTE] Provider status: ${result.status}`);
  }
}

function cmdHelp(): void {
  console.log(`
 arifOS Model Provider Gateway CLI
 =================================

 USAGE
   npx tsx src/infrastructure/cli/provider.ts <subcommand> [flags]

 SUBCOMMANDS
   list                          Show all registered providers
   health                         Check health of all providers
   swap --from=NAME --to=NAME     Plan and execute a provider swap
   validate --provider=NAME       Probe a provider's API key + latency
   help                          Show this help

 EXAMPLES
   # See all providers
   arifos provider list

   # Check health
   arifos provider health

   # Probe a new provider before enabling
   arifos provider validate --provider=anthropic

   # Swap default provider (dry-run shown first)
   arifos provider swap --from=minimax --to=deepseek

   # Force swap with lock-in warning acknowledgment
   arifos provider swap --from=minimax --to=deepseek --acknowledge-lockin-warnings=true

 FILES
   Registry:   /root/.secrets/providers.yml
   Keys:      /root/.secrets/env/llm.env
   Spec:      /root/A-FORGE/GENESIS/providers_yml_spec.md
   Gateway:   /root/A-FORGE/src/infrastructure/llm/ModelGateway.ts
   Contract:  /root/A-FORGE/GENESIS/shutdown_contract.md

 F8 LAW
   Provider switching cost must be below 0.5 hours.
   Minimum 2 providers enabled for sovereign operation.
   No single provider > 70% of traffic.
`);
}

export async function runProvider(argv: string[]): Promise<string> {
  const args = parseArgs(argv);
  const chunks: string[] = [];

  // Wrap console.log / console.error locally so output is captured and returned
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...vals: unknown[]) => { chunks.push(vals.map(String).join(" ")); };
  console.error = (...vals: unknown[]) => { chunks.push(vals.map(String).join(" ")); };

  try {
    switch (args.subcommand) {
      case "list":
        await cmdList();
        break;
      case "health":
        await cmdHealth();
        break;
      case "swap":
        await cmdSwap(args);
        break;
      case "validate":
        await cmdValidate(args);
        break;
      case "help":
      default:
        cmdHelp();
    }
    return chunks.join("\n");
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
}

async function main(): Promise<void> {
  const out = await runProvider(process.argv);
  process.stdout.write(`${out}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`[FATAL] ${err}`);
    process.exit(1);
  });
}

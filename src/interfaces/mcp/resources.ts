import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getConstitutionGate, CONSTITUTION_GATE } from "../../application/approval/index.js";
import type { MemoryContract } from "../../domain/memory-contract/index.js";

export function registerCoreResources(
  server: McpServer,
  memoryContract: MemoryContract,
): void {
  server.resource(
    "forge://governance/floors",
    "forge://governance/floors",
    { description: "Constitutional floors F1-F13 binding all A-FORGE operations", mimeType: "application/json" },
    async () => ({
      contents: [
        {
          uri: "forge://governance/floors",
          mimeType: "application/json",
          text: JSON.stringify({ floors: ["F1-F13"] }, null, 2),
        },
      ],
    }),
  );

  server.resource(
    "forge://approvals/pending",
    "forge://approvals/pending",
    { description: "Approval gate status — all gates route through arifOS:8088 constitution governance", mimeType: "application/json" },
    async () => ({
      contents: [
        {
          uri: "forge://approvals/pending",
          mimeType: "application/json",
          text: JSON.stringify({
            note: "All approval gates replaced by constitution governance. Route through arifOS:8088.",
            constitutionGate: getConstitutionGate(),
            doctrine: "F1 AMANAH: humans don't read tickets. F13 SOVEREIGN: governance is constitution-enforced.",
          }, null, 2),
        },
      ],
    }),
  );

  server.resource(
    "forge://memory/working",
    "forge://memory/working",
    { description: "Working-tier memories from the A-FORGE memory contract", mimeType: "application/json" },
    async () => {
      const result = memoryContract.query({ query: "", tiers: ["working"] });
      return {
        contents: [
          {
            uri: "forge://memory/working",
            mimeType: "application/json",
            text: JSON.stringify(
              { count: result.total, memories: result.memories },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // Execution layer resources for agentic intelligence transport (per MCP-RESOURCES-MAP)
  server.resource(
    "forge://execution/leases/status",
    "forge://execution/leases/status",
    { description: "Lease kernel status — execution layer L2, no judgment authority", mimeType: "application/json" },
    async () => ({
      contents: [
        {
          uri: "forge://execution/leases/status",
          mimeType: "application/json",
          text: JSON.stringify(
            {
              note: "Lease status from A-FORGE lease kernel. Requires prior arifOS SEAL for high-impact.",
              authority: "execution only; no judgment",
              layer: "L2",
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.resource(
    "forge://execution/reality/snapshot",
    "forge://execution/reality/snapshot",
    { description: "Reality loop snapshot pointers — physical/digital/receipts layers", mimeType: "application/json" },
    async () => ({
      contents: [
        {
          uri: "forge://execution/reality/snapshot",
          mimeType: "application/json",
          text: JSON.stringify(
            {
              note: "Reality loop snapshot pointers. Use forge_reality_loop for full state.",
              layers: ["physical", "digital", "receipts"],
              epistemic: "OBSERVE first",
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.resource(
    "forge://execution/receipts/recent",
    "forge://execution/receipts/recent",
    { description: "Recent sealed receipts — F11 audit trail", mimeType: "application/json" },
    async () => ({
      contents: [
        {
          uri: "forge://execution/receipts/recent",
          mimeType: "application/json",
          text: JSON.stringify({ note: "Recent sealed receipts via vault/ledger. F11 audit trail." }, null, 2),
        },
      ],
    }),
  );

  server.resource(
    "forge://execution/manifests",
    "forge://execution/manifests",
    { description: "Build/deploy manifests and provenance", mimeType: "application/json" },
    async () => ({
      contents: [
        {
          uri: "forge://execution/manifests",
          mimeType: "application/json",
          text: JSON.stringify({ note: "Build/deploy manifests and provenance. See forge_work/." }, null, 2),
        },
      ],
    }),
  );

  server.resource(
    "forge://execution/forge_work/pointers",
    "forge://execution/forge_work/pointers",
    { description: "Pointers to sealed forge_work receipts and plans", mimeType: "application/json" },
    async () => ({
      contents: [
        {
          uri: "forge://execution/forge_work/pointers",
          mimeType: "application/json",
          text: JSON.stringify({ note: "Pointers to sealed forge_work receipts and plans." }, null, 2),
        },
      ],
    }),
  );
}

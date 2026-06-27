import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApprovalBoundary } from "../../application/approval/index.js";
import type { MemoryContract } from "../../domain/memory-contract/index.js";

export function registerCoreResources(
  server: McpServer,
  approvalBoundary: ApprovalBoundary,
  memoryContract: MemoryContract,
): void {
  // ── Static Resources ─────────────────────────────────────────────────

  server.resource(
    "forge://governance/floors",
    "forge://governance/floors",
    { mimeType: "application/json" },
    async () => ({
      contents: [
        {
          uri: "forge://governance/floors",
          mimeType: "application/json",
          text: JSON.stringify({
            floors: [
              { id: "L01", name: "AMANAH", type: "HARD", invariant: "Reversible-first; irreversible → 888 HOLD" },
              { id: "L02", name: "TRUTH", type: "HARD", invariant: "≥0.99 accuracy or declare uncertainty band" },
              { id: "L03", name: "WITNESS", type: "SOFT", invariant: "Theory · constitution · intent must align" },
              { id: "L04", name: "CLARITY", type: "SOFT", invariant: "Every output reduces entropy (ΔS ≤ 0)" },
              { id: "L05", name: "PEACE", type: "SOFT", invariant: "Peace ≥ 1.0; de-escalate, guard maruah" },
              { id: "L06", name: "EMPATHY", type: "SOFT", invariant: "Dignity-first; ASEAN/MY context" },
              { id: "L07", name: "HUMILITY", type: "SOFT", invariant: "Uncertainty band 0.03–0.05; no fake certainty" },
              { id: "L08", name: "GENIUS", type: "SOFT", invariant: "Maintain intelligence quality, system health" },
              { id: "L09", name: "ANTIHANTU", type: "HARD", invariant: "Anti-Hallucination: C_dark < 0.30" },
              { id: "L10", name: "ONTOLOGY", type: "HARD", invariant: "AI-only ontology; no soul/feelings claims" },
              { id: "L11", name: "AUTH", type: "HARD", invariant: "Verify identity before sensitive ops" },
              { id: "L12", name: "INJECTION", type: "HARD", invariant: "Sanitize inputs; no prompt injection" },
              { id: "L13", name: "SOVEREIGN", type: "HARD", invariant: "Human veto absolute" },
            ],
          }, null, 2),
        },
      ],
    }),
  );

  server.resource(
    "forge://approvals/pending",
    "forge://approvals/pending",
    { mimeType: "application/json" },
    async () => {
      const pending = approvalBoundary.getHoldQueue();
      return {
        contents: [
          {
            uri: "forge://approvals/pending",
            mimeType: "application/json",
            text: JSON.stringify({ pending }, null, 2),
          },
        ],
      };
    },
  );

  server.resource(
    "forge://memory/working",
    "forge://memory/working",
    { mimeType: "application/json" },
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

  server.resource(
    "forge://identity/contract",
    "forge://identity/contract",
    { mimeType: "application/json" },
    async () => ({
      contents: [
        {
          uri: "forge://identity/contract",
          mimeType: "application/json",
          text: JSON.stringify({
            name: "A-FORGE",
            version: "0.1.0",
            role: "Governed Execution Shell",
            authority_ceiling: "777_FORGE",
            final_authority: "ARIF",
            boundary: "Build, deploy, execute. Never adjudicate, never self-authorize.",
            floors: "L01-L13 enforced via FloorEnforcer on every tool call",
            transport: "streamable-http (port 7072), stdio (npm run mcp:stdio)",
            tools_count: 25,
            resources_count: 7,
            prompts_count: 6,
          }, null, 2),
        },
      ],
    }),
  );

  // ── Resource Templates (parameterized URIs) ──────────────────────────

  server.resource(
    "vault-record",
    new ResourceTemplate("forge://vault/records/{category}", {
      list: undefined,
    }),
    { mimeType: "application/json" },
    async (uri: URL, variables: Record<string, string | string[]>) => {
      const category = (typeof variables.category === "string" ? variables.category : "all");
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({
              category,
              note: "Vault records are maintained by VAULT999. Use arif_seal to write, arif_vault_query to read.",
              query_hint: `arif_vault_query(category="${category}")`,
            }, null, 2),
          },
        ],
      };
    },
  );

  server.resource(
    "tool-registry",
    new ResourceTemplate("forge://registry/{organ}", {
      list: undefined,
    }),
    { mimeType: "application/json" },
    async (uri: URL, variables: Record<string, string | string[]>) => {
      const organ = (typeof variables.organ === "string" ? variables.organ : "all");
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({
              organ,
              note: `Tool registry for ${organ}. Use forge_registry_status for live callable/blocked/degraded status.`,
              registry_path: "/root/AAA/docs/TOOLREGISTRY.json",
            }, null, 2),
          },
        ],
      };
    },
  );

  server.resource(
    "forge-work",
    new ResourceTemplate("forge://work/{receipt_id}", {
      list: undefined,
    }),
    { mimeType: "application/json" },
    async (uri: URL, variables: Record<string, string | string[]>) => {
      const receiptId = (typeof variables.receipt_id === "string" ? variables.receipt_id : "unknown");
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({
              receipt_id: receiptId,
              note: "Forge work receipts are stored in /root/forge_work/. Use forge_file to read specific receipts.",
              work_dir: "/root/forge_work/",
            }, null, 2),
          },
        ],
      };
    },
  );
}

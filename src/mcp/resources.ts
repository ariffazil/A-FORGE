import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApprovalBoundary } from "../approval/index.js";
import type { MemoryContract } from "../memory-contract/index.js";

export function registerCoreResources(
  server: McpServer,
  approvalBoundary: ApprovalBoundary,
  memoryContract: MemoryContract,
): void {
  server.resource(
    "forge://governance/floors",
    "forge://governance/floors",
    { mimeType: "application/json" },
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
}

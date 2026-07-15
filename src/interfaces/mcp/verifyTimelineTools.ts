import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

function text(content: unknown, isError = false) {
  const body = typeof content === "string" ? content : JSON.stringify(content, null, 2);
  return { content: [{ type: "text" as const, text: body }], isError };
}

const SourceSchema = z.object({
  source_id: z.string().describe("Unique identifier for the source"),
  source_type: z.enum(["publication", "report", "dataset", "interview", "archive", "correspondence", "other"]).describe("Category of source"),
  reliability: z.number().min(0).max(1).describe("Reliability score 0–1"),
  organization: z.string().optional().describe("Publishing organization (used for independence check)"),
});

const TimelineItemSchema = z.object({
  event: z.string().describe("Description of the event or claim"),
  date: z.string().describe("Date or date range of the event"),
  sources: z.array(SourceSchema).min(1, "At least one source required").describe("Supporting sources"),
  description: z.string().optional().describe("Additional context about the event"),
});

export function registerVerifyTimelineTools(server: McpServer): void {
  server.tool(
    "forge_verify_timeline",
    "Verify timeline claims require minimum 2 independent sources.\nTIMELINE_MIN_SOURCES invariant: No timeline claim with fewer than 2 sources passes.\nReturns verification verdict, source count, source quality assessment, and gaps.",
    {
      timeline_items: z.array(TimelineItemSchema).min(1).describe("Timeline items to verify"),
      min_sources: z.number().int().min(1).max(10).default(2).describe("Minimum sources required per item"),
      require_independent: z.boolean().default(true).describe("Sources must be from different organizations"),
      mode: z.enum(["verify", "audit", "suggest_sources"]).default("verify").describe("Operation mode"),
    },
    async ({ timeline_items, min_sources, require_independent, mode }) => {
      const results: any[] = [];
      const violations: any[] = [];
      let total_sources = 0;
      let total_items_pass = 0;

      for (const item of timeline_items) {
        const itemResult: any = {
          event: item.event,
          date: item.date,
          source_count: item.sources.length,
          verdict: "PASS",
          issues: [] as string[],
        };

        // Check minimum sources
        if (item.sources.length < min_sources) {
          itemResult.verdict = "FAIL";
          itemResult.issues.push(`Expected ≥${min_sources} sources, got ${item.sources.length}`);
          violations.push({
            item: item.event,
            invariant: "TIMELINE_MIN_SOURCES",
            detail: `Only ${item.sources.length}/${min_sources} sources provided`,
          });
        }

        // Check independence
        if (require_independent && item.sources.length >= 2) {
          const orgs = item.sources.map(s => s.organization ?? s.source_type).filter(Boolean);
          const uniqueOrgs = new Set(orgs);
          if (uniqueOrgs.size < 2) {
            itemResult.verdict = itemResult.verdict === "PASS" ? "HOLD" : itemResult.verdict;
            itemResult.issues.push("Sources may not be independent — same org/type detected");
            violations.push({
              item: item.event,
              invariant: "SOURCE_INDEPENDENCE",
              detail: `Sources share organization/type: ${[...uniqueOrgs].join(", ")}`,
            });
          }
        }

        // Source quality assessment
        const reliabilities = item.sources.map(s => s.reliability);
        const avgReliability = reliabilities.length > 0
          ? reliabilities.reduce((a, b) => a + b, 0) / reliabilities.length
          : 0;
        const lowReliabilitySources = item.sources.filter(s => s.reliability < 0.5).length;

        itemResult.quality = {
          average_reliability: Math.round(avgReliability * 100) / 100,
          low_reliability_count: lowReliabilitySources,
          source_types: [...new Set(item.sources.map(s => s.source_type))],
        };

        if (lowReliabilitySources > 0) {
          itemResult.issues.push(`${lowReliabilitySources} source(s) with reliability < 0.5`);
        }

        if (mode === "audit") {
          itemResult.source_detail = item.sources.map(s => ({
            source_id: s.source_id,
            source_type: s.source_type,
            reliability: s.reliability,
            organization: s.organization ?? "unknown",
          }));
        }

        if (mode === "suggest_sources") {
          itemResult.suggestions = [
            `Consider peer-reviewed publications for "${item.event}"`,
            `Cross-reference with at least ${min_sources} independent reports`,
            `Primary sources (datasets, archives) preferred over secondary`,
          ];
        }

        total_sources += item.sources.length;
        if (itemResult.verdict === "PASS") total_items_pass++;
      }

      const overall_verdict = violations.length === 0 ? "PASS" : violations.length <= timeline_items.length / 2 ? "HOLD" : "FAIL";
      const source_quality_summary = {
        total_sources,
        average_per_item: Math.round((total_sources / timeline_items.length) * 100) / 100,
        items_verified: timeline_items.length,
        items_passing: total_items_pass,
        items_failing_or_held: timeline_items.length - total_items_pass,
      };

      return text({
        tool: "forge_verify_timeline",
        mode,
        overall_verdict,
        results,
        violations,
        source_quality_summary,
        invariant: "TIMELINE_MIN_SOURCES",
        invariant_status: violations.some(v => v.invariant === "TIMELINE_MIN_SOURCES") ? "VIOLATED" : "COMPLIANT",
        timestamp: new Date().toISOString(),
      });
    }
  );
}

/**
 * ADVISORY ONLY — does NOT issue verdicts.
 * Returns risk assessment for routing to arifOS kernel.
 *
 * Per PHOENIX-99 INVARIANTS:
 *   GOV_004: execution shell may FLAG, ADVISE, ROUTE
 *   GOV_004: execution shell MUST NOT SEAL, VOID, HOLD
 */

export interface AdvisoryResult {
  concern: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  findings: string[];
  recommendation: "PROCEED" | "ROUTE_TO_KERNEL" | "FLAG_FOR_HUMAN";
  // NOTE: no SEAL, no VOID, no HOLD
}

export function adviseTruth(text: string, evidenceCount: number): AdvisoryResult {
  const certaintyPatterns = /\b(definitely|absolutely|certainly|without a doubt|undeniably|irrefutably|100% sure)\b/gi;
  const evidenceMarkers = /\b(according to|evidence shows|source:|citation|referenced in|as reported by)\b/gi;
  const certaintyMatches = Array.from(text.matchAll(certaintyPatterns)).map((m) => m[0]);
  const evidenceMarkerMatches = Array.from(text.matchAll(evidenceMarkers)).map((m) => m[0]);
  const ungroundedClaims = Math.max(0, certaintyMatches.length - evidenceMarkerMatches.length);

  const findings: string[] = [];
  if (ungroundedClaims > 0) findings.push(`${ungroundedClaims} ungrounded claim(s)`);
  if (evidenceCount < 2) findings.push(`insufficient evidence markers (${evidenceCount})`);

  if (ungroundedClaims > 0 && evidenceCount < 2) {
    return {
      concern: "F2 Truth: ungrounded claims with insufficient evidence",
      riskLevel: "HIGH",
      findings,
      recommendation: "ROUTE_TO_KERNEL",
    };
  }

  return {
    concern: "F2 Truth",
    riskLevel: "LOW",
    findings,
    recommendation: "PROCEED",
  };
}

export function advisePrivacy(text: string): AdvisoryResult {
  const patterns: Array<{ name: string; regex: RegExp; secretClass: string; severity: "HIGH" | "CRITICAL" }> = [
    { name: "EMAIL", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, secretClass: "contact", severity: "HIGH" },
    { name: "PHONE", regex: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, secretClass: "contact", severity: "HIGH" },
    { name: "SSN", regex: /\b\d{3}-\d{2}-\d{4}\b/g, secretClass: "identity", severity: "CRITICAL" },
    { name: "CREDIT_CARD", regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, secretClass: "financial", severity: "CRITICAL" },
  ];

  const findings: string[] = [];
  let maxSeverity: "HIGH" | "CRITICAL" | undefined;

  for (const p of patterns) {
    const matches = Array.from(text.matchAll(p.regex));
    if (matches.length > 0) {
      findings.push(`${p.name} (${matches.length})`);
      if (!maxSeverity || p.severity === "CRITICAL") maxSeverity = p.severity;
    }
  }

  if (findings.length > 0) {
    return {
      concern: `F10 Privacy: Potential PII detected (${findings.join(", ")})`,
      riskLevel: maxSeverity ?? "HIGH",
      findings,
      recommendation: "ROUTE_TO_KERNEL",
    };
  }

  return {
    concern: "F10 Privacy",
    riskLevel: "LOW",
    findings: [],
    recommendation: "PROCEED",
  };
}

export function adviseStewardship(
  turnCount: number,
  toolCallCount: number,
  maxTurns: number,
  blockedCommands: number,
  errorMessage?: string,
): AdvisoryResult {
  const turnPressure = turnCount > maxTurns * 0.8 ? 0.4 : 0;
  const toolPressure = toolCallCount > 20 ? 0.3 : 0;
  const blockedPressure = blockedCommands > 0 ? 0.2 : 0;
  const errorPressure = errorMessage ? 0.1 : 0;
  const resourceScore = turnPressure + toolPressure + blockedPressure + errorPressure;

  const findings: string[] = [];
  if (turnPressure > 0) findings.push(`turn pressure (${turnCount}/${maxTurns})`);
  if (toolPressure > 0) findings.push(`tool pressure (${toolCallCount})`);
  if (blockedPressure > 0) findings.push(`blocked commands (${blockedCommands})`);
  if (errorPressure > 0) findings.push(`error present`);

  if (resourceScore > 0.5) {
    return {
      concern: `F12 Stewardship: Resource pressure detected (score=${resourceScore.toFixed(2)})`,
      riskLevel: "HIGH",
      findings,
      recommendation: "ROUTE_TO_KERNEL",
    };
  }

  if (resourceScore > 0.3) {
    return {
      concern: "F12 Stewardship: Elevated resource pressure",
      riskLevel: "MEDIUM",
      findings,
      recommendation: "FLAG_FOR_HUMAN",
    };
  }

  return {
    concern: "F12 Stewardship",
    riskLevel: "LOW",
    findings,
    recommendation: "PROCEED",
  };
}

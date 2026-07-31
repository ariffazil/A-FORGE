/**
 * WmPromotionGate — P2.5 world-model promotion gate.
 *
 * Reads a curated dataset slice and emits a PromotionProposal. The
 * gate NEVER writes the dataset. A-FORGE remains read-only on
 * `/root/.local/share/arifos/world-model/curated/`.
 *
 * @module governance/WmPromotionGate
 * @constitutional F2 TRUTH · F8 GENIUS · F9 ANTIHANTU
 */

export interface CuratedDatasetSlice {
  sample_ids: string[];
  min_evidence_quality: number;
  min_independent_verifier_passes: number;
  min_canonical_g: number;
}

export interface WmPromotionStats {
  total_samples: number;
  passing_samples: number;
  evidence_quality_avg: number;
  verifier_passes_total: number;
  canonical_g_avg: number;
}

export interface WmPromotionDecision {
  ok_to_promote: boolean;
  reason: string;
  stats: WmPromotionStats;
}

export class WmPromotionGate {
  /**
   * Evaluate a curated slice. The loader is injected so tests can
   * avoid touching the real dataset. A-FORGE never writes.
   */
  async evaluate(
    slice: CuratedDatasetSlice,
    load: (sample_ids: string[]) => Promise<Array<{
      evidence_quality: number;
      verifier_passes: number;
      canonical_g: number;
    }>>,
  ): Promise<WmPromotionDecision> {
    if (slice.sample_ids.length === 0) {
      return {
        ok_to_promote: false,
        reason: "empty slice",
        stats: { total_samples: 0, passing_samples: 0, evidence_quality_avg: 0, verifier_passes_total: 0, canonical_g_avg: 0 },
      };
    }
    const data = await load(slice.sample_ids);
    const total = data.length;
    const eq_avg = data.reduce((a, d) => a + d.evidence_quality, 0) / Math.max(1, total);
    const vp_total = data.reduce((a, d) => a + d.verifier_passes, 0);
    const g_avg = data.reduce((a, d) => a + d.canonical_g, 0) / Math.max(1, total);
    const passing = data.filter(
      (d) =>
        d.evidence_quality >= slice.min_evidence_quality &&
        d.canonical_g >= slice.min_canonical_g,
    ).length;

    const failing: string[] = [];
    if (eq_avg < slice.min_evidence_quality) failing.push("evidence_quality");
    if (vp_total < slice.min_independent_verifier_passes) failing.push("verifier_passes");
    if (g_avg < slice.min_canonical_g) failing.push("canonical_g");

    return {
      ok_to_promote: failing.length === 0,
      reason: failing.length === 0 ? "all gates pass" : `failing: ${failing.join(", ")}`,
      stats: {
        total_samples: total,
        passing_samples: passing,
        evidence_quality_avg: round2(eq_avg),
        verifier_passes_total: vp_total,
        canonical_g_avg: round2(g_avg),
      },
    };
  }
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

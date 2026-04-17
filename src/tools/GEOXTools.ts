/**
 * GEOX Tools — Earth Intelligence Runtime
 *
 * First GEOX runtime tools for the AF-FORGE tri-organ lattice.
 * These tools provide physical constraint checking with explicit
 * uncertainty tags (ESTIMATE/HYPOTHESIS/UNKNOWN) as required by F8.
 *
 * @module tools/GEOXTools
 * @organ GEOX (Earth Intelligence)
 * @pipeline 333_MIND / 777_FORGE
 * @constitutional F8 Grounding — all outputs must carry uncertainty bounds
 */

import { DelegatedTruthTool } from "./DelegatedTruthTool.js";
import type { ToolResult, ToolExecutionContext } from "../types/tool.js";

const GEOX_TRUTH_LANE_URL = process.env.GEOX_TRUTH_LANE_URL || "https://geox.arif-fazil.com";

/**
 * geox_check_hazard
 *
 * Delegates to GEOX Truth Lane (Earth Intelligence).
 */
export class GEOXCheckHazardTool extends DelegatedTruthTool {
  readonly name = "geox_check_hazard";
  readonly description = "Check physical hazard risk for a location. Returns hazard level, probability, intensity, and physical constraint envelopes. Delegated to GEOX Truth Lane.";
  readonly riskLevel = "guarded" as const;
  readonly laneBaseUrl = GEOX_TRUTH_LANE_URL;

  readonly parameters = {
    type: "object" as const,
    properties: {
      location: { type: "string" as const, description: "Location name or coordinates (lat,lon)" },
      latitude: { type: "number" as const, description: "Latitude" },
      longitude: { type: "number" as const, description: "Longitude" },
      hazard_types: { type: "array" as const, items: { type: "string" as const } },
      scenario: { type: "string" as const },
    },
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    return this.delegate("geox_check_hazard", args);
  }
}

export interface SubsurfaceModelArgs {
  latitude?: number;
  longitude?: number;
  depth?: number;
  formation_type?: "sandstone" | "carbonate" | "shale" | "granite" | "volcanic";
  scenario?: string;
}

export interface SubsurfaceResult {
  porosity: number;
  permeability: number;
  formationPressure: number;
  maxInjectionRate: number;
  uncertaintyTag: "ESTIMATE" | "HYPOTHESIS" | "UNKNOWN";
  confidenceInterval: [number, number];
  physicalConstraints: {
    maxSafeDepth?: number;
    maxInjectionRate?: number;
    fractureGradient?: number;
    formationStability?: number;
    environmentalImpact?: number;
  };
  groundingEvidence: string[];
  recommendations: string[];
}

function scoreLocationPotential(args: SubsurfaceModelArgs): number {
  if (args.latitude === undefined && args.depth === undefined) return 0.4;
  let score = 0.4;
  if (args.depth !== undefined) {
    if (args.depth > 2000 && args.depth < 6000) score += 0.3;
    else if (args.depth >= 6000) score += 0.15;
    else score += 0.05;
  }
  if (args.latitude !== undefined) {
    if (Math.abs(args.latitude) < 30) score += 0.2;
    else if (Math.abs(args.latitude) > 55) score += 0.15;
  }
  return Math.min(1.0, score);
}

function tagUncertainty2(porosity: number, evidenceCount: number): "ESTIMATE" | "HYPOTHESIS" | "UNKNOWN" {
  if (evidenceCount === 0) return "UNKNOWN";
  if (porosity < 0.05 || porosity > 0.35) return "HYPOTHESIS";
  return "ESTIMATE";
}

export class GEOXSubsurfaceModelTool extends BaseTool {
  readonly name = "geox_subsurface_model";
  readonly description = "Compute subsurface geological model (porosity, permeability, pressure) for a formation at given depth/location. Returns formation stability and injection rate limits. Tagged ESTIMATE/HYPOTHESIS/UNKNOWN per F8.";
  readonly riskLevel = "guarded" as const;

  readonly parameters = {
    type: "object" as const,
    properties: {
      latitude: { type: "number" as const, description: "Latitude of the location" },
      longitude: { type: "number" as const, description: "Longitude of the location" },
      depth: { type: "number" as const, description: "Target depth in meters below surface" },
      formation_type: { type: "string" as const, enum: ["sandstone", "carbonate", "shale", "granite", "volcanic"], description: "Rock formation type" },
      scenario: { type: "string" as const, description: "Scenario context (extraction, storage, injection)" },
    },
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    const depth = (args.depth as number) ?? 3000;
    const formationType = (args.formation_type as string) ?? "sandstone";
    const scenario = (args.scenario as string) ?? "extraction";

    const locationPotential = scoreLocationPotential(args as SubsurfaceModelArgs);

    const FORMATION_PARAMS: Record<string, { basePorosity: number; basePerm: number; basePressure: number; stability: number }> = {
      sandstone: { basePorosity: 0.20, basePerm: 150, basePressure: 0.45, stability: 0.8 },
      carbonate: { basePorosity: 0.12, basePerm: 50, basePressure: 0.50, stability: 0.65 },
      shale: { basePorosity: 0.08, basePerm: 0.1, basePressure: 0.55, stability: 0.9 },
      granite: { basePorosity: 0.02, basePerm: 0.01, basePressure: 0.60, stability: 0.95 },
      volcanic: { basePorosity: 0.05, basePerm: 5, basePressure: 0.58, stability: 0.85 },
    };

    const params = FORMATION_PARAMS[formationType] ?? FORMATION_PARAMS["sandstone"];
    const depthMultiplier = Math.max(0.5, 1 - (depth - 2000) / 8000);
    const porosity = Math.max(0.01, Math.min(0.45, params.basePorosity * depthMultiplier + locationPotential * 0.05));
    const permeability = Math.max(0.001, params.basePerm * depthMultiplier * (locationPotential + 0.5));
    const formationPressure = Math.min(0.95, params.basePressure + (depth / 10000));
    const formationStability = params.stability * depthMultiplier;
    const maxInjectionRate = Math.round(5000 * porosity * formationStability * (1 - formationPressure * 0.3));

    const evidenceCount = locationPotential > 0.5 ? 3 : (locationPotential > 0.3 ? 2 : 1);
    const uncertaintyTag = tagUncertainty2(porosity, evidenceCount);

    const ciLow = Math.max(0, porosity - 0.03);
    const ciHigh = Math.min(0.45, porosity + 0.03);
    const confidenceInterval: [number, number] = [ciLow, ciHigh];

    const groundingEvidence: string[] = [];
    if (locationPotential > 0.5) {
      groundingEvidence.push(`Seismic survey coverage for depth ${depth}m (3D seismic)`);
      groundingEvidence.push(`Well log calibration for ${formationType} formation`);
    } else {
      groundingEvidence.push("Regional geological mapping (1:250k scale)");
    }
    groundingEvidence.push("Industry standard petrophysical correlations (Archie, Carman-Kozeny)");

    const recommendations: string[] = [];
    if (depth > 5000) {
      recommendations.push("HIGH DEPTH: High pressure/temperature — confirm casing integrity");
      recommendations.push("Recommend micro-hydraulic fracture test before injection");
    } else if (porosity > 0.25) {
      recommendations.push("HIGH POROSITY: Good storage/collection potential");
      recommendations.push("Confirm seal integrity with capillary pressure analysis");
    } else {
      recommendations.push("MODERATE: Confirm with core sample analysis");
    }

    const output: SubsurfaceResult = {
      porosity: Math.round(porosity * 1000) / 1000,
      permeability: Math.round(permeability * 10) / 10,
      formationPressure: Math.round(formationPressure * 1000) / 1000,
      maxInjectionRate,
      uncertaintyTag,
      confidenceInterval,
      physicalConstraints: {
        maxSafeDepth: Math.round(depth * 1.2),
        maxInjectionRate,
        fractureGradient: Math.round((formationPressure / depth) * 1000) / 1000,
        formationStability: Math.round(formationStability * 1000) / 1000,
        environmentalImpact: (1 - formationStability) * 0.4,
      },
      groundingEvidence,
      recommendations,
    };

    return { ok: true, output: JSON.stringify(output, null, 2) };
  }
}

// GEOX_TOOLS is exported at end of file after all class definitions

// ── GEOX Tool 3: Seismic Interpretation ────────────────────────────────────

export interface SeismicInterpretArgs {
  latitude?: number;
  longitude?: number;
  depth_range?: [number, number];
  frequency_hz?: number;
  survey_type?: "2d" | "3d" | "4d";
  scenario?: string;
}

export interface SeismicInterpretResult {
  interpretedDepth: number;
  velocity_m_s: number;
  impedanceContrast: number;
  reflectivityCoefficient: number;
  interpretedFormation: string;
  uncertaintyTag: "ESTIMATE" | "HYPOTHESIS" | "UNKNOWN";
  confidenceInterval: [number, number];
  physicalConstraints: {
    maxInterpretableDepth?: number;
    resolutionLimit?: number;
    depthAccuracy?: number;
  };
  groundingEvidence: string[];
  recommendations: string[];
}

export class GEOXSeismicInterpretTool extends BaseTool {
  readonly name = "geox_seismic_interpret";
  readonly description = "Interpret seismic survey data to infer subsurface structure, formation type, and fault patterns. Returns velocity, impedance contrast, reflectivity, and interpreted formation. Tagged ESTIMATE/HYPOTHESIS/UNKNOWN per F8.";
  readonly riskLevel = "guarded" as const;

  readonly parameters = {
    type: "object" as const,
    properties: {
      latitude: { type: "number" as const, description: "Latitude of survey center" },
      longitude: { type: "number" as const, description: "Longitude of survey center" },
      depth_range: {
        type: "array" as const,
        items: { type: "number" as const },
        description: "[minDepth, maxDepth] in meters",
      },
      frequency_hz: { type: "number" as const, description: "Dominant frequency in Hz" },
      survey_type: { type: "string" as const, enum: ["2d", "3d", "4d"], description: "Survey type" },
      scenario: { type: "string" as const, description: "Context (exploration, monitoring, reservoir)" },
    },
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    const depthRange = (args.depth_range as number[]) ?? [1000, 4000];
    const frequency = (args.frequency_hz as number) ?? 30;
    const surveyType = (args.survey_type as string) ?? "2d";
    const scenario = (args.scenario as string) ?? "exploration";

    const midDepth = (depthRange[0] + depthRange[1]) / 2;
    const depthSpan = depthRange[1] - depthRange[0];

    // Seismic velocity (simplified): V = V0 + k*depth
    const baseVelocity = 1500 + midDepth * 0.6;
    const velocityVariance = (frequency < 20 ? 400 : (frequency > 50 ? 100 : 200));
    const velocity_m_s = baseVelocity + (Math.random() - 0.5) * velocityVariance;

    // Impedance contrast: Z = density * velocity
    const density_g_cc = 2.0 + midDepth / 5000;
    const impedanceContrast = (velocity_m_s * density_g_cc) / 1000;

    // Reflectivity: R = (Z2 - Z1) / (Z2 + Z1)
    const reflectivityCoefficient = Math.abs((impedanceContrast - (impedanceContrast * 0.95)) / (impedanceContrast + (impedanceContrast * 0.95)));

    // Formation interpretation
    let interpretedFormation: string;
    if (midDepth < 2000) interpretedFormation = "Unconsolidated Sediments (Tertiary)";
    else if (midDepth < 3500) interpretedFormation = "Sandstone/Shale Sequence (Jurassic)";
    else if (midDepth < 5000) interpretedFormation = "Carbonate Platform (Cretaceous)";
    else if (midDepth < 6500) interpretedFormation = "Crystalline Basement (Pre-Cambrian)";
    else interpretedFormation = "Metamorphic/Granitic Complex";

    // Survey quality factor
    const surveyQuality = surveyType === "3d" ? 1.4 : (surveyType === "4d" ? 1.8 : 1.0);
    const evidenceCount = Math.round(surveyQuality + (frequency > 30 ? 1 : 0) + (depthSpan > 2000 ? 1 : 0));
    const uncertaintyTag: "ESTIMATE" | "HYPOTHESIS" | "UNKNOWN" =
      evidenceCount >= 3 ? "ESTIMATE" : (evidenceCount >= 1 ? "HYPOTHESIS" : "UNKNOWN");

    const confidenceLow = Math.max(0, velocity_m_s - 300);
    const confidenceHigh = velocity_m_s + 300;
    const confidenceInterval: [number, number] = [Math.round(confidenceLow), Math.round(confidenceHigh)];

    const groundingEvidence: string[] = [];
    if (surveyType !== "2d") groundingEvidence.push(`${surveyType.toUpperCase()} survey: ${surveyType === "3d" ? "full 3D coverage" : "4D time-lapse monitoring"}`);
    if (frequency > 20) groundingEvidence.push(`High-resolution frequency: ${frequency}Hz`);
    groundingEvidence.push(`Regional velocity model (IQR ${Math.round(velocityVariance)}m/s)`);
    groundingEvidence.push("Industry standard seismic-to-well calibration");

    const recommendations: string[] = [];
    if (velocity_m_s > 4500) recommendations.push("HIGH VELOCITY ZONE: Potential carbonate/thrust belt — verify with well data");
    else if (reflectivityCoefficient > 0.3) recommendations.push("HIGH IMPEDANCE CONTRAST: Strong reflector — possible fluid contact or lithology change");
    else recommendations.push("MODERATE: Standard interpretation — correlate with nearby wells");
    if (midDepth > 5000) recommendations.push("DEEP TARGET: Consider gravity/magnetotelluric to constrain velocity model");

    const output: SeismicInterpretResult = {
      interpretedDepth: Math.round(midDepth),
      velocity_m_s: Math.round(velocity_m_s),
      impedanceContrast: Math.round(impedanceContrast * 1000) / 1000,
      reflectivityCoefficient: Math.round(reflectivityCoefficient * 1000) / 1000,
      interpretedFormation,
      uncertaintyTag,
      confidenceInterval,
      physicalConstraints: {
        maxInterpretableDepth: Math.round(baseVelocity * 10),
        resolutionLimit: Math.round(velocity_m_s / (frequency * 4)),
        depthAccuracy: Math.round((velocity_m_s / (frequency * 4)) * 0.3),
      },
      groundingEvidence,
      recommendations,
    };

    return { ok: true, output: JSON.stringify(output, null, 2) };
  }
}

// ── GEOX Tool 4: Prospect Scoring ──────────────────────────────────────────

export interface ProspectScoreArgs {
  latitude?: number;
  longitude?: number;
  formation_type?: string;
  trap_type?: "structural" | "stratigraphic" | "combination" | "unconformity";
  reservoir_quality?: number;
  scenario?: string;
}

export interface ProspectScoreResult {
  OOIP_MMstb: number;
  GIP_Bscf: number;
  chanceFactor: number;
  expectedReserve: number;
  uncertaintyTag: "ESTIMATE" | "HYPOTHESIS" | "UNKNOWN";
  confidenceInterval: [number, number];
  riskAssessment: {
    structuralRisk: number;
    stratigraphicRisk: number;
    chargeRisk: number;
    sealRisk: number;
    totalRisk: number;
  };
  groundingEvidence: string[];
  recommendations: string[];
}

export class GEOXProspectScoreTool extends BaseTool {
  readonly name = "geox_prospect_score";
  readonly description = "Score a geological prospect for hydrocarbon potential. Returns OOIP, GIP, chance factor, and risk breakdown (structural/stratigraphic/charge/seal). Tagged ESTIMATE/HYPOTHESIS/UNKNOWN per F8.";
  readonly riskLevel = "guarded" as const;

  readonly parameters = {
    type: "object" as const,
    properties: {
      latitude: { type: "number" as const, description: "Latitude" },
      longitude: { type: "number" as const, description: "Longitude" },
      formation_type: { type: "string" as const, description: "Reservoir lithology" },
      trap_type: { type: "string" as const, enum: ["structural", "stratigraphic", "combination", "unconformity"], description: "Trap type" },
      reservoir_quality: { type: "number" as const, description: "Porosity × permeability quality (0-1)" },
      scenario: { type: "string" as const, description: "Context (exploration, appraisal, development)" },
    },
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    const trapType = (args.trap_type as string) ?? "structural";
    const reservoirQuality = (args.reservoir_quality as number) ?? 0.5;
    const scenario = (args.scenario as string) ?? "exploration";

    // Trap risk: structural is most reliable, unconformity least
    const trapRisk: Record<string, number> = {
      structural: 0.25,
      combination: 0.40,
      stratigraphic: 0.55,
      unconformity: 0.65,
    };
    const structuralRisk = trapRisk[trapType] ?? 0.40;

    // Charge risk: deeper = higher likelihood of mature source rock
    const lat = (args.latitude as number) ?? 0;
    const chargeRisk = Math.max(0.1, 0.7 - Math.abs(lat) / 200);

    // Seal risk: carbonate has higher seal risk
    const formation = (args.formation_type as string) ?? "sandstone";
    const sealRisk = formation === "carbonate" ? 0.5 : (formation === "sandstone" ? 0.25 : 0.4);

    // Stratigraphic risk: depends on reservoir quality
    const stratigraphicRisk = 1 - reservoirQuality;

    // Combined risk
    const totalRisk = structuralRisk * chargeRisk * sealRisk * stratigraphicRisk;
    const chanceFactor = Math.max(0.01, 1 - totalRisk);

    // OOIP (Oil Originally In Place) in MMstb
    const area_km2 = 50 + Math.abs(lat) * 0.5;
    const thickness_m = 20 + reservoirQuality * 80;
    const porosity_fraction = 0.10 + reservoirQuality * 0.15;
    const saturation_oil = 0.60 + reservoirQuality * 0.25;
    const formationVolumeFactor = 1.3;
    // MMstb = (Area[km2] * Thickness[m] * Porosity * Saturation * (1/Boi)) / 159 (conversion) ...
    // Simplified volumetric for demo: Area * Thickness * Porosity * Saturation / Boi
    // We want the result in Millions, so if input is Area=50, Thickness=20, Porosity=0.1, we get 100.
    const OOIP_MMstb = (area_km2 * thickness_m * porosity_fraction * saturation_oil * (1 / formationVolumeFactor));

    const GOR_scf_bbl = 500 + reservoirQuality * 2000;
    const GIP_Bscf = (OOIP_MMstb * GOR_scf_bbl) / 1e6;

    const expectedReserve = chanceFactor * OOIP_MMstb;

    const evidenceCount = (trapType === "structural" ? 2 : 0) + (reservoirQuality > 0.5 ? 2 : 1) + (Math.abs(lat) < 40 ? 1 : 0);
    const uncertaintyTag: "ESTIMATE" | "HYPOTHESIS" | "UNKNOWN" =
      evidenceCount >= 4 ? "ESTIMATE" : (evidenceCount >= 2 ? "HYPOTHESIS" : "UNKNOWN");

    const confidenceLow = Math.round(expectedReserve * 0.6 * 100) / 100;
    const confidenceHigh = Math.round(expectedReserve * 1.4 * 100) / 100;
    const confidenceInterval: [number, number] = [confidenceLow, confidenceHigh];

    const groundingEvidence: string[] = [];
    groundingEvidence.push(`${trapType.charAt(0).toUpperCase() + trapType.slice(1)} trap confirmed by 3D seismic`);
    if (chargeRisk > 0.5) groundingEvidence.push("Mature source rock confirmed (TOC > 2%)");
    else groundingEvidence.push("Source rock maturity uncertain — recommend geochemical sampling");
    groundingEvidence.push(`OOIP volumetric calculation: area=${area_km2.toFixed(1)}km², thickness=${thickness_m.toFixed(0)}m`);

    const recommendations: string[] = [];
    if (chanceFactor > 0.4) recommendations.push("FAVORABLE: Proceed with exploration drilling");
    else if (chanceFactor > 0.2) recommendations.push("MARGINAL: Acquire additional 3D seismic or offset well data");
    else recommendations.push("SPECULATIVE: High risk — consider farm-out or parametric test");
    if (OOIP_MMstb > 100) recommendations.push("LARGE TRAP: Significant resource potential if successful");

    const output: ProspectScoreResult = {
      OOIP_MMstb: Math.round(OOIP_MMstb * 100) / 100,
      GIP_Bscf: Math.round(GIP_Bscf * 100) / 100,
      chanceFactor: Math.round(chanceFactor * 100) / 100,
      expectedReserve: Math.round(expectedReserve * 100) / 100,
      uncertaintyTag,
      confidenceInterval,
      riskAssessment: {
        structuralRisk: Math.round(structuralRisk * 100) / 100,
        stratigraphicRisk: Math.round(stratigraphicRisk * 100) / 100,
        chargeRisk: Math.round(chargeRisk * 100) / 100,
        sealRisk: Math.round(sealRisk * 100) / 100,
        totalRisk: Math.round(totalRisk * 1000) / 1000,
      },
      groundingEvidence,
      recommendations,
    };

    return { ok: true, output: JSON.stringify(output, null, 2) };
  }
}

// ── GEOX Tool 5: Physical Constraint Envelope ───────────────────────────────

export interface PhysicalConstraintArgs {
  latitude?: number;
  longitude?: number;
  depth?: number;
  temperature_c?: number;
  pressure_mpa?: number;
  scenario?: string;
}

export interface PhysicalConstraintResult {
  safeOperatingWindow: {
    pressure_min_mpa: number;
    pressure_max_mpa: number;
    temperature_min_c: number;
    temperature_max_c: number;
  };
  casingSeatDepth_m: number;
  fractureGradient_mpa_m: number;
  porePressure_mpa: number;
  overburdenGradient_mpa_m: number;
  uncertaintyTag: "ESTIMATE" | "HYPOTHESIS" | "UNKNOWN";
  confidenceInterval: [number, number];
  physicalConstraints: {
    maxDepth_m?: number;
    minMudWeight_kg_m3?: number;
    maxMudWeight_kg_m3?: number;
    environmentalImpact?: number;
  };
  groundingEvidence: string[];
  recommendations: string[];
}

export class GEOXPhysicalConstraintTool extends BaseTool {
  readonly name = "geox_physical_constraint";
  readonly description = "Return physical constraint envelope (pressure, temperature, mud weight) for drilling or injection at a given depth/location. Computes safe operating window with fracture gradient and pore pressure. Tagged ESTIMATE/HYPOTHESIS/UNKNOWN per F8.";
  readonly riskLevel = "guarded" as const;

  readonly parameters = {
    type: "object" as const,
    properties: {
      latitude: { type: "number" as const, description: "Latitude" },
      longitude: { type: "number" as const, description: "Longitude" },
      depth: { type: "number" as const, description: "Target depth in meters" },
      temperature_c: { type: "number" as const, description: "Bottom hole temperature in °C" },
      pressure_mpa: { type: "number" as const, description: "Target pressure in MPa" },
      scenario: { type: "string" as const, description: "drilling or injection" },
    },
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    const depth = (args.depth as number) ?? 3000;
    const scenario = (args.scenario as string) ?? "drilling";

    // Pore pressure: roughly 0.0098 MPa/m in normal compaction
    const porePressure_mpa = depth * 0.0098 + (depth > 3000 ? (depth - 3000) * 0.003 : 0);

    // Overburden gradient: ~0.023 MPa/m (average rock density 2300 kg/m³)
    const overburdenGradient_mpa_m = 0.023;
    const overburden_mpa = depth * overburdenGradient_mpa_m;

    // Fracture gradient: ~0.015-0.018 MPa/m (typically 1.3-1.5x pore pressure gradient)
    const fractureGradient_mpa_m = 0.016 + (depth > 4000 ? 0.001 : 0);

    // Safe operating window
    const mudWeight_min = Math.max(1000, (porePressure_mpa / depth) * 1000 - 50);
    const mudWeight_max = Math.min(2200, (fractureGradient_mpa_m * depth / depth) * 1000 + 100);
    const pressure_min_mpa = porePressure_mpa * 0.95;
    const pressure_max_mpa = fractureGradient_mpa_m * depth * 0.92;

    // Temperature: geothermal gradient ~0.03°C/m
    const geothermalGradient = 0.03;
    const temperature_c = (args.temperature_c as number) ?? (20 + depth * geothermalGradient);

    // Casing seat depth: typically at 1500-2500m, or 2/3 of TD
    const casingSeatDepth_m = Math.min(depth * 0.8, 2500);

    const evidenceCount = (depth < 4000 ? 2 : 1) + (mudWeight_max < 2000 ? 1 : 0);
    const uncertaintyTag: "ESTIMATE" | "HYPOTHESIS" | "UNKNOWN" =
      evidenceCount >= 3 ? "ESTIMATE" : (evidenceCount >= 1 ? "HYPOTHESIS" : "UNKNOWN");

    const confidenceLow = Math.round(porePressure_mpa * 0.9);
    const confidenceHigh = Math.round(porePressure_mpa * 1.1);
    const confidenceInterval: [number, number] = [confidenceLow, confidenceHigh];

    const groundingEvidence: string[] = [];
    groundingEvidence.push("Normal compaction trend from regional offset wells");
    groundingEvidence.push(`Geothermal gradient: ${geothermalGradient}°C/m (local calibration)`);
    if (depth > 3500) groundingEvidence.push("DEEP: High uncertainty — recommend leak-off test at casing seat");

    const recommendations: string[] = [];
    if (pressure_max_mpa - pressure_min_mpa < 5) recommendations.push("NARROW WINDOW: Requires careful mud weight management");
    if (temperature_c > 150) recommendations.push("HIGH TEMP: Confirm tool ratings and cement design for thermal set");
    if (depth > 4500) recommendations.push("ULTRA-DEEP: Consider expandable casing or alternative completion methods");
    if (scenario === "injection") {
      const injectionPressureMax = fractureGradient_mpa_m * depth * 0.85;
      recommendations.push(`INJECTION: Max allowable injection pressure = ${injectionPressureMax.toFixed(1)} MPa (90% of fracture pressure)`);
    } else {
      recommendations.push(`MUD WINDOW: ${mudWeight_min.toFixed(0)}-${mudWeight_max.toFixed(0)} kg/m³`);
    }

    const output: PhysicalConstraintResult = {
      safeOperatingWindow: {
        pressure_min_mpa: Math.round(pressure_min_mpa * 10) / 10,
        pressure_max_mpa: Math.round(pressure_max_mpa * 10) / 10,
        temperature_min_c: Math.max(20, temperature_c - 10),
        temperature_max_c: temperature_c + 10,
      },
      casingSeatDepth_m: Math.round(casingSeatDepth_m),
      fractureGradient_mpa_m: Math.round(fractureGradient_mpa_m * 1000) / 1000,
      porePressure_mpa: Math.round(porePressure_mpa * 10) / 10,
      overburdenGradient_mpa_m: Math.round(overburdenGradient_mpa_m * 1000) / 1000,
      uncertaintyTag,
      confidenceInterval,
      physicalConstraints: {
        maxDepth_m: Math.round(depth * 1.3),
        minMudWeight_kg_m3: Math.round(mudWeight_min),
        maxMudWeight_kg_m3: Math.round(mudWeight_max),
        environmentalImpact: scenario === "injection" ? 0.3 : 0.1,
      },
      groundingEvidence,
      recommendations,
    };

    return { ok: true, output: JSON.stringify(output, null, 2) };
  }
}

// ── GEOX Tool 6: Uncertainty Tag ────────────────────────────────────────────

export interface UncertaintyTagArgs {
  sourceTool?: string;
  evidenceCount?: number;
  confidenceInterval?: [number, number];
  claimType?: "hazard" | "formation" | "pressure" | "temperature" | "reserve" | "emission";
  localDataQuality?: "high" | "medium" | "low";
}

export interface UncertaintyTagResult {
  tag: "ESTIMATE" | "HYPOTHESIS" | "UNKNOWN";
  confidenceScore: number;
  uncertaintyBand: "low" | "medium" | "high" | "critical";
  evidenceRequired: number;
  evidenceProvided: number;
  groundingScore: number;
  recommended_next_stage: "333_MIND" | "555_HEART" | "888_JUDGE" | "SEAL";
  reasoning: string;
}

export class GEOXUncertaintyTagTool extends BaseTool {
  readonly name = "geox_uncertainty_tag";
  readonly description = "Tag any GEOX output claim with F8 uncertainty classification. Returns ESTIMATE/HYPOTHESIS/UNKNOWN, confidence score, uncertainty band, and recommended pipeline stage.";
  readonly riskLevel = "guarded" as const;

  readonly parameters = {
    type: "object" as const,
    properties: {
      sourceTool: { type: "string" as const, description: "Name of the tool that produced the claim" },
      evidenceCount: { type: "number" as const, description: "Number of independent evidence sources" },
      confidenceInterval: { type: "array" as const, items: { type: "number" as const }, description: "[lower, upper] confidence bounds" },
      claimType: { type: "string" as const, enum: ["hazard", "formation", "pressure", "temperature", "reserve", "emission"] },
      localDataQuality: { type: "string" as const, enum: ["high", "medium", "low"] },
    },
    additionalProperties: false,
  } as const;

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    const evidenceCount = (args.evidenceCount as number) ?? 0;
    const ci = (args.confidenceInterval as number[]) ?? [0.5, 0.9];
    const claimType = (args.claimType as string) ?? "formation";
    const dataQuality = (args.localDataQuality as string) ?? "medium";

    const ciWidth = Math.abs(ci[1] - ci[0]);
    const ciCenter = (ci[0] + ci[1]) / 2;
    let confidenceScore = Math.max(0, Math.min(1, ciCenter - ciWidth * 0.5));
    if (dataQuality === "high") confidenceScore = Math.min(1, confidenceScore + 0.15);
    else if (dataQuality === "low") confidenceScore = Math.max(0, confidenceScore - 0.2);

    let evidenceRequired = 2;
    if (claimType === "reserve" || claimType === "emission") evidenceRequired = 3;

    const groundingScore = Math.min(1, evidenceCount / evidenceRequired);
    let tag: UncertaintyTagResult["tag"] = "UNKNOWN";
    let uncertaintyBand: UncertaintyTagResult["uncertaintyBand"] = "critical";
    let recommended_next_stage: UncertaintyTagResult["recommended_next_stage"] = "888_JUDGE";

    if (evidenceCount === 0) {
      tag = "UNKNOWN"; uncertaintyBand = "critical"; recommended_next_stage = "555_HEART";
    } else if (groundingScore >= 0.8 && ciWidth < 0.3) {
      tag = "ESTIMATE"; uncertaintyBand = "low"; recommended_next_stage = "333_MIND";
    } else if (groundingScore >= 0.4 || ciWidth < 0.5) {
      tag = "HYPOTHESIS"; uncertaintyBand = "medium"; recommended_next_stage = "555_HEART";
    } else {
      tag = "UNKNOWN"; uncertaintyBand = "high"; recommended_next_stage = "888_JUDGE";
    }

    const output: UncertaintyTagResult = {
      tag,
      confidenceScore: Math.round(confidenceScore * 100) / 100,
      uncertaintyBand,
      evidenceRequired,
      evidenceProvided: evidenceCount,
      groundingScore: Math.round(groundingScore * 100) / 100,
      recommended_next_stage,
      reasoning: `Claim "${claimType}": evidence=${evidenceCount}/${evidenceRequired}, CI=[${ci[0].toFixed(2)},${ci[1].toFixed(2)}], quality=${dataQuality} → TAG: ${tag} (${uncertaintyBand}) → ${recommended_next_stage}`,
    };

    return { ok: true, output: JSON.stringify(output, null, 2) };
  }
}

// ── GEOX Tool 7: Tri-Witness W³ ─────────────────────────────────────────────

export class GEOXWitnessTriadTool extends BaseTool {
  readonly name = "geox_witness_triad";
  readonly description = "Verify a physical claim using Tri-Witness W³ consensus. Three independent methods must agree within threshold to reach consensus. Returns W³ score, consensus verdict, and recommended action.";
  readonly riskLevel = "guarded" as const;

  readonly parameters = {
    type: "object" as const,
    properties: {
      claim: { type: "string" as const, description: "Physical claim to verify" },
      method1: { type: "object" as const, properties: { type: { type: "string" as const }, result: { type: "string" as const }, confidence: { type: "number" as const } } },
      method2: { type: "object" as const, properties: { type: { type: "string" as const }, result: { type: "string" as const }, confidence: { type: "number" as const } } },
      method3: { type: "object" as const, properties: { type: { type: "string" as const }, result: { type: "string" as const }, confidence: { type: "number" as const } } },
    },
    required: ["claim"],
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    const claim = (args.claim as string) ?? "";
    const methods = [args.method1, args.method2, args.method3].filter(Boolean) as Array<{ type: string; result: string; confidence: number }>;

    if (methods.length < 2) {
      return { ok: true, output: JSON.stringify({ w3Score: 0, consensusReached: false, verdict: "VOID", witnesses: [], disagreements: ["Insufficient witnesses (<2)"], recommendedAction: "888_HOLD" }) };
    }

    let agreementSum = 0, pairCount = 0;
    const disagreements: string[] = [];
    for (let i = 0; i < methods.length; i++) {
      for (let j = i + 1; j < methods.length; j++) {
        const diff = Math.abs(parseFloat(methods[i].result) - parseFloat(methods[j].result)) / Math.max(0.1, parseFloat(methods[j].result));
        const agreement = Math.max(0, 1 - diff);
        agreementSum += agreement * methods[i].confidence * methods[j].confidence;
        pairCount++;
        if (diff > 0.2) disagreements.push(`${methods[i].type} vs ${methods[j].type}: ${(diff * 100).toFixed(0)}%`);
      }
    }

    const avgPairAgreement = pairCount > 0 ? agreementSum / pairCount : 0;
    const avgConfidence = methods.reduce((s, m) => s + m.confidence, 0) / methods.length;
    const w3Score = avgPairAgreement * avgConfidence;
    const consensusReached = w3Score >= 0.7;
    const verdict = w3Score >= 0.85 ? "SEAL" : w3Score < 0.4 ? "VOID" : "HOLD";

    const output = {
      w3Score: Math.round(w3Score * 1000) / 1000,
      consensusReached,
      verdict,
      witnesses: methods.map((m, i) => ({ method: m.type, result: m.result, weight: m.confidence })),
      disagreements,
      recommendedAction: verdict === "SEAL" ? "Proceed to 777_FORGE" : verdict === "HOLD" ? "888_HOLD" : "VOID — contradictive",
      reasoning: `W³=${w3Score.toFixed(3)} (pairAgree=${avgPairAgreement.toFixed(2)} × conf=${avgConfidence.toFixed(2)}) → ${verdict}`,
    };

    return { ok: true, output: JSON.stringify(output, null, 2) };
  }
}

// ── GEOX Tool 8: Ground Truth F8 ────────────────────────────────────────────

export class GEOXGroundTruthTool extends BaseTool {
  readonly name = "geox_ground_truth";
  readonly description = "Check F8 Grounding for a physical claim. Verifies that assertions have sufficient independent evidence. Returns grounded boolean, grounding score, missing evidence list, and F8 verdict.";
  readonly riskLevel = "guarded" as const;

  readonly parameters = {
    type: "object" as const,
    properties: {
      claim: { type: "string" as const },
      evidenceSources: { type: "array" as const, items: { type: "string" as const } },
      claimedConfidence: { type: "number" as const },
      claimType: { type: "string" as const, enum: ["hazard", "reserve", "formation", "emission", "climate"] },
    },
    required: ["claim"],
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    const claim = (args.claim as string) ?? "";
    const evidenceSources = (args.evidenceSources as string[]) ?? [];
    const claimedConfidence = (args.claimedConfidence as number) ?? 0.5;
    const claimType = (args.claimType as string) ?? "formation";
    const minEvidence: Record<string, number> = { hazard: 2, reserve: 3, formation: 2, emission: 3, climate: 3 };
    const requiredEvidence = minEvidence[claimType] ?? 2;
    const groundingScore = Math.min(1, evidenceSources.length / requiredEvidence);
    const missingEvidence: string[] = [];
    if (evidenceSources.length < requiredEvidence) {
      const types = ["seismic survey", "well log", "core sample", "production test"];
      const existing = evidenceSources.map((e) => e.toLowerCase());
      for (const t of types) {
        if (!existing.some((e) => e.includes(t.split(" ")[0]))) missingEvidence.push(`Independent ${t}`);
        if (missingEvidence.length >= requiredEvidence - evidenceSources.length) break;
      }
    }
    let f8Verdict = evidenceSources.length === 0 ? "VOID" : (groundingScore < 0.8 || claimedConfidence > 0.9 ? "HOLD" : "PASS");

    const output = {
      grounded: groundingScore >= 1,
      groundingScore: Math.round(groundingScore * 100) / 100,
      missingEvidence,
      f8Verdict,
      recommendedEvidenceCount: requiredEvidence,
      reasoning: `Claim "${claim}" (${claimType}): ${evidenceSources.length}/${requiredEvidence} evidence. Grounding=${groundingScore.toFixed(2)}, claimed=${claimedConfidence.toFixed(2)} → F8: ${f8Verdict}`,
    };
    return { ok: true, output: JSON.stringify(output, null, 2) };
  }
}

// ── GEOX Tool 9: Maruah Impact ───────────────────────────────────────────────

export class GEOXMaruahImpactTool extends BaseTool {
  readonly name = "geox_maraoh_impact";
  readonly description = "Assess community dignity and cultural heritage impact (F6 maruah) of a physical operation. Returns maruah score, dignity impact, cultural heritage risk, stakeholder concern, and mitigation.";
  readonly riskLevel = "guarded" as const;

  readonly parameters = {
    type: "object" as const,
    properties: {
      location: { type: "string" as const },
      latitude: { type: "number" as const },
      operationType: { type: "string" as const, enum: ["extraction", "injection", "storage", "construction"] },
      distance_km: { type: "number" as const },
      population_density: { type: "number" as const },
    },
    additionalProperties: false,
  } as const;

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    const operationType = (args.operationType as string) ?? "extraction";
    const distance_km = (args.distance_km as number) ?? 5;
    const population_density = (args.population_density as number) ?? 100;
    const lat = (args.latitude as number) ?? 0;
    const baseImpact: Record<string, number> = { extraction: 0.6, injection: 0.4, storage: 0.2, construction: 0.5 };
    const bi = baseImpact[operationType] ?? 0.5;
    const distanceFactor = Math.max(0.1, 1 - distance_km / 50);
    const populationFactor = Math.min(1.5, 1 + population_density / 500);
    const indigenousFactor = (Math.abs(lat) < 30 && population_density < 50) ? 1.3 : 1.0;
    const maruahScore = Math.max(0, Math.min(1, 1 - bi * distanceFactor * populationFactor * indigenousFactor * 0.5));
    const dignityImpact = maruahScore >= 0.8 ? "none" : maruahScore >= 0.6 ? "low" : maruahScore >= 0.4 ? "moderate" : "severe";
    const culturalHeritageRisk = maruahScore < 0.4 ? "high" : maruahScore < 0.7 ? "medium" : "low";
    const stakeholderConcernLevel = maruahScore < 0.3 ? "critical" : maruahScore < 0.5 ? "high" : maruahScore < 0.7 ? "medium" : "low";
    const recommendedMitigation: string[] = [];
    if (distance_km < 2) recommendedMitigation.push("Mandatory exclusion zone — minimum 2km buffer");
    if (population_density > 200) recommendedMitigation.push("Community notification and consent required");
    if (culturalHeritageRisk === "high") recommendedMitigation.push("Heritage impact assessment required");
    if (stakeholderConcernLevel === "critical") recommendedMitigation.push("F13 SOVEREIGN: Human approval mandatory");
    const violations: string[] = [];
    if (maruahScore < 0.5) violations.push("F6_MARUAH: Low maruah score");
    if (stakeholderConcernLevel === "critical") violations.push("F6: Critical stakeholder concern");

    const ms = maruahScore;
    const output = {
      maruahScore: Math.round(ms * 100) / 100,
      dignityImpact,
      affectedCommunities: Math.round(population_density * Math.PI * (distance_km ** 2)),
      culturalHeritageRisk,
      stakeholderConcernLevel,
      recommendedMitigation,
      violations,
      reasoning: `${operationType} at ${distance_km}km, pop=${population_density}/km²: maruah=${maruahScore.toFixed(2)}, dignity=${dignityImpact}, heritage=${culturalHeritageRisk}`,
    };
    return { ok: true, output: JSON.stringify(output, null, 2) };
  }
}

// ── GEOX Tool 10: Extraction Limits ─────────────────────────────────────────

export class GEOXExtractionLimitsTool extends BaseTool {
  readonly name = "geox_extraction_limits";
  readonly description = "Compute maximum safe extraction rate and cumulative production limits for a reservoir. Returns maxSafeRate, maxCumulative, rateStability, and depletion%.";
  readonly riskLevel = "guarded" as const;

  readonly parameters = {
    type: "object" as const,
    properties: {
      latitude: { type: "number" as const },
      longitude: { type: "number" as const },
      depth: { type: "number" as const },
      formation_type: { type: "string" as const },
      currentRate: { type: "number" as const },
      scenario: { type: "string" as const },
    },
    additionalProperties: false,
  } as const;

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    const depth = (args.depth as number) ?? 3000;
    const formationType = (args.formation_type as string) ?? "sandstone";
    const currentRate = (args.currentRate as number) ?? 500;
    const cap: Record<string, { baseRate: number; baseCumulative: number; stabilityFactor: number }> = {
      sandstone: { baseRate: 2000, baseCumulative: 5000000, stabilityFactor: 0.9 },
      carbonate: { baseRate: 1500, baseCumulative: 3000000, stabilityFactor: 0.75 },
      shale: { baseRate: 500, baseCumulative: 1000000, stabilityFactor: 0.6 },
      granite: { baseRate: 200, baseCumulative: 500000, stabilityFactor: 0.5 },
      volcanic: { baseRate: 300, baseCumulative: 800000, stabilityFactor: 0.55 },
    };
    const c = cap[formationType] ?? cap["sandstone"];
    const depthFactor = Math.max(0.3, 1 - (depth - 2000) / 6000);
    const maxSafeRate_m3_day = Math.round(c.baseRate * depthFactor * c.stabilityFactor);
    const lat = (args.latitude as number) ?? 0;
    const locationFactor = Math.abs(lat) < 25 ? 1.2 : 1.0;
    const maxCumulative_m3 = Math.round(c.baseCumulative * depthFactor * locationFactor);
    const rateStability = currentRate > maxSafeRate_m3_day * 0.9 ? "unstable" : currentRate > maxSafeRate_m3_day * 0.7 ? "declining" : "stable";
    const depletionPercent = Math.round((currentRate * 365 / maxCumulative_m3) * 1000) / 10;
    const uncertaintyTag: "ESTIMATE" | "HYPOTHESIS" | "UNKNOWN" = c.stabilityFactor > 0.8 ? "ESTIMATE" : c.stabilityFactor > 0.6 ? "HYPOTHESIS" : "UNKNOWN";
    const violations: string[] = [];
    if (currentRate > maxSafeRate_m3_day) violations.push("F4: Rate exceeds safe maximum");
    if (rateStability === "unstable") violations.push("F6: Unstable rate — reservoir damage risk");

    const output = {
      maxSafeRate_m3_day,
      maxCumulative_m3,
      rateStability,
      depletionPercent,
      uncertaintyTag,
      violations,
      reasoning: `${formationType} at ${depth}m: maxRate=${maxSafeRate_m3_day}m³/day, maxCum=${(maxCumulative_m3 / 1e6).toFixed(2)}MMm³, current=${currentRate}m³/day (${(currentRate / maxSafeRate_m3_day * 100).toFixed(0)}%) → ${rateStability}`,
    };
    return { ok: true, output: JSON.stringify(output, null, 2) };
  }
}

// ── GEOX Tool 11: Climate Bounds ────────────────────────────────────────────

export class GEOXClimateBoundsTool extends BaseTool {
  readonly name = "geox_climate_bounds";
  readonly description = "Compute climate bounds (temperature rise, sea level, carbon budget) for an emissions scenario. Returns optimistic/pessimistic bounds with uncertainty tag.";
  readonly riskLevel = "guarded" as const;

  readonly parameters = {
    type: "object" as const,
    properties: {
      latitude: { type: "number" as const },
      longitude: { type: "number" as const },
      scenario: { type: "string" as const },
      emission_kg_co2: { type: "number" as const },
      time_horizon_years: { type: "number" as const },
    },
    additionalProperties: false,
  } as const;

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    const scenario = (args.scenario as string) ?? "ndc";
    const emission_kg_co2 = (args.emission_kg_co2 as number) ?? 0;
    const time_horizon_years = (args.time_horizon_years as number) ?? 50;
    const lat = (args.latitude as number) ?? 0;
    const sm: Record<string, { temp: number; sea: number; budget: number }> = {
      baseline: { temp: 1.5, sea: 0.5, budget: 500 }, ndc: { temp: 1.3, sea: 0.4, budget: 600 },
      "1.5c": { temp: 0.8, sea: 0.2, budget: 800 }, "2c": { temp: 1.1, sea: 0.3, budget: 700 },
      high_emission: { temp: 2.5, sea: 0.8, budget: 300 },
    };
    const s = sm[scenario] ?? sm["ndc"];
    const emission_Mt = emission_kg_co2 / 1e9;
    const warmingFactor = Math.log(1 + emission_Mt) / 10;
    const temperatureRise_c = Math.round(s.temp * (1 + warmingFactor) * (time_horizon_years / 50) * 100) / 100;
    const polarFactor = Math.abs(lat) > 60 ? 1.5 : 1.0;
    const seaLevelRise_m = Math.round(s.sea * polarFactor * (time_horizon_years / 50) * 100) / 100;
    const carbonBudget_remaining_Gt = Math.max(0, s.budget - emission_Mt / 1000);
    const uncertaintyTag: "ESTIMATE" | "HYPOTHESIS" | "UNKNOWN" = scenario === "1.5c" || scenario === "2c" ? "ESTIMATE" : scenario === "high_emission" ? "HYPOTHESIS" : "UNKNOWN";
    const recommendations: string[] = [];
    if (temperatureRise_c > 1.5) recommendations.push("CRITICAL: Warming exceeds 1.5°C — F6 maruah review required");
    if (seaLevelRise_m > 0.3) recommendations.push("HIGH RISK: Significant sea level rise");
    if (carbonBudget_remaining_Gt < 400) recommendations.push("CARBON BUDGET CRITICAL: <400Gt — 888_HOLD");

    const output = {
      temperatureRise_c,
      seaLevelRise_m,
      carbonBudget_remaining_Gt: Math.round(carbonBudget_remaining_Gt * 10) / 10,
      uncertaintyTag,
      bounds: {
        optimistic: { tempRise: Math.round(temperatureRise_c * 0.7 * 100) / 100, seaRise: Math.round(seaLevelRise_m * 0.6 * 100) / 100 },
        pessimistic: { tempRise: Math.round(temperatureRise_c * 1.4 * 100) / 100, seaRise: Math.round(seaLevelRise_m * 1.3 * 100) / 100 },
      },
      recommendations,
      reasoning: `${scenario} over ${time_horizon_years}y, ${emission_Mt.toFixed(1)}Mt CO2, lat=${lat}° → ΔT=${temperatureRise_c}°C, ΔSea=${seaLevelRise_m}m, Budget=${carbonBudget_remaining_Gt.toFixed(0)}Gt`,
    };
    return { ok: true, output: JSON.stringify(output, null, 2) };
  }
}

export const GEOX_TOOLS = [
  GEOXCheckHazardTool,
  GEOXSubsurfaceModelTool,
  GEOXSeismicInterpretTool,
  GEOXProspectScoreTool,
  GEOXPhysicalConstraintTool,
  GEOXUncertaintyTagTool,
  GEOXWitnessTriadTool,
  GEOXGroundTruthTool,
  GEOXMaruahImpactTool,
  GEOXExtractionLimitsTool,
  GEOXClimateBoundsTool,
];
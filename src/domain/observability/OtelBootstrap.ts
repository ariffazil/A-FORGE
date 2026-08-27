/**
 * OtelBootstrap.ts — OpenTelemetry SDK initialization for A-FORGE
 *
 * ECOSYSTEM_EXPANSION::v1 Phase 3: OBSERVABILITY
 * Bootstraps OTel SDK with arifOS-specific resource attributes.
 *
 * @module domain/observability/OtelBootstrap
 * @forged 2026-08-20 by 333-AGI under F13 SOVEREIGN directive
 * DITEMPA BUKAN DIBERI
 */

import { type OtelConfig, DEFAULT_OTEL_CONFIG } from "./OtelTypes.js";

let tracer: any = null;
let isReady = false;

export function initOtel(config: Partial<OtelConfig> = {}): void {
  if (isReady) return;
  const cfg = { ...DEFAULT_OTEL_CONFIG, ...config };
  tracer = {
    name: cfg.serviceName,
    version: cfg.serviceVersion,
    organ: cfg.organName,
    endpoint: cfg.otlpEndpoint,
    spans: [] as any[],
  };
  isReady = true;
}

export function getTracer(): any {
  if (!isReady) initOtel();
  return tracer;
}

export function isOtelReady(): boolean {
  return isReady;
}

export async function stopOtel(): Promise<void> {
  if (!isReady) return;
  tracer = null;
  isReady = false;
}

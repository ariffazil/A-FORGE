/**
 * GEOX Error Envelope — Reference Implementation
 * 
 * Shows how GEOX tools use the shared ErrorClassifier to return
 * structured, self-describing errors that agents can recover from.
 * 
 * Every organ should follow this pattern:
 *   1. Import error builders from error-classifier.ts
 *   2. Wrap try/catch in structured envelopes
 *   3. Include context: what field, what organ, what action
 * 
 * FORGED: 2026-07-03
 */

import {
  badInputShape,
  badInputValue,
  missingRequiredField,
  downstreamFailure,
  downstreamParserFail,
  resourceExhausted,
  internalError,
  authorityBlock,
  floorBlock,
  classifyUnknown,
  type MCPStructuredError,
} from '../governance/error-classifier.js';

// ─── GEOX-Specific Error Builders ──────────────────────────────────

export function missingWellName(): MCPStructuredError {
  return badInputShape('well_name is required for well log operations', {
    missing_fields: ['well_name'],
    source_tool: 'geox_well_ingest',
    source_organ: 'geox',
  });
}

export function invalidLASPath(path: string): MCPStructuredError {
  return badInputValue('LAS file path is invalid or file not found', {
    invalid_fields: [{ field: 'las_path', expected: 'valid file path', got: path }],
    source_tool: 'geox_well_ingest',
    source_organ: 'geox',
  });
}

export function seismicVolumeUnavailable(volumeRef: string): MCPStructuredError {
  return downstreamFailure(`Seismic volume '${volumeRef}' could not be loaded`, {
    original_error: 'Volume file not found or corrupted SEG-Y header',
    source_tool: 'geox_seismic_compute',
    source_organ: 'geox',
    can_retry: false,
  });
}

export function basinResolutionTimeout(basinName: string): MCPStructuredError {
  return resourceExhausted(`Basin resolution for '${basinName}' timed out`, {
    resource_type: 'timeout',
    retry_after_ms: 30_000,
    source_tool: 'geox_basin',
    source_organ: 'geox',
  });
}

export function petrophysicsCalculationError(
  wellName: string,
  formula: string,
  originalError: unknown
): MCPStructuredError {
  return internalError(
    `Petrophysics calculation failed for well '${wellName}' in formula '${formula}'`,
    {
      original_error: originalError instanceof Error ? originalError.message : String(originalError),
      source_tool: 'geox_petrophysics',
      source_organ: 'geox',
    }
  );
}

export function invalidDepthRange(top: number, base: number): MCPStructuredError {
  return badInputValue('Depth range is invalid: top must be less than base', {
    invalid_fields: [
      { field: 'zone_top', expected: 'number < zone_base', got: String(top) },
      { field: 'zone_base', expected: 'number > zone_top', got: String(base) },
    ],
    source_tool: 'geox_sequence',
    source_organ: 'geox',
  });
}

export function dataSourceTimeout(source: string): MCPStructuredError {
  return resourceExhausted(`External data source '${source}' timed out`, {
    resource_type: 'timeout',
    retry_after_ms: 60_000,
    source_tool: 'geox_evidence',
    source_organ: 'geox',
  });
}

// ─── New GEOX Error Builders (wired to new error classes) ──────────

export function missingSourceUri(toolName: string): MCPStructuredError {
  return missingRequiredField('source_uri is required for this operation', {
    missing_fields: ['source_uri'],
    source_tool: toolName,
    source_organ: 'geox',
  });
}

export function segyParseFailure(filePath: string, originalError: unknown): MCPStructuredError {
  return downstreamParserFail(`Failed to parse SEG-Y file: ${filePath}`, {
    parser_name: 'SEG-Y',
    original_error: originalError instanceof Error ? originalError.message : String(originalError),
    source_tool: 'geox_seismic_ingest',
    source_organ: 'geox',
    can_retry: false,
  });
}

export function dstParseFailure(filePath: string, originalError: unknown): MCPStructuredError {
  return downstreamParserFail(`Failed to parse DST file: ${filePath}`, {
    parser_name: 'DST',
    original_error: originalError instanceof Error ? originalError.message : String(originalError),
    source_tool: 'geox_well_ingest',
    source_organ: 'geox',
    can_retry: false,
  });
}

export function authorityBlocked(toolName: string, reason: string): MCPStructuredError {
  return authorityBlock(`Authority blocked for ${toolName}: ${reason}`, {
    source_tool: toolName,
    source_organ: 'geox',
  });
}

export function floorViolation(toolName: string, floors: string[]): MCPStructuredError {
  return floorBlock(`Constitutional floor violation in ${toolName}`, {
    violated_floors: floors,
    source_tool: toolName,
    source_organ: 'geox',
  });
}

// ─── Generic GEOX Error Wrapper ────────────────────────────────────

/**
 * Wrap any GEOX tool execution in a try/catch that returns structured errors.
 * Use this pattern in every GEOX tool handler.
 * 
 * @example
 * ```ts
 * async function geox_well_ingest(args: { well_name?: string; las_path?: string }) {
 *   return geoxErrorWrap('geox_well_ingest', async () => {
 *     if (!args.well_name) throw new GEOXError('MISSING_WELL_NAME');
 *     // ... actual logic
 *   });
 * }
 * ```
 */
export async function geoxErrorWrap(
  toolName: string,
  fn: () => Promise<unknown>
): Promise<unknown> {
  try {
    return await fn();
  } catch (err) {
    // If it's already a structured error, re-throw
    if (err && typeof err === 'object' && 'isError' in err && (err as any).isError === true) {
      return err;
    }

    // Classify unknown errors with GEOX context
    return classifyUnknown(err, {
      source_tool: toolName,
      source_organ: 'geox',
    });
  }
}

// ─── GEOX Error Types (for throwing within GEOX) ──────────────────

export type GEOXErrorCode =
  | 'MISSING_WELL_NAME'
  | 'INVALID_LAS_PATH'
  | 'INVALID_DEPTH_RANGE'
  | 'VOLUME_UNAVAILABLE'
  | 'BASIN_TIMEOUT'
  | 'PETROPHYSICS_CALC_FAILED'
  | 'DATA_SOURCE_TIMEOUT'
  | 'MISSING_SOURCE'
  | 'MISSING_SOURCE_URI'
  | 'PARSER_FAILED'
  | 'SEGY_PARSE_FAILED'
  | 'DST_PARSE_FAILED'
  | 'ROUTER_DROPPED'
  | 'AUTHORITY_BLOCKED'
  | 'FLOOR_VIOLATION';

export class GEOXError extends Error {
  code: GEOXErrorCode;
  context?: Record<string, unknown>;

  constructor(code: GEOXErrorCode, context?: Record<string, unknown>) {
    super(code);
    this.code = code;
    this.context = context;
    this.name = 'GEOXError';
  }

  toStructuredError(): MCPStructuredError {
    switch (this.code) {
      case 'MISSING_WELL_NAME':
        return missingWellName();
      case 'INVALID_LAS_PATH':
        return invalidLASPath((this.context?.path as string) ?? 'unknown');
      case 'INVALID_DEPTH_RANGE':
        return invalidDepthRange(
          (this.context?.top as number) ?? 0,
          (this.context?.base as number) ?? 0
        );
      case 'VOLUME_UNAVAILABLE':
        return seismicVolumeUnavailable((this.context?.volume_ref as string) ?? 'unknown');
      case 'BASIN_TIMEOUT':
        return basinResolutionTimeout((this.context?.basin_name as string) ?? 'unknown');
      case 'PETROPHYSICS_CALC_FAILED':
        return petrophysicsCalculationError(
          (this.context?.well_name as string) ?? 'unknown',
          (this.context?.formula as string) ?? 'unknown',
          this.context?.original_error
        );
      case 'DATA_SOURCE_TIMEOUT':
        return dataSourceTimeout((this.context?.source as string) ?? 'unknown');
      case 'MISSING_SOURCE':
        return badInputShape('source_uri is required', {
          missing_fields: ['source_uri'],
          source_tool: this.context?.tool as string,
          source_organ: 'geox',
        });
      case 'MISSING_SOURCE_URI':
        return missingSourceUri((this.context?.tool as string) ?? 'geox_unknown');
      case 'PARSER_FAILED':
        return downstreamFailure('Parser failed to process input file', {
          original_error: this.context?.error as string,
          source_tool: this.context?.tool as string,
          source_organ: 'geox',
        });
      case 'SEGY_PARSE_FAILED':
        return segyParseFailure(
          (this.context?.path as string) ?? 'unknown',
          this.context?.original_error ?? 'unknown'
        );
      case 'DST_PARSE_FAILED':
        return dstParseFailure(
          (this.context?.path as string) ?? 'unknown',
          this.context?.original_error ?? 'unknown'
        );
      case 'ROUTER_DROPPED':
        return downstreamFailure('Request was dropped by the MCP router', {
          source_tool: this.context?.tool as string,
          source_organ: 'geox',
          can_retry: true,
        });
      case 'AUTHORITY_BLOCKED':
        return authorityBlocked(
          (this.context?.tool as string) ?? 'geox_unknown',
          (this.context?.reason as string) ?? 'no lease or authority'
        );
      case 'FLOOR_VIOLATION':
        return floorViolation(
          (this.context?.tool as string) ?? 'geox_unknown',
          (this.context?.floors as string[]) ?? []
        );
      default:
        return internalError(`Unknown GEOX error: ${this.code}`, {
          source_organ: 'geox',
        });
    }
  }
}

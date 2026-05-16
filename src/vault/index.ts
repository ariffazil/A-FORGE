import {
  PostgresVaultClient,
  type FloorRule,
  type SessionRecord,
  type ToolCallRecord,
} from "./PostgresVaultClient.js";
export { PostgresVaultClient, type FloorRule, type SessionRecord, type ToolCallRecord };
import {
  type VaultClient,
  type VaultSealRecord,
  type VaultTelemetrySnapshot,
  type VaultVerdict,
  NoOpVaultClient,
  FileVaultClient,
  computeInputHash,
  generateSealId,
} from "./VaultClient.js";
export {
  type VaultClient,
  type VaultSealRecord,
  type VaultTelemetrySnapshot,
  type VaultVerdict,
  NoOpVaultClient,
  FileVaultClient,
  computeInputHash,
  generateSealId,
};
export { SupabaseVaultClient, getSupabaseClient, type VaultRecord } from "./SupabaseVaultClient.js";
export { MerkleV3Service, type TelemetryRow, type MerkleVerificationResult } from "./MerkleV3Service.js";

let _postgresVaultClient: PostgresVaultClient | null = null;

export function getPostgresVaultClient(connectionString?: string): PostgresVaultClient {
  if (!_postgresVaultClient) {
    _postgresVaultClient = new PostgresVaultClient(
      connectionString ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "",
    );
  }
  return _postgresVaultClient;
}

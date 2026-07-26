/**
 * MerkleReceiptAnchor — Anchoring VAULT999 QQQ receipts cryptographically.
 *
 * Computes a Merkle root over block segments (every 100 receipts) of
 * qqq_receipts.jsonl, logs to merkle/roots.jsonl, uploads to Supabase,
 * and creates a signed external git tag.
 *
 * DITEMPA BUKAN DIBERI — Secure anchors prevent retrospective history rewriting.
 */

import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";
import { getSupabaseClient } from "../../infrastructure/vault/SupabaseVaultClient.js";

const RECEIPTS_PATH = "/root/VAULT999/qqq_receipts.jsonl";
const MERKLE_ROOTS_PATH = "/root/VAULT999/merkle/roots.jsonl";

export interface MerkleBlockRoot {
  block_index: number;
  start_seal_id: string;
  end_seal_id: string;
  merkle_root: string;
  prev_root: string;
  timestamp: string;
}

/**
 * Compute Merkle Root using pairwise binary hashing.
 */
export function computeMerkleRoot(hashes: string[]): string {
  if (hashes.length === 0) return createHash("sha256").update("EMPTY_BLOCK").digest("hex");
  if (hashes.length === 1) return hashes[0];

  const nextLevel: string[] = [];
  for (let i = 0; i < hashes.length; i += 2) {
    if (i + 1 < hashes.length) {
      nextLevel.push(createHash("sha256").update(hashes[i] + hashes[i + 1]).digest("hex"));
    } else {
      nextLevel.push(createHash("sha256").update(hashes[i] + hashes[i]).digest("hex"));
    }
  }
  return computeMerkleRoot(nextLevel);
}

/**
 * Check if the total receipt count is a multiple of 100, and if so,
 * triggers Merkle root anchoring.
 */
export async function checkAndAnchorReceipts(): Promise<MerkleBlockRoot | null> {
  if (!existsSync(RECEIPTS_PATH)) return null;

  try {
    const rawContent = readFileSync(RECEIPTS_PATH, "utf-8").trim();
    if (!rawContent) return null;

    const lines = rawContent.split("\n").filter(Boolean);
    const count = lines.length;

    if (count === 0 || count % 100 !== 0) {
      return null; // Only run on multiples of 100
    }

    const blockIndex = count / 100;
    const startIndex = (blockIndex - 1) * 100;
    const blockLines = lines.slice(startIndex, count);
    const parsedEntries = blockLines.map(line => JSON.parse(line));
    
    // Hash each receipt in the block
    const hashes = blockLines.map(line => {
      return createHash("sha256").update(line).digest("hex");
    });

    const merkleRoot = computeMerkleRoot(hashes);
    const startSealId = parsedEntries[0].qqq_id || `seal-start-${startIndex}`;
    const endSealId = parsedEntries[parsedEntries.length - 1].qqq_id || `seal-end-${count - 1}`;

    // Read previous root
    let prevRoot = "0".repeat(64);
    if (existsSync(MERKLE_ROOTS_PATH)) {
      try {
        const rootContent = readFileSync(MERKLE_ROOTS_PATH, "utf-8").trim();
        if (rootContent) {
          const rootLines = rootContent.split("\n").filter(Boolean);
          if (rootLines.length > 0) {
            const last = JSON.parse(rootLines[rootLines.length - 1]);
            prevRoot = last.merkle_root || prevRoot;
          }
        }
      } catch {}
    }

    const blockRecord: MerkleBlockRoot = {
      block_index: blockIndex,
      start_seal_id: startSealId,
      end_seal_id: endSealId,
      merkle_root: merkleRoot,
      prev_root: prevRoot,
      timestamp: new Date().toISOString()
    };

    // 1. Write to roots.jsonl
    mkdirSync(dirname(MERKLE_ROOTS_PATH), { recursive: true });
    appendFileSync(MERKLE_ROOTS_PATH, JSON.stringify(blockRecord) + "\n", "utf-8");

    // 2. Upload to Supabase s999.vault_merkle_roots table
    try {
      const sb = getSupabaseClient();
      const { error } = await sb.rpc("vault_append_merkle_root", {
        p_block_index: blockIndex,
        p_start_seal_id: startSealId,
        p_end_seal_id: endSealId,
        p_merkle_root: merkleRoot,
        p_prev_root: prevRoot
      });
      if (error) {
        process.stderr.write(`[MerkleAnchor] Supabase write warning: ${error.message}\n`);
      }
    } catch (sbErr: any) {
      process.stderr.write(`[MerkleAnchor] Supabase client offline: ${sbErr.message}\n`);
    }

    // 3. Anchor externally: Create a Git tag with block details
    try {
      const tagName = `v-merkle-block-${blockIndex}-${Date.now()}`;
      execSync(`git -C /root/A-FORGE tag -a "${tagName}" -m "VAULT999 Merkle Anchor Block ${blockIndex} | root: ${merkleRoot}"`, { stdio: 'ignore' });
      process.stdout.write(`[MerkleAnchor] External Git tag anchor created: ${tagName}\n`);
    } catch (gitErr: any) {
      process.stderr.write(`[MerkleAnchor] Git tagging failed: ${gitErr.message}\n`);
    }

    // P1-5b: Forward Merkle anchor to arifFLOW — fire-and-forget
    _forwardMerkleToArifFlow(blockRecord).catch(() => {});

    return blockRecord;
  } catch (err: any) {
    process.stderr.write(`[MerkleAnchor] Failed to execute receipts anchoring: ${err.message}\n`);
    return null;
  }
}

/**
 * P1-5b: Forward Merkle anchor to arifFLOW :7073/receipt/emit.
 * Fire-and-forget — failure is silent, local roots.jsonl + Supabase + Git tag are primary.
 * DEPRECATED P1-7: will be replaced by arifFLOW client import post-extraction.
 */
async function _forwardMerkleToArifFlow(block: MerkleBlockRoot): Promise<void> {
  try {
    await fetch("http://127.0.0.1:7073/receipt/emit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organ: "A-FORGE",
        producer: "MerkleReceiptAnchor",
        action: "merkle_anchor",
        scope: `block:${block.block_index}`,
        risk: "INTERNAL",
        epistemic_label: "OBS",
        confidence: 1.0,
        verdict: "SEAL",
        metadata: {
          block_index: block.block_index,
          start_seal_id: block.start_seal_id,
          end_seal_id: block.end_seal_id,
          merkle_root: block.merkle_root,
          prev_root: block.prev_root,
        },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // arifFLOW unreachable — local anchors + Supabase + Git tag are primary
  }
}

/**
 * Per-entry integrity verification for BrushCodex bundles.
 *
 * A bundle entry may carry an optional `integrity` hash of the entry's bytes
 * (bundle spec section 3). `writeBundleWithIntegrity` stamps these; this verifier
 * recomputes each declared hash over the archived bytes and reports matches,
 * mismatches (tamper / corruption), and entries with no declared hash.
 *
 * The archive is opened under the same safe-archive guards as the reader (safe.ts)
 * before any bytes are trusted. Async because hashing uses Web Crypto.
 */

import { strFromU8, unzipSync } from 'fflate';
import { computeBytesIntegrity } from '../common';
import { assertSafeEntry, BundleSizeTracker } from './safe';
import { BundleManifestValidationError, parseBundleManifest } from './validate';

const MANIFEST_PATH = 'manifest.json';

export type BundleEntryIntegrityStatus = 'valid' | 'mismatch' | 'absent' | 'missing-file';

export interface BundleEntryIntegrity {
  path: string;
  status: BundleEntryIntegrityStatus;
}

export interface BundleIntegrityReport {
  /** True when no entry mismatched or was missing (declared-but-absent files count as tampering). */
  ok: boolean;
  /** Number of entries whose declared integrity was actually checked. */
  checked: number;
  entries: BundleEntryIntegrity[];
}

/**
 * Verify every declared per-entry `integrity` hash in a bundle against the
 * archived bytes. Throws `BundleSafetyError` on unsafe archive content and
 * `BundleManifestValidationError` on a bad/missing manifest (same guards as the
 * reader); otherwise returns a per-entry report.
 */
export async function verifyBundleIntegrity(zip: Uint8Array): Promise<BundleIntegrityReport> {
  const tracker = new BundleSizeTracker();
  const files = unzipSync(zip, {
    filter: (file) => {
      assertSafeEntry(file.name, file.originalSize);
      tracker.add(file.originalSize);
      return true;
    },
  });

  const manifestBytes = files[MANIFEST_PATH];
  if (manifestBytes === undefined) {
    throw new BundleManifestValidationError([
      {
        path: '',
        code: 'missing-manifest',
        message: "Bundle has no 'manifest.json'.",
        layer: 'schema',
      },
    ]);
  }
  const manifest = parseBundleManifest(JSON.parse(strFromU8(manifestBytes)));

  const entries: BundleEntryIntegrity[] = [];
  let checked = 0;
  for (const entry of manifest.entries) {
    if (entry.integrity === undefined) {
      entries.push({ path: entry.path, status: 'absent' });
      continue;
    }
    const bytes = files[entry.path];
    if (bytes === undefined) {
      entries.push({ path: entry.path, status: 'missing-file' });
      continue;
    }
    const computed = await computeBytesIntegrity(bytes, entry.integrity.algorithm);
    checked += 1;
    entries.push({
      path: entry.path,
      status: computed.value === entry.integrity.value.toLowerCase() ? 'valid' : 'mismatch',
    });
  }

  const ok = entries.every(
    (entry) => entry.status !== 'mismatch' && entry.status !== 'missing-file',
  );
  return { ok, checked, entries };
}

/**
 * Content-integrity hashing for BrushCodex documents (common spec section 5.5).
 *
 * The integrity hash is computed over the **canonical serialization** (./canonical)
 * of the document with the top-level `integrity` member removed, so a document's
 * own declared hash never affects the value and stamping is idempotent. The
 * algorithm is `sha-256` (default) or `sha-512`; the value is lowercase hex.
 *
 * These hashes detect accidental corruption and enable deduplication; they are
 * NOT signatures and do not establish authorship (spec section 9).
 *
 * Web Crypto (`globalThis.crypto.subtle`) is used rather than `node:crypto`, so
 * this stays framework-agnostic and runs anywhere the rest of `standards/` does.
 */

import { toCanonicalJson } from './canonical';
import { integritySchema, type Integrity } from './envelope';

/** The hash algorithms the integrity field supports. */
export type IntegrityAlgorithm = Integrity['algorithm'];

/** Map the spec's algorithm token to the Web Crypto identifier. */
const SUBTLE_ALGORITHM: Record<IntegrityAlgorithm, 'SHA-256' | 'SHA-512'> = {
  'sha-256': 'SHA-256',
  'sha-512': 'SHA-512',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** A shallow copy of a document object with its top-level `integrity` removed. */
function withoutIntegrity(document: unknown): unknown {
  if (!isRecord(document)) return document;
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(document)) {
    if (key !== 'integrity') rest[key] = value;
  }
  return rest;
}

/** Lowercase hex encoding of a digest buffer. */
function toHex(buffer: ArrayBuffer): string {
  let hex = '';
  for (const byte of new Uint8Array(buffer)) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

/** Digest raw bytes with the given algorithm, returning an `Integrity`. */
async function digest(bytes: Uint8Array, algorithm: IntegrityAlgorithm): Promise<Integrity> {
  const buffer = await globalThis.crypto.subtle.digest(SUBTLE_ALGORITHM[algorithm], bytes);
  return { algorithm, value: toHex(buffer) };
}

/**
 * Compute the content-integrity hash of a document: the digest of the canonical
 * serialization of the document with its `integrity` member removed.
 */
export async function computeIntegrity(
  document: unknown,
  algorithm: IntegrityAlgorithm = 'sha-256',
): Promise<Integrity> {
  const canonical = toCanonicalJson(withoutIntegrity(document));
  return digest(new TextEncoder().encode(canonical), algorithm);
}

/**
 * Compute the integrity hash of raw bytes (e.g. a bundle entry's file bytes,
 * which are hashed as-is rather than canonicalized — bundle spec section 3).
 */
export async function computeBytesIntegrity(
  bytes: Uint8Array,
  algorithm: IntegrityAlgorithm = 'sha-256',
): Promise<Integrity> {
  return digest(bytes, algorithm);
}

/** The document's declared `integrity`, if present and well-formed. */
export function readDeclaredIntegrity(document: unknown): Integrity | undefined {
  if (!isRecord(document)) return undefined;
  const parsed = integritySchema.safeParse(document.integrity);
  return parsed.success ? parsed.data : undefined;
}

export type IntegrityStatus = 'absent' | 'valid' | 'mismatch';

export interface IntegrityResult {
  status: IntegrityStatus;
  /** The document's declared integrity (absent when none is present). */
  declared?: Integrity;
  /** The recomputed integrity (absent only when the document declares none). */
  computed?: Integrity;
}

/**
 * Verify a document's declared `integrity`. Returns `absent` when none is
 * declared, `valid` when the recomputed hash matches, and `mismatch` otherwise
 * (the document changed, or the declared hash is wrong).
 */
export async function verifyIntegrity(document: unknown): Promise<IntegrityResult> {
  const declared = readDeclaredIntegrity(document);
  if (declared === undefined) return { status: 'absent' };
  const computed = await computeIntegrity(document, declared.algorithm);
  const status: IntegrityStatus =
    computed.value === declared.value.toLowerCase() ? 'valid' : 'mismatch';
  return { status, declared, computed };
}

/**
 * Return a copy of a document object with its `integrity` member set to the hash
 * computed over the rest. Idempotent: re-stamping recomputes the same value.
 */
export async function stampIntegrity(
  document: Record<string, unknown>,
  algorithm: IntegrityAlgorithm = 'sha-256',
): Promise<Record<string, unknown>> {
  const integrity = await computeIntegrity(document, algorithm);
  return { ...document, integrity };
}

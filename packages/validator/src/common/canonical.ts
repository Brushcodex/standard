/**
 * Canonical serialization and loss-free round-tripping for Common documents.
 *
 * The canonical form (spec §7) is JSON with object members sorted lexicographically
 * by key (default UTF-16 code-unit order), arrays left in document order, and no
 * insignificant whitespace. It underpins hashing, deduplication, stable diffing,
 * and the `parse -> serialize -> parse` round-trip guarantee: every supported
 * member and every unknown namespaced extension survives unchanged.
 */

import { commonDocumentSchema, type CommonDocument } from './envelope';
import { parseCommonDocument } from './validate';

/** Recursively sort object keys so serialization is deterministic. */
function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      sorted[key] = sortValue(source[key]);
    }
    return sorted;
  }
  return value;
}

/** Produce the canonical JSON string for any JSON-compatible value. */
export function toCanonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

/** Serialize a document to its canonical JSON string. */
export function serializeCommonDocument(doc: CommonDocument): string {
  return toCanonicalJson(doc);
}

/**
 * Normalize a document to canonical order without dropping any supported member
 * or unknown extension. Idempotent: `normalize(normalize(x)) === normalize(x)`.
 */
export function normalizeCommonDocument(doc: CommonDocument): CommonDocument {
  return commonDocumentSchema.parse(JSON.parse(toCanonicalJson(doc)));
}

/**
 * Full round trip from a serialized document: validate + parse, then re-serialize
 * canonically. Returns both the typed document and its canonical string, proving
 * the format is stable under `parse -> serialize`.
 */
export function roundTripCommonDocument(input: unknown): {
  document: CommonDocument;
  canonical: string;
} {
  const document = parseCommonDocument(input);
  return { document, canonical: serializeCommonDocument(document) };
}

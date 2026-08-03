/**
 * Identity and revision minting for document authoring (common spec §4).
 *
 * The normative envelope requires an `id` that is a stable, globally unique
 * **absolute URI** and MUST NOT require a central registry — so the default is a
 * `urn:uuid:` URI, which any producer can mint offline. `revision` is a non-empty
 * **opaque** token naming one exact document state; the default mirrors the
 * timestamped form used across the example corpus
 * (`rev-2026-07-15T14-00-00Z-ccdd`).
 *
 * Every source of non-determinism (clock, UUID) is injectable so authored output
 * can be byte-reproducible in tests and pipelines.
 */

/** A source of RFC 4122 UUID strings. */
export type UuidSource = () => string;

/** Thrown when the authoring helpers are used incorrectly (not a validation failure). */
export class AuthoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthoringError';
  }
}

/**
 * The platform UUID source (Web Crypto), matching the rest of this package's
 * framework-agnostic posture — no `node:crypto` import.
 */
export function defaultUuid(): string {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID !== 'function') {
    throw new AuthoringError(
      'globalThis.crypto.randomUUID is unavailable in this runtime; pass an explicit ' +
        '`uuid` source (or an explicit `id`/`revision`) to the authoring helpers.',
    );
  }
  return webCrypto.randomUUID();
}

/**
 * Normalise a timestamp to an ISO-8601 instant with an offset, the form the
 * envelope's `createdAt`/`updatedAt` require.
 */
export function toIsoInstant(value: Date | string): string {
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new AuthoringError(`\`now\` is not a valid date-time: ${JSON.stringify(value)}`);
    }
    return parsed.toISOString();
  }
  if (Number.isNaN(value.getTime())) {
    throw new AuthoringError('`now` is an Invalid Date.');
  }
  return value.toISOString();
}

/** Mint a registry-free document `id` as a `urn:uuid:` URI. */
export function newDocumentId(uuid: UuidSource = defaultUuid): string {
  return `urn:uuid:${uuid()}`;
}

/**
 * Mint an opaque `revision` token for one document state: a second-precision
 * timestamp plus a short random suffix, so two revisions minted within the same
 * second still differ.
 */
export function newRevision(now: Date | string = new Date(), uuid: UuidSource = defaultUuid): string {
  const stamp = toIsoInstant(now).replace(/\.\d+Z$/, 'Z').replace(/:/g, '-');
  const suffix = uuid().replace(/-/g, '').slice(0, 6);
  return `rev-${stamp}-${suffix}`;
}

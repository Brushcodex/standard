/**
 * The published paint-identity registry, judged on its own.
 *
 * This repository is the PUBLIC one, and the registry it carries is generated
 * in a private one. That asymmetry is the whole reason these checks exist here
 * rather than only there: whatever a private generator believes it produced,
 * this is the file the world can fetch, and it must be judged as found.
 *
 * So nothing below reads the catalogue, the policy, or any private source. It
 * asks only what a stranger could ask — is this document the shape it claims,
 * does every identifier resolve to exactly one paint, and does it carry
 * anything it promised not to carry.
 *
 * Pure functions; the runner does the I/O.
 */

/** The format this repository publishes. A different major is a different contract. */
export const PUBLIC_FORMAT_VERSION = '1.0.0';

export const ID_NAMESPACE = 'brushcodex:paint:';

/** Assigned ids are issued at a minimum width, never a fixed one (Common §5.7). */
export const ASSIGNED_ID_PATTERN = /^brushcodex:paint:p\d{5,}$/;
export const CANONICAL_ASSIGNED_ID_PATTERN = /^brushcodex:paint:p\d{7,}$/;

export const DOCUMENT_FIELDS = [
  'publicFormatVersion',
  'generator',
  'identifierNamespace',
  'coverage',
  'paints',
];

export const PAINT_FIELDS = [
  'id',
  'manufacturer',
  'ranges',
  'name',
  'otherNames',
  'codes',
  'status',
  'aliasIds',
  'supersededIds',
];

/**
 * Field names and value shapes that would mean private catalogue material had
 * reached the public artifact.
 *
 * A DENY-LIST IS NOT THE GATE — `PAINT_FIELDS` is, and it is an allowlist, so
 * an unknown field fails whether or not it is named here. This list exists on
 * top of it to make the failure legible: "unknown field `observations`" is a
 * schema complaint, while "the artifact carries colour observations" says what
 * actually went wrong, and the two together are much harder to wave through.
 */
export const FORBIDDEN_KEYS = [
  'observations',
  'observation',
  'color',
  'colour',
  'hex',
  'cielab',
  'munsell',
  'measurement',
  'measurements',
  'authority',
  'confidence',
  'provenance',
  'sourceType',
  'sourceId',
  'source',
  'record',
  'importer',
  'upstreamId',
  'upstreamRef',
  'curated',
  'packagings',
  'barcode',
  'barcodes',
  'ean13',
  'upc',
  'standards',
  'equivalentTo',
  'equivalence',
  'match',
  'matches',
  'similarity',
  'distance',
  'recommendation',
  'recommendations',
  'substitute',
  'substitutes',
  'reviewStatus',
  'needsReview',
  'notes',
  'evidence',
  'policy',
  'decision',
];

/** Every key appearing anywhere in a value. */
function keysIn(value, out = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) keysIn(item, out);
  } else if (value && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      out.add(key);
      keysIn(inner, out);
    }
  }
  return out;
}

/**
 * Check a published registry document. Returns a list of findings; empty means
 * the artifact is publishable as it stands.
 */
export function checkPublicRegistry(document) {
  const findings = [];
  const add = (message) => findings.push(message);

  if (document?.publicFormatVersion !== PUBLIC_FORMAT_VERSION) {
    add(
      `publicFormatVersion must be ${PUBLIC_FORMAT_VERSION}, found ${JSON.stringify(document?.publicFormatVersion)}`,
    );
  }
  if (document?.identifierNamespace !== ID_NAMESPACE) {
    add(`identifierNamespace must be ${ID_NAMESPACE}`);
  }
  for (const key of Object.keys(document ?? {})) {
    if (!DOCUMENT_FIELDS.includes(key)) add(`unknown top-level field: ${key}`);
  }

  const paints = document?.paints;
  if (!Array.isArray(paints)) {
    add('no paints[] array');
    return findings;
  }
  if (document?.coverage?.published !== paints.length) {
    add(`coverage.published ${document?.coverage?.published} but paints[] has ${paints.length}`);
  }

  for (const key of keysIn(document)) {
    if (FORBIDDEN_KEYS.includes(key)) add(`private catalogue material in the public artifact: ${key}`);
  }

  const ids = new Set();
  for (const paint of paints) {
    const at = typeof paint?.id === 'string' ? paint.id : '(no id)';
    for (const key of Object.keys(paint ?? {})) {
      if (!PAINT_FIELDS.includes(key)) add(`${at}: unknown field ${key}`);
    }
    if (!CANONICAL_ASSIGNED_ID_PATTERN.test(paint?.id ?? '')) {
      add(`${at}: id is not a canonical assigned identifier`);
    }
    if (ids.has(paint.id)) add(`${at}: published twice`);
    ids.add(paint.id);
    for (const [field, value] of [
      ['manufacturer', paint?.manufacturer],
      ['name', paint?.name],
    ]) {
      if (typeof value !== 'string' || value.trim() === '') add(`${at}: ${field} is missing`);
    }
    for (const field of ['ranges', 'otherNames', 'codes', 'aliasIds', 'supersededIds']) {
      if (paint?.[field] === undefined) continue;
      if (!Array.isArray(paint[field]) || paint[field].some((v) => typeof v !== 'string')) {
        add(`${at}: ${field} must be an array of strings`);
      }
    }
  }

  // ONE IDENTIFIER, ONE PAINT. An alias claimed twice would give a consumer a
  // different answer depending on which record it read first, and a redirect
  // onto a live id would make resolution a two-step walk the format does not
  // promise. Both are checked over the whole document, not per record.
  const claimedBy = new Map();
  for (const paint of paints) {
    for (const alias of [...(paint.aliasIds ?? []), ...(paint.supersededIds ?? [])]) {
      if (typeof alias !== 'string') continue;
      if (!alias.startsWith(ID_NAMESPACE)) {
        add(`${paint.id}: alias outside the BrushCodex paint namespace: ${alias}`);
        continue;
      }
      if (alias === paint.id) add(`${paint.id}: lists its own id as an alias`);
      const already = claimedBy.get(alias);
      if (already !== undefined && already !== paint.id) {
        add(`identifier ${alias} resolves to two paints: ${already} and ${paint.id}`);
      }
      claimedBy.set(alias, paint.id);
    }
  }
  for (const [alias, owner] of claimedBy) {
    if (ids.has(alias) && alias !== owner) {
      add(`identifier ${alias} is both a published id and an alias of ${owner}`);
    }
  }

  return findings;
}

/**
 * Resolve an identifier against a published registry — the reference
 * implementation of what §5.7 promises, and the thing the tests drive.
 *
 * Deliberately a plain lookup: no padding arithmetic, no prefix matching, no
 * case folding. Every form BrushCodex has issued is present in the document as
 * either an id or an alias, so a consumer never has to know the padding rule —
 * and a resolver that stripped zeros would also answer for identifiers nobody
 * ever minted.
 */
export function resolve(document, identifier) {
  for (const paint of document?.paints ?? []) {
    if (paint.id === identifier) return paint;
    if ((paint.aliasIds ?? []).includes(identifier)) return paint;
    if ((paint.supersededIds ?? []).includes(identifier)) return paint;
  }
  return undefined;
}

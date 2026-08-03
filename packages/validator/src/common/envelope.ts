/**
 * BrushCodex Common Document Envelope v1 (DRAFT) — reference TypeScript model.
 *
 * This is the framework-agnostic, implementation-neutral model for the shared
 * metadata carried by every BrushCodex document. It mirrors the normative
 * artifacts and is kept honest against them by the test suite:
 *
 *   - normative prose:  specs/common/v1/README.md
 *   - normative schema:  schemas/common/v1/common.schema.json
 *   - example corpus:    examples/common/v1/**
 *
 * The Zod schema here is the reference application's typed trust-boundary parser.
 * The authoritative machine validator is the JSON Schema (validated with ajv in
 * `./validate`); the tests assert the two agree on the whole example corpus, so
 * the model can never silently drift from the published schema.
 *
 * Nothing in this module imports Next.js, Prisma, or any app-specific type.
 */

import { z } from 'zod';

/** SemVer 2.0.0. */
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
/** Lowercase specification name, e.g. `common`, `recipe`. */
const SPEC_NAME = /^[a-z][a-z0-9-]*$/;
/** BCP 47 language tag, or the `und` (undetermined) token. */
const BCP47 = /^(und|[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)$/;
/** BCP 47 language tag (no `und`), used inside translation entries. */
const BCP47_STRICT = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
/** Namespaced extension key (must contain a `.` or `:` separator). */
const EXTENSION_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]*[.:][A-Za-z0-9][A-Za-z0-9._:-]*$/;
/** Lowercase hex (integrity hash values). */
const HEX = /^[0-9a-f]+$/;
/** Absolute URI: a scheme followed by `:` and no whitespace. */
const ABSOLUTE_URI = /^[A-Za-z][A-Za-z0-9+.-]*:\S*$/;

/** Whether a value is an absolute URI (matches the schema's `format: uri` on the corpus). */
export function isAbsoluteUri(value: string): boolean {
  return ABSOLUTE_URI.test(value);
}

const uri = z.string().refine(isAbsoluteUri, { message: 'must be an absolute URI' });
const dateTime = z.string().datetime({ offset: true });

/** Controlled provenance source classes (spec §5.3). */
export const SOURCE_TYPES = [
  'manufacturer_digital_swatch',
  'physical_measurement',
  'community_estimate',
  'digital_approximation',
  'photographed_sample',
  'synthetic_test_fixture',
  'unknown',
] as const;

/** Review states for a provenance entry. */
export const REVIEW_STATUSES = ['pending_review', 'approved', 'rejected', 'deprecated'] as const;

/** Confidence bands independent of source. */
export const CONFIDENCE_LEVELS = ['high', 'medium', 'low', 'unknown'] as const;

export const agentSchema = z
  .object({
    name: z.string().min(1),
    id: uri.optional(),
    role: z.string().optional(),
    url: uri.optional(),
  })
  .strict();

export const licenseSchema = z
  .object({
    spdxId: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    url: uri.optional(),
    notice: z.string().optional(),
  })
  .strict()
  .refine((value) => value.spdxId !== undefined || value.name !== undefined, {
    message: 'license requires at least one of spdxId or name',
  });

export const provenanceEntrySchema = z
  .object({
    sourceType: z.enum(SOURCE_TYPES),
    reviewStatus: z.enum(REVIEW_STATUSES).optional(),
    confidence: z.enum(CONFIDENCE_LEVELS).optional(),
    sourceName: z.string().optional(),
    sourceUrl: uri.optional(),
    contributor: z.string().optional(),
    retrievedAt: dateTime.optional(),
    license: licenseSchema.optional(),
    transformationVersion: z.string().optional(),
    method: z.string().optional(),
    derivedFrom: z.array(uri).optional(),
    note: z.string().optional(),
  })
  .strict();

export const translationSchema = z
  .object({
    language: z.string().regex(BCP47_STRICT),
    title: z.string().optional(),
    description: z.string().optional(),
  })
  .strict();

export const linksSchema = z
  .object({
    source: uri.optional(),
    canonical: uri.optional(),
    predecessor: uri.optional(),
    successor: uri.optional(),
    forkOrigin: uri.optional(),
  })
  .strict();

export const integritySchema = z
  .object({
    algorithm: z.enum(['sha-256', 'sha-512']),
    value: z.string().regex(HEX),
  })
  .strict();

export const commonDocumentSchema = z
  .object({
    $schema: z.string().optional(),
    spec: z.string().regex(SPEC_NAME),
    specVersion: z.string().regex(SEMVER),
    id: uri,
    revision: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    createdAt: dateTime.optional(),
    updatedAt: dateTime.optional(),
    language: z.string().regex(BCP47).optional(),
    authors: z.array(agentSchema).optional(),
    contributors: z.array(agentSchema).optional(),
    // Credit prose for the document as a whole. Never a licence, never an author list, and never
    // parsed into agents — preserved verbatim.
    attribution: z.string().min(1).optional(),
    license: licenseSchema.optional(),
    links: linksSchema.optional(),
    provenance: z.array(provenanceEntrySchema).optional(),
    tags: z
      .array(z.string().min(1))
      .refine((tags) => new Set(tags).size === tags.length, { message: 'tags must be unique' })
      .optional(),
    translations: z.array(translationSchema).optional(),
    extensions: z.record(z.string().regex(EXTENSION_KEY), z.unknown()).optional(),
    integrity: integritySchema.optional(),
  })
  .strict();

export type Agent = z.infer<typeof agentSchema>;
export type License = z.infer<typeof licenseSchema>;
export type ProvenanceEntry = z.infer<typeof provenanceEntrySchema>;
export type Translation = z.infer<typeof translationSchema>;
export type DocumentLinks = z.infer<typeof linksSchema>;
export type Integrity = z.infer<typeof integritySchema>;
export type CommonDocument = z.infer<typeof commonDocumentSchema>;
export type SourceType = (typeof SOURCE_TYPES)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

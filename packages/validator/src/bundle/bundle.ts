/**
 * BrushCodex Bundle Manifest v1 (DRAFT) — reference TypeScript model.
 *
 * The manifest (embedded as `manifest.json` in a `.brushcodex.zip`) lists the
 * standard documents and permitted media the archive contains. It embeds the
 * Common document envelope.
 *
 *   - normative prose:  specs/bundle/v1/README.md
 *   - normative schema:  schemas/bundle/v1/bundle.schema.json
 *   - example corpus:    examples/bundle/v1/**
 */

import { z } from 'zod';
import { commonDocumentSchema, integritySchema } from '../common/envelope';

/** Specs a bundle document entry may declare. */
export const BUNDLE_ENTRY_SPECS = [
  'common',
  'recipe',
  'palette',
  'technique',
  'inventory',
  'project',
] as const;

/** A light path guard mirroring the JSON Schema; the reader enforces the full rules (safe.ts). */
const SAFE_PATH = /^[A-Za-z0-9_][A-Za-z0-9._/-]*$/;

export const bundleEntrySchema = z
  .object({
    path: z.string().min(1).max(255).regex(SAFE_PATH),
    spec: z.enum(BUNDLE_ENTRY_SPECS).optional(),
    mediaType: z.string().min(1),
    integrity: integritySchema.optional(),
  })
  .strict();

/**
 * The typed Bundle manifest model. Extends the Common envelope and pins `spec` to
 * the literal `bundle`.
 */
export const bundleManifestSchema = commonDocumentSchema
  .extend({
    spec: z.literal('bundle'),
    summary: z.string().optional(),
    entries: z.array(bundleEntrySchema).min(1),
  })
  .strict();

export type BundleManifest = z.infer<typeof bundleManifestSchema>;
export type BundleEntry = z.infer<typeof bundleEntrySchema>;
export type BundleEntrySpec = (typeof BUNDLE_ENTRY_SPECS)[number];

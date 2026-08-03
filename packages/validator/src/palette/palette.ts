/**
 * BrushCodex Palette v1 (DRAFT) — reference TypeScript model.
 *
 * A Palette embeds the Common document envelope (the Zod envelope model is
 * extended, not duplicated) and adds named entries (paint / literal color /
 * mixture) with semantic roles, plus relationships between entries.
 *
 *   - normative prose:  specs/palette/v1/README.md
 *   - normative schema:  schemas/palette/v1/palette.schema.json
 *   - example corpus:    examples/palette/v1/**
 *
 * Literal paint references are first-class: a palette is valid with paints that
 * carry only a manufacturer/name and no catalogue id or color value.
 *
 * NOTE: `paintRef`/`colorValue` are the canonical shared definitions from the
 * Common model (`../common/paint`); `mixEntry` stays palette-local because a
 * palette mixture anchors into `entries` (a recipe mixture anchors into `paints`).
 * See specs/palette/v1 §10.
 */

import { z } from 'zod';
import { commonDocumentSchema, provenanceEntrySchema } from '../common/envelope';
import { colorValueSchema, paintRefSchema } from '../common/paint';
import { ROLES, TARGET_KINDS, targetSchema } from '../common/structures';

/** Semantic roles a palette entry can play (spec §4). Shared with Recipe via the `common` ROLES vocabulary. */
export const PALETTE_ROLES = ROLES;

/** Relationship classes between entries (spec §5). */
export const RELATIONSHIP_TYPES = [
  'shadow_to_highlight',
  'analogous',
  'complementary',
  'triadic',
  'custom',
] as const;

/** Re-exported from `common` (shared with Recipe) so the palette public surface stays stable. */
export { TARGET_KINDS };

/** The canonical shared paint reference (re-exported under the palette-local name). */
export const palettePaintRefSchema = paintRefSchema;

const mixEntrySchema = z
  .object({ paint: z.string().min(1), parts: z.number().positive() })
  .strict();

const entrySchema = z
  .object({
    name: z.string().min(1),
    ref: z.string().min(1).optional(),
    role: z.enum(PALETTE_ROLES).optional(),
    paint: palettePaintRefSchema.optional(),
    color: colorValueSchema.optional(),
    mix: z.array(mixEntrySchema).min(2).optional(),
    provenance: z.array(provenanceEntrySchema).optional(),
    note: z.string().optional(),
  })
  .strict()
  .refine(
    (entry) => entry.paint !== undefined || entry.color !== undefined || entry.mix !== undefined,
    { message: 'an entry must carry at least a paint, a color, or a mix' },
  );

const relationshipSchema = z
  .object({
    type: z.enum(RELATIONSHIP_TYPES),
    sequence: z.array(z.string().min(1)).min(2),
    note: z.string().optional(),
  })
  .strict();

/**
 * The typed Palette model. Extends the Common envelope (so every envelope member
 * is inherited) and pins `spec` to the literal `palette`.
 */
export const paletteDocumentSchema = commonDocumentSchema
  .extend({
    spec: z.literal('palette'),
    summary: z.string().optional(),
    intent: z.string().optional(),
    target: targetSchema.optional(),
    entries: z.array(entrySchema).min(1),
    relationships: z.array(relationshipSchema).optional(),
  })
  .strict();

export type PaletteDocument = z.infer<typeof paletteDocumentSchema>;
export type PaletteEntry = z.infer<typeof entrySchema>;
export type PaletteRelationship = z.infer<typeof relationshipSchema>;
export type PalettePaintRef = z.infer<typeof palettePaintRefSchema>;
export type PaletteRole = (typeof PALETTE_ROLES)[number];
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

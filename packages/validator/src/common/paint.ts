/**
 * Canonical paint reference + color value, shared by every BrushCodex spec
 * (Recipe, Palette, Inventory, Project).
 *
 * These were previously duplicated in each spec model and had drifted (the
 * Project model omitted `provenance`, so a provenance-bearing paint reference —
 * valid elsewhere — could not travel into a project). Defining them once here,
 * mirroring `schemas/common/v1/common.schema.json#/$defs/{colorValue,paintRef}`,
 * keeps the reference model and the published JSON Schema in lockstep and makes a
 * paint reference portable across all specs.
 */

import { z } from 'zod';
import { provenanceEntrySchema } from './envelope';

/** An sRGB color value; its meaning is declared by the owning item's provenance. */
export const colorValueSchema = z.object({ hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) }).strict();

/**
 * Classifies any component referenced the way paints are (in paints[]/mix[]),
 * bottled or not, by its function in the mixture. Absence means an ordinary
 * pigment paint. A component that does not determine the resulting colour (a
 * medium, thinner, varnish, or additive) is marked so the color engine skips it —
 * water is an `additive`, a dry pigment stirred into a carrier stays a `paint`.
 */
export const PAINT_KINDS = ['paint', 'medium', 'thinner', 'additive', 'varnish'] as const;

/**
 * Binder/solvent family — the substitution-safety axis. The four named values are
 * the binder-family subset of Technique's paintClass vocabulary, plus `other`;
 * distinct from paintClass, which is a broader product-type advisory.
 */
export const PAINT_CHEMISTRIES = ['acrylic', 'enamel', 'oil', 'lacquer', 'other'] as const;

/**
 * A paint reference. At least one of `manufacturer` or `name` MUST be present;
 * everything else is optional, so a literal paint with no catalogue id or color
 * stays valid (the literal fallback for paints with no shared catalogue entry).
 * `ref` is an optional document-local anchor used by specs that support
 * intra-document references (e.g. Recipe steps/mixtures); other specs omit it.
 */
export const paintRefSchema = z
  .object({
    ref: z.string().min(1).optional(),
    manufacturer: z.string().min(1).optional(),
    range: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
    kind: z.enum(PAINT_KINDS).optional(),
    chemistry: z.enum(PAINT_CHEMISTRIES).optional(),
    catalogueId: z.string().min(1).optional(),
    color: colorValueSchema.optional(),
    provenance: z.array(provenanceEntrySchema).optional(),
    note: z.string().optional(),
  })
  .strict()
  .refine((paint) => paint.manufacturer !== undefined || paint.name !== undefined, {
    message: 'a paint reference must include at least a manufacturer or a name',
  });

export type ColorValue = z.infer<typeof colorValueSchema>;
export type PaintRef = z.infer<typeof paintRefSchema>;
export type PaintKind = (typeof PAINT_KINDS)[number];
export type PaintChemistry = (typeof PAINT_CHEMISTRIES)[number];

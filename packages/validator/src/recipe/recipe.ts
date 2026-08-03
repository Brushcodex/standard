/**
 * BrushCodex Recipe v1 (DRAFT) — reference TypeScript model.
 *
 * A Recipe embeds the Common document envelope (single source of truth: the Zod
 * envelope model is extended, not duplicated) and adds ordered steps, paints,
 * mixtures, roles, media, and classified alternatives.
 *
 *   - normative prose:  specs/recipe/v1/README.md
 *   - normative schema:  schemas/recipe/v1/recipe.schema.json
 *   - example corpus:    examples/recipe/v1/**
 *
 * Literal paint references are first-class: a recipe is valid with paints that
 * carry only a manufacturer/name and no catalogue id or color value.
 */

import { z } from 'zod';
import { commonDocumentSchema } from '../common/envelope';
import { paintRefSchema } from '../common/paint';
import {
  ROLES,
  TARGET_KINDS,
  targetSchema,
  resourceSchema,
  documentRefSchema,
  mediaRefSchema,
  mediaCitationSchema,
} from '../common/structures';

/** Semantic roles a step can play (spec §5). Shared with Palette via the `common` ROLES vocabulary. */
export const STEP_ROLES = ROLES;

/** How an alternative substitution was established (kept distinct — spec §8). */
export const ALTERNATIVE_TYPES = [
  'authored',
  'manufacturer_published',
  'mathematical',
  'community_tested',
  'verified_practical',
] as const;

export const STEP_METHODS = ['brush', 'airbrush', 'sponge', 'stipple', 'other'] as const;

/** Re-exported from `common` (shared with Palette) so the recipe public surface stays stable. */
export { TARGET_KINDS };

const mixEntrySchema = z
  .object({ paint: z.string().min(1), parts: z.number().positive() })
  .strict();

const alternativeSchema = z
  .object({
    type: z.enum(ALTERNATIVE_TYPES),
    paint: z.string().min(1).optional(),
    paintRef: paintRefSchema.optional(),
    note: z.string().optional(),
  })
  .strict()
  .refine((alt) => alt.paint !== undefined || alt.paintRef !== undefined, {
    message: 'an alternative must reference a paint anchor or an inline paintRef',
  });

const stepSchema = z
  .object({
    id: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    instruction: z.string().min(1),
    role: z.enum(STEP_ROLES).optional(),
    technique: z.string().min(1).optional(),
    targetArea: z.string().min(1).optional(),
    paintRefs: z.array(z.string().min(1)).optional(),
    mix: z.array(mixEntrySchema).min(2).optional(),
    // The author's wording for a mixture `mix` cannot express. When both are present `mix` is
    // authoritative for computation; this is never parsed into ratios.
    mixNote: z.string().min(1).optional(),
    method: z.enum(STEP_METHODS).optional(),
    coats: z.number().int().positive().optional(),
    thinning: z.string().optional(),
    dryingNotes: z.string().optional(),
    expectedResult: z.string().optional(),
    warnings: z.array(z.string().min(1)).optional(),
    media: z.array(mediaRefSchema).optional(),
    source: mediaCitationSchema.optional(),
    alternatives: z.array(alternativeSchema).optional(),
  })
  .strict();

/**
 * The typed Recipe model. Extends the Common envelope (so every envelope member
 * is inherited) and pins `spec` to the literal `recipe`.
 */
export const recipeDocumentSchema = commonDocumentSchema
  .extend({
    spec: z.literal('recipe'),
    summary: z.string().optional(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    estimatedActiveMinutes: z.number().int().nonnegative().optional(),
    dryingNotes: z.string().optional(),
    target: targetSchema.optional(),
    paints: z.array(paintRefSchema).optional(),
    resources: z.array(resourceSchema).optional(),
    techniqueRefs: z.array(documentRefSchema).optional(),
    media: z.array(mediaRefSchema).optional(),
    steps: z.array(stepSchema).min(1),
  })
  .strict();

export type RecipeDocument = z.infer<typeof recipeDocumentSchema>;
export type PaintRef = z.infer<typeof paintRefSchema>;
export type RecipeStep = z.infer<typeof stepSchema>;
export type RecipeAlternative = z.infer<typeof alternativeSchema>;
export type StepRole = (typeof STEP_ROLES)[number];
export type AlternativeType = (typeof ALTERNATIVE_TYPES)[number];

/**
 * BrushCodex Technique v1 (DRAFT) — reference TypeScript model.
 *
 * A Technique embeds the Common document envelope (the Zod envelope model is
 * extended, not duplicated) and adds a reusable technique definition: purpose,
 * prerequisites, tools/materials, ordered steps or parameter guidance, suitable/
 * unsuitable paint classes, common problems, safety notes, citations, and variants.
 *
 *   - normative prose:  specs/technique/v1/README.md
 *   - normative schema:  schemas/technique/v1/technique.schema.json
 *   - example corpus:    examples/technique/v1/**
 */

import { z } from 'zod';
import { commonDocumentSchema, isAbsoluteUri } from '../common/envelope';
import { resourceSchema } from '../common/structures';

const uri = z.string().refine(isAbsoluteUri, { message: 'must be an absolute URI' });

/** Controlled paint-class vocabulary for suitability guidance (spec §7). */
export const PAINT_CLASSES = [
  'acrylic',
  'oil',
  'enamel',
  'lacquer',
  'ink',
  'wash',
  'contrast',
  'technical',
  'metallic',
] as const;

const uniquePaintClasses = z
  .array(z.enum(PAINT_CLASSES))
  .refine((classes) => new Set(classes).size === classes.length, {
    message: 'paint classes must be unique',
  });

const stepSchema = z
  .object({
    instruction: z.string().min(1),
    note: z.string().optional(),
  })
  .strict();

const parameterSchema = z
  .object({
    name: z.string().min(1),
    guidance: z.string().min(1),
    typicalValue: z.string().optional(),
  })
  .strict();

const problemSchema = z
  .object({
    problem: z.string().min(1),
    correction: z.string().optional(),
  })
  .strict();

const citationSchema = z
  .object({
    text: z.string().min(1),
    url: uri.optional(),
  })
  .strict();

const variantSchema = z
  .object({
    name: z.string().min(1),
    summary: z.string().optional(),
    note: z.string().optional(),
  })
  .strict();

/**
 * The typed Technique model. Extends the Common envelope (so every envelope
 * member is inherited) and pins `spec` to the literal `technique`.
 */
export const techniqueDocumentSchema = commonDocumentSchema
  .extend({
    spec: z.literal('technique'),
    purpose: z.string().min(1),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    prerequisites: z.array(z.string().min(1)).optional(),
    tools: z.array(resourceSchema).optional(),
    steps: z.array(stepSchema).optional(),
    parameters: z.array(parameterSchema).optional(),
    suitablePaintClasses: uniquePaintClasses.optional(),
    unsuitablePaintClasses: uniquePaintClasses.optional(),
    commonProblems: z.array(problemSchema).optional(),
    safetyNotes: z.array(z.string().min(1)).optional(),
    citations: z.array(citationSchema).optional(),
    variants: z.array(variantSchema).optional(),
  })
  .strict();

export type TechniqueDocument = z.infer<typeof techniqueDocumentSchema>;
export type TechniqueTool = z.infer<typeof resourceSchema>;
export type TechniqueParameter = z.infer<typeof parameterSchema>;
export type TechniqueVariant = z.infer<typeof variantSchema>;
export type PaintClass = (typeof PAINT_CLASSES)[number];

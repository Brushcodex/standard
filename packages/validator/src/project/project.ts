/**
 * BrushCodex Project v1 (DRAFT) — reference TypeScript model.
 *
 * A Project embeds the Common document envelope (the Zod envelope model is
 * extended, not duplicated) and adds subjects (miniatures/subprojects) with stages
 * and checklists, selected recipes/palettes, classified accepted substitutions, a
 * journal with time logs and per-entry visibility, results, and tools used.
 *
 *   - normative prose:  specs/project/v1/README.md
 *   - normative schema:  schemas/project/v1/project.schema.json
 *   - example corpus:    examples/project/v1/**
 */

import { z } from 'zod';
import { commonDocumentSchema } from '../common/envelope';
import { paintRefSchema } from '../common/paint';
import { resourceSchema, documentRefSchema, mediaRefSchema } from '../common/structures';

const percentage = z.number().int().min(0).max(100);

export const PROJECT_STATUSES = ['active', 'on_hold', 'completed', 'archived'] as const;
export const SUBJECT_STATUSES = ['not_started', 'in_progress', 'blocked', 'done'] as const;
export const STAGE_STATUSES = ['not_started', 'in_progress', 'done'] as const;

/** Accepted-substitution classes (kept distinct, as in the Recipe spec). */
export const SUBSTITUTION_TYPES = [
  'authored',
  'manufacturer_published',
  'mathematical',
  'community_tested',
  'verified_practical',
] as const;

const stageSchema = z
  .object({ name: z.string().min(1), status: z.enum(STAGE_STATUSES).optional() })
  .strict();

const checkItemSchema = z
  .object({ task: z.string().min(1), done: z.boolean().optional() })
  .strict();

const subjectSchema = z
  .object({
    name: z.string().min(1),
    ref: z.string().min(1).optional(),
    status: z.enum(SUBJECT_STATUSES).optional(),
    progress: percentage.optional(),
    stages: z.array(stageSchema).optional(),
    checklist: z.array(checkItemSchema).optional(),
    note: z.string().optional(),
  })
  .strict();

const substitutionSchema = z
  .object({
    original: paintRefSchema,
    substitute: paintRefSchema,
    type: z.enum(SUBSTITUTION_TYPES).optional(),
    note: z.string().optional(),
  })
  .strict();

const journalEntrySchema = z
  .object({
    at: z.string().datetime({ offset: true }).optional(),
    body: z.string().min(1),
    minutesSpent: z.number().min(0).optional(),
    subjectRef: z.string().min(1).optional(),
    visibility: z.enum(['shareable', 'private']).optional(),
  })
  .strict();

/**
 * The typed Project model. Extends the Common envelope (so every envelope member
 * is inherited) and pins `spec` to the literal `project`.
 */
export const projectDocumentSchema = commonDocumentSchema
  .extend({
    spec: z.literal('project'),
    summary: z.string().optional(),
    status: z.enum(PROJECT_STATUSES),
    progress: percentage.optional(),
    subjects: z.array(subjectSchema).optional(),
    recipeRefs: z.array(documentRefSchema).optional(),
    paletteRefs: z.array(documentRefSchema).optional(),
    substitutions: z.array(substitutionSchema).optional(),
    journal: z.array(journalEntrySchema).optional(),
    results: z.array(mediaRefSchema).optional(),
    toolsUsed: z.array(resourceSchema).optional(),
  })
  .strict();

export type ProjectDocument = z.infer<typeof projectDocumentSchema>;
export type ProjectSubject = z.infer<typeof subjectSchema>;
export type ProjectJournalEntry = z.infer<typeof journalEntrySchema>;
export type ProjectSubstitution = z.infer<typeof substitutionSchema>;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type SubstitutionType = (typeof SUBSTITUTION_TYPES)[number];

/**
 * Shared structural building blocks used by more than one BrushCodex spec, so
 * they are defined once here rather than duplicated (and left to drift) in each
 * spec model. Mirrors `schemas/common/v1/common.schema.json#/$defs/{resource,
 * documentRef,role,target,mediaRef,mediaCitation}`.
 *
 *   - `resource`     — a tool or non-paint material (Recipe.resources,
 *                      Technique.tools, Project.toolsUsed).
 *   - `documentRef`  — a soft cross-document reference by stable id URI
 *                      (Recipe.techniqueRefs, Project.recipeRefs/paletteRefs).
 *   - `ROLES`        — the coarse role vocabulary (Recipe steps, Palette entries).
 *   - `target`       — the subject a document is for (Recipe, Palette).
 *   - `mediaRef`     — a linked media item with its own rights metadata
 *                      (Recipe.media, Recipe step.media, Project.results).
 *   - `mediaCitation`— a moment/range in a time-based media item (Recipe
 *                      step.source).
 */

import { z } from 'zod';
import { agentSchema, isAbsoluteUri, licenseSchema } from './envelope';

const uri = z.string().refine(isAbsoluteUri, { message: 'must be an absolute URI' });

/**
 * A tool or non-paint material. `name` is the only required member; there is no
 * manufacturer or catalogue identity. Ordinary tools and scenic materials MUST
 * NOT be modelled as a paintRef — they belong here.
 */
export const resourceSchema = z
  .object({
    name: z.string().min(1),
    kind: z.enum(['tool', 'material']).optional(),
    optional: z.boolean().optional(),
    specification: z.string().optional(),
    quantity: z.string().optional(),
    note: z.string().optional(),
  })
  .strict();

/**
 * A soft reference to another BrushCodex document by its stable id URI. The
 * referenced document need not be resolvable by the consumer; an unresolved
 * reference is not an error.
 */
export const documentRefSchema = z.object({ id: uri, title: z.string().optional() }).strict();

/**
 * The coarse, closed role vocabulary shared by Recipe steps and Palette entries.
 * Named specific techniques use a free-text field (e.g. Recipe step.technique),
 * never this enum, so it stays small and stable across the freeze.
 */
export const ROLES = [
  'primer',
  'basecoat',
  'undercoat',
  'shadow',
  'midtone',
  'layer',
  'highlight',
  'edge_highlight',
  'spot_highlight',
  'wash',
  'glaze',
  'drybrush',
  'weathering',
  'metallic',
  'texture',
  'decal',
  'varnish',
  'other',
] as const;

export const TARGET_KINDS = [
  'miniature',
  'model',
  'material',
  'surface',
  'terrain',
  'generic',
] as const;

/** Scale measurement systems. Deliberately only the two observed systems. */
export const SCALE_SYSTEMS = ['nominal_mm', 'ratio'] as const;

/** Physical composition of a subject (drives priming and solvent safety). */
export const SUBSTRATES = ['resin', 'plastic', 'metal', 'mdf', 'foam', 'pla', 'other'] as const;

const scaleSchema = z
  .object({ system: z.enum(SCALE_SYSTEMS), value: z.string().min(1) })
  .strict();

/**
 * The identity of the discrete Painted Subject a target denotes (Common §5.8).
 *
 * Literal-first, exactly like `paintRef`: `authority` and `designation` are the
 * offline floor and are required whenever the object exists — unconditionally,
 * so an opaque `subjectId` can never travel without something a human can read.
 * `subjectId` is an optional external identifier compared by whole-string
 * equality; it is never parsed, never resolved to decide validity, and never a
 * Source Product, SKU, or database row.
 */
export const subjectIdentitySchema = z
  .object({
    authority: z.string().min(1),
    designation: z.string().min(1),
    qualifier: z.string().min(1).optional(),
    authorityId: z.string().min(1).optional(),
    subjectId: z.string().min(1).optional(),
  })
  .strict();

/**
 * The subject a Recipe or Palette targets. Physical height and subject form
 * (e.g. bust) are intentionally NOT collapsed into `scale`.
 *
 * `kind`/`description`/`scale`/`substrate` state applicability; the optional
 * `identity` states which exact Painted Subject that applicability denotes.
 * It refines the target and never replaces `description`.
 */
export const targetSchema = z
  .object({
    kind: z.enum(TARGET_KINDS).optional(),
    description: z.string().min(1),
    scale: scaleSchema.optional(),
    substrate: z.enum(SUBSTRATES).optional(),
    identity: subjectIdentitySchema.optional(),
  })
  .strict();

/** How a linked media item relates to the document. Absent means unstated. */
export const MEDIA_RELATIONS = ['source', 'result', 'reference'] as const;

export const MEDIA_KINDS = ['image', 'video', 'other'] as const;

/**
 * A linked media item with its own rights metadata. `creator` and `license`
 * describe the LINKED WORK, not the document: transcribing a tutorial does not
 * make its creator an author of the recipe, and reachable media is not thereby
 * openly licensed. Neither is ever inferred — absent means unknown.
 */
export const mediaRefSchema = z
  .object({
    id: z.string().min(1).optional(),
    url: uri,
    kind: z.enum(MEDIA_KINDS).optional(),
    relation: z.enum(MEDIA_RELATIONS).optional(),
    caption: z.string().optional(),
    creator: agentSchema.optional(),
    license: licenseSchema.optional(),
    rightsNote: z.string().optional(),
  })
  .strict();

/**
 * A moment or range in a time-based media item the document links. Seconds are
 * the portable value every consumer can seek with; `label` preserves the
 * author's written form (e.g. "1:00-1:35") so a round trip through a
 * human-timecode representation loses nothing.
 *
 * `media` is the anchor into the owning document's `media[].id`; it may be
 * omitted only when exactly one linked media item has relation `source`
 * (resolution and range order are semantic rules — see the recipe validator).
 */
export const mediaCitationSchema = z
  .object({
    media: z.string().min(1).optional(),
    startSeconds: z.number().nonnegative(),
    endSeconds: z.number().positive().optional(),
    label: z.string().min(1).optional(),
  })
  .strict();

export type Resource = z.infer<typeof resourceSchema>;
export type DocumentRef = z.infer<typeof documentRefSchema>;
export type MediaRef = z.infer<typeof mediaRefSchema>;
export type MediaCitation = z.infer<typeof mediaCitationSchema>;
export type MediaRelation = (typeof MEDIA_RELATIONS)[number];
export type MediaKind = (typeof MEDIA_KINDS)[number];
export type Target = z.infer<typeof targetSchema>;
export type SubjectIdentity = z.infer<typeof subjectIdentitySchema>;
export type Role = (typeof ROLES)[number];
export type TargetKind = (typeof TARGET_KINDS)[number];
export type ScaleSystem = (typeof SCALE_SYSTEMS)[number];
export type Substrate = (typeof SUBSTRATES)[number];

/**
 * Reference validator for the BrushCodex Recipe v1 document format.
 *
 * Two layers, matching the Common validator:
 *   1. schema   — validated against the normative recipe JSON Schema, which
 *                 composes the Common envelope. Ajv (draft 2020-12) with the
 *                 published common schema registered so the cross-schema $ref
 *                 resolves.
 *   2. semantic — envelope prose rules (updatedAt >= createdAt) plus recipe
 *                 anchor integrity: every paint anchor used by a step, mixture,
 *                 or alternative must resolve to a declared paints[].ref, and
 *                 every step source citation must resolve to a declared
 *                 media[].id (or an unambiguous single 'source' media item) and
 *                 name a range that runs forwards.
 *
 * Loads the published schema files from disk, so it can never drift from the
 * artifacts implementers consume, and runs without the web application.
 */

import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { schemas } from '@brushcodex/schema';
import {
  ajvErrorToIssue,
  envelopeSemanticIssues,
  loadCommonSchema,
  type ValidationIssue,
  type ValidationResult,
} from '../common/validate';
import { toCanonicalJson } from '../common/canonical';
import { recipeDocumentSchema, type RecipeDocument } from './recipe';

let cachedValidate: ValidateFunction | null = null;

/**
 * The normative Recipe v1 JSON Schema, imported as a bundled module (not read
 * from disk) so the validator runs identically under Node/Vitest, tooling, and a
 * bundled Next.js route. Same published artifact as the file in `schemas/`.
 */
export function loadRecipeSchema(): Record<string, unknown> {
  return schemas.recipe as Record<string, unknown>;
}

function getValidator(): ValidateFunction {
  if (cachedValidate === null) {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    // The recipe schema $refs the common envelope by its $id; register it first.
    ajv.addSchema(loadCommonSchema());
    cachedValidate = ajv.compile(loadRecipeSchema());
  }
  return cachedValidate;
}

/** Validate against the normative Recipe JSON Schema only. */
export function validateRecipeAgainstSchema(input: unknown): ValidationIssue[] {
  const validate = getValidator();
  const ok = validate(input);
  if (ok) return [];
  return (validate.errors ?? []).map(ajvErrorToIssue);
}

/** Prose rules the schema cannot express. Assumes `input` is already schema-valid. */
function recipeSemanticIssues(doc: RecipeDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [...envelopeSemanticIssues(doc)];

  const declared = new Set(
    (doc.paints ?? []).map((paint) => paint.ref).filter((ref): ref is string => ref !== undefined),
  );

  const anchors: Array<{ anchor: string; path: string }> = [];
  doc.steps.forEach((step, stepIndex) => {
    (step.paintRefs ?? []).forEach((anchor, refIndex) => {
      anchors.push({ anchor, path: `/steps/${stepIndex}/paintRefs/${refIndex}` });
    });
    (step.mix ?? []).forEach((entry, mixIndex) => {
      anchors.push({ anchor: entry.paint, path: `/steps/${stepIndex}/mix/${mixIndex}/paint` });
    });
    (step.alternatives ?? []).forEach((alternative, altIndex) => {
      if (alternative.paint !== undefined) {
        anchors.push({
          anchor: alternative.paint,
          path: `/steps/${stepIndex}/alternatives/${altIndex}/paint`,
        });
      }
    });
  });

  for (const { anchor, path } of anchors) {
    if (!declared.has(anchor)) {
      issues.push({
        path,
        code: 'paint-anchor-resolves',
        message: `paint anchor '${anchor}' does not resolve to any paints[].ref`,
        layer: 'semantic',
      });
    }
  }

  issues.push(...mediaCitationIssues(doc));

  return issues;
}

/**
 * Media anchor integrity and citation coherence (spec §7a, §9):
 *
 *   - a `media[].id` is a document-local anchor, so it MUST be unique;
 *   - a step citation naming `media` MUST resolve to one of those ids;
 *   - a citation that omits `media` is only unambiguous when exactly one media
 *     item declares `relation: "source"` — otherwise it cites nothing definite;
 *   - a cited range MUST run forwards (`endSeconds` > `startSeconds`).
 *
 * None of these are expressible in JSON Schema (cross-member and cross-array).
 */
function mediaCitationIssues(doc: RecipeDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const media = doc.media ?? [];

  const seen = new Set<string>();
  media.forEach((item, index) => {
    if (item.id === undefined) return;
    if (seen.has(item.id)) {
      issues.push({
        path: `/media/${index}/id`,
        code: 'media-id-unique',
        message: `media id '${item.id}' is declared more than once`,
        layer: 'semantic',
      });
    }
    seen.add(item.id);
  });

  const sourceCount = media.filter((item) => item.relation === 'source').length;

  doc.steps.forEach((step, stepIndex) => {
    const citation = step.source;
    if (citation === undefined) return;
    const path = `/steps/${stepIndex}/source`;

    if (citation.media !== undefined) {
      if (!seen.has(citation.media)) {
        issues.push({
          path: `${path}/media`,
          code: 'media-anchor-resolves',
          message: `media anchor '${citation.media}' does not resolve to any media[].id`,
          layer: 'semantic',
        });
      }
    } else if (sourceCount !== 1) {
      issues.push({
        path,
        code: 'media-citation-resolves',
        message:
          `a source citation without a 'media' anchor requires exactly one ` +
          `media[] entry with relation 'source'; ` +
          (sourceCount === 0 ? 'none is declared' : `${sourceCount} are declared`),
        layer: 'semantic',
      });
    }

    if (citation.endSeconds !== undefined && citation.endSeconds <= citation.startSeconds) {
      issues.push({
        path: `${path}/endSeconds`,
        code: 'media-citation-range',
        message:
          `cited range ends at ${citation.endSeconds}s, which is not after ` +
          `its start at ${citation.startSeconds}s`,
        layer: 'semantic',
      });
    }
  });

  return issues;
}

/** Full reference validation: JSON Schema, then prose + anchor-integrity rules. */
export function validateRecipeDocument(input: unknown): ValidationResult {
  const schemaIssues = validateRecipeAgainstSchema(input);
  if (schemaIssues.length > 0) {
    return { valid: false, issues: schemaIssues };
  }
  const parsed = recipeDocumentSchema.parse(input);
  const semantic = recipeSemanticIssues(parsed);
  return { valid: semantic.length === 0, issues: semantic };
}

/** Thrown by {@link parseRecipeDocument} when a document is not conformant. */
export class RecipeValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(`Invalid BrushCodex Recipe document: ${issues.map((i) => i.message).join('; ')}`);
    this.name = 'RecipeValidationError';
    this.issues = issues;
  }
}

/** Validate and parse an unknown value into a typed {@link RecipeDocument}. */
export function parseRecipeDocument(input: unknown): RecipeDocument {
  const result = validateRecipeDocument(input);
  if (!result.valid) {
    throw new RecipeValidationError(result.issues);
  }
  return recipeDocumentSchema.parse(input);
}

/** Serialize a recipe to its canonical JSON string (shared canonical form). */
export function serializeRecipeDocument(doc: RecipeDocument): string {
  return toCanonicalJson(doc);
}

/** Validate + parse, then re-serialize canonically. Proves a loss-free round trip. */
export function roundTripRecipeDocument(input: unknown): {
  document: RecipeDocument;
  canonical: string;
} {
  const document = parseRecipeDocument(input);
  return { document, canonical: serializeRecipeDocument(document) };
}

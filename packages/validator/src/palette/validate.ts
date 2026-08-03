/**
 * Reference validator for the BrushCodex Palette v1 document format.
 *
 * Two layers, matching the Recipe validator:
 *   1. schema   — validated against the normative palette JSON Schema, which
 *                 composes the Common envelope. Ajv (draft 2020-12) with the
 *                 published common schema registered so the cross-schema $ref
 *                 resolves.
 *   2. semantic — envelope prose rules (updatedAt >= createdAt) plus palette
 *                 anchor integrity: every anchor used by a mixture or a
 *                 relationship must resolve to a declared entries[].ref.
 *
 * The schemas are imported as bundled modules (not read from disk), so the
 * validator runs identically under Node/Vitest, tooling, and a bundled Next.js
 * route.
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
import { paletteDocumentSchema, type PaletteDocument } from './palette';

let cachedValidate: ValidateFunction | null = null;

/**
 * The normative Palette v1 JSON Schema, imported as a bundled module. Same
 * published artifact as the file in `schemas/`.
 */
export function loadPaletteSchema(): Record<string, unknown> {
  return schemas.palette as Record<string, unknown>;
}

function getValidator(): ValidateFunction {
  if (cachedValidate === null) {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    // The palette schema $refs the common envelope by its $id; register it first.
    ajv.addSchema(loadCommonSchema());
    cachedValidate = ajv.compile(loadPaletteSchema());
  }
  return cachedValidate;
}

/** Validate against the normative Palette JSON Schema only. */
export function validatePaletteAgainstSchema(input: unknown): ValidationIssue[] {
  const validate = getValidator();
  const ok = validate(input);
  if (ok) return [];
  return (validate.errors ?? []).map(ajvErrorToIssue);
}

/** Prose rules the schema cannot express. Assumes `input` is already schema-valid. */
function paletteSemanticIssues(doc: PaletteDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [...envelopeSemanticIssues(doc)];

  const declared = new Set(
    doc.entries.map((entry) => entry.ref).filter((ref): ref is string => ref !== undefined),
  );

  const anchors: Array<{ anchor: string; path: string }> = [];
  doc.entries.forEach((entry, entryIndex) => {
    (entry.mix ?? []).forEach((mix, mixIndex) => {
      anchors.push({ anchor: mix.paint, path: `/entries/${entryIndex}/mix/${mixIndex}/paint` });
    });
  });
  (doc.relationships ?? []).forEach((relationship, relIndex) => {
    relationship.sequence.forEach((anchor, seqIndex) => {
      anchors.push({ anchor, path: `/relationships/${relIndex}/sequence/${seqIndex}` });
    });
  });

  for (const { anchor, path } of anchors) {
    if (!declared.has(anchor)) {
      issues.push({
        path,
        code: 'entry-anchor-resolves',
        message: `anchor '${anchor}' does not resolve to any entries[].ref`,
        layer: 'semantic',
      });
    }
  }

  return issues;
}

/** Full reference validation: JSON Schema, then prose + anchor-integrity rules. */
export function validatePaletteDocument(input: unknown): ValidationResult {
  const schemaIssues = validatePaletteAgainstSchema(input);
  if (schemaIssues.length > 0) {
    return { valid: false, issues: schemaIssues };
  }
  const parsed = paletteDocumentSchema.parse(input);
  const semantic = paletteSemanticIssues(parsed);
  return { valid: semantic.length === 0, issues: semantic };
}

/** Thrown by {@link parsePaletteDocument} when a document is not conformant. */
export class PaletteValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(`Invalid BrushCodex Palette document: ${issues.map((i) => i.message).join('; ')}`);
    this.name = 'PaletteValidationError';
    this.issues = issues;
  }
}

/** Validate and parse an unknown value into a typed {@link PaletteDocument}. */
export function parsePaletteDocument(input: unknown): PaletteDocument {
  const result = validatePaletteDocument(input);
  if (!result.valid) {
    throw new PaletteValidationError(result.issues);
  }
  return paletteDocumentSchema.parse(input);
}

/** Serialize a palette to its canonical JSON string (shared canonical form). */
export function serializePaletteDocument(doc: PaletteDocument): string {
  return toCanonicalJson(doc);
}

/** Validate + parse, then re-serialize canonically. Proves a loss-free round trip. */
export function roundTripPaletteDocument(input: unknown): {
  document: PaletteDocument;
  canonical: string;
} {
  const document = parsePaletteDocument(input);
  return { document, canonical: serializePaletteDocument(document) };
}

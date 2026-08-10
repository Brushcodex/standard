/**
 * Reference validator for the BrushCodex Technique v1 document format.
 *
 * Two layers, matching the other spec validators:
 *   1. schema   — validated against the normative technique JSON Schema, which
 *                 composes the Common envelope. Ajv (draft 2020-12) with the
 *                 published common schema registered so the cross-schema $ref
 *                 resolves.
 *   2. semantic — envelope prose rules (e.g. updatedAt >= createdAt). Techniques
 *                 have no internal anchors, so no cross-reference rule applies.
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
  specVersionIssues,
  loadCommonSchema,
  type ValidationIssue,
  type ValidationResult,
} from '../common/validate';
import { toCanonicalJson } from '../common/canonical';
import { techniqueDocumentSchema, type TechniqueDocument } from './technique';

let cachedValidate: ValidateFunction | null = null;

/**
 * The normative Technique v1 JSON Schema, imported as a bundled module. Same
 * published artifact as the file in `schemas/`.
 */
export function loadTechniqueSchema(): Record<string, unknown> {
  return schemas.technique as Record<string, unknown>;
}

function getValidator(): ValidateFunction {
  if (cachedValidate === null) {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    // The technique schema $refs the common envelope by its $id; register it first.
    ajv.addSchema(loadCommonSchema());
    cachedValidate = ajv.compile(loadTechniqueSchema());
  }
  return cachedValidate;
}

/** Validate against the normative Technique JSON Schema only. */
export function validateTechniqueAgainstSchema(input: unknown): ValidationIssue[] {
  const validate = getValidator();
  const ok = validate(input);
  if (ok) return [];
  return (validate.errors ?? []).map(ajvErrorToIssue);
}

/** Full reference validation: JSON Schema, then envelope prose rules. */
export function validateTechniqueDocument(input: unknown): ValidationResult {
  // Version negotiation first (VERSIONING §8.5): an unrecognised spec version is
  // reported alone, so no misleading 1.0 schema errors are produced beside it.
  const versionIssues = specVersionIssues(input);
  if (versionIssues.length > 0) {
    return { valid: false, issues: versionIssues };
  }
  const schemaIssues = validateTechniqueAgainstSchema(input);
  if (schemaIssues.length > 0) {
    return { valid: false, issues: schemaIssues };
  }
  const parsed = techniqueDocumentSchema.parse(input);
  const semantic = envelopeSemanticIssues(parsed);
  return { valid: semantic.length === 0, issues: semantic };
}

/** Thrown by {@link parseTechniqueDocument} when a document is not conformant. */
export class TechniqueValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(`Invalid BrushCodex Technique document: ${issues.map((i) => i.message).join('; ')}`);
    this.name = 'TechniqueValidationError';
    this.issues = issues;
  }
}

/** Validate and parse an unknown value into a typed {@link TechniqueDocument}. */
export function parseTechniqueDocument(input: unknown): TechniqueDocument {
  const result = validateTechniqueDocument(input);
  if (!result.valid) {
    throw new TechniqueValidationError(result.issues);
  }
  return techniqueDocumentSchema.parse(input);
}

/** Serialize a technique to its canonical JSON string (shared canonical form). */
export function serializeTechniqueDocument(doc: TechniqueDocument): string {
  return toCanonicalJson(doc);
}

/** Validate + parse, then re-serialize canonically. Proves a loss-free round trip. */
export function roundTripTechniqueDocument(input: unknown): {
  document: TechniqueDocument;
  canonical: string;
} {
  const document = parseTechniqueDocument(input);
  return { document, canonical: serializeTechniqueDocument(document) };
}

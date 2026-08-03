/**
 * Reference validator for the BrushCodex Project v1 document format.
 *
 * Two layers, matching the other spec validators:
 *   1. schema   — validated against the normative project JSON Schema, which
 *                 composes the Common envelope. Ajv (draft 2020-12) with the
 *                 published common schema registered so the cross-schema $ref
 *                 resolves.
 *   2. semantic — envelope prose rules (updatedAt >= createdAt) plus subject-anchor
 *                 integrity: every journal subjectRef must resolve to a declared
 *                 subjects[].ref.
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
import { projectDocumentSchema, type ProjectDocument } from './project';

let cachedValidate: ValidateFunction | null = null;

/**
 * The normative Project v1 JSON Schema, imported as a bundled module. Same
 * published artifact as the file in `schemas/`.
 */
export function loadProjectSchema(): Record<string, unknown> {
  return schemas.project as Record<string, unknown>;
}

function getValidator(): ValidateFunction {
  if (cachedValidate === null) {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    // The project schema $refs the common envelope by its $id; register it first.
    ajv.addSchema(loadCommonSchema());
    cachedValidate = ajv.compile(loadProjectSchema());
  }
  return cachedValidate;
}

/** Validate against the normative Project JSON Schema only. */
export function validateProjectAgainstSchema(input: unknown): ValidationIssue[] {
  const validate = getValidator();
  const ok = validate(input);
  if (ok) return [];
  return (validate.errors ?? []).map(ajvErrorToIssue);
}

/** Prose rules the schema cannot express. Assumes `input` is already schema-valid. */
function projectSemanticIssues(doc: ProjectDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [...envelopeSemanticIssues(doc)];

  const declared = new Set(
    (doc.subjects ?? [])
      .map((subject) => subject.ref)
      .filter((ref): ref is string => ref !== undefined),
  );

  (doc.journal ?? []).forEach((entry, index) => {
    if (entry.subjectRef !== undefined && !declared.has(entry.subjectRef)) {
      issues.push({
        path: `/journal/${index}/subjectRef`,
        code: 'subject-anchor-resolves',
        message: `journal subjectRef '${entry.subjectRef}' does not resolve to any subjects[].ref`,
        layer: 'semantic',
      });
    }
  });

  return issues;
}

/** Full reference validation: JSON Schema, then prose + anchor-integrity rules. */
export function validateProjectDocument(input: unknown): ValidationResult {
  const schemaIssues = validateProjectAgainstSchema(input);
  if (schemaIssues.length > 0) {
    return { valid: false, issues: schemaIssues };
  }
  const parsed = projectDocumentSchema.parse(input);
  const semantic = projectSemanticIssues(parsed);
  return { valid: semantic.length === 0, issues: semantic };
}

/** Thrown by {@link parseProjectDocument} when a document is not conformant. */
export class ProjectValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(`Invalid BrushCodex Project document: ${issues.map((i) => i.message).join('; ')}`);
    this.name = 'ProjectValidationError';
    this.issues = issues;
  }
}

/** Validate and parse an unknown value into a typed {@link ProjectDocument}. */
export function parseProjectDocument(input: unknown): ProjectDocument {
  const result = validateProjectDocument(input);
  if (!result.valid) {
    throw new ProjectValidationError(result.issues);
  }
  return projectDocumentSchema.parse(input);
}

/** Serialize a project to its canonical JSON string (shared canonical form). */
export function serializeProjectDocument(doc: ProjectDocument): string {
  return toCanonicalJson(doc);
}

/** Validate + parse, then re-serialize canonically. Proves a loss-free round trip. */
export function roundTripProjectDocument(input: unknown): {
  document: ProjectDocument;
  canonical: string;
} {
  const document = parseProjectDocument(input);
  return { document, canonical: serializeProjectDocument(document) };
}

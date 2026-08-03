/**
 * Reference validator for the BrushCodex Common Document Envelope v1.
 *
 * Two validation layers, matching the specification's conformance section:
 *
 *   1. schema   — the document validated against the normative JSON Schema
 *                 (schemas/common/v1/common.schema.json) using Ajv (draft 2020-12).
 *                 This is the authoritative machine check.
 *   2. semantic — prose rules the JSON Schema cannot express (e.g. updatedAt must
 *                 not precede createdAt). Only evaluated once the document is
 *                 schema-valid.
 *
 * The validator loads the *published* schema file from disk, so it can never drift
 * from the artifact third-party implementers consume. It runs under Node/Vitest
 * (and future tooling) without starting the web application.
 */

import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { schemas } from '@brushcodex/schema';
import { commonDocumentSchema, type CommonDocument } from './envelope';

/** A single validation problem, with the layer that produced it. */
export interface ValidationIssue {
  /** JSON Pointer to the offending location (`''` = document root). */
  path: string;
  /** Ajv keyword (schema layer) or a prose-rule code (semantic layer). */
  code: string;
  /** Human-readable explanation. */
  message: string;
  /** Which conformance layer rejected the document. */
  layer: 'schema' | 'semantic';
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

let cachedValidate: ValidateFunction | null = null;

/**
 * The normative Common v1 JSON Schema. Imported as a bundled module (not read
 * from disk) so the validator runs identically under Node/Vitest, tooling, and a
 * bundled Next.js route. It is the same published artifact implementers consume,
 * so it still cannot drift from the file in `schemas/`.
 */
export function loadCommonSchema(): Record<string, unknown> {
  return schemas.common as Record<string, unknown>;
}

function getValidator(): ValidateFunction {
  if (cachedValidate === null) {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    cachedValidate = ajv.compile(loadCommonSchema());
  }
  return cachedValidate;
}

/**
 * How many enum members to spell out before summarising the remainder, so a single
 * diagnostic line stays bounded even against an unusually large vocabulary. Every
 * closed vocabulary in the standard is far smaller than this, so in practice each
 * allowed value is always listed in full.
 */
const MAX_ENUM_VALUES_LISTED = 24;

/** Render an enum's allowed values as a quoted, comma-separated, bounded list. */
function formatAllowedValues(values: readonly unknown[]): string {
  const shown = values.slice(0, MAX_ENUM_VALUES_LISTED).map((value) => JSON.stringify(value));
  const omitted = values.length - shown.length;
  return omitted > 0 ? `${shown.join(', ')}, plus ${omitted} more` : shown.join(', ');
}

/**
 * A parenthetical that names the *specific* offending member, so a reader can act
 * on the error without cross-referencing the schema:
 *   - additionalProperties / unevaluatedProperties → the property that is not allowed
 *   - required                                      → the property that is missing
 *   - enum                                          → the values that WOULD be accepted
 *   - const                                         → the single value that IS required
 * Any other keyword contributes no suffix (the base Ajv message stands alone).
 */
function schemaErrorDetail(error: ErrorObject): string {
  const { keyword, params } = error;
  if (
    (keyword === 'additionalProperties' || keyword === 'unevaluatedProperties') &&
    typeof params.additionalProperty === 'string'
  ) {
    return ` (${params.additionalProperty})`;
  }
  if (keyword === 'unevaluatedProperties' && typeof params.unevaluatedProperty === 'string') {
    return ` (${params.unevaluatedProperty})`;
  }
  if (keyword === 'required' && typeof params.missingProperty === 'string') {
    return ` (${params.missingProperty})`;
  }
  if (keyword === 'enum' && Array.isArray(params.allowedValues)) {
    return ` (allowed: ${formatAllowedValues(params.allowedValues)})`;
  }
  if (keyword === 'const' && 'allowedValue' in params) {
    return ` (expected: ${JSON.stringify(params.allowedValue)})`;
  }
  return '';
}

/** Map one Ajv error object into a schema-layer {@link ValidationIssue}. Shared across specs. */
export function ajvErrorToIssue(error: ErrorObject): ValidationIssue {
  const path = error.instancePath;
  return {
    path,
    code: error.keyword,
    message: `${path || '(root)'} ${error.message ?? 'is invalid'}${schemaErrorDetail(error)}`.trim(),
    layer: 'schema',
  };
}

/** Validate against the normative JSON Schema only. Returns the schema-layer issues. */
export function validateAgainstSchema(input: unknown): ValidationIssue[] {
  const validate = getValidator();
  const ok = validate(input);
  if (ok) return [];
  return (validate.errors ?? []).map(ajvErrorToIssue);
}

/**
 * Envelope prose rules the JSON Schema cannot express. Shared by every spec that
 * embeds the Common envelope. Assumes the input is already schema-valid.
 */
export function envelopeSemanticIssues(input: {
  createdAt?: string;
  updatedAt?: string;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (input.createdAt !== undefined && input.updatedAt !== undefined) {
    if (Date.parse(input.updatedAt) < Date.parse(input.createdAt)) {
      issues.push({
        path: '/updatedAt',
        code: 'updatedAt-not-before-createdAt',
        message: 'updatedAt must not precede createdAt',
        layer: 'semantic',
      });
    }
  }
  return issues;
}

/**
 * Full reference validation: JSON Schema, then prose rules. A document is
 * conformant only when both layers pass.
 */
export function validateCommonDocument(input: unknown): ValidationResult {
  const schemaIssues = validateAgainstSchema(input);
  if (schemaIssues.length > 0) {
    return { valid: false, issues: schemaIssues };
  }
  // Schema-valid, so the Zod parse (which mirrors the schema) yields the typed shape.
  const parsed = commonDocumentSchema.parse(input);
  const semantic = envelopeSemanticIssues(parsed);
  return { valid: semantic.length === 0, issues: semantic };
}

/** Thrown by {@link parseCommonDocument} when a document is not conformant. */
export class CommonValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(`Invalid BrushCodex Common document: ${issues.map((i) => i.message).join('; ')}`);
    this.name = 'CommonValidationError';
    this.issues = issues;
  }
}

/**
 * Validate and parse an unknown value into a typed {@link CommonDocument}.
 * Throws {@link CommonValidationError} with structured issues when invalid.
 */
export function parseCommonDocument(input: unknown): CommonDocument {
  const result = validateCommonDocument(input);
  if (!result.valid) {
    throw new CommonValidationError(result.issues);
  }
  return commonDocumentSchema.parse(input);
}

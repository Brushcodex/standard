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
 * The specification version these validators implement. Every schema in
 * `schemas/**​/v1` is the `1.0` surface; this validator ships no other.
 */
export const IMPLEMENTED_SPEC_VERSION = '1.0.0';

/** The `1.0` of {@link IMPLEMENTED_SPEC_VERSION}, as the numbers the check compares. */
const IMPLEMENTED = { major: 1, minor: 0 } as const;

/**
 * Schema version negotiation (VERSIONING §8.5).
 *
 * A document declares the spec version it targets. A consumer validates it against
 * the schema matching that version, and one that ships only `1.0` MUST NOT silently
 * treat a higher minor as `1.0` — a `1.1` document may legitimately use members and
 * enum values `1.0` never had, and reporting those as ordinary schema errors tells
 * the reader the document is malformed when it is merely newer.
 *
 * This validator implements exactly one version, so negotiation here is a single
 * clear refusal rather than multi-schema selection: an unrecognised version is
 * reported as its own issue and validation stops, so no misleading `1.0` errors are
 * produced beside it. A patch difference (`1.0.1`) is not a surface change and
 * passes; a lower minor cannot exist within major 1 (`1.0` is the first).
 *
 * Returns `[]` when the value is not shaped like a document at all — the schema
 * layer owns "specVersion is missing / not a SemVer string".
 */
export function specVersionIssues(input: unknown): ValidationIssue[] {
  if (input === null || typeof input !== 'object' || !('specVersion' in input)) return [];
  const declared = (input as { specVersion: unknown }).specVersion;
  if (typeof declared !== 'string') return [];
  const parts = /^(\d+)\.(\d+)\./.exec(declared);
  if (parts === null) return [];

  const major = Number(parts[1]);
  const minor = Number(parts[2]);
  if (major === IMPLEMENTED.major && minor <= IMPLEMENTED.minor) return [];

  const targetsLaterMinor = major === IMPLEMENTED.major;
  return [
    {
      path: '/specVersion',
      code: 'spec-version-unsupported',
      message:
        `document targets ${declared}; this validator implements ` +
        `${IMPLEMENTED_SPEC_VERSION}. ` +
        (targetsLaterMinor
          ? `A ${major}.${minor} document may use members or enum values added after ` +
            `${IMPLEMENTED_SPEC_VERSION}, so validating it against the ` +
            `${IMPLEMENTED_SPEC_VERSION} schema would report them as errors it cannot ` +
            `distinguish from real ones. Validate against the ${major}.${minor} schema, or ` +
            `accept the document as a downgrade-with-loss.`
          : `Major version ${major} is a different, incompatible format; the ` +
            `${IMPLEMENTED_SPEC_VERSION} schema says nothing about it.`),
      layer: 'semantic',
    },
  ];
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
  // Version negotiation first (VERSIONING §8.5): an unrecognised spec version is
  // reported alone, so no misleading 1.0 schema errors are produced beside it.
  const versionIssues = specVersionIssues(input);
  if (versionIssues.length > 0) {
    return { valid: false, issues: versionIssues };
  }
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

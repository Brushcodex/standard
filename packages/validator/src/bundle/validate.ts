/**
 * Reference validator for the BrushCodex Bundle manifest v1, plus a spec-dispatch
 * helper used when validating documents contained in a bundle.
 *
 * The manifest is validated against the normative JSON Schema (which composes the
 * Common envelope). The archive-safety semantics live in ./safe and ./read, not
 * here. The schema is imported as a bundled module, so this runs identically under
 * Node/Vitest, tooling, and a bundled Next.js route.
 */

import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { schemas } from '@brushcodex/schema';
import {
  ajvErrorToIssue,
  loadCommonSchema,
  validateCommonDocument,
  type ValidationIssue,
  type ValidationResult,
} from '../common';
import { validateRecipeDocument } from '../recipe';
import { validatePaletteDocument } from '../palette';
import { validateTechniqueDocument } from '../technique';
import { validateInventoryDocument } from '../inventory';
import { validateProjectDocument } from '../project';
import { bundleManifestSchema, type BundleEntrySpec, type BundleManifest } from './bundle';

let cachedValidate: ValidateFunction | null = null;

/** The normative Bundle manifest JSON Schema (imported as a bundled module). */
export function loadBundleSchema(): Record<string, unknown> {
  return schemas.bundle as Record<string, unknown>;
}

function getValidator(): ValidateFunction {
  if (cachedValidate === null) {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    ajv.addSchema(loadCommonSchema());
    cachedValidate = ajv.compile(loadBundleSchema());
  }
  return cachedValidate;
}

/** Validate a value against the Bundle manifest JSON Schema. */
export function validateBundleManifestAgainstSchema(input: unknown): ValidationIssue[] {
  const validate = getValidator();
  const ok = validate(input);
  if (ok) return [];
  return (validate.errors ?? []).map(ajvErrorToIssue);
}

/** Full manifest validation (schema only — safety semantics are enforced by the reader). */
export function validateBundleManifest(input: unknown): ValidationResult {
  const issues = validateBundleManifestAgainstSchema(input);
  return { valid: issues.length === 0, issues };
}

/** Thrown by {@link parseBundleManifest} when a manifest is not conformant. */
export class BundleManifestValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(`Invalid BrushCodex Bundle manifest: ${issues.map((i) => i.message).join('; ')}`);
    this.name = 'BundleManifestValidationError';
    this.issues = issues;
  }
}

/** Validate and parse an unknown value into a typed {@link BundleManifest}. */
export function parseBundleManifest(input: unknown): BundleManifest {
  const result = validateBundleManifest(input);
  if (!result.valid) {
    throw new BundleManifestValidationError(result.issues);
  }
  return bundleManifestSchema.parse(input);
}

/** Validate a contained document against the specification its bundle entry declares. */
export function validateDocumentBySpec(spec: BundleEntrySpec, value: unknown): ValidationResult {
  switch (spec) {
    case 'common':
      return validateCommonDocument(value);
    case 'recipe':
      return validateRecipeDocument(value);
    case 'palette':
      return validatePaletteDocument(value);
    case 'technique':
      return validateTechniqueDocument(value);
    case 'inventory':
      return validateInventoryDocument(value);
    case 'project':
      return validateProjectDocument(value);
    default:
      return {
        valid: false,
        issues: [
          { path: '', code: 'unknown-spec', message: `Unknown spec '${spec}'.`, layer: 'schema' },
        ],
      };
  }
}

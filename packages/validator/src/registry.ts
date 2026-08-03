/**
 * Specification registry — a single dispatch from a `spec` name to its reference
 * validator, covering every BrushCodex document format. Used by the standalone
 * validator CLI and the conformance runner (both run without the web application).
 */

import { validateCommonDocument, type ValidationResult } from './common';
import { validateRecipeDocument } from './recipe';
import { validatePaletteDocument } from './palette';
import { validateTechniqueDocument } from './technique';
import { validateInventoryDocument } from './inventory';
import { validateProjectDocument } from './project';
import { validateBundleManifest } from './bundle';

/** Every specification a top-level document may declare. */
export const SPEC_NAMES = [
  'common',
  'recipe',
  'palette',
  'technique',
  'inventory',
  'project',
  'bundle',
] as const;

export type SpecName = (typeof SPEC_NAMES)[number];

const VALIDATORS: Record<SpecName, (value: unknown) => ValidationResult> = {
  common: validateCommonDocument,
  recipe: validateRecipeDocument,
  palette: validatePaletteDocument,
  technique: validateTechniqueDocument,
  inventory: validateInventoryDocument,
  project: validateProjectDocument,
  bundle: validateBundleManifest,
};

/** Whether a value is a known specification name. */
export function isSpecName(value: unknown): value is SpecName {
  return typeof value === 'string' && (SPEC_NAMES as readonly string[]).includes(value);
}

/** Validate a value against a specific specification. */
export function validateBySpec(spec: SpecName, value: unknown): ValidationResult {
  return VALIDATORS[spec](value);
}

/** The declared `spec` of a parsed document, if it names a known specification. */
export function detectSpec(value: unknown): SpecName | null {
  if (value !== null && typeof value === 'object' && 'spec' in value) {
    const declared = (value as { spec: unknown }).spec;
    if (isSpecName(declared)) return declared;
  }
  return null;
}

export interface DocumentValidation {
  spec: SpecName | null;
  result: ValidationResult;
}

/**
 * Detect a document's declared spec and validate it. Returns a
 * `null` spec with an issue when the value has no recognised `spec`.
 */
export function validateAnyDocument(value: unknown): DocumentValidation {
  const spec = detectSpec(value);
  if (spec === null) {
    return {
      spec: null,
      result: {
        valid: false,
        issues: [
          {
            path: '',
            code: 'unknown-spec',
            message:
              "Document has no recognised 'spec' field (expected one of: " +
              `${SPEC_NAMES.join(', ')}).`,
            layer: 'schema',
          },
        ],
      },
    };
  }
  return { spec, result: validateBySpec(spec, value) };
}

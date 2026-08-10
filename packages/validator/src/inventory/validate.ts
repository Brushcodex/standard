/**
 * Reference validator for the BrushCodex Paint Inventory v1 document format.
 *
 * Two layers, matching the other spec validators:
 *   1. schema   — validated against the normative inventory JSON Schema, which
 *                 composes the Common envelope. Ajv (draft 2020-12) with the
 *                 published common schema registered so the cross-schema $ref
 *                 resolves.
 *   2. semantic — envelope prose rules (e.g. updatedAt >= createdAt).
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
import { inventoryDocumentSchema, type InventoryDocument } from './inventory';

let cachedValidate: ValidateFunction | null = null;

/**
 * The normative Inventory v1 JSON Schema, imported as a bundled module. Same
 * published artifact as the file in `schemas/`.
 */
export function loadInventorySchema(): Record<string, unknown> {
  return schemas.inventory as Record<string, unknown>;
}

function getValidator(): ValidateFunction {
  if (cachedValidate === null) {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    // The inventory schema $refs the common envelope by its $id; register it first.
    ajv.addSchema(loadCommonSchema());
    cachedValidate = ajv.compile(loadInventorySchema());
  }
  return cachedValidate;
}

/** Validate against the normative Inventory JSON Schema only. */
export function validateInventoryAgainstSchema(input: unknown): ValidationIssue[] {
  const validate = getValidator();
  const ok = validate(input);
  if (ok) return [];
  return (validate.errors ?? []).map(ajvErrorToIssue);
}

/** Full reference validation: JSON Schema, then envelope prose rules. */
export function validateInventoryDocument(input: unknown): ValidationResult {
  // Version negotiation first (VERSIONING §8.5): an unrecognised spec version is
  // reported alone, so no misleading 1.0 schema errors are produced beside it.
  const versionIssues = specVersionIssues(input);
  if (versionIssues.length > 0) {
    return { valid: false, issues: versionIssues };
  }
  const schemaIssues = validateInventoryAgainstSchema(input);
  if (schemaIssues.length > 0) {
    return { valid: false, issues: schemaIssues };
  }
  const parsed = inventoryDocumentSchema.parse(input);
  const semantic = envelopeSemanticIssues(parsed);
  return { valid: semantic.length === 0, issues: semantic };
}

/** Thrown by {@link parseInventoryDocument} when a document is not conformant. */
export class InventoryValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(`Invalid BrushCodex Inventory document: ${issues.map((i) => i.message).join('; ')}`);
    this.name = 'InventoryValidationError';
    this.issues = issues;
  }
}

/** Validate and parse an unknown value into a typed {@link InventoryDocument}. */
export function parseInventoryDocument(input: unknown): InventoryDocument {
  const result = validateInventoryDocument(input);
  if (!result.valid) {
    throw new InventoryValidationError(result.issues);
  }
  return inventoryDocumentSchema.parse(input);
}

/** Serialize an inventory to its canonical JSON string (shared canonical form). */
export function serializeInventoryDocument(doc: InventoryDocument): string {
  return toCanonicalJson(doc);
}

/** Validate + parse, then re-serialize canonically. Proves a loss-free round trip. */
export function roundTripInventoryDocument(input: unknown): {
  document: InventoryDocument;
  canonical: string;
} {
  const document = parseInventoryDocument(input);
  return { document, canonical: serializeInventoryDocument(document) };
}

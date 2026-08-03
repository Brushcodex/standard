// @brushcodex/schema — the canonical BrushCodex JSON Schemas as data. Zero dependencies.
//
// Self-contained: the schemas are inlined into generated/schemas.generated.js by
// scripts/generate.mjs from the canonical root schemas/ (single source of truth), so the
// published package carries the artifacts and needs no filesystem or repo-relative paths.
// Regenerate with: pnpm --filter @brushcodex/schema generate

import {
  common,
  recipe,
  palette,
  inventory,
  project,
  technique,
  bundle,
} from './generated/schemas.generated.js';

/** Every published specification's v1 JSON Schema, keyed by spec name. */
export const schemas = Object.freeze({
  common,
  recipe,
  palette,
  inventory,
  project,
  technique,
  bundle,
});

/** Map of schema `$id` -> schema object, for validators that resolve `$ref`s by `$id`. */
export const schemaById = Object.freeze(
  Object.fromEntries(Object.values(schemas).map((s) => [s.$id, s])),
);

/** The spec names for which a v1 schema exists. */
export const SPEC_NAMES = Object.freeze(Object.keys(schemas));

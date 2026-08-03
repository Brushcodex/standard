/**
 * @brushcodex/validator — reference validators, conformance runner, and renderer
 * for the BrushCodex open standard.
 *
 * Framework-agnostic and application-independent: it runs under Node/Vitest and
 * tooling without any web application. It loads the normative JSON Schemas from
 * the repository's `schemas/` directory (the single source of truth) so it can
 * never drift from the artifacts implementers consume. Extracted, unmodified,
 * from the reference application's `src/modules/standards/**` (see the repo
 * PROVENANCE.md).
 */

// Primary flat entry points: spec dispatch + corpus conformance.
export * from './registry';
export * from './conformance';

// Per-spec reference models + validators (validate / parse / serialize / round-trip),
// namespaced so that building blocks several specs define (e.g. PaintRef, TARGET_KINDS)
// do not collide at the top level. Use e.g. `recipe.parseRecipeDocument(...)`.
export * as common from './common';
export * as recipe from './recipe';
export * as palette from './palette';
export * as inventory from './inventory';
export * as project from './project';
export * as technique from './technique';
export * as bundle from './bundle';

// Reference HTML renderer.
export * as render from './render';

// Authoring helpers: build documents that are valid by construction, and revise
// them without breaking the envelope's rules.
export * as authoring from './authoring';

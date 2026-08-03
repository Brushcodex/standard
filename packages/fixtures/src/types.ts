/**
 * Types for the BrushCodex fixture corpus. Pure declarations — no runtime, no `node:*`,
 * safe to import in any environment.
 */

/**
 * The seven canonical BrushCodex specifications. A fixture's `spec` IS its document type:
 * it is the specification the fixture is validated against (`validateBySpec(fixture.spec, …)`
 * in `@brushcodex/validator`). Kept as a local literal union (not imported from the validator)
 * so the default entry stays dependency-free.
 */
export type SpecName =
  | 'common'
  | 'recipe'
  | 'palette'
  | 'inventory'
  | 'project'
  | 'technique'
  | 'bundle';

/** Whether a fixture is a positive (`valid`) or negative (`invalid`) conformance case. */
export type FixtureCategory = 'valid' | 'invalid';

/**
 * For an invalid fixture, the exact failure it is designed to trigger (from the corpus'
 * per-spec `invalid/EXPECTATIONS.json`).
 *
 * - `schema`  — rejected by the composed JSON Schema; `keyword`/`instancePath` locate it.
 * - `semantic`— schema-valid but violates a prose rule the reference validator enforces
 *   (e.g. anchor-integrity); `rule` names it.
 */
export type FixtureExpectation =
  | { readonly layer: 'schema'; readonly keyword: string; readonly instancePath: string; readonly reason: string }
  | { readonly layer: 'semantic'; readonly rule: string; readonly reason: string };

/** One corpus fixture: stable identity + metadata. The document *content* is not embedded here;
 * load it with `loadFixture`/`loadFixtureText` from `@brushcodex/fixtures/node`. */
export interface BrushCodexFixture {
  /** Stable, human-readable id — e.g. `recipe/comprehensive.valid`, `recipe/invalid/missing-steps`. */
  readonly id: string;
  /** The specification the fixture is validated against (its document type). */
  readonly spec: SpecName;
  /** Positive or negative conformance case. */
  readonly category: FixtureCategory;
  /** POSIX path to the document under the package's `corpus/` root (e.g. `examples/recipe/v1/minimal.valid.json`). */
  readonly relativePath: string;
  /** `true` for `*.valid.json`, `false` for `invalid/*.json`. Mirrors `category`. */
  readonly expectedValid: boolean;
  /** Human-readable note (the intended-violation reason for invalid fixtures). */
  readonly description?: string;
  /** The intended failure for an invalid fixture (absent for valid fixtures). */
  readonly expectation?: FixtureExpectation;
}

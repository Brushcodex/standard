/**
 * The fixture manifest and pure (browser-safe) selectors over it. No `node:*`, no document
 * content — just stable identity + metadata. Load document content with the loaders in
 * `@brushcodex/fixtures/node`.
 */

import type { BrushCodexFixture, SpecName } from './types';
import { fixtures } from './manifest.generated.js';

export { fixtures };

/** Every positive conformance case (must validate against its `spec`). */
export const validFixtures: readonly BrushCodexFixture[] = fixtures.filter((f) => f.expectedValid);

/** Every negative conformance case (must be rejected as its `spec`). */
export const invalidFixtures: readonly BrushCodexFixture[] = fixtures.filter((f) => !f.expectedValid);

const byId = new Map(fixtures.map((f) => [f.id, f]));

/** Look up a fixture by its stable id. Throws if the id is unknown (fixtures are a closed set). */
export function getFixture(id: string): BrushCodexFixture {
  const fixture = byId.get(id);
  if (!fixture) {
    throw new Error(
      `Unknown fixture id: ${JSON.stringify(id)}. See the manifest (@brushcodex/fixtures) for valid ids.`,
    );
  }
  return fixture;
}

/** All fixtures for one specification, in manifest order. */
export function fixturesBySpec(spec: SpecName): readonly BrushCodexFixture[] {
  return fixtures.filter((f) => f.spec === spec);
}

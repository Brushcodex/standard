/**
 * @brushcodex/fixtures — the canonical BrushCodex example & conformance fixture corpus.
 *
 * The default entry is browser-safe: types, the fixture manifest, and pure selectors over it.
 * It embeds no document content and imports no `node:*` module. To read a fixture's document
 * content (or the corpus directory, e.g. for the conformance runner), import the Node loaders
 * from `@brushcodex/fixtures/node`.
 */

export type {
  BrushCodexFixture,
  FixtureCategory,
  FixtureExpectation,
  SpecName,
} from './types';
export { fixtures, validFixtures, invalidFixtures, getFixture, fixturesBySpec } from './manifest.js';

/**
 * @brushcodex/fixtures/node — Node-only loaders for the packed corpus.
 *
 * The corpus ships inside the package (`corpus/examples/**`), so these resolve relative to this
 * module and work from an installed/packed tarball with no repository-relative escape. Intended
 * for tests, scripts, and the conformance runner — never a browser bundle.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrushCodexFixture } from './types';
import { getFixture } from './manifest.js';

/** Absolute path to the shipped corpus root (contains `examples/`). */
export const corpusRoot: string = fileURLToPath(new URL('../corpus', import.meta.url));

/**
 * Absolute path to the shipped `examples/` directory. Feed this to
 * `runConformance` from `@brushcodex/validator` to run the whole corpus.
 */
export const examplesRoot: string = join(corpusRoot, 'examples');

/** Absolute path to a single fixture's document file. */
export function fixturePath(idOrFixture: string | BrushCodexFixture): string {
  const fixture = typeof idOrFixture === 'string' ? getFixture(idOrFixture) : idOrFixture;
  return join(corpusRoot, fixture.relativePath);
}

/** Read a fixture's raw JSON text. */
export function loadFixtureText(idOrFixture: string | BrushCodexFixture): string {
  return readFileSync(fixturePath(idOrFixture), 'utf8');
}

/** Read and parse a fixture's JSON document. */
export function loadFixture(idOrFixture: string | BrushCodexFixture): unknown {
  return JSON.parse(loadFixtureText(idOrFixture));
}

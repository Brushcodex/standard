/**
 * @brushcodex/fixtures tests. Proves the manifest is complete, stable, and truthful:
 * every canonical fixture appears once, every path resolves inside the package, no private
 * file leaks in, and the metadata agrees with what @brushcodex/validator actually does.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runConformance, validateBySpec, SPEC_NAMES } from '@brushcodex/validator';
import type { SpecName } from './types';
import {
  fixtures,
  validFixtures,
  invalidFixtures,
  getFixture,
  fixturesBySpec,
} from './index';
import {
  corpusRoot,
  examplesRoot,
  fixturePath,
  loadFixture,
  loadFixtureText,
} from './node';

/** Every fixture document actually on disk under the packed corpus (source of truth for coverage). */
function onDiskFixtureRelPaths(): string[] {
  const out: string[] = [];
  for (const spec of SPEC_NAMES) {
    const versionDir = `${examplesRoot}/${spec}/v1`;
    for (const name of readdirSync(versionDir, { withFileTypes: true })) {
      if (name.isFile() && name.name.endsWith('.valid.json')) {
        out.push(`examples/${spec}/v1/${name.name}`);
      }
    }
    const invalidDir = `${versionDir}/invalid`;
    for (const name of readdirSync(invalidDir)) {
      if (name.endsWith('.json') && name !== 'EXPECTATIONS.json') {
        out.push(`examples/${spec}/v1/invalid/${name}`);
      }
    }
  }
  return out.sort();
}

describe('manifest completeness & identity', () => {
  it('splits cleanly into valid + invalid with nothing left over', () => {
    expect(validFixtures.length + invalidFixtures.length).toBe(fixtures.length);
    expect(fixtures.every((f) => f.expectedValid === (f.category === 'valid'))).toBe(true);
  });

  it('every fixture id is unique', () => {
    const ids = fixtures.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every on-disk fixture appears exactly once, and the manifest invents nothing', () => {
    const manifestPaths = fixtures.map((f) => f.relativePath).sort();
    expect(manifestPaths).toEqual(onDiskFixtureRelPaths());
  });

  it('covers all seven canonical specs', () => {
    expect(new Set(fixtures.map((f) => f.spec))).toEqual(new Set(SPEC_NAMES));
  });
});

describe('manifest paths resolve inside the package', () => {
  it('every fixture path is absolute, contained in corpusRoot, and exists', () => {
    for (const f of fixtures) {
      const p = fixturePath(f.id);
      expect(isAbsolute(p)).toBe(true);
      const rel = relative(corpusRoot, p);
      expect(rel.startsWith('..')).toBe(false);
      expect(isAbsolute(rel)).toBe(false);
      expect(existsSync(p)).toBe(true);
    }
  });

  it('no relativePath traverses out of examples/', () => {
    for (const f of fixtures) {
      expect(f.relativePath.startsWith('examples/')).toBe(true);
      expect(f.relativePath.split('/').includes('..')).toBe(false);
    }
  });
});

describe('no private or application-specific files enter the package', () => {
  it('corpus/examples holds only the seven spec directories and the LICENSE', () => {
    const top = readdirSync(examplesRoot).sort();
    const expected: string[] = [...SPEC_NAMES, 'LICENSE'].sort();
    expect(top).toEqual(expected);
  });

  it('EXPECTATIONS.json and LICENSE are metadata, never fixtures', () => {
    for (const f of fixtures) {
      expect(f.relativePath.endsWith('EXPECTATIONS.json')).toBe(false);
      expect(f.relativePath.endsWith('/LICENSE')).toBe(false);
      expect(f.relativePath.endsWith('.json')).toBe(true);
    }
  });
});

describe('metadata agrees with @brushcodex/validator', () => {
  it('every valid fixture validates against its spec', () => {
    for (const f of validFixtures) {
      const result = validateBySpec(f.spec as SpecName, loadFixture(f.id));
      expect(result.valid, `${f.id}: ${result.issues.map((i) => i.message).join('; ')}`).toBe(true);
    }
  });

  it('every invalid fixture is rejected as its spec', () => {
    for (const f of invalidFixtures) {
      expect(validateBySpec(f.spec as SpecName, loadFixture(f.id)).valid, f.id).toBe(false);
    }
  });

  it('every invalid fixture fails for its intended, documented reason', () => {
    for (const f of invalidFixtures) {
      const expectation = f.expectation;
      expect(expectation, `${f.id} lacks an expectation`).toBeDefined();
      if (!expectation) continue;
      const { issues } = validateBySpec(f.spec as SpecName, loadFixture(f.id));
      const matched =
        expectation.layer === 'schema'
          ? issues.some(
              (i) =>
                i.layer === 'schema' &&
                i.code === expectation.keyword &&
                i.path === expectation.instancePath,
            )
          : issues.some((i) => i.layer === 'semantic' && i.code === expectation.rule);
      expect(
        matched,
        `${f.id}: expected ${JSON.stringify(expectation)}, got ${JSON.stringify(
          issues.map((i) => ({ layer: i.layer, code: i.code, path: i.path })),
        )}`,
      ).toBe(true);
    }
  });
});

describe('conformance runner over the packed corpus', () => {
  it('runConformance(examplesRoot) passes for the whole shipped corpus', () => {
    const report = runConformance(examplesRoot);
    expect(report.failed).toBe(0);
    expect(report.total).toBe(fixtures.length);
  });
});

describe('manifest generation is deterministic', () => {
  it('regenerating leaves the committed manifest byte-identical', () => {
    const manifestPath = fileURLToPath(new URL('./manifest.generated.ts', import.meta.url));
    const generator = fileURLToPath(new URL('../scripts/generate-manifest.mjs', import.meta.url));
    const before = readFileSync(manifestPath, 'utf8');
    execFileSync(process.execPath, [generator], { stdio: 'ignore' });
    expect(readFileSync(manifestPath, 'utf8')).toBe(before);
  });
});

describe('public API', () => {
  it('getFixture returns the fixture and throws on an unknown id', () => {
    expect(getFixture('recipe/minimal.valid').spec).toBe('recipe');
    expect(() => getFixture('nope/does-not-exist')).toThrow(/Unknown fixture id/);
  });

  it('loadFixture parses JSON; loadFixtureText returns the raw text', () => {
    const doc = loadFixture('recipe/minimal.valid') as { spec: string };
    expect(doc.spec).toBe('recipe');
    expect(loadFixtureText('recipe/minimal.valid')).toContain('"spec"');
  });

  it('fixturesBySpec returns only that spec', () => {
    const recipeFixtures = fixturesBySpec('recipe');
    expect(recipeFixtures.length).toBeGreaterThan(0);
    expect(recipeFixtures.every((f) => f.spec === 'recipe')).toBe(true);
  });
});

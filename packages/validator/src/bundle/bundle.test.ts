/**
 * Conformance + security tests for BrushCodex Bundle v1 (DRAFT).
 *
 * Covers the manifest schema against its corpus, the safe-archive guards
 * (path traversal, unsupported content, oversized/over-count archives), a real
 * write -> read round trip, and rejection of malicious/invalid archives.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { bundleManifestSchema } from './bundle';
import {
  BundleManifestValidationError,
  loadBundleSchema,
  parseBundleManifest,
  validateBundleManifestAgainstSchema,
  validateBundleManifest,
} from './validate';
import {
  BundleSafetyError,
  BundleSizeTracker,
  MAX_BUNDLE_ENTRIES,
  MAX_ENTRY_BYTES,
  assertSafeEntry,
  extensionOf,
  isSafeEntryPath,
  mediaTypeForPath,
} from './safe';
import { BundleContentError, readBundle } from './read';
import { writeBundle } from './write';

const EXAMPLES_DIR = new URL('../../../../examples/bundle/v1/', import.meta.url);

function readExample(relativePath: string): unknown {
  return JSON.parse(readFileSync(fileURLToPath(new URL(relativePath, EXAMPLES_DIR)), 'utf8'));
}

const VALID_FILES = ['minimal.valid.json', 'comprehensive.valid.json'] as const;

interface ExpectationCase {
  file: string;
  layer: 'schema' | 'semantic';
  reason: string;
  expect: { keyword?: string; instancePath?: string };
}
const expectations = readExample('invalid/EXPECTATIONS.json') as { cases: ExpectationCase[] };

const MINIMAL_RECIPE = {
  spec: 'recipe',
  specVersion: '1.0.0',
  id: 'urn:uuid:11111111-1111-4111-8111-111111111111',
  revision: 'r1',
  title: 'Bundled recipe',
  steps: [{ instruction: 'Basecoat.' }],
};
const MINIMAL_PALETTE = {
  spec: 'palette',
  specVersion: '1.0.0',
  id: 'urn:uuid:22222222-2222-4222-8222-222222222222',
  revision: 'r1',
  title: 'Bundled palette',
  entries: [{ name: 'Steel', color: { hex: '#8a8d90' } }],
};

function validManifest(entries: unknown[]): Record<string, unknown> {
  return {
    spec: 'bundle',
    specVersion: '1.0.0',
    id: 'urn:uuid:33333333-3333-4333-8333-333333333333',
    revision: 'r1',
    title: 'Test bundle',
    entries,
  };
}

describe('Bundle manifest — published JSON Schema', () => {
  it('is a well-formed draft 2020-12 schema that composes the Common envelope', () => {
    const schema = loadBundleSchema();
    expect(schema.$id).toBe('https://brushcodex.com/schemas/bundle/v1/bundle.schema.json');
    expect(schema.unevaluatedProperties).toBe(false);
  });

  it.each(VALID_FILES)('%s validates and parses', (file) => {
    const doc = readExample(file);
    expect(validateBundleManifest(doc)).toEqual({ valid: true, issues: [] });
    expect(parseBundleManifest(doc).spec).toBe('bundle');
  });

  it('every invalid fixture has a declared expectation', () => {
    const onDisk = readdirSync(fileURLToPath(new URL('invalid/', EXAMPLES_DIR)))
      .filter((name) => name.endsWith('.json') && name !== 'EXPECTATIONS.json')
      .sort();
    expect(expectations.cases.map((c) => c.file).sort()).toEqual(onDisk);
  });

  it.each(expectations.cases.map((c) => [c.file, c] as const))(
    '%s is rejected as documented',
    (_file, testCase) => {
      const doc = readExample(`invalid/${testCase.file}`);
      const issues = validateBundleManifestAgainstSchema(doc);
      expect(issues.length).toBeGreaterThan(0);
      expect(
        issues.some(
          (issue) =>
            (testCase.expect.keyword === undefined || issue.code === testCase.expect.keyword) &&
            (testCase.expect.instancePath === undefined ||
              issue.path === testCase.expect.instancePath),
        ),
      ).toBe(true);
      // The Zod model agrees.
      expect(bundleManifestSchema.safeParse(doc).success).toBe(false);
    },
  );
});

describe('Bundle — safe-archive guards', () => {
  it('rejects traversal, absolute, backslash, drive-letter, and NUL paths', () => {
    for (const bad of [
      '../evil.json',
      'a/../b.json',
      '/etc/passwd',
      'a\\b.json',
      'C:/x.json',
      'a\0b.json',
      '',
      './x.json',
    ]) {
      expect(isSafeEntryPath(bad)).toBe(false);
    }
    for (const good of [
      'manifest.json',
      'documents/recipe.json',
      'media/photo.png',
      'a-b_c.1.json',
    ]) {
      expect(isSafeEntryPath(good)).toBe(true);
    }
  });

  it('maps extensions to permitted media types and rejects others', () => {
    expect(extensionOf('media/p.PNG')).toBe('png');
    expect(mediaTypeForPath('media/p.png')).toBe('image/png');
    expect(mediaTypeForPath('media/p.jpg')).toBe('image/jpeg');
    expect(mediaTypeForPath('doc.json')).toBeNull(); // json is not a media type
    expect(mediaTypeForPath('evil.svg')).toBeNull();
  });

  it('assertSafeEntry throws on unsafe path, unsupported type, and oversize', () => {
    expect(() => assertSafeEntry('../evil.json', 10)).toThrow(BundleSafetyError);
    expect(() => assertSafeEntry('evil.exe', 10)).toThrow(/Unsupported/);
    expect(() => assertSafeEntry('evil.svg', 10)).toThrow(/Unsupported/);
    expect(() => assertSafeEntry('big.json', MAX_ENTRY_BYTES + 1)).toThrow(/uncompressed/);
    expect(() => assertSafeEntry('ok.json', 10)).not.toThrow();
  });

  it('BundleSizeTracker enforces the entry-count and total-size limits', () => {
    const counter = new BundleSizeTracker();
    expect(() => {
      for (let i = 0; i <= MAX_BUNDLE_ENTRIES; i += 1) counter.add(1);
    }).toThrow(/more than/);

    const sizer = new BundleSizeTracker();
    expect(() => sizer.add(MAX_ENTRY_BYTES * 5)).toThrow(/exceeds/);
  });
});

describe('Bundle — write then read round trip', () => {
  it('assembles and reads back a bundle with two documents', () => {
    const zip = writeBundle({
      id: 'urn:brushcodex:bundle:test',
      title: 'Rusted armour bundle',
      documents: [
        { path: 'documents/recipe.brushrecipe.json', spec: 'recipe', document: MINIMAL_RECIPE },
        { path: 'documents/palette.brushpalette.json', spec: 'palette', document: MINIMAL_PALETTE },
      ],
    });
    expect(zip).toBeInstanceOf(Uint8Array);

    const result = readBundle(zip);
    expect(result.manifest.spec).toBe('bundle');
    expect(result.manifest.entries).toHaveLength(2);
    expect(result.documents.map((d) => d.spec).sort()).toEqual(['palette', 'recipe']);
    const recipe = result.documents.find((d) => d.spec === 'recipe');
    expect((recipe?.document as { title: string }).title).toBe('Bundled recipe');
  });

  it('refuses to write an unsafe document path', () => {
    expect(() =>
      writeBundle({
        id: 'urn:x',
        title: 'x',
        documents: [{ path: '../escape.json', spec: 'recipe', document: MINIMAL_RECIPE }],
      }),
    ).toThrow(BundleSafetyError);
  });
});

describe('Bundle — malicious / invalid archives are rejected', () => {
  it('rejects a ZIP containing a path-traversal entry (before decompression)', () => {
    const zip = zipSync({
      'manifest.json': strToU8(
        JSON.stringify(
          validManifest([
            { path: 'documents/r.json', spec: 'recipe', mediaType: 'application/json' },
          ]),
        ),
      ),
      'documents/r.json': strToU8(JSON.stringify(MINIMAL_RECIPE)),
      '../evil.json': strToU8('{}'),
    });
    expect(() => readBundle(zip)).toThrow(BundleSafetyError);
  });

  it('rejects a ZIP containing unsupported/executable content', () => {
    const zip = zipSync({
      'manifest.json': strToU8(
        JSON.stringify(
          validManifest([{ path: 'a.json', spec: 'recipe', mediaType: 'application/json' }]),
        ),
      ),
      'evil.exe': strToU8('MZ'),
    });
    expect(() => readBundle(zip)).toThrow(/Unsupported/);
  });

  it('rejects a bundle with no manifest.json', () => {
    const zip = zipSync({ 'documents/r.json': strToU8(JSON.stringify(MINIMAL_RECIPE)) });
    expect(() => readBundle(zip)).toThrow(BundleManifestValidationError);
  });

  it('rejects a manifest that references a missing file', () => {
    const zip = zipSync({
      'manifest.json': strToU8(
        JSON.stringify(
          validManifest([
            { path: 'documents/missing.json', spec: 'recipe', mediaType: 'application/json' },
          ]),
        ),
      ),
    });
    expect(() => readBundle(zip)).toThrow(BundleContentError);
  });

  it('rejects a bundle whose contained document is non-conformant', () => {
    const badRecipe = {
      spec: 'recipe',
      specVersion: '1.0.0',
      id: 'urn:uuid:44444444-4444-4444-8444-444444444444',
      revision: 'r1',
      title: 'No steps',
    };
    const zip = zipSync({
      'manifest.json': strToU8(
        JSON.stringify(
          validManifest([
            { path: 'documents/bad.json', spec: 'recipe', mediaType: 'application/json' },
          ]),
        ),
      ),
      'documents/bad.json': strToU8(JSON.stringify(badRecipe)),
    });
    expect(() => readBundle(zip)).toThrow(BundleContentError);
  });
});

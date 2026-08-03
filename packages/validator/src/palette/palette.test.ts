/**
 * Conformance tests for the BrushCodex Palette v1 (DRAFT).
 *
 * Exercises the published artifacts on disk — the palette JSON Schema (which
 * composes the Common envelope) and the example corpus — so prose, schema,
 * examples, and the reference model stay in lockstep, including the honesty rule
 * that a palette with purely literal paint references validates and round-trips.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { paletteDocumentSchema } from './palette';
import {
  PaletteValidationError,
  loadPaletteSchema,
  parsePaletteDocument,
  roundTripPaletteDocument,
  serializePaletteDocument,
  validatePaletteAgainstSchema,
  validatePaletteDocument,
} from './validate';

const EXAMPLES_DIR = new URL('../../../../examples/palette/v1/', import.meta.url);

function readExample(relativePath: string): unknown {
  const url = new URL(relativePath, EXAMPLES_DIR);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
}

const VALID_FILES = [
  'minimal.valid.json',
  'comprehensive.valid.json',
  'literal-only.valid.json',
] as const;

interface ExpectationCase {
  file: string;
  layer: 'schema' | 'semantic';
  reason: string;
  expect: { keyword?: string; instancePath?: string; rule?: string };
}

const expectations = readExample('invalid/EXPECTATIONS.json') as { cases: ExpectationCase[] };

function zodAccepts(input: unknown): boolean {
  return paletteDocumentSchema.safeParse(input).success;
}

describe('Palette — published JSON Schema', () => {
  it('is a well-formed draft 2020-12 schema that composes the Common envelope', () => {
    const schema = loadPaletteSchema();
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$id).toBe('https://brushcodex.com/schemas/palette/v1/palette.schema.json');
    expect(schema.unevaluatedProperties).toBe(false);
    const allOf = schema.allOf as Array<{ $ref?: string }>;
    expect(allOf[0]?.$ref).toBe(
      'https://brushcodex.com/schemas/common/v1/common.schema.json#/$defs/envelopeCore',
    );
  });
});

describe('Palette — valid examples', () => {
  it.each(VALID_FILES)('%s validates against the schema and semantic rules', (file) => {
    const doc = readExample(file);
    expect(validatePaletteAgainstSchema(doc)).toEqual([]);
    expect(validatePaletteDocument(doc)).toEqual({ valid: true, issues: [] });
  });

  it.each(VALID_FILES)('%s parses into the typed palette model', (file) => {
    expect(parsePaletteDocument(readExample(file)).spec).toBe('palette');
  });

  it('a literal-only palette has no catalogue ids or colors on its paints', () => {
    const doc = parsePaletteDocument(readExample('literal-only.valid.json'));
    for (const entry of doc.entries) {
      if (entry.paint) {
        expect(entry.paint.catalogueId).toBeUndefined();
        expect(entry.paint.color).toBeUndefined();
        expect(entry.paint.manufacturer !== undefined || entry.paint.name !== undefined).toBe(true);
      }
    }
  });
});

describe('Palette — invalid examples fail for the intended reason', () => {
  it('every invalid fixture on disk has a declared expectation', () => {
    const onDisk = readdirSync(fileURLToPath(new URL('invalid/', EXAMPLES_DIR)))
      .filter((name) => name.endsWith('.json') && name !== 'EXPECTATIONS.json')
      .sort();
    const declared = expectations.cases.map((c) => c.file).sort();
    expect(declared).toEqual(onDisk);
  });

  it.each(expectations.cases.map((c) => [c.file, c] as const))(
    '%s is rejected as documented',
    (_file, testCase) => {
      const doc = readExample(`invalid/${testCase.file}`);
      const schemaIssues = validatePaletteAgainstSchema(doc);
      const full = validatePaletteDocument(doc);

      expect(full.valid).toBe(false);

      if (testCase.layer === 'schema') {
        expect(schemaIssues.length).toBeGreaterThan(0);
        expect(
          schemaIssues.some(
            (issue) =>
              (testCase.expect.keyword === undefined || issue.code === testCase.expect.keyword) &&
              (testCase.expect.instancePath === undefined ||
                issue.path === testCase.expect.instancePath),
          ),
        ).toBe(true);
      } else {
        expect(schemaIssues).toEqual([]);
        expect(
          full.issues.some(
            (issue) => issue.layer === 'semantic' && issue.code === testCase.expect.rule,
          ),
        ).toBe(true);
      }
    },
  );
});

describe('Palette — Zod model agrees with the JSON Schema on the corpus', () => {
  it.each(VALID_FILES)('accepts %s', (file) => {
    const doc = readExample(file);
    expect(validatePaletteAgainstSchema(doc)).toEqual([]);
    expect(zodAccepts(doc)).toBe(true);
  });

  it.each(expectations.cases.map((c) => [c.file, c] as const))(
    'agrees on %s',
    (_file, testCase) => {
      const doc = readExample(`invalid/${testCase.file}`);
      const schemaValid = validatePaletteAgainstSchema(doc).length === 0;
      expect(zodAccepts(doc)).toBe(schemaValid);
      expect(schemaValid).toBe(testCase.layer === 'semantic');
    },
  );
});

describe('Palette — canonical round trip', () => {
  it('parse -> serialize -> parse preserves every supported member', () => {
    const first = parsePaletteDocument(readExample('comprehensive.valid.json'));
    const reparsed = parsePaletteDocument(JSON.parse(serializePaletteDocument(first)));
    expect(reparsed).toEqual(first);
  });

  it('preserves unknown namespaced extensions unchanged', () => {
    const { document } = roundTripPaletteDocument(readExample('comprehensive.valid.json'));
    expect(document.extensions).toEqual({
      'com.example.tool:swatchOrder': { order: ['steel', 'rust', 'bone'] },
    });
  });

  it('preserves mixtures and relationships', () => {
    const doc = parsePaletteDocument(readExample('comprehensive.valid.json'));
    const mixEntry = doc.entries.find((entry) => entry.mix !== undefined);
    expect(mixEntry?.mix).toEqual([
      { paint: 'steel', parts: 3 },
      { paint: 'bone', parts: 1 },
    ]);
    expect(doc.relationships?.map((relationship) => relationship.type)).toEqual([
      'shadow_to_highlight',
      'complementary',
    ]);
  });
});

describe('Palette — anchor integrity (semantic)', () => {
  it('rejects a mixture that references an undeclared entry anchor', () => {
    const result = validatePaletteDocument(readExample('invalid/dangling-mix-anchor.json'));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'entry-anchor-resolves')).toBe(true);
  });

  it('rejects a relationship that references an undeclared entry anchor', () => {
    const result = validatePaletteDocument(
      readExample('invalid/dangling-relationship-anchor.json'),
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'entry-anchor-resolves')).toBe(true);
  });

  it('accepts a palette whose anchors all resolve', () => {
    expect(validatePaletteDocument(readExample('literal-only.valid.json')).valid).toBe(true);
  });
});

describe('Palette — parse errors', () => {
  it('throws a structured PaletteValidationError on an invalid document', () => {
    try {
      parsePaletteDocument(readExample('invalid/missing-entries.json'));
      expect.unreachable('parsePaletteDocument should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(PaletteValidationError);
      expect((error as PaletteValidationError).issues.length).toBeGreaterThan(0);
    }
  });
});

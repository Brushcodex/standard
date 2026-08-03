/**
 * Conformance tests for the BrushCodex Common Document Envelope v1 (DRAFT).
 *
 * These tests exercise the *published* artifacts — the JSON Schema and the
 * example corpus on disk — so prose, schema, examples, and the reference model
 * cannot silently drift apart. This is the executable proof the strategy asks for
 * (schema validation -> parse -> serialize -> semantic round trip).
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { commonDocumentSchema } from './envelope';
import {
  CommonValidationError,
  loadCommonSchema,
  parseCommonDocument,
  validateAgainstSchema,
  validateCommonDocument,
} from './validate';
import {
  normalizeCommonDocument,
  roundTripCommonDocument,
  serializeCommonDocument,
  toCanonicalJson,
} from './canonical';

const EXAMPLES_DIR = new URL('../../../../examples/common/v1/', import.meta.url);

function readExample(relativePath: string): unknown {
  const url = new URL(relativePath, EXAMPLES_DIR);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
}

const VALID_FILES = ['minimal.valid.json', 'comprehensive.valid.json'] as const;

interface ExpectationCase {
  file: string;
  layer: 'schema' | 'semantic';
  reason: string;
  expect: { keyword?: string; instancePath?: string; rule?: string };
}

const expectations = readExample('invalid/EXPECTATIONS.json') as {
  cases: ExpectationCase[];
};

function zodAccepts(input: unknown): boolean {
  return commonDocumentSchema.safeParse(input).success;
}

describe('Common envelope — published JSON Schema', () => {
  it('is a well-formed draft 2020-12 schema with the expected identity', () => {
    const schema = loadCommonSchema();
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$id).toBe('https://brushcodex.com/schemas/common/v1/common.schema.json');
    // The object is closed via unevaluatedProperties so the envelope can be
    // composed (allOf'd) by concrete specs; required lives in the reusable core.
    expect(schema.unevaluatedProperties).toBe(false);
    const defs = schema.$defs as Record<string, { required?: string[] }>;
    expect(defs.envelopeCore?.required).toEqual(['spec', 'specVersion', 'id', 'revision', 'title']);
  });
});

describe('Common envelope — valid examples', () => {
  it.each(VALID_FILES)('%s validates against the schema and prose rules', (file) => {
    const doc = readExample(file);
    expect(validateAgainstSchema(doc)).toEqual([]);
    const result = validateCommonDocument(doc);
    expect(result).toEqual({ valid: true, issues: [] });
  });

  it.each(VALID_FILES)('%s parses into the typed model', (file) => {
    const doc = readExample(file);
    expect(() => parseCommonDocument(doc)).not.toThrow();
    expect(parseCommonDocument(doc).spec).toBe('common');
  });
});

describe('Common envelope — invalid examples fail for the intended reason', () => {
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
      const schemaIssues = validateAgainstSchema(doc);
      const full = validateCommonDocument(doc);

      // In every case the document must be non-conformant overall.
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
        // Semantic: schema-valid, but a prose rule rejects it.
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

describe('Common envelope — Zod model agrees with the JSON Schema on the corpus', () => {
  it.each(VALID_FILES)('accepts %s (both layers)', (file) => {
    const doc = readExample(file);
    expect(validateAgainstSchema(doc)).toEqual([]);
    expect(zodAccepts(doc)).toBe(true);
  });

  it.each(expectations.cases.map((c) => [c.file, c] as const))(
    'agrees on %s',
    (_file, testCase) => {
      const doc = readExample(`invalid/${testCase.file}`);
      const schemaValid = validateAgainstSchema(doc).length === 0;
      // The Zod model must reach the same accept/reject verdict as the raw schema.
      expect(zodAccepts(doc)).toBe(schemaValid);
      if (testCase.layer === 'schema') {
        expect(schemaValid).toBe(false);
      } else {
        expect(schemaValid).toBe(true);
      }
    },
  );
});

describe('Common envelope — canonical round trip', () => {
  it('parse -> serialize -> parse preserves every supported member', () => {
    const doc = readExample('comprehensive.valid.json');
    const first = parseCommonDocument(doc);
    const reparsed = parseCommonDocument(JSON.parse(serializeCommonDocument(first)));
    expect(reparsed).toEqual(first);
  });

  it('preserves unknown namespaced extensions unchanged', () => {
    const doc = readExample('comprehensive.valid.json');
    const { document } = roundTripCommonDocument(doc);
    expect(document.extensions).toEqual({
      'com.example.tool:layerMap': {
        version: 3,
        regions: [
          { id: 'r1', label: 'cloak', points: [0.1, 0.2, 0.3] },
          { id: 'r2', label: 'trim', nested: { deep: { keep: true } } },
        ],
      },
      'org.miniac.difficulty': 'intermediate',
    });
  });

  it('produces deterministic, key-sorted canonical JSON', () => {
    const a = toCanonicalJson({ b: 1, a: { d: 2, c: 3 } });
    const b = toCanonicalJson({ a: { c: 3, d: 2 }, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it('normalization is idempotent and lossless', () => {
    const doc = parseCommonDocument(readExample('comprehensive.valid.json'));
    const once = normalizeCommonDocument(doc);
    const twice = normalizeCommonDocument(once);
    expect(once).toEqual(doc);
    expect(serializeCommonDocument(twice)).toBe(serializeCommonDocument(once));
  });
});

describe('Common envelope — parse errors', () => {
  it('throws a structured CommonValidationError on an invalid document', () => {
    const doc = readExample('invalid/missing-required-spec.json');
    try {
      parseCommonDocument(doc);
      expect.unreachable('parseCommonDocument should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(CommonValidationError);
      const validationError = error as CommonValidationError;
      expect(validationError.issues.length).toBeGreaterThan(0);
      expect(validationError.issues.some((i) => i.code === 'required')).toBe(true);
    }
  });
});

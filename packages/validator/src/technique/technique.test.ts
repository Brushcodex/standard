/**
 * Conformance tests for the BrushCodex Technique v1 (DRAFT).
 *
 * Exercises the published artifacts on disk — the technique JSON Schema (which
 * composes the Common envelope) and the example corpus — so prose, schema,
 * examples, and the reference model stay in lockstep.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { techniqueDocumentSchema } from './technique';
import {
  TechniqueValidationError,
  loadTechniqueSchema,
  parseTechniqueDocument,
  roundTripTechniqueDocument,
  serializeTechniqueDocument,
  validateTechniqueAgainstSchema,
  validateTechniqueDocument,
} from './validate';

const EXAMPLES_DIR = new URL('../../../../examples/technique/v1/', import.meta.url);

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

const expectations = readExample('invalid/EXPECTATIONS.json') as { cases: ExpectationCase[] };

function zodAccepts(input: unknown): boolean {
  return techniqueDocumentSchema.safeParse(input).success;
}

describe('Technique — published JSON Schema', () => {
  it('is a well-formed draft 2020-12 schema that composes the Common envelope', () => {
    const schema = loadTechniqueSchema();
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$id).toBe('https://brushcodex.com/schemas/technique/v1/technique.schema.json');
    expect(schema.unevaluatedProperties).toBe(false);
    const allOf = schema.allOf as Array<{ $ref?: string }>;
    expect(allOf[0]?.$ref).toBe(
      'https://brushcodex.com/schemas/common/v1/common.schema.json#/$defs/envelopeCore',
    );
  });
});

describe('Technique — valid examples', () => {
  it.each(VALID_FILES)('%s validates against the schema and semantic rules', (file) => {
    const doc = readExample(file);
    expect(validateTechniqueAgainstSchema(doc)).toEqual([]);
    expect(validateTechniqueDocument(doc)).toEqual({ valid: true, issues: [] });
  });

  it.each(VALID_FILES)('%s parses into the typed technique model', (file) => {
    expect(parseTechniqueDocument(readExample(file)).spec).toBe('technique');
  });

  it('the simplest valid technique is an envelope plus a purpose', () => {
    const doc = parseTechniqueDocument(readExample('minimal.valid.json'));
    expect(doc.purpose.length).toBeGreaterThan(0);
    expect(doc.steps).toBeUndefined();
    expect(doc.parameters).toBeUndefined();
  });
});

describe('Technique — invalid examples fail for the intended reason', () => {
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
      const schemaIssues = validateTechniqueAgainstSchema(doc);
      const full = validateTechniqueDocument(doc);

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

describe('Technique — Zod model agrees with the JSON Schema on the corpus', () => {
  it.each(VALID_FILES)('accepts %s', (file) => {
    const doc = readExample(file);
    expect(validateTechniqueAgainstSchema(doc)).toEqual([]);
    expect(zodAccepts(doc)).toBe(true);
  });

  it.each(expectations.cases.map((c) => [c.file, c] as const))(
    'agrees on %s',
    (_file, testCase) => {
      const doc = readExample(`invalid/${testCase.file}`);
      const schemaValid = validateTechniqueAgainstSchema(doc).length === 0;
      expect(zodAccepts(doc)).toBe(schemaValid);
      expect(schemaValid).toBe(testCase.layer === 'semantic');
    },
  );
});

describe('Technique — canonical round trip', () => {
  it('parse -> serialize -> parse preserves every supported member', () => {
    const first = parseTechniqueDocument(readExample('comprehensive.valid.json'));
    const reparsed = parseTechniqueDocument(JSON.parse(serializeTechniqueDocument(first)));
    expect(reparsed).toEqual(first);
  });

  it('preserves unknown namespaced extensions unchanged', () => {
    const { document } = roundTripTechniqueDocument(readExample('comprehensive.valid.json'));
    expect(document.extensions).toEqual({
      'com.example.tool:brushProfile': { recommendedSizes: [0, 1] },
    });
  });

  it('preserves tools, parameters, problems, and variants', () => {
    const doc = parseTechniqueDocument(readExample('comprehensive.valid.json'));
    expect(doc.tools?.map((tool) => tool.name)).toEqual([
      'Fine detail brush (size 1)',
      'Wet palette',
    ]);
    expect(doc.parameters?.[0]?.typicalValue).toBe('~1:1');
    expect(doc.commonProblems?.[0]?.correction).toContain('Thin further');
    expect(doc.variants?.[0]?.name).toBe('Two-tone edge');
  });
});

describe('Technique — parse errors', () => {
  it('throws a structured TechniqueValidationError on an invalid document', () => {
    try {
      parseTechniqueDocument(readExample('invalid/missing-purpose.json'));
      expect.unreachable('parseTechniqueDocument should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(TechniqueValidationError);
      expect((error as TechniqueValidationError).issues.length).toBeGreaterThan(0);
    }
  });
});

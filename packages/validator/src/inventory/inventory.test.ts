/**
 * Conformance tests for the BrushCodex Paint Inventory v1 (DRAFT), including the
 * privacy export-profile: the shared profile removes private data while the result
 * stays a valid Inventory document, and the full document round-trips losslessly.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { inventoryDocumentSchema } from './inventory';
import {
  InventoryValidationError,
  loadInventorySchema,
  parseInventoryDocument,
  roundTripInventoryDocument,
  serializeInventoryDocument,
  validateInventoryAgainstSchema,
  validateInventoryDocument,
} from './validate';
import { hasPrivateData, toSharedInventory } from './profile';

const EXAMPLES_DIR = new URL('../../../../examples/inventory/v1/', import.meta.url);

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
  return inventoryDocumentSchema.safeParse(input).success;
}

describe('Inventory — published JSON Schema', () => {
  it('is a well-formed draft 2020-12 schema that composes the Common envelope', () => {
    const schema = loadInventorySchema();
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$id).toBe('https://brushcodex.com/schemas/inventory/v1/inventory.schema.json');
    expect(schema.unevaluatedProperties).toBe(false);
    const allOf = schema.allOf as Array<{ $ref?: string }>;
    expect(allOf[0]?.$ref).toBe(
      'https://brushcodex.com/schemas/common/v1/common.schema.json#/$defs/envelopeCore',
    );
  });
});

describe('Inventory — valid examples', () => {
  it.each(VALID_FILES)('%s validates against the schema and semantic rules', (file) => {
    const doc = readExample(file);
    expect(validateInventoryAgainstSchema(doc)).toEqual([]);
    expect(validateInventoryDocument(doc)).toEqual({ valid: true, issues: [] });
  });

  it.each(VALID_FILES)('%s parses into the typed inventory model', (file) => {
    expect(parseInventoryDocument(readExample(file)).spec).toBe('inventory');
  });
});

describe('Inventory — invalid examples fail for the intended reason', () => {
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
      const schemaIssues = validateInventoryAgainstSchema(doc);
      const full = validateInventoryDocument(doc);

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

describe('Inventory — Zod model agrees with the JSON Schema on the corpus', () => {
  it.each(VALID_FILES)('accepts %s', (file) => {
    const doc = readExample(file);
    expect(validateInventoryAgainstSchema(doc)).toEqual([]);
    expect(zodAccepts(doc)).toBe(true);
  });

  it.each(expectations.cases.map((c) => [c.file, c] as const))(
    'agrees on %s',
    (_file, testCase) => {
      const doc = readExample(`invalid/${testCase.file}`);
      const schemaValid = validateInventoryAgainstSchema(doc).length === 0;
      expect(zodAccepts(doc)).toBe(schemaValid);
      expect(schemaValid).toBe(testCase.layer === 'semantic');
    },
  );
});

describe('Inventory — canonical round trip', () => {
  it('parse -> serialize -> parse preserves every member, private data included', () => {
    const first = parseInventoryDocument(readExample('comprehensive.valid.json'));
    const reparsed = parseInventoryDocument(JSON.parse(serializeInventoryDocument(first)));
    expect(reparsed).toEqual(first);
    // Private data survives the full round trip.
    expect(reparsed.items[0]?.private?.storageLocation).toBe('Drawer 1, row 3');
  });

  it('preserves unknown namespaced extensions unchanged', () => {
    const { document } = roundTripInventoryDocument(readExample('comprehensive.valid.json'));
    expect(document.extensions).toEqual({ 'com.example.tool:sortOrder': { by: 'manufacturer' } });
  });
});

describe('Inventory — shared export profile (privacy)', () => {
  it('removes private items and strips private fields, and the result still validates', () => {
    const full = parseInventoryDocument(readExample('comprehensive.valid.json'));
    expect(hasPrivateData(full)).toBe(true);

    const shared = toSharedInventory(full);

    // The private-visibility item is gone; the two shareable items remain.
    expect(full.items).toHaveLength(3);
    expect(shared.items).toHaveLength(2);
    // No item retains a `private` object or a private visibility.
    expect(shared.items.every((item) => item.private === undefined)).toBe(true);
    expect(shared.items.every((item) => item.visibility !== 'private')).toBe(true);
    expect(hasPrivateData(shared)).toBe(false);

    // Shareable data is untouched.
    expect(shared.items[0]?.quantity).toBe(2);
    expect(shared.items[0]?.paint.catalogueId).toBe('pnt-some-brand-steel');

    // The shared profile is itself a conformant Inventory document...
    expect(validateInventoryDocument(shared)).toEqual({ valid: true, issues: [] });
    // ...and its serialization leaks none of the private strings.
    const serialized = serializeInventoryDocument(shared);
    for (const secret of [
      'Drawer 1, row 3',
      'L-2026-014',
      'signature basecoat',
      'spring open day',
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('does not mutate the source document', () => {
    const full = parseInventoryDocument(readExample('comprehensive.valid.json'));
    toSharedInventory(full);
    expect(full.items).toHaveLength(3);
    expect(full.items[0]?.private?.storageLocation).toBe('Drawer 1, row 3');
  });
});

describe('Inventory — parse errors', () => {
  it('throws a structured InventoryValidationError on an invalid document', () => {
    try {
      parseInventoryDocument(readExample('invalid/missing-items.json'));
      expect.unreachable('parseInventoryDocument should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(InventoryValidationError);
      expect((error as InventoryValidationError).issues.length).toBeGreaterThan(0);
    }
  });
});

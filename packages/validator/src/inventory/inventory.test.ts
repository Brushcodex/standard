/**
 * Conformance tests for the Open Paint Format Paint Inventory v1 (DRAFT), including the
 * privacy export-profile: the shared profile removes private data while the result
 * stays a valid Inventory document, and the full document round-trips losslessly.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { inventoryDocumentSchema, isOwnedItem, isWantedItem } from './inventory';
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

const VALID_FILES = [
  'minimal.valid.json',
  'comprehensive.valid.json',
  'wishlist.valid.json',
] as const;

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
    expect(schema.$id).toBe('https://openpaintformat.org/schemas/inventory/v1/inventory.schema.json');
    expect(schema.unevaluatedProperties).toBe(false);
    const allOf = schema.allOf as Array<{ $ref?: string }>;
    expect(allOf[0]?.$ref).toBe(
      'https://openpaintformat.org/schemas/common/v1/common.schema.json#/$defs/envelopeCore',
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
    expect(full.extensions).toEqual({ 'com.example.tool:sortOrder': { by: 'manufacturer' } });
  });

  it('removes document-level extensions, which it cannot prove are free of private data', () => {
    // An extension keyed by item ref that names the private item and a storage location:
    // copying it verbatim would leak exactly what the profile just removed.
    const source = readExample('comprehensive.valid.json') as Record<string, unknown>;
    const full = parseInventoryDocument({
      ...source,
      extensions: {
        ...(source.extensions as Record<string, unknown>),
        'app.example:locations': {
          steel: 'Drawer 1, row 3',
          'secret-recipe-base': 'Top shelf, behind the varnish',
        },
      },
    });
    // The full profile is the document as authored: extensions are retained.
    expect(Object.keys(full.extensions ?? {}).sort()).toEqual([
      'app.example:locations',
      'com.example.tool:sortOrder',
    ]);

    const shared = toSharedInventory(full);
    expect(shared).not.toHaveProperty('extensions');
    expect(validateInventoryDocument(shared)).toEqual({ valid: true, issues: [] });
    const serialized = serializeInventoryDocument(shared);
    for (const leaked of ['secret-recipe-base', 'Top shelf', 'Drawer 1, row 3', 'sortOrder']) {
      expect(serialized).not.toContain(leaked);
    }
    // Every other envelope member is untouched.
    const { extensions: _fullExtensions, items: _fullItems, ...fullRest } = full;
    const { items: _sharedItems, ...sharedRest } = shared;
    expect(sharedRest).toEqual(fullRest);
  });

  it('removes integrity, which is stale and would confirm guesses at removed content', () => {
    const source = readExample('comprehensive.valid.json') as Record<string, unknown>;
    const integrity = { algorithm: 'sha-256', value: 'ab'.repeat(32) };
    const full = parseInventoryDocument({ ...source, integrity });
    // The full profile is the document as authored: integrity is retained.
    expect(full.integrity).toEqual(integrity);

    const shared = toSharedInventory(full);
    expect(shared).not.toHaveProperty('integrity');
    expect(validateInventoryDocument(shared)).toEqual({ valid: true, issues: [] });
    expect(serializeInventoryDocument(shared)).not.toContain('ab'.repeat(32));
    // Removed, not recomputed, and the revision is carried as authored.
    expect(shared.revision).toBe(full.revision);
  });

  // The document envelope is the only place Inventory v1 allows `extensions`. Every nested
  // object is closed, so the profile has nothing further to strip. If one of these ever
  // starts validating, the schema has opened a new extension point and toSharedInventory
  // (spec §6) must be extended to remove it too.
  type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const nestedObjects: Array<[string, (doc: Json) => Json | undefined]> = [
    ['an item', (doc) => doc.items[0]],
    ['an item private object', (doc) => doc.items[0]?.private],
    ['a paintRef', (doc) => doc.items[0]?.paint],
    ['a paintRef color', (doc) => doc.items[0]?.paint?.color],
    ['a paintRef provenance entry', (doc) => doc.items[0]?.paint?.provenance?.[0]],
    ['an author agent', (doc) => doc.authors[0]],
  ];
  it.each(nestedObjects)('rejects extensions nested in %s (no nested extension point)', (
    _where,
    at,
  ) => {
    const doc = structuredClone(readExample('comprehensive.valid.json')) as Json;
    const target = at(doc);
    expect(target).toBeDefined();
    target!.extensions = { 'app.example:leak': 'Drawer 1, row 3' };
    expect(validateInventoryAgainstSchema(doc).length).toBeGreaterThan(0);
    expect(zodAccepts(doc)).toBe(false);
  });
});

describe('Inventory — anchor uniqueness (semantic)', () => {
  const base = () => readExample('minimal.valid.json') as Record<string, unknown>;

  it('rejects two items sharing one ref, reporting only the later duplicate', () => {
    const result = validateInventoryDocument(readExample('invalid/duplicate-item-ref.json'));
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({ code: 'item-ref-unique', path: '/items/1/ref', layer: 'semantic' }),
    ]);
  });

  it('accepts two items for the same paint when their refs differ or are absent (§7)', () => {
    const paint = { manufacturer: 'Vallejo', name: 'Flat Brown' };
    const result = validateInventoryDocument({
      ...base(),
      items: [{ ref: 'a', paint }, { ref: 'b', paint }, { paint }, { paint }],
    });
    expect(result.issues).toEqual([]);
  });

  it('the shared profile of a valid inventory keeps its refs unique', () => {
    const full = readExample('comprehensive.valid.json');
    expect(validateInventoryDocument(full).valid).toBe(true);
    expect(validateInventoryDocument(toSharedInventory(parseInventoryDocument(full))).valid).toBe(
      true,
    );
  });
});

describe('Inventory — owned and wanted (§4a)', () => {
  const base = () => readExample('minimal.valid.json') as Record<string, unknown>;
  const paint = { manufacturer: 'Some Brand', name: 'Verdigris' };

  it('reads absent members as owned and not wanted, so older documents keep their meaning', () => {
    const doc = parseInventoryDocument(readExample('wishlist.valid.json'));
    expect(doc.items.map((item) => [isOwnedItem(item), isWantedItem(item)])).toEqual([
      [true, false],
      [true, true],
      [false, true],
    ]);
  });

  it('rejects an item that is not owned and carries no wanted member', () => {
    const doc = { ...base(), items: [{ paint, owned: false }] };
    expect(validateInventoryAgainstSchema(doc)).toContainEqual(
      expect.objectContaining({ code: 'required', path: '/items/0' }),
    );
    expect(zodAccepts(doc)).toBe(false);
  });

  it.each(['quantity', 'unit', 'bottleSizeMl', 'condition', 'lowStock'] as const)(
    'rejects %s on an item that is not owned, in the schema and the model alike',
    (member) => {
      const value = { quantity: 1, unit: 'pot', bottleSizeMl: 17, condition: 'sealed', lowStock: true }[
        member
      ];
      const doc = { ...base(), items: [{ paint, owned: false, wanted: true, [member]: value }] };
      expect(validateInventoryAgainstSchema(doc)).toContainEqual(
        expect.objectContaining({ code: 'false schema', path: `/items/0/${member}` }),
      );
      expect(zodAccepts(doc)).toBe(false);
    },
  );

  it('allows private notes on an item that is not owned, but not where it is kept', () => {
    const withNotes = { ...base(), items: [{ paint, owned: false, wanted: true, private: { notes: 'x' } }] };
    expect(validateInventoryDocument(withNotes)).toEqual({ valid: true, issues: [] });
    expect(zodAccepts(withNotes)).toBe(true);
    for (const member of ['storageLocation', 'lot', 'acquiredAt', 'acquiredNote']) {
      const value = member === 'acquiredAt' ? '2026-01-01T00:00:00Z' : 'x';
      const doc = {
        ...base(),
        items: [{ paint, owned: false, wanted: true, private: { [member]: value } }],
      };
      expect(validateInventoryDocument(doc).valid).toBe(false);
      expect(zodAccepts(doc)).toBe(false);
    }
  });

  it('places no constraint on an owned item that is also wanted (a restock)', () => {
    const doc = {
      ...base(),
      items: [{ paint, owned: true, wanted: true, quantity: 0, condition: 'empty', lowStock: true }],
    };
    expect(validateInventoryDocument(doc)).toEqual({ valid: true, issues: [] });
  });

  it('the shared profile keeps owned and wanted, which are shareable', () => {
    const shared = toSharedInventory(parseInventoryDocument(readExample('wishlist.valid.json')));
    expect(shared.items.map((item) => [item.owned, item.wanted])).toEqual([
      [undefined, undefined],
      [true, true],
      [false, true],
    ]);
    expect(shared.items.every((item) => item.private === undefined)).toBe(true);
    expect(validateInventoryDocument(shared).valid).toBe(true);
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

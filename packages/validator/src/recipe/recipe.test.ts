/**
 * Conformance tests for the BrushCodex Recipe v1 (DRAFT).
 *
 * Exercises the published artifacts on disk — the recipe JSON Schema (which
 * composes the Common envelope) and the example corpus — so prose, schema,
 * examples, and the reference model stay in lockstep. Includes the strategy's
 * key honesty journey: a recipe with purely literal paint references (no
 * catalogue id, no color) validates and round-trips without loss.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { recipeDocumentSchema } from './recipe';
import {
  RecipeValidationError,
  loadRecipeSchema,
  parseRecipeDocument,
  roundTripRecipeDocument,
  serializeRecipeDocument,
  validateRecipeAgainstSchema,
  validateRecipeDocument,
} from './validate';

const EXAMPLES_DIR = new URL('../../../../examples/recipe/v1/', import.meta.url);

function readExample(relativePath: string): unknown {
  const url = new URL(relativePath, EXAMPLES_DIR);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
}

const VALID_FILES = [
  'minimal.valid.json',
  'comprehensive.valid.json',
  'literal-paints-no-catalogue.valid.json',
] as const;

interface ExpectationCase {
  file: string;
  layer: 'schema' | 'semantic';
  reason: string;
  expect: { keyword?: string; instancePath?: string; rule?: string };
}

const expectations = readExample('invalid/EXPECTATIONS.json') as { cases: ExpectationCase[] };

function zodAccepts(input: unknown): boolean {
  return recipeDocumentSchema.safeParse(input).success;
}

describe('Recipe — published JSON Schema', () => {
  it('is a well-formed draft 2020-12 schema that composes the Common envelope', () => {
    const schema = loadRecipeSchema();
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$id).toBe('https://brushcodex.com/schemas/recipe/v1/recipe.schema.json');
    expect(schema.unevaluatedProperties).toBe(false);
    const allOf = schema.allOf as Array<{ $ref?: string }>;
    expect(allOf[0]?.$ref).toBe(
      'https://brushcodex.com/schemas/common/v1/common.schema.json#/$defs/envelopeCore',
    );
  });
});

describe('Recipe — valid examples', () => {
  it.each(VALID_FILES)('%s validates against the schema and semantic rules', (file) => {
    const doc = readExample(file);
    expect(validateRecipeAgainstSchema(doc)).toEqual([]);
    expect(validateRecipeDocument(doc)).toEqual({ valid: true, issues: [] });
  });

  it.each(VALID_FILES)('%s parses into the typed recipe model', (file) => {
    const doc = readExample(file);
    expect(parseRecipeDocument(doc).spec).toBe('recipe');
  });
});

describe('Recipe — literal paint references without a catalogue (strategy honesty rule)', () => {
  it('validates a recipe whose paints have no catalogue id and no color value', () => {
    const doc = parseRecipeDocument(readExample('literal-paints-no-catalogue.valid.json'));
    expect(doc.paints).toBeDefined();
    for (const paint of doc.paints ?? []) {
      expect(paint.catalogueId).toBeUndefined();
      expect(paint.color).toBeUndefined();
      // A literal paint still identifies itself.
      expect(paint.manufacturer !== undefined || paint.name !== undefined).toBe(true);
    }
  });

  it('round-trips a literal-only recipe without material loss', () => {
    const input = readExample('literal-paints-no-catalogue.valid.json');
    const first = parseRecipeDocument(input);
    const reparsed = parseRecipeDocument(JSON.parse(serializeRecipeDocument(first)));
    expect(reparsed).toEqual(first);
  });
});

describe('Recipe — invalid examples fail for the intended reason', () => {
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
      const schemaIssues = validateRecipeAgainstSchema(doc);
      const full = validateRecipeDocument(doc);

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

describe('Recipe — Zod model agrees with the JSON Schema on the corpus', () => {
  it.each(VALID_FILES)('accepts %s', (file) => {
    const doc = readExample(file);
    expect(validateRecipeAgainstSchema(doc)).toEqual([]);
    expect(zodAccepts(doc)).toBe(true);
  });

  it.each(expectations.cases.map((c) => [c.file, c] as const))(
    'agrees on %s',
    (_file, testCase) => {
      const doc = readExample(`invalid/${testCase.file}`);
      const schemaValid = validateRecipeAgainstSchema(doc).length === 0;
      expect(zodAccepts(doc)).toBe(schemaValid);
      expect(schemaValid).toBe(testCase.layer === 'semantic');
    },
  );
});

describe('Recipe — canonical round trip', () => {
  it('parse -> serialize -> parse preserves every supported member', () => {
    const first = parseRecipeDocument(readExample('comprehensive.valid.json'));
    const reparsed = parseRecipeDocument(JSON.parse(serializeRecipeDocument(first)));
    expect(reparsed).toEqual(first);
  });

  it('preserves unknown namespaced extensions unchanged', () => {
    const { document } = roundTripRecipeDocument(readExample('comprehensive.valid.json'));
    expect(document.extensions).toEqual({
      'com.example.tool:chipMap': {
        regions: [{ id: 'r1', chips: [{ x: 0.3, y: 0.7 }] }],
      },
    });
  });

  it('preserves mixtures, classified alternatives, and media rights', () => {
    const doc = parseRecipeDocument(readExample('comprehensive.valid.json'));
    const mixStep = doc.steps.find((step) => step.mix !== undefined);
    expect(mixStep?.mix).toEqual([
      { paint: 'steel', parts: 3 },
      { paint: 'bone', parts: 1 },
    ]);
    const altStep = doc.steps.find((step) => step.alternatives !== undefined);
    expect(altStep?.alternatives?.map((alt) => alt.type)).toEqual([
      'mathematical',
      'verified_practical',
    ]);
    const mediaStep = doc.steps.find((step) => step.media !== undefined);
    expect(mediaStep?.media?.[0]?.license?.spdxId).toBe('CC-BY-4.0');
  });
});

describe('Recipe — source media and step citations', () => {
  it('round-trips the cited work with its own creator and licence', () => {
    const doc = parseRecipeDocument(readExample('comprehensive.valid.json'));
    const source = doc.media?.find((media) => media.relation === 'source');
    expect(source?.id).toBe('tutorial');
    expect(source?.creator?.name).toBe('Example Painting Academy');
    // The linked work's licence is its own; it is NOT the recipe's licence, and
    // reachability never implies an open licence.
    expect(source?.license?.spdxId).toBe('NOASSERTION');
    expect(doc.license?.spdxId).toBe('CC-BY-4.0');
  });

  it('carries citations as seconds, keeping the author-written label verbatim', () => {
    const doc = parseRecipeDocument(readExample('comprehensive.valid.json'));
    expect(doc.steps[0]?.source).toEqual({
      media: 'tutorial',
      startSeconds: 60,
      endSeconds: 95,
      label: '1:00-1:35',
    });
    // A point citation has no end; an anchorless one targets the lone source.
    const point = doc.steps.find(
      (step) => step.source !== undefined && step.source.media === undefined,
    )?.source;
    expect(point?.startSeconds).toBe(742.5);
    expect(point?.endSeconds).toBeUndefined();
  });

  it('rejects a citation whose media anchor resolves to nothing', () => {
    const result = validateRecipeDocument(readExample('invalid/dangling-media-anchor.json'));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'media-anchor-resolves')).toBe(true);
  });

  it('rejects an anchorless citation when the source work is ambiguous', () => {
    const result = validateRecipeDocument(readExample('invalid/ambiguous-media-citation.json'));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'media-citation-resolves')).toBe(true);
  });

  it('rejects a range that does not run forwards, and a reused media anchor', () => {
    const backwards = validateRecipeDocument(readExample('invalid/backwards-media-citation.json'));
    expect(backwards.issues.some((i) => i.code === 'media-citation-range')).toBe(true);
    const duplicate = validateRecipeDocument(readExample('invalid/duplicate-media-id.json'));
    expect(duplicate.issues.some((i) => i.code === 'media-id-unique')).toBe(true);
  });

  it('accepts a recipe with media but no citations, and citations on a lone source', () => {
    const base = readExample('comprehensive.valid.json') as Record<string, unknown>;
    const noCitations = {
      ...base,
      steps: (base.steps as Array<Record<string, unknown>>).map(
        ({ source: _source, ...rest }) => rest,
      ),
    };
    expect(validateRecipeDocument(noCitations).valid).toBe(true);
  });
});

describe('Recipe — credit and prose mixtures', () => {
  it('keeps document credit separate from authors and licence', () => {
    const doc = parseRecipeDocument(readExample('comprehensive.valid.json'));
    expect(doc.attribution).toContain('Tuesday club night');
    // Credit prose is not an author and not a licence — the three coexist unmerged.
    expect(doc.authors).toEqual([{ name: 'A. Painter', role: 'author' }]);
    expect(doc.license?.spdxId).toBe('CC-BY-4.0');
  });

  it('carries a prose mixture beside a structured one, and alone when there is none', () => {
    const doc = parseRecipeDocument(readExample('comprehensive.valid.json'));
    const structured = doc.steps.find((step) => step.mix !== undefined);
    expect(structured?.mix).toHaveLength(2);
    expect(structured?.mixNote).toContain('3:1 Steel to Bonewhite');

    // The evidenced case: a mixture whose components are not all declared paints.
    const proseOnly = doc.steps.find(
      (step) => step.mix === undefined && step.mixNote !== undefined,
    );
    expect(proseOnly?.mixNote).toContain('four parts water');
  });

  it('round-trips both members unchanged', () => {
    const { document } = roundTripRecipeDocument(readExample('comprehensive.valid.json'));
    const reparsed = parseRecipeDocument(JSON.parse(serializeRecipeDocument(document)));
    expect(reparsed.attribution).toBe(document.attribution);
    expect(reparsed.steps.map((step) => step.mixNote)).toEqual(
      document.steps.map((step) => step.mixNote),
    );
  });
});

describe('Recipe — anchor integrity (semantic)', () => {
  it('rejects a step that references an undeclared paint anchor', () => {
    const result = validateRecipeDocument(readExample('invalid/dangling-paint-anchor.json'));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'paint-anchor-resolves')).toBe(true);
  });

  it('accepts steps whose anchors all resolve to declared paints', () => {
    const result = validateRecipeDocument(readExample('literal-paints-no-catalogue.valid.json'));
    expect(result.valid).toBe(true);
  });
});

describe('Recipe — parse errors', () => {
  it('throws a structured RecipeValidationError on an invalid document', () => {
    try {
      parseRecipeDocument(readExample('invalid/missing-steps.json'));
      expect.unreachable('parseRecipeDocument should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(RecipeValidationError);
      expect((error as RecipeValidationError).issues.length).toBeGreaterThan(0);
    }
  });
});

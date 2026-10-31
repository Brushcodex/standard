/**
 * Conformance tests for the BrushCodex Project v1 (DRAFT), including subject-anchor
 * integrity and the privacy shared-profile (private journal entries removed while
 * the result stays valid).
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { projectDocumentSchema } from './project';
import {
  ProjectValidationError,
  loadProjectSchema,
  parseProjectDocument,
  roundTripProjectDocument,
  serializeProjectDocument,
  validateProjectAgainstSchema,
  validateProjectDocument,
} from './validate';
import { hasPrivateJournal, toSharedProject } from './profile';

const EXAMPLES_DIR = new URL('../../../../examples/project/v1/', import.meta.url);

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
  return projectDocumentSchema.safeParse(input).success;
}

describe('Project — published JSON Schema', () => {
  it('is a well-formed draft 2020-12 schema that composes the Common envelope', () => {
    const schema = loadProjectSchema();
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$id).toBe('https://brushcodex.com/schemas/project/v1/project.schema.json');
    expect(schema.unevaluatedProperties).toBe(false);
    const allOf = schema.allOf as Array<{ $ref?: string }>;
    expect(allOf[0]?.$ref).toBe(
      'https://brushcodex.com/schemas/common/v1/common.schema.json#/$defs/envelopeCore',
    );
  });
});

describe('Project — valid examples', () => {
  it.each(VALID_FILES)('%s validates against the schema and semantic rules', (file) => {
    const doc = readExample(file);
    expect(validateProjectAgainstSchema(doc)).toEqual([]);
    expect(validateProjectDocument(doc)).toEqual({ valid: true, issues: [] });
  });

  it.each(VALID_FILES)('%s parses into the typed project model', (file) => {
    expect(parseProjectDocument(readExample(file)).spec).toBe('project');
  });
});

describe('Project — invalid examples fail for the intended reason', () => {
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
      const schemaIssues = validateProjectAgainstSchema(doc);
      const full = validateProjectDocument(doc);

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

describe('Project — Zod model agrees with the JSON Schema on the corpus', () => {
  it.each(VALID_FILES)('accepts %s', (file) => {
    const doc = readExample(file);
    expect(validateProjectAgainstSchema(doc)).toEqual([]);
    expect(zodAccepts(doc)).toBe(true);
  });

  it.each(expectations.cases.map((c) => [c.file, c] as const))(
    'agrees on %s',
    (_file, testCase) => {
      const doc = readExample(`invalid/${testCase.file}`);
      const schemaValid = validateProjectAgainstSchema(doc).length === 0;
      expect(zodAccepts(doc)).toBe(schemaValid);
      expect(schemaValid).toBe(testCase.layer === 'semantic');
    },
  );
});

describe('Project — canonical round trip', () => {
  it('parse -> serialize -> parse preserves every member, private journal included', () => {
    const first = parseProjectDocument(readExample('comprehensive.valid.json'));
    const reparsed = parseProjectDocument(JSON.parse(serializeProjectDocument(first)));
    expect(reparsed).toEqual(first);
    expect(reparsed.journal?.some((entry) => entry.visibility === 'private')).toBe(true);
  });

  it('preserves unknown namespaced extensions unchanged', () => {
    const { document } = roundTripProjectDocument(readExample('comprehensive.valid.json'));
    expect(document.extensions).toEqual({ 'com.example.tool:board': { column: 'in-progress' } });
  });

  it('preserves subjects, selections, substitutions, and tools', () => {
    const doc = parseProjectDocument(readExample('comprehensive.valid.json'));
    expect(doc.subjects?.map((subject) => subject.name)).toEqual(['Sergeant', 'Trooper A']);
    expect(doc.recipeRefs?.[0]?.id).toBe('urn:brushcodex:recipe:rusted-armour:v1');
    expect(doc.substitutions?.[0]?.type).toBe('mathematical');
    expect(doc.toolsUsed?.map((tool) => tool.name)).toEqual(['Airbrush', 'Weathering sponge']);
  });
});

describe('Project — subject-anchor integrity (semantic)', () => {
  it('rejects a journal entry that references an undeclared subject anchor', () => {
    const result = validateProjectDocument(readExample('invalid/dangling-subject-ref.json'));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'subject-anchor-resolves')).toBe(true);
  });

  it('accepts a project whose journal anchors all resolve', () => {
    expect(validateProjectDocument(readExample('comprehensive.valid.json')).valid).toBe(true);
  });

  it('rejects two subjects sharing one ref, reporting only the later duplicate', () => {
    const result = validateProjectDocument(readExample('invalid/duplicate-subject-ref.json'));
    expect(result.valid).toBe(false);
    const duplicates = result.issues.filter((i) => i.code === 'subject-ref-unique');
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]).toMatchObject({ path: '/subjects/1/ref', layer: 'semantic' });
    expect(result.issues.some((i) => i.code === 'subject-anchor-resolves')).toBe(false);
  });

  it('rejects two result media items sharing one id (Common mediaRef rule)', () => {
    const result = validateProjectDocument(readExample('invalid/duplicate-result-media-id.json'));
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({ code: 'media-id-unique', path: '/results/1/id', layer: 'semantic' }),
    ]);
  });

  it('treats recipeRefs / paletteRefs as references: listing one document twice is valid', () => {
    const base = readExample('minimal.valid.json') as Record<string, unknown>;
    const ref = { id: 'urn:uuid:00000000-0000-4000-8000-000000000001' };
    const result = validateProjectDocument({ ...base, recipeRefs: [ref, ref], paletteRefs: [ref, ref] });
    expect(result.issues).toEqual([]);
  });
});

describe('Project — shared export profile (privacy)', () => {
  it('removes private journal entries and the result still validates', () => {
    const full = parseProjectDocument(readExample('comprehensive.valid.json'));
    expect(hasPrivateJournal(full)).toBe(true);

    const shared = toSharedProject(full);

    expect(full.journal).toHaveLength(2);
    expect(shared.journal).toHaveLength(1);
    expect(shared.journal?.every((entry) => entry.visibility !== 'private')).toBe(true);
    expect(hasPrivateJournal(shared)).toBe(false);

    expect(validateProjectDocument(shared)).toEqual({ valid: true, issues: [] });
    expect(serializeProjectDocument(shared)).not.toContain('custom rust mix ratio');
  });

  it('does not mutate the source document', () => {
    const full = parseProjectDocument(readExample('comprehensive.valid.json'));
    toSharedProject(full);
    expect(full.journal).toHaveLength(2);
    expect(full.extensions).toEqual({ 'com.example.tool:board': { column: 'in-progress' } });
  });

  it('removes extensions and integrity; the full profile keeps both', () => {
    // An extension that indexes the journal can name the private entry the profile removes,
    // and the author's integrity hash covers that entry too.
    const source = readExample('comprehensive.valid.json') as Record<string, unknown>;
    const integrity = { algorithm: 'sha-256', value: 'cd'.repeat(32) };
    const full = parseProjectDocument({
      ...source,
      extensions: {
        ...(source.extensions as Record<string, unknown>),
        'app.example:journalIndex': { '1': 'custom rust mix ratio' },
      },
      integrity,
    });
    expect(Object.keys(full.extensions ?? {}).sort()).toEqual([
      'app.example:journalIndex',
      'com.example.tool:board',
    ]);
    expect(full.integrity).toEqual(integrity);

    const shared = toSharedProject(full);
    expect(shared).not.toHaveProperty('extensions');
    expect(shared).not.toHaveProperty('integrity');
    expect(validateProjectDocument(shared)).toEqual({ valid: true, issues: [] });
    const serialized = serializeProjectDocument(shared);
    for (const leaked of ['custom rust mix ratio', 'journalIndex', 'cd'.repeat(32)]) {
      expect(serialized).not.toContain(leaked);
    }
    // Every other envelope and project member is untouched.
    const {
      extensions: _fullExtensions,
      integrity: _fullIntegrity,
      journal: _fullJournal,
      ...fullRest
    } = full;
    const { journal: _sharedJournal, ...sharedRest } = shared;
    expect(sharedRest).toEqual(fullRest);
  });

  it('removes extensions from a project that has no journal', () => {
    const shared = toSharedProject(
      parseProjectDocument({
        ...(readExample('minimal.valid.json') as Record<string, unknown>),
        extensions: { 'app.example:leak': 'secret' },
      }),
    );
    expect(shared).not.toHaveProperty('extensions');
    expect(shared).not.toHaveProperty('journal');
  });

  // The document envelope is the only place Project v1 allows `extensions`. If one of these
  // ever starts validating, the schema has opened a new extension point and toSharedProject
  // (spec §7) must be extended to remove it too.
  type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const nestedObjects: Array<[string, (doc: Json) => Json | undefined]> = [
    ['a subject', (doc) => doc.subjects[0]],
    ['a stage', (doc) => doc.subjects[0]?.stages?.[0]],
    ['a checklist item', (doc) => doc.subjects[0]?.checklist?.[0]],
    ['a recipe ref', (doc) => doc.recipeRefs[0]],
    ['a substitution', (doc) => doc.substitutions[0]],
    ['a substitution paintRef', (doc) => doc.substitutions[0]?.original],
    ['a journal entry', (doc) => doc.journal[0]],
    ['a result mediaRef', (doc) => doc.results[0]],
    ['a result license', (doc) => doc.results[0]?.license],
    ['a tool resource', (doc) => doc.toolsUsed[0]],
    ['links', (doc) => doc.links],
    ['an author agent', (doc) => doc.authors[0]],
  ];
  it.each(nestedObjects)('rejects extensions nested in %s (no nested extension point)', (
    _where,
    at,
  ) => {
    const doc = structuredClone(readExample('comprehensive.valid.json')) as Json;
    const target = at(doc);
    expect(target).toBeDefined();
    target!.extensions = { 'app.example:leak': 'custom rust mix ratio' };
    expect(validateProjectAgainstSchema(doc).length).toBeGreaterThan(0);
    expect(zodAccepts(doc)).toBe(false);
  });
});

describe('Project — parse errors', () => {
  it('throws a structured ProjectValidationError on an invalid document', () => {
    try {
      parseProjectDocument(readExample('invalid/missing-status.json'));
      expect.unreachable('parseProjectDocument should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectValidationError);
      expect((error as ProjectValidationError).issues.length).toBeGreaterThan(0);
    }
  });
});

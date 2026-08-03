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

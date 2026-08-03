/**
 * Unit tests for the shared Ajv-error → ValidationIssue mapping and the
 * schema-layer validator. `ajvErrorToIssue` feeds EVERY spec's validator, so its
 * machine-readable fields (code, path, layer) and its human-readable message
 * quality are asserted here once, at the source, rather than per spec.
 *
 * The detail-suffix cases below are also the regression net for the message
 * enrichment: an invalid enum value now names the vocabulary that WOULD be
 * accepted, so a user can fix the document without opening the schema.
 */

import type { ErrorObject } from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ajvErrorToIssue, validateAgainstSchema } from './validate';
import { validateBySpec } from '../registry';

/** Build a minimal Ajv ErrorObject; only the fields the mapper reads matter. */
function ajvError(partial: Partial<ErrorObject> & Pick<ErrorObject, 'keyword'>): ErrorObject {
  return {
    instancePath: '',
    schemaPath: '#',
    params: {},
    ...partial,
  } as ErrorObject;
}

describe('ajvErrorToIssue — machine-readable fields', () => {
  it('carries the Ajv keyword as code, instancePath as path, and the schema layer', () => {
    const issue = ajvErrorToIssue(
      ajvError({ keyword: 'type', instancePath: '/title', message: 'must be string' }),
    );
    expect(issue.code).toBe('type');
    expect(issue.path).toBe('/title');
    expect(issue.layer).toBe('schema');
    expect(issue.message).toBe('/title must be string');
  });

  it('renders the document root as "(root)" in the message but leaves path empty', () => {
    const issue = ajvErrorToIssue(ajvError({ keyword: 'type', message: 'must be object' }));
    expect(issue.path).toBe('');
    expect(issue.message).toBe('(root) must be object');
  });

  it('falls back to "is invalid" when Ajv supplies no message', () => {
    const issue = ajvErrorToIssue(ajvError({ keyword: 'false schema', instancePath: '/x' }));
    expect(issue.message).toBe('/x is invalid');
  });
});

describe('ajvErrorToIssue — actionable detail suffixes', () => {
  it('names the missing property for a required error', () => {
    const issue = ajvErrorToIssue(
      ajvError({
        keyword: 'required',
        params: { missingProperty: 'spec' },
        message: "must have required property 'spec'",
      }),
    );
    expect(issue.message).toContain('(spec)');
  });

  it('names the disallowed property for additionalProperties and unevaluatedProperties', () => {
    const additional = ajvErrorToIssue(
      ajvError({
        keyword: 'additionalProperties',
        instancePath: '/meta',
        params: { additionalProperty: 'wat' },
        message: 'must NOT have additional properties',
      }),
    );
    expect(additional.message).toContain('(wat)');

    const unevaluated = ajvErrorToIssue(
      ajvError({
        keyword: 'unevaluatedProperties',
        params: { unevaluatedProperty: 'stray' },
        message: 'must NOT have unevaluated properties',
      }),
    );
    expect(unevaluated.message).toContain('(stray)');
  });

  it('lists the allowed values for an enum error, in schema order and quoted', () => {
    const issue = ajvErrorToIssue(
      ajvError({
        keyword: 'enum',
        instancePath: '/paints/0/kind',
        params: { allowedValues: ['brush', 'airbrush', 'sponge'] },
        message: 'must be equal to one of the allowed values',
      }),
    );
    expect(issue.code).toBe('enum');
    expect(issue.message).toContain('/paints/0/kind');
    expect(issue.message).toContain('(allowed: "brush", "airbrush", "sponge")');
  });

  it('summarises the tail when an enum exceeds the listing cap', () => {
    const many = Array.from({ length: 30 }, (_, i) => `v${i}`);
    const issue = ajvErrorToIssue(
      ajvError({
        keyword: 'enum',
        instancePath: '/x',
        params: { allowedValues: many },
        message: 'must be equal to one of the allowed values',
      }),
    );
    expect(issue.message).toContain('"v0"');
    expect(issue.message).toContain('"v23"'); // last of the first 24 (0-indexed)
    expect(issue.message).not.toContain('"v24"');
    expect(issue.message).toContain('plus 6 more'); // 30 - 24
  });

  it('names the single required value for a const error', () => {
    const issue = ajvErrorToIssue(
      ajvError({
        keyword: 'const',
        instancePath: '/spec',
        params: { allowedValue: 'recipe' },
        message: 'must be equal to constant',
      }),
    );
    expect(issue.code).toBe('const');
    expect(issue.message).toContain('/spec');
    expect(issue.message).toContain('(expected: "recipe")');
  });
});

describe('validateAgainstSchema — enum enrichment end to end', () => {
  const invalidDir = new URL('../../../../examples/common/v1/invalid/', import.meta.url);
  const readInvalid = (name: string): unknown =>
    JSON.parse(readFileSync(fileURLToPath(new URL(name, invalidDir)), 'utf8'));

  it('a real out-of-vocabulary value yields an enum issue that lists the vocabulary', () => {
    // unknown-source-type.json puts an unknown sourceType at /provenance/0/sourceType.
    const issues = validateAgainstSchema(readInvalid('unknown-source-type.json'));
    const enumIssue = issues.find((issue) => issue.code === 'enum');
    expect(enumIssue, JSON.stringify(issues)).toBeDefined();
    expect(enumIssue?.path).toBe('/provenance/0/sourceType');
    // Ajv populates params.allowedValues under this validator's config, so the
    // message names the accepted values rather than only "the allowed values".
    expect(enumIssue?.message).toMatch(/\(allowed: "[^"]+"/);
  });
});

describe('validateBySpec — const enrichment end to end', () => {
  const readRecipeInvalid = (name: string): unknown =>
    JSON.parse(
      readFileSync(
        fileURLToPath(new URL(`../../../../examples/recipe/v1/invalid/${name}`, import.meta.url)),
        'utf8',
      ),
    );

  it('a wrong spec value yields a const issue naming the required value', () => {
    // wrong-spec.json declares a spec other than "recipe"; validated AS recipe (its
    // directory), the /spec const fails — exercising the shared mapper's const branch on
    // a real Ajv error, so a wrong param name would be caught here, not just in the unit test.
    const { issues } = validateBySpec('recipe', readRecipeInvalid('wrong-spec.json'));
    const constIssue = issues.find((issue) => issue.code === 'const' && issue.path === '/spec');
    expect(constIssue, JSON.stringify(issues)).toBeDefined();
    expect(constIssue?.message).toContain('(expected: "recipe")');
  });
});

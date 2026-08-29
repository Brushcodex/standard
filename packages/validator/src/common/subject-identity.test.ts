/**
 * Painted Subject identity — the capability graduated into Common `target` (§5.8).
 *
 * The identity exists to make one operation deterministic: *given an exact
 * miniature, which Painting Workflows and Palettes apply to it?* Matching two
 * `target.description` strings cannot answer that — independent authors write
 * different sentences for one sculpt, and a remaster keeps the old name while
 * the geometry changes. So the tests below are written in pairs: the literal
 * baseline a consumer had before, and the identity answer, with the disagreement
 * asserted rather than described.
 *
 * The other half is the literal floor. `authority` and `designation` are
 * REQUIRED whenever the identity object exists — unconditionally, so an opaque
 * `subjectId` can never travel without something a human can read offline. That
 * rule is the whole reason this graduated out of an extension, where open JSON
 * could not enforce it, so it is mutation-tested here in both directions.
 *
 * Fixtures are the published corpus, not inline literals, so prose, schema,
 * examples and model stay in lockstep.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseRecipeDocument, roundTripRecipeDocument, validateRecipeDocument } from '../recipe';
import { parsePaletteDocument, roundTripPaletteDocument, validatePaletteDocument } from '../palette';
import type { SubjectIdentity } from './structures';

const EXAMPLES = new URL('../../../../examples/', import.meta.url);

function read(relative: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(relative, EXAMPLES)), 'utf8'),
  ) as Record<string, unknown>;
}

const RECIPE_EXACT = 'recipe/v1/comprehensive.valid.json';
const RECIPE_LITERAL_ONLY = 'recipe/v1/literal-subject-no-registry.valid.json';
const RECIPE_BROAD = 'recipe/v1/reusable-army-workflow.valid.json';
const RECIPE_NO_TARGET = 'recipe/v1/minimal.valid.json';
const PALETTE_EXACT = 'palette/v1/exact-subject.valid.json';
const PALETTE_BROAD = 'palette/v1/comprehensive.valid.json';

/** Deep clone so a mutation test never edits another test's fixture. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function targetOf(document: Record<string, unknown>): Record<string, unknown> {
  return document['target'] as Record<string, unknown>;
}

function identityOf(document: Record<string, unknown>): SubjectIdentity | undefined {
  return targetOf(document)?.['identity'] as SubjectIdentity | undefined;
}

/** The baseline a consumer had before this member existed. */
function descriptionsMatch(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const normalize = (text: string): string =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return normalize(String(targetOf(a)?.['description'] ?? '')) ===
    normalize(String(targetOf(b)?.['description'] ?? ''));
}

describe('Painted Subject identity — the literal floor', () => {
  it('rejects an identity with no authority, even when a subjectId is present', () => {
    const document = clone(read(RECIPE_EXACT));
    delete (identityOf(document) as unknown as Record<string, unknown>)['authority'];
    const result = validateRecipeDocument(document);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path.startsWith('/target/identity'))).toBe(true);
  });

  it('rejects an identity with no designation, even when a subjectId is present', () => {
    const document = clone(read(RECIPE_EXACT));
    delete (identityOf(document) as unknown as Record<string, unknown>)['designation'];
    expect(validateRecipeDocument(document).valid).toBe(false);
  });

  it('rejects a hollow identity object', () => {
    const document = clone(read(RECIPE_EXACT));
    targetOf(document)['identity'] = {};
    expect(validateRecipeDocument(document).valid).toBe(false);
  });

  it('rejects an empty authority or designation rather than accepting a blank floor', () => {
    for (const member of ['authority', 'designation'] as const) {
      const document = clone(read(RECIPE_EXACT));
      (identityOf(document) as unknown as Record<string, unknown>)[member] = '';
      expect(validateRecipeDocument(document).valid, member).toBe(false);
    }
  });

  it('enforces the same floor through Palette, which shares the Common target', () => {
    const document = clone(read(PALETTE_EXACT));
    delete (identityOf(document) as unknown as Record<string, unknown>)['authority'];
    expect(validatePaletteDocument(document).valid).toBe(false);
  });
});

describe('Painted Subject identity — optional at every level', () => {
  it('accepts an identity with no subjectId: the literals alone are a subject', () => {
    const document = read(RECIPE_LITERAL_ONLY);
    expect(validateRecipeDocument(document)).toEqual({ valid: true, issues: [] });
    const identity = identityOf(document);
    expect(identity?.subjectId).toBeUndefined();
    expect(identity?.authorityId).toBeUndefined();
    expect(identity?.authority).toBe('Example Terrain Works');
    expect(identity?.designation).toBe('Ruined Chapel Wall');
  });

  it('removing the subjectId from an exact document leaves it valid', () => {
    const document = clone(read(RECIPE_EXACT));
    delete (identityOf(document) as unknown as Record<string, unknown>)['subjectId'];
    expect(validateRecipeDocument(document)).toEqual({ valid: true, issues: [] });
  });

  it('keeps a broad, class-level target valid with no identity at all', () => {
    const recipe = read(RECIPE_BROAD);
    expect(targetOf(recipe)['description']).toBe('28mm plastic infantry armour');
    expect(identityOf(recipe)).toBeUndefined();
    expect(validateRecipeDocument(recipe)).toEqual({ valid: true, issues: [] });

    const palette = read(PALETTE_BROAD);
    expect(identityOf(palette)).toBeUndefined();
    expect(validatePaletteDocument(palette)).toEqual({ valid: true, issues: [] });
  });

  it('keeps a recipe with no target at all valid', () => {
    const document = read(RECIPE_NO_TARGET);
    expect(document['target']).toBeUndefined();
    expect(validateRecipeDocument(document)).toEqual({ valid: true, issues: [] });
  });

  it('never fabricates an identity through a round trip', () => {
    const { document } = roundTripRecipeDocument(read(RECIPE_BROAD));
    expect(document.target?.identity).toBeUndefined();
  });
});

describe('Painted Subject identity — the subjectId is opaque and unresolved is not an error', () => {
  it('accepts an arbitrary external identifier in a namespace nothing here knows', () => {
    for (const foreign of [
      'urn:example:sculpt:41f2',
      'https://example.org/subjects/41f2',
      'vendor:some-studio:0041',
      'an-opaque-token',
    ]) {
      const document = clone(read(RECIPE_EXACT));
      (identityOf(document) as unknown as Record<string, unknown>)['subjectId'] = foreign;
      expect(validateRecipeDocument(document).valid, foreign).toBe(true);
    }
  });

  it('validates with no resolver present — a resolver that throws is never reached', () => {
    const registry = {
      resolve(): never {
        throw new Error('subject registry unreachable');
      },
    };
    expect(() => registry.resolve()).toThrow('subject registry unreachable');
    expect(validateRecipeDocument(read(RECIPE_EXACT))).toEqual({ valid: true, issues: [] });
    expect(validatePaletteDocument(read(PALETTE_EXACT))).toEqual({ valid: true, issues: [] });
  });
});

describe('Painted Subject identity — the consumer', () => {
  it('reaches a Recipe AND a Palette from one identifier, where description matching fails', () => {
    // The whole approved operation, on the published corpus: exact subject ->
    // stable identity -> the workflow and the palette that apply to it. Two
    // specs, two authors, two different sentences for one sculpt.
    const recipe = read(RECIPE_EXACT);
    const palette = read(PALETTE_EXACT);
    const wanted = 'brushcodex:subject:example-miniatures/vanguard/squad-sergeant';

    const applicable = [recipe, palette].filter(
      (document) => identityOf(document)?.subjectId === wanted,
    );
    expect(applicable).toHaveLength(2);
    expect(recipe['spec']).toBe('recipe');
    expect(palette['spec']).toBe('palette');

    // The baseline a consumer had before this member cannot make that match.
    expect(descriptionsMatch(recipe, palette)).toBe(false);
    // And the literals still agree, which is what a reader offline sees.
    expect(identityOf(recipe)?.designation).toBe(identityOf(palette)?.designation);
  });

  it('separates two subjects an authority names alike', () => {
    // A remaster keeps the designation and changes the geometry. Name matching
    // says "same" and is wrong; the identifiers are distinct.
    const original = read(RECIPE_EXACT);
    const remaster = clone(original);
    const identity = identityOf(remaster) as unknown as Record<string, unknown>;
    identity['qualifier'] = 'Mk2 remaster; the power fist is a separate component';
    identity['subjectId'] = 'brushcodex:subject:example-miniatures/vanguard/squad-sergeant-mk2';

    expect(validateRecipeDocument(remaster).valid).toBe(true);
    expect(identityOf(remaster)?.designation).toBe(identityOf(original)?.designation);
    expect(identityOf(remaster)?.subjectId).not.toBe(identityOf(original)?.subjectId);
  });

  it('declines to answer for a broad target instead of guessing', () => {
    const broad = read(RECIPE_BROAD);
    const exact = read(RECIPE_EXACT);
    // No identity means no identifier to compare: a consumer concludes nothing,
    // which is the honest answer and never a false match.
    expect(identityOf(broad)?.subjectId).toBeUndefined();
    expect(identityOf(exact)?.subjectId).toBeDefined();
  });
});

describe('Painted Subject identity — round trip', () => {
  it('preserves every identity member through a Recipe canonical round trip', () => {
    const source = read(RECIPE_EXACT);
    const { document } = roundTripRecipeDocument(source);
    expect(document.target?.identity).toEqual({
      authority: 'Example Miniatures',
      designation: 'Vanguard Squad Sergeant',
      qualifier: 'sergeant variant — bare head and power fist; not an ordinary squad body',
      authorityId: 'VG-SGT-01',
      subjectId: 'brushcodex:subject:example-miniatures/vanguard/squad-sergeant',
    });
  });

  it('preserves every identity member through a Palette canonical round trip', () => {
    const { document } = roundTripPaletteDocument(read(PALETTE_EXACT));
    expect(document.target?.identity).toEqual(identityOf(read(PALETTE_EXACT)));
  });

  it('preserves a floor-only identity without inventing the optional members', () => {
    const { document } = roundTripRecipeDocument(read(RECIPE_LITERAL_ONLY));
    expect(document.target?.identity).toEqual({
      authority: 'Example Terrain Works',
      designation: 'Ruined Chapel Wall',
      qualifier: 'assembled with the optional buttress, which changes which faces are reachable',
    });
  });
});

describe('Painted Subject identity — the Source Product boundary', () => {
  it('has no member for a product, SKU, or commercial lifecycle', () => {
    const identity = identityOf(read(RECIPE_EXACT)) as unknown as Record<string, unknown>;
    for (const forbidden of [
      'sku',
      'gtin',
      'productId',
      'productName',
      'bundle',
      'price',
      'stock',
      'availability',
      'retailer',
      'affiliateUrl',
      'url',
      'references',
    ]) {
      expect(Object.keys(identity), forbidden).not.toContain(forbidden);
    }
  });

  it('rejects a product member smuggled into the identity', () => {
    const document = clone(read(RECIPE_EXACT));
    (identityOf(document) as unknown as Record<string, unknown>)['sku'] = 'EM-2105';
    expect(validateRecipeDocument(document).valid).toBe(false);
  });

  it('does not duplicate what the target already says', () => {
    const identity = identityOf(read(RECIPE_EXACT)) as unknown as Record<string, unknown>;
    for (const applicability of ['description', 'kind', 'scale', 'substrate']) {
      expect(Object.keys(identity), applicability).not.toContain(applicability);
    }
    // And the applicability statement is still there, doing its own job.
    expect(targetOf(read(RECIPE_EXACT))['description']).toBeTruthy();
  });
});

describe('Painted Subject identity — the reference model agrees with the schema', () => {
  it('parses an exact identity into the typed model', () => {
    const recipe = parseRecipeDocument(read(RECIPE_EXACT));
    const palette = parsePaletteDocument(read(PALETTE_EXACT));
    expect(recipe.target?.identity?.authority).toBe('Example Miniatures');
    expect(palette.target?.identity?.designation).toBe('Vanguard Squad Sergeant');
  });

  it('rejects an unknown member inside the identity (the object is closed)', () => {
    const document = clone(read(RECIPE_EXACT));
    (identityOf(document) as unknown as Record<string, unknown>)['nickname'] = 'Banner Bob';
    expect(validateRecipeDocument(document).valid).toBe(false);
  });
});

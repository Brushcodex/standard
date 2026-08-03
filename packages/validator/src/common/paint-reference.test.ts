/**
 * The paint-reference contract that makes the standard usable **without** a catalogue.
 *
 * Three guarantees, each of which a downstream implementation is entitled to rely on:
 *   1. Colour is optional — a reference with no `color` at all is valid, so an
 *      implementation may bring its own colour data (or none).
 *   2. `catalogueId` is optional and opaque — a document that names a catalogue nobody
 *      has is still valid; resolution is best-effort and its failure is not an error.
 *   3. The colour source classes are distinct and an approximate screen value is never
 *      typed as a physical measurement (spec §5.3).
 */

import { describe, expect, it } from 'vitest';
import { SOURCE_TYPES } from './envelope';
import { colorValueSchema, paintRefSchema } from './paint';
import { validateRecipeDocument } from '../recipe';

const recipe = (paints: unknown[]) => ({
  spec: 'recipe',
  specVersion: '1.0.0',
  id: 'urn:uuid:55555555-5555-4555-8555-555555555555',
  revision: 'rev-1',
  title: 'Catalogue-independent',
  paints,
  steps: [{ instruction: 'Basecoat.', paintRefs: ['p1'] }],
});

describe('paint reference — usable with no catalogue and no colour', () => {
  it('a reference with neither colour nor catalogueId is valid (the literal floor)', () => {
    expect(paintRefSchema.safeParse({ manufacturer: 'Citadel', name: 'Mephiston Red' }).success).toBe(
      true,
    );
    expect(validateRecipeDocument(recipe([{ ref: 'p1', name: 'Mephiston Red' }]))).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('a name-only reference is valid — manufacturer OR name is the only requirement', () => {
    expect(paintRefSchema.safeParse({ name: 'Some custom mix' }).success).toBe(true);
    expect(paintRefSchema.safeParse({ manufacturer: 'Vallejo' }).success).toBe(true);
  });

  it('a reference with neither manufacturer nor name is rejected', () => {
    expect(paintRefSchema.safeParse({ code: '70.950' }).success).toBe(false);
  });

  it('an unresolvable catalogueId is still a valid document — resolution is best-effort', () => {
    const doc = recipe([
      { ref: 'p1', name: 'House Grey', catalogueId: 'urn:example:private-catalogue:9f2' },
    ]);
    expect(validateRecipeDocument(doc)).toEqual({ valid: true, issues: [] });
  });

  it('the recommended brushcodex identifier form validates as an ordinary opaque string', () => {
    const parsed = paintRefSchema.safeParse({
      manufacturer: 'Citadel',
      range: 'Base',
      name: 'Mephiston Red',
      catalogueId: 'brushcodex:paint:citadel/base/mephiston-red',
    });
    expect(parsed.success).toBe(true);
  });

  it('an empty catalogueId is rejected — absent, never blank', () => {
    expect(paintRefSchema.safeParse({ name: 'X', catalogueId: '' }).success).toBe(false);
  });
});

describe('paint reference — colour observations are classified, never assumed', () => {
  it('the four colour-authority classes are distinct members of the vocabulary', () => {
    expect(SOURCE_TYPES).toContain('physical_measurement');
    expect(SOURCE_TYPES).toContain('manufacturer_digital_swatch');
    expect(SOURCE_TYPES).toContain('community_estimate');
    expect(SOURCE_TYPES).toContain('digital_approximation');
    expect(new Set(SOURCE_TYPES).size).toBe(SOURCE_TYPES.length);
  });

  it('an approximate digital colour is accepted as digital_approximation, not as a measurement', () => {
    const approximate = {
      manufacturer: 'Citadel',
      name: 'Mephiston Red',
      color: { hex: '#9a1115' },
      provenance: [
        {
          sourceType: 'digital_approximation' as const,
          confidence: 'low' as const,
          note: 'Screen approximation; not a physical measurement.',
        },
      ],
    };
    expect(paintRefSchema.safeParse(approximate).success).toBe(true);
    expect(validateRecipeDocument(recipe([{ ref: 'p1', ...approximate }]))).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('a measured colour is carried by the same shape under a different source class', () => {
    const measured = {
      ref: 'p1',
      manufacturer: 'Citadel',
      name: 'Mephiston Red',
      color: { hex: '#8f1013' },
      provenance: [
        {
          sourceType: 'physical_measurement' as const,
          confidence: 'high' as const,
          method: 'spectrophotometer, D65/10°, dried film over white',
        },
      ],
    };
    expect(validateRecipeDocument(recipe([measured]))).toEqual({ valid: true, issues: [] });
  });

  it('an unknown source class is rejected', () => {
    const parsed = paintRefSchema.safeParse({
      name: 'X',
      color: { hex: '#112233' },
      provenance: [{ sourceType: 'vibes' }],
    });
    expect(parsed.success).toBe(false);
  });
});

describe('paint reference — colour values are validated', () => {
  it.each(['#abc', 'abcdef', '#gggggg', '#1234567', 'rgb(1,2,3)', ''])(
    'rejects the malformed hex %o',
    (hex) => {
      expect(colorValueSchema.safeParse({ hex }).success).toBe(false);
    },
  );

  it.each(['#000000', '#FFFFFF', '#9a1115', '#9A1115'])('accepts the well-formed hex %o', (hex) => {
    expect(colorValueSchema.safeParse({ hex }).success).toBe(true);
  });

  it('rejects a colour object carrying anything other than hex', () => {
    expect(colorValueSchema.safeParse({ hex: '#112233', rgb: [17, 34, 51] }).success).toBe(false);
  });
});

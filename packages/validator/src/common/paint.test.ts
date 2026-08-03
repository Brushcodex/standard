/**
 * The canonical paint reference is shared by every spec.
 *
 * Two guarantees:
 *   1. Portability — a paint reference carrying `provenance` (and `color`/`ref`)
 *      validates identically under Recipe, Palette, Inventory, AND Project. Before
 *      consolidation the Project schema omitted `provenance` under
 *      `additionalProperties: false`, so a provenance-bearing paint valid elsewhere
 *      was rejected in a project. This is the regression guard.
 *   2. Single source — each spec schema's `$defs.paintRef`/`$defs.colorValue` is a
 *      `$ref` into the Common schema, not an inline copy, so the four cannot drift.
 */

import { describe, expect, it } from 'vitest';
import { schemas } from '@brushcodex/schema';
import { validateRecipeDocument } from '../recipe';
import { validatePaletteDocument } from '../palette';
import { validateInventoryDocument } from '../inventory';
import { validateProjectDocument } from '../project';

const PROVENANCE = [{ sourceType: 'manufacturer_digital_swatch' as const }];
const COLOR = { hex: '#c0c0c0' };

describe('canonical paint reference — cross-spec portability', () => {
  it('a provenance-bearing paint validates in a Recipe', () => {
    const result = validateRecipeDocument({
      spec: 'recipe',
      specVersion: '1.0.0',
      id: 'urn:uuid:11111111-1111-4111-8111-111111111111',
      revision: 'rev-1',
      title: 'Portable paint',
      paints: [{ ref: 'p1', name: 'Steel', color: COLOR, provenance: PROVENANCE }],
      steps: [{ instruction: 'Basecoat.', paintRefs: ['p1'] }],
    });
    expect(result).toEqual({ valid: true, issues: [] });
  });

  it('a provenance-bearing paint validates in a Palette', () => {
    const result = validatePaletteDocument({
      spec: 'palette',
      specVersion: '1.0.0',
      id: 'urn:uuid:22222222-2222-4222-8222-222222222222',
      revision: 'rev-1',
      title: 'Portable paint',
      entries: [{ name: 'Base', paint: { name: 'Steel', color: COLOR, provenance: PROVENANCE } }],
    });
    expect(result).toEqual({ valid: true, issues: [] });
  });

  it('a provenance-bearing paint validates in an Inventory', () => {
    const result = validateInventoryDocument({
      spec: 'inventory',
      specVersion: '1.0.0',
      id: 'urn:uuid:33333333-3333-4333-8333-333333333333',
      revision: 'rev-1',
      title: 'Portable paint',
      items: [{ paint: { manufacturer: 'X', name: 'Steel', provenance: PROVENANCE }, quantity: 1 }],
    });
    expect(result).toEqual({ valid: true, issues: [] });
  });

  it('a provenance-bearing (and ref/color-bearing) paint validates in a Project substitution — the regression', () => {
    const result = validateProjectDocument({
      spec: 'project',
      specVersion: '1.0.0',
      id: 'urn:uuid:44444444-4444-4444-8444-444444444444',
      revision: 'rev-1',
      title: 'Portable paint',
      status: 'active',
      substitutions: [
        {
          original: { ref: 'a', name: 'Old', color: COLOR, provenance: PROVENANCE },
          substitute: { name: 'New' },
          type: 'authored',
        },
      ],
    });
    expect(result).toEqual({ valid: true, issues: [] });
  });
});

describe('canonical paint reference — single source of truth', () => {
  interface SchemaDefs {
    $defs: Record<string, { $ref?: string }>;
  }
  const specs: Array<[string, SchemaDefs]> = [
    ['recipe', schemas.recipe as unknown as SchemaDefs],
    ['palette', schemas.palette as unknown as SchemaDefs],
    ['inventory', schemas.inventory as unknown as SchemaDefs],
    ['project', schemas.project as unknown as SchemaDefs],
  ];

  it.each(specs)(
    '%s schema $refs the Common paintRef + colorValue (no inline copy)',
    (_name, schema) => {
      expect(schema.$defs.paintRef?.$ref).toBe(
        'https://brushcodex.com/schemas/common/v1/common.schema.json#/$defs/paintRef',
      );
      expect(schema.$defs.colorValue?.$ref).toBe(
        'https://brushcodex.com/schemas/common/v1/common.schema.json#/$defs/colorValue',
      );
    },
  );
});

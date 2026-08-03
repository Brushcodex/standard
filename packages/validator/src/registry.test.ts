/**
 * Tests for the spec registry and the conformance runner — the pieces the
 * standalone validator CLI and conformance script are built on.
 */

import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SPEC_NAMES, detectSpec, validateAnyDocument, validateBySpec } from './registry';
import { runConformance } from './conformance';

describe('standards registry', () => {
  it('exposes a validator for every spec name', () => {
    for (const spec of SPEC_NAMES) {
      // Each spec's validator rejects an empty object (missing required members).
      expect(validateBySpec(spec, {}).valid).toBe(false);
    }
  });

  it('detects the declared spec of a document', () => {
    expect(detectSpec({ spec: 'recipe' })).toBe('recipe');
    expect(detectSpec({ spec: 'bundle' })).toBe('bundle');
    expect(detectSpec({ spec: 'nope' })).toBeNull();
    expect(detectSpec({})).toBeNull();
    expect(detectSpec(null)).toBeNull();
  });

  it('validateAnyDocument dispatches by declared spec', () => {
    const recipe = {
      spec: 'recipe',
      specVersion: '1.0.0',
      id: 'urn:uuid:11111111-1111-4111-8111-111111111111',
      revision: 'r1',
      title: 'T',
      steps: [{ instruction: 'x' }],
    };
    expect(validateAnyDocument(recipe)).toEqual({
      spec: 'recipe',
      result: { valid: true, issues: [] },
    });

    const unknown = validateAnyDocument({ nope: 1 });
    expect(unknown.spec).toBeNull();
    expect(unknown.result.valid).toBe(false);
    expect(unknown.result.issues[0]?.code).toBe('unknown-spec');
  });
});

describe('conformance runner over the published corpus', () => {
  const report = runConformance(fileURLToPath(new URL('../../../examples', import.meta.url)));

  it('validates cases for every specification', () => {
    expect(new Set(report.cases.map((item) => item.spec))).toEqual(new Set(SPEC_NAMES));
    expect(report.total).toBeGreaterThan(40);
  });

  it('every corpus case matches its expected outcome', () => {
    expect(report.cases.filter((item) => !item.ok)).toEqual([]);
    expect(report.failed).toBe(0);
    expect(report.passed).toBe(report.total);
  });

  it('bySpec aggregates cover every spec and reconcile with the totals', () => {
    expect(new Set(report.bySpec.map((s) => s.spec))).toEqual(new Set(SPEC_NAMES));
    for (const summary of report.bySpec) {
      const specCases = report.cases.filter((c) => c.spec === summary.spec);
      expect(summary.total).toBe(specCases.length);
      expect(summary.passed).toBe(specCases.filter((c) => c.ok).length);
      expect(summary.passed + summary.failed).toBe(summary.total);
    }
    // The per-spec tallies sum to the grand totals.
    expect(report.bySpec.reduce((n, s) => n + s.total, 0)).toBe(report.total);
    expect(report.bySpec.reduce((n, s) => n + s.passed, 0)).toBe(report.passed);
  });
});

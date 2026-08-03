/**
 * Conformance runner — validates the on-disk example corpus with the reference
 * validators, checking that every `*.valid.json` is accepted and every
 * `invalid/*.json` is rejected, per specification. Runs without the web
 * application; a standalone script (`scripts/conformance.ts`) wraps it so third
 * parties can prove an implementation against the published corpus.
 *
 * Each fixture is validated against the specification named by its **directory**
 * (e.g. everything under `examples/recipe/v1` is validated as a recipe), so a
 * fixture that deliberately declares the wrong `spec` still counts as invalid.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { SPEC_NAMES, validateBySpec, type SpecName } from './registry';

export type ConformanceExpectation = 'valid' | 'invalid';

export interface ConformanceCaseResult {
  spec: SpecName;
  file: string;
  expected: ConformanceExpectation;
  actual: ConformanceExpectation;
  ok: boolean;
  /** Validator messages (present when a case fails its expectation). */
  detail?: string;
}

/** Per-specification pass/fail tally within a {@link ConformanceReport}. */
export interface ConformanceSpecSummary {
  spec: SpecName;
  total: number;
  passed: number;
  failed: number;
}

export interface ConformanceReport {
  total: number;
  passed: number;
  failed: number;
  /** Per-spec aggregates (specs with at least one case), in corpus order. */
  bySpec: ConformanceSpecSummary[];
  cases: ConformanceCaseResult[];
}

function listJson(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((name) => name.endsWith('.json') && name !== 'EXPECTATIONS.json')
      .sort();
  } catch {
    return [];
  }
}

function validateFile(path: string, spec: SpecName): { valid: boolean; detail: string } {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return { valid: false, detail: 'not valid JSON' };
  }
  const result = validateBySpec(spec, value);
  return { valid: result.valid, detail: result.issues.map((issue) => issue.message).join('; ') };
}

/**
 * Validate the whole example corpus under `examplesRoot` (the `examples/`
 * directory). Returns a structured pass/fail report; the caller decides how to
 * present it and what exit code to use.
 */
export function runConformance(examplesRoot: string): ConformanceReport {
  const cases: ConformanceCaseResult[] = [];

  for (const spec of SPEC_NAMES) {
    const versionDir = `${examplesRoot}/${spec}/v1`;

    for (const name of listJson(versionDir).filter((n) => n.endsWith('.valid.json'))) {
      const { valid, detail } = validateFile(`${versionDir}/${name}`, spec);
      cases.push({
        spec,
        file: name,
        expected: 'valid',
        actual: valid ? 'valid' : 'invalid',
        ok: valid,
        ...(valid ? {} : { detail }),
      });
    }

    for (const name of listJson(`${versionDir}/invalid`)) {
      const { valid } = validateFile(`${versionDir}/invalid/${name}`, spec);
      cases.push({
        spec,
        file: `invalid/${name}`,
        expected: 'invalid',
        actual: valid ? 'valid' : 'invalid',
        ok: !valid,
        ...(valid ? { detail: 'unexpectedly accepted' } : {}),
      });
    }
  }

  const passed = cases.filter((c) => c.ok).length;
  const bySpec: ConformanceSpecSummary[] = SPEC_NAMES.map((spec) => {
    const specCases = cases.filter((c) => c.spec === spec);
    const specPassed = specCases.filter((c) => c.ok).length;
    return { spec, total: specCases.length, passed: specPassed, failed: specCases.length - specPassed };
  }).filter((summary) => summary.total > 0);
  return { total: cases.length, passed, failed: cases.length - passed, bySpec, cases };
}

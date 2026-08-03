/**
 * Prose ↔ schema consistency check.
 *
 * Asserts that every enum value and every property name in each versioned JSON Schema is documented
 * in the normative prose. Both surfaces are binding, and a disagreement between them is a defect
 * (see any `specs/**​/README.md` § "Normative vs. informative"). This turns "we keep them honest by
 * review" into a command — most valuable **right before a freeze**, which makes the schemas
 * immutable and any undocumented member permanent.
 *
 * Scope and the two checks are described in `scripts/lib/consistency.mjs`. Dependency-free; reads
 * only `specs/` and `schemas/`. Exit 0 when consistent, 1 on any discrepancy, 2 on a read error.
 *
 * Usage:  node scripts/check-consistency.mjs [--json]
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  backtickTokens,
  specDiscrepancies,
} from './lib/consistency.mjs';

const SPECS = ['common', 'recipe', 'palette', 'inventory', 'project', 'technique', 'bundle'];
const repoRoot = new URL('..', import.meta.url);
const asJson = process.argv.includes('--json');

function read(relative) {
  return readFileSync(fileURLToPath(new URL(relative, repoRoot)), 'utf8');
}

let proseBySpec;
let schemas;
try {
  proseBySpec = Object.fromEntries(
    SPECS.map((s) => [s, backtickTokens(read(`specs/${s}/v1/README.md`))]),
  );
  schemas = Object.fromEntries(
    SPECS.map((s) => [s, JSON.parse(read(`schemas/${s}/v1/${s}.schema.json`))]),
  );
} catch (error) {
  console.error(`check-consistency: could not read specs/schemas — ${error.message}`);
  process.exit(2);
}

const corpusTokens = new Set(SPECS.flatMap((s) => [...proseBySpec[s]]));

const results = SPECS.map((spec) => {
  const ownTokens = new Set([...proseBySpec[spec], ...proseBySpec.common]);
  const { undocumentedEnumValues, undocumentedProperties } = specDiscrepancies(
    schemas[spec],
    ownTokens,
    corpusTokens,
  );
  return { spec, undocumentedEnumValues, undocumentedProperties };
});

const total = results.reduce(
  (n, r) => n + r.undocumentedEnumValues.length + r.undocumentedProperties.length,
  0,
);

if (asJson) {
  console.log(JSON.stringify({ ok: total === 0, total, results }, null, 2));
  process.exit(total === 0 ? 0 : 1);
}

for (const r of results) {
  const issues = r.undocumentedEnumValues.length + r.undocumentedProperties.length;
  if (issues === 0) {
    console.log(`  ok    ${r.spec}`);
    continue;
  }
  console.log(`  FAIL  ${r.spec}`);
  if (r.undocumentedEnumValues.length) {
    console.log(`          enum values not documented in prose: ${r.undocumentedEnumValues.join(', ')}`);
  }
  if (r.undocumentedProperties.length) {
    console.log(`          properties not documented in prose:  ${r.undocumentedProperties.join(', ')}`);
  }
}

if (total === 0) {
  console.log('\nConsistent: every schema enum value and property name is documented in the prose.');
  process.exit(0);
}
console.log(
  `\n${total} discrepanc${total === 1 ? 'y' : 'ies'}. Either document the member in the spec prose, ` +
    'or remove it from the schema — both are normative and must agree.',
);
process.exit(1);

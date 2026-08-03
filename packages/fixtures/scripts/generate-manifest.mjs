// Generator for @brushcodex/fixtures. Two deterministic outputs, from the single canonical
// corpus at the repo root (brushcodex-standard/examples/**):
//
//   1. corpus/examples/**            — a byte-for-byte copy shipped inside the package, so an
//                                       installed consumer never reads the source repository.
//   2. src/manifest.generated.ts     — a stable, typed manifest (ids + metadata; no content).
//
//   pnpm --filter @brushcodex/fixtures generate
//
// Fails (exit 1) on: an unknown spec directory, malformed JSON, a duplicate id, an invalid
// fixture with no EXPECTATIONS entry, or an EXPECTATIONS entry naming a missing file.

import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';

const EXAMPLES_ROOT = new URL('../../../examples/', import.meta.url); // packages/fixtures/scripts -> repo root
const CORPUS_DIR = new URL('../corpus/', import.meta.url);
const CORPUS_EXAMPLES = new URL('../corpus/examples/', import.meta.url);
const MANIFEST_OUT = new URL('../src/manifest.generated.ts', import.meta.url);

// Canonical spec order (matches @brushcodex/schema SPEC_NAMES / the conformance runner).
const SPECS = ['common', 'recipe', 'palette', 'inventory', 'project', 'technique', 'bundle'];

function fail(message) {
  console.error(`FATAL: ${message}`);
  process.exit(1);
}

function listJson(dirUrl) {
  try {
    return readdirSync(dirUrl)
      .filter((name) => name.endsWith('.json'))
      .sort();
  } catch {
    return [];
  }
}

function readJson(fileUrl, label) {
  let text;
  try {
    text = readFileSync(fileUrl, 'utf8');
  } catch (error) {
    fail(`cannot read ${label}: ${error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`);
  }
}

// --- Guard: only the 7 known spec directories (plus the LICENSE file) live under examples/. ---
for (const entry of readdirSync(EXAMPLES_ROOT, { withFileTypes: true })) {
  if (entry.isDirectory()) {
    if (!SPECS.includes(entry.name)) fail(`unexpected spec directory examples/${entry.name}`);
  } else if (entry.name !== 'LICENSE') {
    fail(`unexpected file examples/${entry.name} (only spec dirs and LICENSE are allowed)`);
  }
}

// --- Build the manifest. ---
const fixtures = [];
const seenIds = new Set();

function push(fixture) {
  if (seenIds.has(fixture.id)) fail(`duplicate fixture id: ${fixture.id}`);
  seenIds.add(fixture.id);
  fixtures.push(fixture);
}

for (const spec of SPECS) {
  const versionDir = new URL(`${spec}/v1/`, EXAMPLES_ROOT);
  const invalidDir = new URL(`${spec}/v1/invalid/`, EXAMPLES_ROOT);

  // Valid fixtures: *.valid.json directly under v1/.
  for (const name of listJson(versionDir).filter((n) => n.endsWith('.valid.json'))) {
    push({
      id: `${spec}/${name.replace(/\.json$/, '')}`,
      spec,
      category: 'valid',
      relativePath: `examples/${spec}/v1/${name}`,
      expectedValid: true,
    });
  }

  // EXPECTATIONS: filename -> case, for the invalid fixtures.
  const expectations = readJson(new URL('EXPECTATIONS.json', invalidDir), `examples/${spec}/v1/invalid/EXPECTATIONS.json`);
  const caseByFile = new Map();
  for (const c of expectations.cases ?? []) caseByFile.set(c.file, c);

  const invalidFiles = listJson(invalidDir).filter((n) => n !== 'EXPECTATIONS.json');

  // Every EXPECTATIONS case must name a real invalid fixture.
  for (const file of caseByFile.keys()) {
    if (!invalidFiles.includes(file)) {
      fail(`EXPECTATIONS names a missing file: examples/${spec}/v1/invalid/${file}`);
    }
  }

  for (const name of invalidFiles) {
    const c = caseByFile.get(name);
    if (!c) fail(`invalid fixture has no EXPECTATIONS entry: examples/${spec}/v1/invalid/${name}`);
    // Confirm each invalid fixture is at least well-formed JSON (content lives in the corpus copy).
    readJson(new URL(name, invalidDir), `examples/${spec}/v1/invalid/${name}`);

    let expectation;
    if (c.layer === 'schema') {
      expectation = {
        layer: 'schema',
        keyword: String(c.expect?.keyword ?? ''),
        instancePath: String(c.expect?.instancePath ?? ''),
        reason: String(c.reason ?? ''),
      };
    } else if (c.layer === 'semantic') {
      expectation = { layer: 'semantic', rule: String(c.expect?.rule ?? ''), reason: String(c.reason ?? '') };
    } else {
      fail(`unknown EXPECTATIONS layer '${c.layer}' for examples/${spec}/v1/invalid/${name}`);
    }

    push({
      id: `${spec}/invalid/${name.replace(/\.json$/, '')}`,
      spec,
      category: 'invalid',
      relativePath: `examples/${spec}/v1/invalid/${name}`,
      expectedValid: false,
      description: String(c.reason ?? ''),
      expectation,
    });
  }
}

// --- Copy the canonical corpus into the package (deterministic; overwrites any prior copy). ---
rmSync(CORPUS_EXAMPLES, { recursive: true, force: true });
mkdirSync(CORPUS_DIR, { recursive: true });
cpSync(EXAMPLES_ROOT, CORPUS_EXAMPLES, { recursive: true });

// --- Emit the typed manifest. ---
const lines = [
  '// AUTO-GENERATED by packages/fixtures/scripts/generate-manifest.mjs — DO NOT EDIT BY HAND.',
  '// Source of truth: brushcodex-standard/examples/**.',
  '// Regenerate: pnpm --filter @brushcodex/fixtures generate',
  '',
  "import type { BrushCodexFixture } from './types';",
  '',
  'export const fixtures: readonly BrushCodexFixture[] = [',
];
for (const f of fixtures) {
  const parts = [
    `id: ${JSON.stringify(f.id)}`,
    `spec: ${JSON.stringify(f.spec)}`,
    `category: ${JSON.stringify(f.category)}`,
    `relativePath: ${JSON.stringify(f.relativePath)}`,
    `expectedValid: ${f.expectedValid}`,
  ];
  if (f.description !== undefined) parts.push(`description: ${JSON.stringify(f.description)}`);
  if (f.expectation !== undefined) parts.push(`expectation: ${JSON.stringify(f.expectation)}`);
  lines.push(`  { ${parts.join(', ')} },`);
}
lines.push('];', '');

writeFileSync(MANIFEST_OUT, lines.join('\n'));

const validCount = fixtures.filter((f) => f.expectedValid).length;
console.log(
  `@brushcodex/fixtures: ${fixtures.length} fixtures (${validCount} valid, ${fixtures.length - validCount} invalid) across ${SPECS.length} specs; corpus copied.`,
);

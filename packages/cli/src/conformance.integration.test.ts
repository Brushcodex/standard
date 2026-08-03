/**
 * Regression tests for CLI package self-containment — the guarantee that the packed
 * `brushcodex-conformance` bin runs the corpus through the installed `@brushcodex/fixtures`
 * package, with NO repo-relative path and from ANY working directory.
 *
 * These would have caught the original defect (`new URL('../../../examples', import.meta.url)`),
 * which only surfaces in the PACKED layout — so a mere change of `cwd` is not enough; we assert
 * statically (no escape in dist) AND simulate the installed node_modules layout AND spawn via
 * plain Node (not just Vitest's resolver).
 *
 * Requires a built workspace (`pnpm -r build`): the CLI `test` script builds the CLI bins first,
 * and this file regenerates the fixtures corpus if it is missing.
 */

import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { fixtures } from '@brushcodex/fixtures';
import { examplesRoot } from '@brushcodex/fixtures/node';
import { bundle } from '@brushcodex/validator';

const CLI_DIR = fileURLToPath(new URL('..', import.meta.url)); // packages/cli
const FIXTURES_DIR = fileURLToPath(new URL('../../fixtures', import.meta.url)); // packages/fixtures
const CONFORMANCE_BIN = join(CLI_DIR, 'dist', 'conformance.js');
const VALIDATE_BIN = join(CLI_DIR, 'dist', 'validate.js');
const FIXTURES_GENERATOR = join(FIXTURES_DIR, 'scripts', 'generate-manifest.mjs');

/** Run a built bin via plain Node; returns { status, stdout, stderr } without throwing on exit!=0. */
function runNode(bin: string, args: string[], cwd: string): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8' });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

beforeAll(() => {
  // The CLI bins must be built (the `test` script runs `node scripts/build.mjs` first).
  if (!existsSync(CONFORMANCE_BIN) || !existsSync(VALIDATE_BIN)) {
    throw new Error(`CLI dist bins missing — build the CLI first (node scripts/build.mjs): ${CONFORMANCE_BIN}`);
  }
  // The fixtures corpus is generated + gitignored; regenerate it if a fresh checkout lacks it.
  if (!existsSync(join(examplesRoot, 'recipe', 'v1', 'minimal.valid.json'))) {
    execFileSync(process.execPath, [FIXTURES_GENERATOR], { stdio: 'ignore' });
  }
  // The fixtures package must be built (its dist/node.js is the runtime entry the CLI imports).
  if (!existsSync(join(FIXTURES_DIR, 'dist', 'node.js'))) {
    throw new Error('@brushcodex/fixtures is not built — run `pnpm -r build` first.');
  }
});

describe('static: the built conformance bin has no repo-root escape', () => {
  it('imports @brushcodex/fixtures and contains no ../../../examples repo escape', () => {
    const dist = readFileSync(CONFORMANCE_BIN, 'utf8');
    expect(dist).toContain('@brushcodex/fixtures');
    // The original defect, in every separator form:
    expect(dist).not.toMatch(/\.\.[\\/]\.\.[\\/]\.\.[\\/]examples/);
    expect(dist).not.toMatch(/\.\.[\\/]\.\.[\\/]examples/);
  });
});

describe('behavioral: conformance runs from any working directory (plain Node)', () => {
  it('reports 76/76 and exits 0 when run from a foreign cwd (os.tmpdir())', () => {
    const { status, stdout } = runNode(CONFORMANCE_BIN, [], tmpdir());
    expect(status).toBe(0);
    expect(stdout).toContain(`${fixtures.length}/${fixtures.length}`);
    // Per-spec tally: every spec present in the corpus reports its own passed/total line.
    for (const spec of new Set(fixtures.map((f) => f.spec))) {
      expect(stdout).toMatch(new RegExp(`${spec}\\s+\\d+/\\d+`));
    }
  });

  it('--json total equals the fixtures manifest count, with zero failures', () => {
    const { status, stdout } = runNode(CONFORMANCE_BIN, ['--json'], tmpdir());
    expect(status).toBe(0);
    const report = JSON.parse(stdout) as {
      total: number;
      passed: number;
      failed: number;
      bySpec: Array<{ spec: string; total: number; passed: number; failed: number }>;
    };
    expect(report.total).toBe(fixtures.length);
    expect(report.passed).toBe(fixtures.length);
    expect(report.failed).toBe(0);
    // Machine-readable per-spec aggregates ship in --json; they reconcile with the total.
    expect(new Set(report.bySpec.map((s) => s.spec))).toEqual(new Set(fixtures.map((f) => f.spec)));
    expect(report.bySpec.reduce((n, s) => n + s.total, 0)).toBe(report.total);
  });
});

describe('packed-layout simulation: install tree, source repo irrelevant', () => {
  it('runs 76/76 from a copied node_modules where ../../../examples would NOT resolve', () => {
    // Recreate the installed layout: <root>/node_modules/@brushcodex/{cli,fixtures} + the CLI's
    // external npm deps. From <root>/node_modules/@brushcodex/cli/dist/conformance.js the old
    // `../../../examples` would resolve to <root>/node_modules/examples (absent) — so a regression
    // to a repo-relative escape fails loudly here. The corpus is served by the COPIED fixtures
    // package (its own corpus/), never the source repo's examples/.
    const root = mkdtempSync(join(tmpdir(), 'bcx-cli-packed-'));
    const modules = join(root, 'node_modules');
    const cliPkg = join(modules, '@brushcodex', 'cli');
    const fixturesPkg = join(modules, '@brushcodex', 'fixtures');
    mkdirSync(cliPkg, { recursive: true });
    mkdirSync(fixturesPkg, { recursive: true });

    // Copy only what the packed tarballs ship (files: dist [+ corpus]) plus each package.json.
    cpSync(join(CLI_DIR, 'dist'), join(cliPkg, 'dist'), { recursive: true });
    cpSync(join(CLI_DIR, 'package.json'), join(cliPkg, 'package.json'));
    cpSync(join(FIXTURES_DIR, 'dist'), join(fixturesPkg, 'dist'), { recursive: true });
    cpSync(join(FIXTURES_DIR, 'corpus'), join(fixturesPkg, 'corpus'), { recursive: true });
    cpSync(join(FIXTURES_DIR, 'package.json'), join(fixturesPkg, 'package.json'));

    // The CLI's external runtime deps (bundled-out npm libs) — link each to its real store dir so
    // pnpm's transitive structure stays intact. A junction on Windows needs no elevated privilege.
    for (const dep of ['ajv', 'ajv-formats', 'zod', 'fflate']) {
      const target = realpathSync(join(CLI_DIR, 'node_modules', dep));
      symlinkSync(target, join(modules, dep), 'junction');
    }

    const bin = join(cliPkg, 'dist', 'conformance.js');
    // Run from an unrelated cwd to also prove cwd-independence in the installed layout.
    const { status, stdout, stderr } = runNode(bin, [], root);
    expect(status, stderr).toBe(0);
    expect(stdout).toContain(`${fixtures.length}/${fixtures.length}`);
  });
});

describe('validate bin: external user files (no corpus dependency)', () => {
  it('accepts a valid document (exit 0) and rejects an invalid one (exit 1)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bcx-cli-validate-'));
    const validFile = join(dir, 'ok.brushrecipe.json');
    const invalidFile = join(dir, 'bad.brushrecipe.json');
    // Minimal valid recipe (from the manifest) vs. a document missing required members.
    writeFileSync(validFile, readFileSync(join(examplesRoot, 'recipe', 'v1', 'minimal.valid.json')));
    writeFileSync(invalidFile, JSON.stringify({ spec: 'recipe', specVersion: '1.0.0' }));

    expect(runNode(VALIDATE_BIN, [validFile], dir).status).toBe(0);
    expect(runNode(VALIDATE_BIN, [invalidFile], dir).status).toBe(1);
  });

  it('validates several files at once, exits 1 if any is invalid, and prints an N/M summary', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bcx-cli-multi-'));
    const good = join(dir, 'good.brushrecipe.json');
    const bad = join(dir, 'bad.brushrecipe.json');
    writeFileSync(good, readFileSync(join(examplesRoot, 'recipe', 'v1', 'minimal.valid.json')));
    writeFileSync(bad, JSON.stringify({ spec: 'recipe', specVersion: '1.0.0' }));

    const { status, stdout } = runNode(VALIDATE_BIN, [good, bad], dir);
    expect(status).toBe(1); // any invalid input => exit 1
    expect(stdout).toContain('1/2 valid.'); // summary counts both files
    expect(stdout).toMatch(/OK\s+recipe/); // the valid document
    expect(stdout).toMatch(/FAIL\s+recipe/); // the invalid document
  });
});

interface JsonFileResult {
  file: string;
  kind: 'document' | 'bundle-archive';
  spec: string | null;
  valid: boolean;
  issues: Array<{ path: string; code: string; message: string; layer: string }>;
  documents?: number;
  media?: number;
}

/** Parse a `--json` run that targeted a single file and return that one result. */
function parseSingle(stdout: string): JsonFileResult {
  const report = JSON.parse(stdout) as JsonFileResult[];
  expect(report).toHaveLength(1);
  const [only] = report;
  if (!only) throw new Error('expected exactly one file result in --json output');
  return only;
}

describe('validate --json: structured, machine-readable issues', () => {
  it('emits one { path, code, message, layer } object per issue for an invalid document', () => {
    // A real corpus fixture with an out-of-vocabulary paint kind (enum violation).
    const badPaintKind = join(examplesRoot, 'recipe', 'v1', 'invalid', 'bad-paint-kind.json');
    const { status, stdout } = runNode(VALIDATE_BIN, ['--json', badPaintKind], tmpdir());
    expect(status).toBe(1);

    const result = parseSingle(stdout);
    expect(result.valid).toBe(false);
    const enumIssue = result.issues.find((issue) => issue.code === 'enum');
    expect(enumIssue, JSON.stringify(result.issues)).toBeDefined();
    // path locates the offending member; layer is the machine-branchable classification;
    // message carries the allowed-values enrichment. None of these survive in --json today.
    expect(enumIssue?.path).toContain('kind');
    expect(enumIssue?.layer).toBe('schema');
    expect(enumIssue?.message).toContain('allowed:');
  });

  it('classifies unparseable input as a syntax-layer not-json issue', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bcx-cli-json-'));
    const notJson = join(dir, 'broken.brushrecipe.json');
    writeFileSync(notJson, '{ this is not json');
    const { status, stdout } = runNode(VALIDATE_BIN, ['--json', notJson], dir);
    expect(status).toBe(1);

    const result = parseSingle(stdout);
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([
      { path: '', code: 'not-json', message: 'not valid JSON', layer: 'syntax' },
    ]);
  });

  it('distinguishes a missing/unreadable file from invalid JSON', () => {
    const missing = join(mkdtempSync(join(tmpdir(), 'bcx-cli-missing-')), 'nope.brushrecipe.json');
    const { status, stdout } = runNode(VALIDATE_BIN, ['--json', missing], tmpdir());
    expect(status).toBe(1);

    const result = parseSingle(stdout);
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe('unreadable'); // not the misleading "not-json"
    expect(result.issues[0]?.layer).toBe('io');
    expect(result.issues[0]?.message).toMatch(/cannot read file:/);
  });

  it('reports a valid document with an empty issues array', () => {
    const validFile = join(examplesRoot, 'recipe', 'v1', 'minimal.valid.json');
    const { status, stdout } = runNode(VALIDATE_BIN, ['--json', validFile], tmpdir());
    expect(status).toBe(0);

    const result = parseSingle(stdout);
    expect(result.valid).toBe(true);
    expect(result.spec).toBe('recipe');
    expect(result.issues).toEqual([]);
  });
});

describe('validate bin: .brushcodex.zip bundle archives', () => {
  it('accepts a well-formed bundle and reports its document/media counts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bcx-cli-bundle-'));
    const recipe = JSON.parse(
      readFileSync(join(examplesRoot, 'recipe', 'v1', 'minimal.valid.json'), 'utf8'),
    );
    // Build a real bundle with the reference writer, then validate it through the bin.
    const zip = bundle.writeBundle({
      id: 'https://example.org/bundles/cli-test',
      title: 'CLI test bundle',
      documents: [{ path: 'recipe.json', spec: 'recipe', document: recipe }],
    });
    const zipFile = join(dir, 'archive.brushcodex.zip');
    writeFileSync(zipFile, zip);

    const human = runNode(VALIDATE_BIN, [zipFile], dir);
    expect(human.status, human.stderr).toBe(0);
    expect(human.stdout).toContain('1 document(s), 0 media');

    const { status, stdout } = runNode(VALIDATE_BIN, ['--json', zipFile], dir);
    expect(status).toBe(0);
    const result = parseSingle(stdout);
    expect(result.kind).toBe('bundle-archive');
    expect(result.valid).toBe(true);
    expect(result.documents).toBe(1);
    expect(result.media).toBe(0);
  });

  it('rejects an unreadable archive with an archive-layer bundle-unreadable issue', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bcx-cli-badzip-'));
    const badZip = join(dir, 'corrupt.brushcodex.zip');
    writeFileSync(badZip, 'this is not a zip archive');

    const { status, stdout } = runNode(VALIDATE_BIN, ['--json', badZip], dir);
    expect(status).toBe(1);
    const result = parseSingle(stdout);
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe('bundle-unreadable');
    expect(result.issues[0]?.layer).toBe('archive');
  });

  it('reports a missing archive as io/unreadable, not a corrupt archive', () => {
    const missing = join(mkdtempSync(join(tmpdir(), 'bcx-cli-missingzip-')), 'gone.brushcodex.zip');
    const { status, stdout } = runNode(VALIDATE_BIN, ['--json', missing], tmpdir());
    expect(status).toBe(1);
    const result = parseSingle(stdout);
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe('unreadable'); // not bundle-unreadable
    expect(result.issues[0]?.layer).toBe('io'); // not archive
  });
});

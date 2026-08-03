#!/usr/bin/env node
/**
 * Packed release gate — `pnpm verify:packed`.
 *
 * Proves every public @brushcodex/* package works from **packed tarballs** in a clean, isolated
 * consumer with NO access to this source checkout, under plain Node ESM and via the installed CLI
 * shims. It builds from zero, packs with pnpm (rewriting `workspace:*`), installs the tarballs into
 * a throwaway npm project outside the repo (path with a space), runs schema/types/validator/
 * fixtures/CLI checks, then repeats the essential checks with the source repo renamed away.
 *
 * It NEVER publishes, pushes, or tags. See ../docs/RELEASING.md.
 *
 * Producer side: pnpm (workspace-aware build + pack). Consumer side: npm (workspace-blind, flat
 * node_modules, bundled with Node) — the strongest "unaffiliated external consumer" proof.
 *
 * Cross-platform: Node ESM only; no external `tar`; explicit argv (no shell string concat) except
 * the Windows `.cmd` shim, which requires a quoted shell command.
 *
 * Flags: --keep (retain the consumer + tarballs on success). Env: BCX_KEEP_CONSUMER=1 (same).
 */

import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readTarGz } from './lib/targz.mjs';
import {
  CORPUS_OWNER,
  EXPECTED_PACKAGES,
  GateError,
  assertPackageSet,
  countCorpusFixtures,
  findContentViolations,
  findManifestViolations,
  findVersionViolations,
} from './lib/assertions.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES_DIR = join(REPO_ROOT, 'packages');
const ARTIFACTS_DIR = join(REPO_ROOT, 'artifacts', 'local-packages');
const EXAMPLES_DIR = join(REPO_ROOT, 'examples');
const FIXTURE_COUNT = 92;
const KEEP = process.argv.includes('--keep') || process.env.BCX_KEEP_CONSUMER === '1';

// package name -> its directory under packages/
const PACKAGE_DIRS = {
  '@brushcodex/schema': join(PACKAGES_DIR, 'schema'),
  '@brushcodex/types': join(PACKAGES_DIR, 'types'),
  '@brushcodex/validator': join(PACKAGES_DIR, 'validator'),
  '@brushcodex/fixtures': join(PACKAGES_DIR, 'fixtures'),
  '@brushcodex/cli': join(PACKAGES_DIR, 'cli'),
};

// Registry of active source renames [original, hidden]. Restored by withSourceAbsent's finally on
// normal/exception exit, and by a signal handler on interruption — so the source tree is never
// left mutated, "even when the script fails".
const pendingRestores = [];
function restoreRenames() {
  while (pendingRestores.length) {
    const [src, hidden] = pendingRestores.pop();
    try {
      if (existsSync(hidden)) renameSync(hidden, src);
    } catch (e) {
      console.error(`   ! failed to restore ${src}: ${e.message}`);
    }
  }
}
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    restoreRenames();
    process.exit(130);
  });
}

// ---------------------------------------------------------------------------------------------
// Small process/logging utilities
// ---------------------------------------------------------------------------------------------

let stageNum = 0;
function stage(title) {
  stageNum += 1;
  console.log(`\n── [${stageNum}] ${title} ${'─'.repeat(Math.max(0, 62 - title.length))}`);
}
function info(msg) {
  console.log(`   ${msg}`);
}
function ok(msg) {
  console.log(`   ✓ ${msg}`);
}
function fail(msg) {
  throw new GateError(msg);
}

/** Environment for the consumer: strip package-manager config that could leak the workspace. */
function cleanEnv() {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (/^npm_config_/i.test(k)) continue;
    if (/^npm_package_/i.test(k)) continue;
    if (/^PNPM/i.test(k)) continue;
    if (k === 'INIT_CWD' || k === 'NODE_OPTIONS') continue;
    env[k] = v;
  }
  return env;
}

const IS_WIN = process.platform === 'win32';
const PNPM = IS_WIN ? 'pnpm.cmd' : 'pnpm';
const NPM = IS_WIN ? 'npm.cmd' : 'npm';

/**
 * spawnSync wrapper. On Windows, `.cmd`/`.bat` shims (pnpm, npm, the `.bin` shims) cannot be
 * spawned directly since Node's CVE-2024-27980 mitigation — they need `shell: true`, which does
 * NOT auto-quote, so we build a quoted command line ourselves. Everything else (node itself) runs
 * with an explicit argv array and no shell, so paths with spaces are safe.
 */
function invoke(cmd, args, opts = {}) {
  if (IS_WIN && /\.(cmd|bat)$/i.test(cmd)) {
    const line = [cmd, ...args].map((a) => (/[\s"&|<>^]/.test(a) ? `"${a}"` : a)).join(' ');
    return spawnSync(line, { shell: true, ...opts });
  }
  return spawnSync(cmd, args, opts);
}

/** Run a command with explicit args; inherit stdio (streamed). Throws on non-zero. */
function run(cmd, args, opts = {}) {
  const r = invoke(cmd, args, { stdio: 'inherit', encoding: 'utf8', ...opts, env: opts.env || process.env });
  if (r.error) fail(`${cmd} could not start: ${r.error.message}`);
  if (r.status !== 0) fail(`${cmd} ${args.join(' ')} exited ${r.status}`);
  return r;
}

/** Run a command capturing stdout/stderr; never throws. Returns { status, stdout, stderr }. */
function capture(cmd, args, opts = {}) {
  const r = invoke(cmd, args, { encoding: 'utf8', ...opts, env: opts.env || process.env });
  return { status: r.status ?? (r.error ? -1 : 1), stdout: r.stdout || '', stderr: r.stderr || '', error: r.error };
}

/** Run a built CLI file directly under this Node (shell-independent; handles spaces in argv). */
function runNode(file, args, cwd) {
  return capture(process.execPath, [file, ...args], { cwd });
}

/** Run an installed `.bin` shim cross-platform (invoke() shells `.cmd` on Windows). */
function runBinShim(consumerDir, binName, args, cwd) {
  const shim = join(consumerDir, 'node_modules', '.bin', IS_WIN ? `${binName}.cmd` : binName);
  return capture(shim, args, { cwd });
}

// ---------------------------------------------------------------------------------------------
// Consumer file templates (written by THIS Node process into the consumer — never a repo tool,
// so no editor/linter hook rewrites them).
// ---------------------------------------------------------------------------------------------

function consumerPackageJson(tarballs, tsVersion) {
  const deps = {};
  const overrides = {};
  for (const name of EXPECTED_PACKAGES) {
    deps[name] = `file:vendor/${tarballs[name].filename}`;
    overrides[name] = deps[name];
  }
  return `${JSON.stringify(
    {
      name: 'bcx-packed-consumer',
      version: '0.0.0',
      private: true,
      type: 'module',
      description: 'Throwaway isolated consumer for the BrushCodex packed release gate.',
      dependencies: deps,
      devDependencies: { typescript: tsVersion },
      overrides,
    },
    null,
    2,
  )}\n`;
}

const CONSUMER_TSCONFIG = `${JSON.stringify(
  {
    compilerOptions: {
      module: 'nodenext',
      moduleResolution: 'nodenext',
      target: 'ES2022',
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      esModuleInterop: true,
    },
    files: ['types-check.ts'],
  },
  null,
  2,
)}\n`;

// Check B — imports all seven canonical document types from the PACKED @brushcodex/types and
// type-checks representative data. Compiled by the consumer's own tsc (not the source .ts).
const CONSUMER_TYPES_CHECK = `import type {
  CommonDocument,
  RecipeDocument,
  PaletteDocument,
  PaletteRole,
  InventoryDocument,
  ProjectDocument,
  TechniqueDocument,
  BundleManifest,
} from '@brushcodex/types';
import { loadFixture } from '@brushcodex/fixtures/node';

// Prove each declaration resolves from the packed artifacts by binding each type.
type Use<T> = (value: T) => unknown;
const cover: [
  Use<CommonDocument>,
  Use<RecipeDocument>,
  Use<PaletteDocument>,
  Use<PaletteRole>,
  Use<InventoryDocument>,
  Use<ProjectDocument>,
  Use<TechniqueDocument>,
  Use<BundleManifest>,
] = [(d) => d, (d) => d, (d) => d, (r) => r, (d) => d, (d) => d, (d) => d, (m) => m];
void cover;

// Representative fixture data, type-checked against the packed .d.ts (loadFixture returns unknown,
// so this cast is legal and .spec must exist on RecipeDocument).
const recipe = loadFixture('recipe/minimal.valid') as RecipeDocument;
export const recipeSpec: string = recipe.spec;
`;

// Runtime checks A + C + D — plain Node ESM against the installed packages.
// argv: [mode, sourceRepoPath]
const CONSUMER_SMOKE = `import { schemas, schemaById, SPEC_NAMES } from '@brushcodex/schema';
import {
  runConformance,
  validateAnyDocument,
  SPEC_NAMES as VALIDATOR_SPECS,
} from '@brushcodex/validator';
import { validateRecipeDocument } from '@brushcodex/validator/recipe';
import { graduateRecipeDocument, readClockTimecode } from '@brushcodex/validator/migrate';
import { createRecipe, reviseDocument } from '@brushcodex/validator/authoring';
import { fixtures, validFixtures, invalidFixtures, getFixture } from '@brushcodex/fixtures';
import { fixtures as manifestFixtures } from '@brushcodex/fixtures/manifest';
import { examplesRoot, corpusRoot, loadFixture, fixturePath } from '@brushcodex/fixtures/node';

const mode = process.argv[2] || 'full';
const sourceRepo = (process.argv[3] || '').replace(/\\\\/g, '/').toLowerCase();
const failures = [];
function check(name, cond, detail) {
  if (cond) {
    console.log('   ok   ' + name);
  } else {
    console.log('   FAIL ' + name + (detail ? ' — ' + detail : ''));
    failures.push(name);
  }
}

// A. schema (root export; no subpaths defined for this package)
check('A schema: 7 specs', SPEC_NAMES.length === 7, 'got ' + SPEC_NAMES.length);
check('A schema: canonical $id on each', Object.values(schemas).every((s) => typeof s.$id === 'string' && s.$id.startsWith('https://brushcodex.com/schemas/')));
check('A schema: schemaById indexes each', Object.values(schemas).every((s) => schemaById[s.$id] === s));

// C. validator (root + per-spec subpath)
const validRecipe = loadFixture('recipe/minimal.valid');
check('C validator: valid recipe (validateAnyDocument)', validateAnyDocument(validRecipe).result.valid === true);
check('C validator: valid recipe (subpath /recipe)', validateRecipeDocument(validRecipe).valid === true);
check('C validator: invalid recipe rejected', validateRecipeDocument({ spec: 'recipe', specVersion: '1.0.0' }).valid === false);
check('C validator: SPEC_NAMES has 7', VALIDATOR_SPECS.length === 7);

// C2. migrate (subpath /migrate) — an extension graduation recovers stranded meaning into core
// members, and the result is still a document the validator accepts.
const stranded = {
  ...validRecipe,
  extensions: {
    'org.brushcodex.recipe:sourceUrl': 'https://example.org/v',
    'org.brushcodex.recipe:stepDetails': [{ order: 0, timecode: '1:00-1:35' }],
  },
};
const graduated = graduateRecipeDocument(stranded, { readTimecode: readClockTimecode });
check('C validator: /migrate recovers the cited work', graduated.document.media?.[0]?.relation === 'source');
check('C validator: /migrate recovers a step citation', graduated.document.steps[0]?.source?.startSeconds === 60);
check('C validator: /migrate leaves no emptied extension', graduated.document.extensions === undefined);
check('C validator: /migrate output is valid', validateRecipeDocument(graduated.document).valid === true);

// C3. authoring (subpath /authoring) — a document built by the helpers is valid by
// construction, and revising it produces a new revision without changing identity.
const authored = createRecipe({ title: 'Packed authoring', steps: [{ instruction: 'Basecoat.' }] });
check('C validator: /authoring output is valid', validateRecipeDocument(authored).valid === true);
check('C validator: /authoring mints a registry-free id', authored.id.startsWith('urn:uuid:'));
const revised = reviseDocument(authored, { title: 'Packed authoring, edited' });
check('C validator: /authoring revision differs', revised.revision !== authored.revision);
check('C validator: /authoring revision keeps identity', revised.id === authored.id);
check('C validator: /authoring revision is valid', validateRecipeDocument(revised).valid === true);

// D. fixtures (root + /manifest + /node)
check('D fixtures: manifest count ' + ${FIXTURE_COUNT}, fixtures.length === ${FIXTURE_COUNT}, 'got ' + fixtures.length);
check('D fixtures: /manifest subpath matches root', manifestFixtures.length === fixtures.length);
check('D fixtures: valid + invalid partition', validFixtures.length + invalidFixtures.length === fixtures.length);
check('D fixtures: stable id getFixture', getFixture('recipe/minimal.valid').spec === 'recipe');
const conf = runConformance(examplesRoot);
check('D fixtures: conformance ' + ${FIXTURE_COUNT} + '/' + ${FIXTURE_COUNT}, conf.total === ${FIXTURE_COUNT} && conf.failed === 0, conf.passed + '/' + conf.total + ' failed ' + conf.failed);
const cr = corpusRoot.replace(/\\\\/g, '/').toLowerCase();
check('D fixtures: corpusRoot inside node_modules', cr.includes('/node_modules/'), corpusRoot);
check('D fixtures: no source-repo path in corpusRoot', !sourceRepo || !cr.startsWith(sourceRepo), corpusRoot);
check('D fixtures: fixturePath resolves inside corpus', fixturePath('recipe/minimal.valid').replace(/\\\\/g, '/').toLowerCase().startsWith(cr));

console.log('\\nsmoke[' + mode + ']: ' + (failures.length ? failures.length + ' FAILED' : 'all passed'));
process.exit(failures.length ? 1 : 0);
`;

// Writes external (non-corpus) documents the CLI validate checks consume, using the installed
// fixtures package (not the source repo). argv: [outDir]
const CONSUMER_MAKE_EXTERNAL = `import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadFixtureText } from '@brushcodex/fixtures/node';
const out = process.argv[2];
writeFileSync(join(out, 'external-valid.brushrecipe.json'), loadFixtureText('recipe/minimal.valid'));
writeFileSync(join(out, 'external-invalid.brushrecipe.json'), JSON.stringify({ spec: 'recipe', specVersion: '1.0.0' }, null, 2));
console.log('external documents written to ' + out);
`;

// ---------------------------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------------------------

function cleanOutputs() {
  stage('Clean prior build/pack outputs (gitignored only)');
  const targets = [
    ARTIFACTS_DIR,
    join(REPO_ROOT, 'packages', 'schema', 'generated'),
    join(REPO_ROOT, 'packages', 'fixtures', 'corpus'),
  ];
  for (const name of Object.keys(PACKAGE_DIRS)) targets.push(join(PACKAGE_DIRS[name], 'dist'));
  for (const t of targets) {
    if (existsSync(t)) {
      rmSync(t, { recursive: true, force: true });
      info(`removed ${t.replace(REPO_ROOT, '.')}`);
    }
  }
  // stray tsbuildinfo
  for (const name of Object.keys(PACKAGE_DIRS)) {
    for (const f of readdirSync(PACKAGE_DIRS[name])) {
      if (f.endsWith('.tsbuildinfo')) rmSync(join(PACKAGE_DIRS[name], f), { force: true });
    }
  }
  ok('outputs cleaned');
}

function buildAll() {
  stage('Build all five packages from zero (topological)');
  run(PNPM, ['-r', 'build'], { cwd: REPO_ROOT });
  ok('build complete');
}

function packAll() {
  stage('Pack all five packages (pnpm pack rewrites workspace:*)');
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const tarballs = {};
  for (const name of EXPECTED_PACKAGES) {
    const pkgDir = PACKAGE_DIRS[name];
    const r = capture(PNPM, ['pack', '--pack-destination', ARTIFACTS_DIR], { cwd: pkgDir });
    if (r.status !== 0) fail(`pnpm pack failed for ${name}: ${r.stderr || r.stdout}`);
    // Determine the tarball path from command output, not a glob.
    const line = r.stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .reverse()
      .find((l) => l.endsWith('.tgz'));
    if (!line) fail(`pnpm pack for ${name} printed no .tgz path:\n${r.stdout}`);
    const tarballPath = resolve(pkgDir, line);
    if (!existsSync(tarballPath)) fail(`pnpm pack for ${name} reported ${tarballPath} but it does not exist`);
    const entries = readTarGz(readFileSync(tarballPath));
    const manifest = JSON.parse(entries.get('package/package.json').toString('utf8'));
    if (manifest.name !== name) fail(`tarball for ${name} contains manifest name ${manifest.name}`);
    tarballs[name] = { path: tarballPath, filename: line.split(/[\\/]/).pop(), entries, manifest };
    info(`packed ${name} -> ${tarballs[name].filename} (${entries.size} entries)`);
  }
  ok(`packed ${Object.keys(tarballs).length} tarballs`);
  return tarballs;
}

function inspectPacked(tarballs) {
  stage('Inspect packed manifests + contents (Phase 3 + 7 assertions)');
  assertPackageSet(Object.keys(tarballs));
  ok('produced set is exactly the five expected packages');

  const manifests = new Map(EXPECTED_PACKAGES.map((n) => [n, tarballs[n].manifest]));
  const versionViolations = findVersionViolations(manifests);
  if (versionViolations.length) fail(`version compatibility:\n     - ${versionViolations.join('\n     - ')}`);
  ok(`versions internally compatible (all ${tarballs[EXPECTED_PACKAGES[0]].manifest.version})`);

  const forbiddenAbsolute = [REPO_ROOT, REPO_ROOT.replace(/\\/g, '/'), EXAMPLES_DIR, EXAMPLES_DIR.replace(/\\/g, '/')];
  const violations = [];
  for (const name of EXPECTED_PACKAGES) {
    violations.push(...findManifestViolations(name, tarballs[name].manifest));
    violations.push(...findContentViolations(name, tarballs[name].entries, { forbiddenAbsolute }));
  }
  if (violations.length) fail(`packed-content violations:\n     - ${violations.join('\n     - ')}`);
  ok('metadata, private flags, legal files, dependencies, source boundaries, and corpus ownership are valid');

  const corpus = countCorpusFixtures(tarballs[CORPUS_OWNER].entries);
  if (corpus < FIXTURE_COUNT) fail(`@brushcodex/fixtures ships ${corpus} corpus files (< ${FIXTURE_COUNT})`);
  ok(`@brushcodex/fixtures ships the corpus (${corpus} JSON files); cli/validator ship none`);
}

function detectTsVersion() {
  const tsPkg = join(PACKAGE_DIRS['@brushcodex/validator'], '..', '..', 'node_modules', 'typescript', 'package.json');
  try {
    return JSON.parse(readFileSync(tsPkg, 'utf8')).version;
  } catch {
    return '5.5.4';
  }
}

function createConsumer(tarballs) {
  stage('Create isolated consumer outside the repo (path with a space)');
  const base = mkdtempSync(join(tmpdir(), 'bcx-packed-'));
  const consumer = join(base, 'consumer project'); // intentional space
  const vendor = join(consumer, 'vendor');
  mkdirSync(vendor, { recursive: true });
  for (const name of EXPECTED_PACKAGES) {
    cpSync(tarballs[name].path, join(vendor, tarballs[name].filename));
  }
  const tsVersion = detectTsVersion();
  writeFileSync(join(consumer, 'package.json'), consumerPackageJson(tarballs, tsVersion));
  writeFileSync(join(consumer, 'tsconfig.json'), CONSUMER_TSCONFIG);
  writeFileSync(join(consumer, 'types-check.ts'), CONSUMER_TYPES_CHECK);
  writeFileSync(join(consumer, 'smoke.mjs'), CONSUMER_SMOKE);
  writeFileSync(join(consumer, 'make-external.mjs'), CONSUMER_MAKE_EXTERNAL);
  info(`consumer: ${consumer}`);
  ok('consumer scaffolded from tarballs only');
  return { base, consumer };
}

function installConsumer(consumer) {
  stage('Install from tarballs only (npm; workspace-blind; scrubbed env)');
  run(NPM, ['install', '--no-audit', '--no-fund'], { cwd: consumer, env: cleanEnv() });
  // Guard: exactly the five @brushcodex packages, nothing injected.
  const scope = join(consumer, 'node_modules', '@brushcodex');
  const installed = existsSync(scope) ? readdirSync(scope).map((n) => `@brushcodex/${n}`).sort() : [];
  assertPackageSet(installed);
  ok(`installed exactly: ${installed.join(', ')}`);
}

function foreignCwd() {
  // A working directory unrelated to both the repo and the consumer.
  return mkdtempSync(join(tmpdir(), 'bcx-cwd-'));
}

function runSmoke(consumer, mode, cwd) {
  const r = runNode(join(consumer, 'smoke.mjs'), [mode, REPO_ROOT], cwd);
  process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) fail(`runtime smoke[${mode}] failed (exit ${r.status})`);
}

function runTypeCheck(consumer) {
  stage('Check B: type-check against packed @brushcodex/types (consumer tsc)');
  const tsc = join(consumer, 'node_modules', 'typescript', 'bin', 'tsc');
  const r = runNode(tsc, ['--noEmit', '--project', 'tsconfig.json'], consumer);
  if (r.stdout.trim()) info(r.stdout.trim());
  if (r.status !== 0) {
    if (r.stderr) process.stderr.write(r.stderr);
    fail(`tsc type-check failed (exit ${r.status})`);
  }
  ok('all seven document types resolve from packed .d.ts; representative data type-checks');
}

function cliChecks(consumer, base, label, cwd) {
  const cliDist = join(consumer, 'node_modules', '@brushcodex', 'cli', 'dist');
  const conf = join(cliDist, 'conformance.js');
  const val = join(cliDist, 'validate.js');
  const validFile = join(base, 'external-valid.brushrecipe.json');
  const invalidFile = join(base, 'external-invalid.brushrecipe.json');

  // Direct package binary (raw dist under plain Node), from a foreign cwd.
  const c1 = runNode(conf, [], cwd);
  if (c1.status !== 0 || !c1.stdout.includes(`${FIXTURE_COUNT}/${FIXTURE_COUNT}`)) {
    process.stderr.write(c1.stdout + c1.stderr);
    fail(`[${label}] conformance did not report ${FIXTURE_COUNT}/${FIXTURE_COUNT} (exit ${c1.status})`);
  }
  ok(`[${label}] conformance ${FIXTURE_COUNT}/${FIXTURE_COUNT} (raw dist, foreign cwd)`);

  const c2 = runNode(conf, ['--json'], cwd);
  let report;
  try {
    report = JSON.parse(c2.stdout);
  } catch {
    fail(`[${label}] conformance --json did not emit JSON`);
  }
  if (c2.status !== 0 || report.total !== FIXTURE_COUNT || report.failed !== 0) {
    fail(`[${label}] conformance --json: total=${report.total} failed=${report.failed} exit=${c2.status}`);
  }
  ok(`[${label}] conformance --json total=${report.total} failed=${report.failed}`);

  const v1 = runNode(val, [validFile], cwd);
  if (v1.status !== 0) fail(`[${label}] validate <valid> exited ${v1.status} (expected 0)`);
  const v2 = runNode(val, [invalidFile], cwd);
  if (v2.status !== 1) fail(`[${label}] validate <invalid> exited ${v2.status} (expected 1)`);
  ok(`[${label}] validate: valid=exit0, invalid=exit1`);

  // Help / usage banner (documented usage-error exit code 2).
  const h = runNode(val, ['--help'], cwd);
  if (h.status !== 2 || !/Usage:/.test(h.stdout + h.stderr)) {
    fail(`[${label}] validate --help did not show the usage banner (exit ${h.status})`);
  }
  ok(`[${label}] validate --help shows usage banner (exit 2)`);

  // Installed .bin shim (platform-aware).
  const s = runBinShim(consumer, 'brushcodex-conformance', ['--json'], cwd);
  let sReport;
  try {
    sReport = JSON.parse(s.stdout);
  } catch {
    process.stderr.write(s.stdout + s.stderr);
    fail(`[${label}] .bin shim conformance --json did not emit JSON (exit ${s.status})`);
  }
  if (s.status !== 0 || sReport.total !== FIXTURE_COUNT || sReport.failed !== 0) {
    fail(`[${label}] .bin shim conformance: total=${sReport.total} failed=${sReport.failed} exit=${s.status}`);
  }
  ok(`[${label}] .bin shim conformance ${FIXTURE_COUNT}/${FIXTURE_COUNT}`);
}

function packageManagerShim(consumer) {
  stage('Check E: package-manager shim (npm exec)');
  // npm exec must run from the consumer so it resolves the locally-installed bin (no registry/install).
  const r = capture(NPM, ['exec', '--no', '--', 'brushcodex-conformance', '--json'], { cwd: consumer, env: cleanEnv() });
  let report;
  try {
    report = JSON.parse(r.stdout);
  } catch {
    process.stderr.write(r.stdout + r.stderr);
    fail(`npm exec brushcodex-conformance did not emit JSON (exit ${r.status})`);
  }
  if (r.status !== 0 || report.total !== FIXTURE_COUNT || report.failed !== 0) {
    fail(`npm exec conformance: total=${report.total} failed=${report.failed} exit=${r.status}`);
  }
  ok(`npm exec brushcodex-conformance ${FIXTURE_COUNT}/${FIXTURE_COUNT}`);
}

/** Rename source paths away, run fn, then restore every rename no matter what (incl. signals). */
function withSourceAbsent(fn) {
  const plan = [EXAMPLES_DIR, ARTIFACTS_DIR];
  for (const name of Object.keys(PACKAGE_DIRS)) plan.push(join(PACKAGE_DIRS[name], 'dist'));
  try {
    let hiddenCount = 0;
    for (const src of plan) {
      if (existsSync(src)) {
        const hidden = `${src}.gate-hidden`;
        if (existsSync(hidden)) rmSync(hidden, { recursive: true, force: true });
        renameSync(src, hidden);
        pendingRestores.push([src, hidden]); // module-level; restored by finally or signal handler
        hiddenCount += 1;
      }
    }
    info(`hid ${hiddenCount} source paths (examples/, packages/*/dist, artifacts/)`);
    fn();
  } finally {
    restoreRenames();
    info('restored all hidden source paths');
  }
}

function cleanup(base) {
  stage('Cleanup');
  if (KEEP) {
    info(`--keep set: retained consumer base ${base} and tarballs in ${ARTIFACTS_DIR}`);
    return;
  }
  rmSync(base, { recursive: true, force: true });
  if (existsSync(ARTIFACTS_DIR)) rmSync(ARTIFACTS_DIR, { recursive: true, force: true });
  ok('removed consumer + tarballs; tree clean');
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------

function main() {
  console.log('BrushCodex packed release gate — pnpm verify:packed');
  console.log(`repo: ${REPO_ROOT}`);

  cleanOutputs();
  buildAll();
  const tarballs = packAll();
  inspectPacked(tarballs);

  const { base, consumer } = createConsumer(tarballs);
  let succeeded = false;
  try {
    installConsumer(consumer);

    // Generate external (non-corpus) documents from the INSTALLED package.
    run(process.execPath, [join(consumer, 'make-external.mjs'), base], { cwd: consumer });

    stage('Checks A/C/D: schema + validator + fixtures (plain Node ESM, foreign cwd)');
    runSmoke(consumer, 'full', foreignCwd());
    ok('schema, validator, and fixtures pass from the installed packages');

    runTypeCheck(consumer);

    stage('Check E: CLI bins (raw dist + installed .bin shim, foreign cwd)');
    cliChecks(consumer, base, 'installed', foreignCwd());

    packageManagerShim(consumer);

    stage('Source-checkout absence proof (examples/, packages/*/dist, artifacts/ hidden)');
    withSourceAbsent(() => {
      runSmoke(consumer, 'source-absent', foreignCwd());
      cliChecks(consumer, base, 'source-absent', foreignCwd());
    });
    ok('installed packages remain fully functional with the source checkout hidden');

    succeeded = true;
  } finally {
    if (succeeded) {
      cleanup(base);
    } else {
      console.error(`\n✗ gate FAILED — preserving consumer for diagnosis:\n    ${base}\n    tarballs: ${ARTIFACTS_DIR}`);
    }
  }

  console.log('\n✓ PACKED RELEASE GATE PASSED — all five packages verified from packed artifacts.');
}

try {
  main();
} catch (err) {
  if (err instanceof GateError) {
    console.error(`\n✗ GATE FAILURE: ${err.message}`);
  } else {
    console.error('\n✗ UNEXPECTED ERROR:', err);
  }
  process.exit(1);
}

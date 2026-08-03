/**
 * Regression tests for the packed release gate's helper logic (scripts/lib/**).
 *
 * Run with `node --test scripts/` (wired as `pnpm test:gate`). No test-runner dependency: uses the
 * built-in node:test. These prove the gate DETECTS each package-boundary defect class the brief
 * requires — a missing packed dependency, a repo-relative import in packed output, a missing
 * fixture corpus, a broken CLI executable (no `bin`), and a manifest/version mismatch — by driving
 * the pure assertion functions with synthesized in-memory tarballs. No broken package state is ever
 * committed; the full `pnpm verify:packed` is the top-level integration test.
 */

import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { test } from 'node:test';

import { readTarGz, listTarGz } from './lib/targz.mjs';
import {
  GateError,
  assertPackageSet,
  diffPackageSet,
  countCorpusFixtures,
  findContentViolations,
  findManifestViolations,
  findSourceEscapes,
  findVersionViolations,
} from './lib/assertions.mjs';

// ---------------------------------------------------------------------------------------------
// A tiny, correct ustar tar.gz builder so tests exercise the real reader + assertions together.
// ---------------------------------------------------------------------------------------------

function tarHeader(name, size) {
  const h = Buffer.alloc(512);
  h.write(name.slice(0, 100), 0, 'utf8');
  h.write('0000644\0', 100, 'ascii'); // mode
  h.write('0000000\0', 108, 'ascii'); // uid
  h.write('0000000\0', 116, 'ascii'); // gid
  h.write(`${size.toString(8).padStart(11, '0')}\0`, 124, 'ascii'); // size (octal)
  h.write('00000000000\0', 136, 'ascii'); // mtime
  h.fill(' ', 148, 156); // checksum field starts as spaces
  h.write('0', 156, 'ascii'); // typeflag: regular file
  h.write('ustar\0', 257, 'ascii'); // magic
  h.write('00', 263, 'ascii'); // version
  let sum = 0;
  for (let i = 0; i < 512; i += 1) sum += h[i];
  h.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 'ascii');
  return h;
}

/** files: { 'dist/index.js': 'content', ... } (paths are placed under package/). */
function buildTarGz(files) {
  const blocks = [];
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content, 'utf8');
    blocks.push(tarHeader(`package/${name}`, data.length));
    const padded = Buffer.alloc(Math.ceil(data.length / 512) * 512);
    data.copy(padded);
    blocks.push(padded);
  }
  blocks.push(Buffer.alloc(1024)); // two zero blocks terminate the archive
  return gzipSync(Buffer.concat(blocks));
}

/** Build a plausible packed tarball for one package: manifest + files, returned as an entry map. */
function pkgTarball(name, { version = '0.1.0-draft', dependencies = {}, files = ['dist', 'LICENSE', 'NOTICE'], bin, extra = {} } = {}) {
  const manifest = {
    name,
    version,
    private: true,
    license: 'Apache-2.0',
    repository: {
      type: 'git',
      url: 'https://github.com/Brushcodex/standard.git',
      directory: name.replace('@brushcodex/', 'packages/'),
    },
    homepage: 'https://brushcodex.com/standard',
    bugs: 'https://github.com/Brushcodex/standard/issues',
    engines: { node: '>=20.11.0' },
    dependencies,
    files,
  };
  if (bin) manifest.bin = bin;
  const license = name === '@brushcodex/fixtures'
    ? 'Grant of Patent License\nEND OF TERMS AND CONDITIONS\nCC0 1.0 Universal\nPublic License Fallback\nLimitations and Disclaimers\n'
    : 'Grant of Patent License\nEND OF TERMS AND CONDITIONS\n';
  return readTarGz(
    buildTarGz({
      'package.json': JSON.stringify(manifest),
      LICENSE: license,
      NOTICE: `BrushCodex ${name}\nCopyright (c) 2026 The BrushCodex authors.\n`,
      'dist/index.js': 'export const x = 1;\n',
      ...extra,
    }),
  );
}

function manifestOf(entries) {
  return JSON.parse(entries.get('package/package.json').toString('utf8'));
}

// ---------------------------------------------------------------------------------------------
// tar reader
// ---------------------------------------------------------------------------------------------

test('targz: round-trips regular files and reads the manifest', () => {
  const tgz = buildTarGz({ 'package.json': '{"name":"x"}', 'dist/a.js': 'A', 'dist/b.js': 'BB' });
  const entries = readTarGz(tgz);
  assert.deepEqual(listTarGz(tgz), ['package/dist/a.js', 'package/dist/b.js', 'package/package.json']);
  assert.equal(entries.get('package/dist/b.js').toString('utf8'), 'BB');
  assert.equal(JSON.parse(entries.get('package/package.json').toString('utf8')).name, 'x');
});

// ---------------------------------------------------------------------------------------------
// package set (missing / unexpected packages, incl. build-order/omission mistakes)
// ---------------------------------------------------------------------------------------------

test('package set: exact five passes; missing and unexpected are both caught', () => {
  const five = ['@brushcodex/schema', '@brushcodex/types', '@brushcodex/validator', '@brushcodex/fixtures', '@brushcodex/cli'];
  assert.doesNotThrow(() => assertPackageSet(five));

  const missing = five.filter((n) => n !== '@brushcodex/cli');
  assert.throws(() => assertPackageSet(missing), GateError);
  assert.deepEqual(diffPackageSet(missing).missing, ['@brushcodex/cli']);

  const withExtra = [...five, '@brushcodex/secret'];
  assert.deepEqual(diffPackageSet(withExtra).unexpected, ['@brushcodex/secret']);
  assert.throws(() => assertPackageSet(withExtra), GateError);
});

// ---------------------------------------------------------------------------------------------
// version compatibility (manifest count / internal-version mismatch)
// ---------------------------------------------------------------------------------------------

test('versions: uniform + correctly-pinned passes; drift and bad pins are caught', () => {
  const good = new Map([
    ['@brushcodex/validator', { version: '0.1.0-draft', dependencies: {} }],
    ['@brushcodex/cli', { version: '0.1.0-draft', dependencies: { '@brushcodex/fixtures': '0.1.0-draft' } }],
    ['@brushcodex/fixtures', { version: '0.1.0-draft', dependencies: {} }],
  ]);
  assert.deepEqual(findVersionViolations(good), []);

  const drift = new Map([
    ['@brushcodex/validator', { version: '0.1.0-draft', dependencies: {} }],
    ['@brushcodex/cli', { version: '0.2.0', dependencies: { '@brushcodex/fixtures': '0.1.0-draft' } }],
  ]);
  assert.ok(findVersionViolations(drift).some((v) => /not uniform/.test(v)));

  const badPin = new Map([
    ['@brushcodex/cli', { version: '0.1.0-draft', dependencies: { '@brushcodex/fixtures': '^0.1.0' } }],
  ]);
  assert.ok(findVersionViolations(badPin).some((v) => /pins @brushcodex\/fixtures/.test(v)));
});

// ---------------------------------------------------------------------------------------------
// manifest violations (missing dependency, workspace leak, no files, broken CLI executable)
// ---------------------------------------------------------------------------------------------

test('manifest: a healthy CLI manifest passes', () => {
  const cli = manifestOf(
    pkgTarball('@brushcodex/cli', {
      dependencies: { '@brushcodex/fixtures': '0.1.0-draft', ajv: '^8', 'ajv-formats': '^3', fflate: '^0.8', zod: '3.23.8' },
      bin: { 'brushcodex-validate': './dist/validate.js' },
    }),
  );
  assert.deepEqual(findManifestViolations('@brushcodex/cli', cli), []);
});

test('manifest: DETECTS unsafe publication and incomplete public metadata', () => {
  const manifest = manifestOf(pkgTarball('@brushcodex/schema'));
  manifest.private = false;
  manifest.repository.url = 'https://example.invalid/wrong.git';
  manifest.homepage = 'https://example.invalid';
  manifest.bugs = 'https://example.invalid/issues';
  manifest.engines.node = '>=18';
  manifest.files = ['dist'];
  const v = findManifestViolations('@brushcodex/schema', manifest);
  assert.ok(v.some((m) => /retain "private": true/.test(m)), v.join('; '));
  assert.ok(v.some((m) => /repository must identify/.test(m)), v.join('; '));
  assert.ok(v.some((m) => /homepage must be/.test(m)), v.join('; '));
  assert.ok(v.some((m) => /bugs must point/.test(m)), v.join('; '));
  assert.ok(v.some((m) => /engines\.node/.test(m)), v.join('; '));
  assert.ok(v.some((m) => /allowlist LICENSE/.test(m)), v.join('; '));
  assert.ok(v.some((m) => /allowlist NOTICE/.test(m)), v.join('; '));
});

test('manifest: DETECTS a missing packed dependency', () => {
  const cli = { name: '@brushcodex/cli', version: '0.1.0-draft', files: ['dist'], bin: { x: './x.js' }, dependencies: { ajv: '^8', 'ajv-formats': '^3', fflate: '^0.8', zod: '3.23.8' } };
  const v = findManifestViolations('@brushcodex/cli', cli);
  assert.ok(v.some((m) => /missing required runtime dependency @brushcodex\/fixtures/.test(m)), v.join('; '));
});

test('manifest: DETECTS a leaked workspace: protocol', () => {
  const types = { name: '@brushcodex/types', version: '0.1.0-draft', files: ['dist'], dependencies: { '@brushcodex/validator': 'workspace:*' } };
  const v = findManifestViolations('@brushcodex/types', types);
  assert.ok(v.some((m) => /leaks a workspace protocol/.test(m)), v.join('; '));
});

test('manifest: DETECTS a broken CLI (no bin) and a package with no files', () => {
  const noBin = { name: '@brushcodex/cli', version: '0.1.0-draft', files: ['dist'], dependencies: { '@brushcodex/fixtures': '0.1.0-draft', ajv: '^8', 'ajv-formats': '^3', fflate: '^0.8', zod: '3.23.8' } };
  assert.ok(findManifestViolations('@brushcodex/cli', noBin).some((m) => /declares no "bin"/.test(m)));

  const noFiles = { name: '@brushcodex/schema', version: '0.1.0-draft', dependencies: {} };
  assert.ok(findManifestViolations('@brushcodex/schema', noFiles).some((m) => /declares no "files"/.test(m)));
});

// ---------------------------------------------------------------------------------------------
// content violations (repo-relative import, cross-package src, corpus rules, forbidden files)
// ---------------------------------------------------------------------------------------------

test('content: source-escape detector flags the classic defects', () => {
  assert.deepEqual(findSourceEscapes('const x = 1;\n'), []);
  assert.ok(findSourceEscapes("new URL('../../../examples', import.meta.url)").includes('repo-relative ../../examples escape'));
  assert.ok(findSourceEscapes("import y from '@brushcodex/schema/src/index.ts'").includes("imports another package's src/"));
  assert.ok(findSourceEscapes('"@brushcodex/fixtures": "workspace:*"').includes('leaked workspace: protocol'));
});

test('content: DETECTS a repo-relative import in packed output', () => {
  const entries = pkgTarball('@brushcodex/cli', {
    bin: { x: './x.js' },
    dependencies: { '@brushcodex/fixtures': '0.1.0-draft', ajv: '^8', 'ajv-formats': '^3', fflate: '^0.8', zod: '3.23.8' },
    extra: { 'dist/conformance.js': "const r = new URL('../../../examples', import.meta.url);\n" },
  });
  const v = findContentViolations('@brushcodex/cli', entries);
  assert.ok(v.some((m) => /repo-relative/.test(m)), v.join('; '));
});

test('content: DETECTS the corpus duplicated into the CLI, and a missing corpus in fixtures', () => {
  const cliWithCorpus = pkgTarball('@brushcodex/cli', {
    bin: { x: './x.js' },
    dependencies: { '@brushcodex/fixtures': '0.1.0-draft', ajv: '^8', 'ajv-formats': '^3', fflate: '^0.8', zod: '3.23.8' },
    extra: { 'corpus/examples/recipe/v1/minimal.valid.json': '{}' },
  });
  assert.ok(findContentViolations('@brushcodex/cli', cliWithCorpus).some((m) => /duplicates the fixture corpus/.test(m)));

  const fixturesNoCorpus = pkgTarball('@brushcodex/fixtures', { files: ['dist', 'corpus'] });
  assert.ok(findContentViolations('@brushcodex/fixtures', fixturesNoCorpus).some((m) => /ships no fixture corpus/.test(m)));
});

test('content: DETECTS an absolute source path and forbidden files', () => {
  const abs = 'X:/example/source/standard';
  const entries = pkgTarball('@brushcodex/validator', {
    dependencies: { ajv: '^8', 'ajv-formats': '^3', fflate: '^0.8', zod: '3.23.8' },
    extra: { 'dist/leak.js': `// built from ${abs}/schemas\n`, '.env': 'SECRET=1\n' },
  });
  const v = findContentViolations('@brushcodex/validator', entries, { forbiddenAbsolute: [abs] });
  assert.ok(v.some((m) => /absolute source path/.test(m)), v.join('; '));
  assert.ok(v.some((m) => /ships a \.env file/.test(m)), v.join('; '));
});

test('content: DETECTS missing or incomplete package legal files', () => {
  const missing = pkgTarball('@brushcodex/schema', { extra: { LICENSE: '', NOTICE: '' } });
  const missingViolations = findContentViolations('@brushcodex/schema', missing);
  assert.ok(missingViolations.some((m) => /complete Apache-2\.0 terms/.test(m)), missingViolations.join('; '));
  assert.ok(missingViolations.some((m) => /NOTICE is missing or incomplete/.test(m)), missingViolations.join('; '));

  const fixturesWithoutCc0 = pkgTarball('@brushcodex/fixtures', {
    extra: {
      LICENSE: 'Grant of Patent License\nEND OF TERMS AND CONDITIONS\n',
      'corpus/examples/recipe/v1/minimal.valid.json': '{}',
    },
  });
  const cc0Violations = findContentViolations('@brushcodex/fixtures', fixturesWithoutCc0);
  assert.ok(cc0Violations.some((m) => /complete CC0-1\.0 terms/.test(m)), cc0Violations.join('; '));
});

test('content: DETECTS a manifest count mismatch via the corpus counter', () => {
  const fixtures = pkgTarball('@brushcodex/fixtures', {
    files: ['dist', 'corpus'],
    extra: {
      'corpus/examples/recipe/v1/minimal.valid.json': '{}',
      'corpus/examples/palette/v1/minimal.valid.json': '{}',
    },
  });
  assert.equal(countCorpusFixtures(fixtures), 2); // a real gate demands >= 76 — this stand-in is short
  assert.ok(countCorpusFixtures(fixtures) < 76);
});

test('content: a clean fixtures tarball with a corpus passes', () => {
  const fixtures = pkgTarball('@brushcodex/fixtures', {
    files: ['dist', 'corpus'],
    extra: { 'corpus/examples/recipe/v1/minimal.valid.json': '{"spec":"recipe"}' },
  });
  assert.deepEqual(findContentViolations('@brushcodex/fixtures', fixtures), []);
});

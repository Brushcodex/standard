/**
 * Pure assertion helpers for the packed release gate.
 *
 * Everything here is a pure function over already-read data (manifests, entry maps, name lists),
 * with no filesystem or process access, so the regression suite (scripts/verify-packed.test.mjs)
 * can drive each failure class with controlled in-memory inputs. The orchestrator
 * (scripts/verify-packed.mjs) reads the tarballs and calls these; a non-empty violation list, or a
 * thrown GateError, fails the gate.
 */

/** The five public packages the standard ships. The gate proves exactly these — no more, no less. */
export const EXPECTED_PACKAGES = Object.freeze([
  '@brushcodex/schema',
  '@brushcodex/types',
  '@brushcodex/validator',
  '@brushcodex/fixtures',
  '@brushcodex/cli',
]);

/** Runtime dependencies each packed manifest must declare (npm libs + rewritten inter-package edges). */
export const REQUIRED_RUNTIME_DEPS = Object.freeze({
  '@brushcodex/schema': [],
  '@brushcodex/types': ['@brushcodex/validator'],
  '@brushcodex/validator': ['ajv', 'ajv-formats', 'fflate', 'zod'],
  '@brushcodex/fixtures': [],
  '@brushcodex/cli': ['@brushcodex/fixtures', 'ajv', 'ajv-formats', 'fflate', 'zod'],
});

/** Packages whose tarball must ship the fixture corpus, and those that must NOT (no duplication). */
export const CORPUS_OWNER = '@brushcodex/fixtures';
export const CORPUS_FORBIDDEN = Object.freeze(['@brushcodex/cli', '@brushcodex/validator']);

export class GateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GateError';
  }
}

/**
 * Compare the produced tarball package-name set against EXPECTED_PACKAGES.
 * @returns {{ missing: string[], unexpected: string[] }}
 */
export function diffPackageSet(actualNames, expected = EXPECTED_PACKAGES) {
  const actual = new Set(actualNames);
  const want = new Set(expected);
  return {
    missing: [...want].filter((n) => !actual.has(n)).sort(),
    unexpected: [...actual].filter((n) => !want.has(n)).sort(),
  };
}

/** Throw unless the produced set is exactly EXPECTED_PACKAGES. */
export function assertPackageSet(actualNames, expected = EXPECTED_PACKAGES) {
  const { missing, unexpected } = diffPackageSet(actualNames, expected);
  if (missing.length || unexpected.length) {
    const parts = [];
    if (missing.length) parts.push(`missing: ${missing.join(', ')}`);
    if (unexpected.length) parts.push(`unexpected: ${unexpected.join(', ')}`);
    throw new GateError(`packed package set mismatch — ${parts.join('; ')}`);
  }
}

/**
 * All @brushcodex/* packages must share one version, and every inter-package dependency must pin
 * that exact version (proving `workspace:*` was rewritten and versions are internally compatible).
 * @param {Map<string,object>|Array<[string,object]>} manifests package name -> parsed manifest
 * @returns {string[]} violations
 */
export function findVersionViolations(manifests) {
  const map = manifests instanceof Map ? manifests : new Map(manifests);
  const violations = [];
  const versions = new Set();
  for (const [name, m] of map) versions.add(m.version);
  if (versions.size > 1) {
    violations.push(`@brushcodex/* versions are not uniform: ${[...versions].sort().join(', ')}`);
  }
  const version = map.size ? [...map.values()][0].version : undefined;
  for (const [name, m] of map) {
    const deps = { ...(m.dependencies || {}) };
    for (const [dep, range] of Object.entries(deps)) {
      if (!dep.startsWith('@brushcodex/')) continue;
      if (range !== version) {
        violations.push(`${name} pins ${dep}@"${range}" but the package version is "${version}"`);
      }
    }
  }
  return violations;
}

/**
 * Manifest-level checks: no leaked workspace protocol, required runtime deps present, `files`
 * present, and — for the CLI — `bin` present.
 * @returns {string[]} violations
 */
export function findManifestViolations(name, manifest, required = REQUIRED_RUNTIME_DEPS) {
  const violations = [];
  const deps = { ...(manifest.dependencies || {}), ...(manifest.optionalDependencies || {}) };
  const packageDirectory = name.replace('@brushcodex/', 'packages/');

  if (manifest.private !== true) violations.push(`${name}: must retain "private": true`);
  if (manifest.license !== 'Apache-2.0') violations.push(`${name}: license must be Apache-2.0`);
  if (manifest.repository?.type !== 'git' || manifest.repository?.url !== 'https://github.com/Brushcodex/standard.git') {
    violations.push(`${name}: repository must identify https://github.com/Brushcodex/standard.git as git`);
  }
  if (manifest.repository?.directory !== packageDirectory) {
    violations.push(`${name}: repository.directory must be ${packageDirectory}`);
  }
  if (manifest.homepage !== 'https://brushcodex.com/standard') {
    violations.push(`${name}: homepage must be https://brushcodex.com/standard`);
  }
  const bugsUrl = typeof manifest.bugs === 'string' ? manifest.bugs : manifest.bugs?.url;
  if (bugsUrl !== 'https://github.com/Brushcodex/standard/issues') {
    violations.push(`${name}: bugs must point to https://github.com/Brushcodex/standard/issues`);
  }
  if (manifest.engines?.node !== '>=20.11.0') {
    violations.push(`${name}: engines.node must be >=20.11.0`);
  }

  for (const [dep, range] of Object.entries(deps)) {
    if (typeof range === 'string' && range.includes('workspace:')) {
      violations.push(`${name}: dependency ${dep} leaks a workspace protocol ("${range}")`);
    }
  }

  for (const dep of required[name] || []) {
    if (!(dep in deps)) violations.push(`${name}: missing required runtime dependency ${dep}`);
  }

  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    violations.push(`${name}: packed manifest declares no "files"`);
  } else {
    for (const legalFile of ['LICENSE', 'NOTICE']) {
      if (!manifest.files.includes(legalFile)) {
        violations.push(`${name}: packed manifest does not allowlist ${legalFile}`);
      }
    }
  }

  if (name === '@brushcodex/cli') {
    const bin = manifest.bin;
    const hasBin = bin && typeof bin === 'object' && Object.keys(bin).length > 0;
    if (!hasBin) violations.push(`${name}: packed manifest declares no "bin"`);
  }

  return violations;
}

const FORBIDDEN_FILE = [
  { re: /(^|\/)\.env(\.|$)/, why: 'ships a .env file' },
  { re: /(^|\/)node_modules\//, why: 'ships a nested node_modules' },
  { re: /_(PLAN|RESULT|REPORT)\.md$/i, why: 'ships a development report' },
  { re: /(^|\/)\.git(\/|$)/, why: 'ships git metadata' },
  { re: /\.(test|spec)\.[cm]?[jt]s$/, why: 'ships a test file' },
];

/**
 * Whether a JS/TS source line reaches outside the package: a repo-root `examples/` escape, an
 * import from another package's `src/`, or a leaked workspace protocol string.
 */
export function findSourceEscapes(text) {
  const escapes = [];
  if (/\.\.[\\/]\.\.[\\/](\.\.[\\/])?examples/.test(text)) {
    escapes.push('repo-relative ../../examples escape');
  }
  if (/@brushcodex\/[a-z-]+\/src\//.test(text)) {
    escapes.push("imports another package's src/");
  }
  if (/"workspace:|'workspace:/.test(text)) {
    escapes.push('leaked workspace: protocol');
  }
  return escapes;
}

/**
 * Content-level checks over a tarball's entry map.
 * @param {string} name package name
 * @param {Map<string,Buffer>} entries entryPath -> Buffer
 * @param {object} opts
 * @param {string[]} [opts.forbiddenAbsolute] absolute source paths that must never appear in text
 * @returns {string[]} violations
 */
export function findContentViolations(name, entries, opts = {}) {
  const violations = [];
  const forbiddenAbsolute = opts.forbiddenAbsolute || [];
  const paths = [...entries.keys()];

  const license = entries.get('package/LICENSE')?.toString('utf8') || '';
  const notice = entries.get('package/NOTICE')?.toString('utf8') || '';
  const hasCompleteApache = license.includes('Grant of Patent License')
    && license.includes('END OF TERMS AND CONDITIONS');
  if (!hasCompleteApache) violations.push(`${name}: package/LICENSE lacks the complete Apache-2.0 terms`);
  if (!notice.includes('Copyright') || !notice.includes(name)) {
    violations.push(`${name}: package/NOTICE is missing or incomplete`);
  }
  if (name === CORPUS_OWNER) {
    const hasCompleteCc0 = license.includes('CC0 1.0 Universal')
      && license.includes('Public License Fallback')
      && license.includes('Limitations and Disclaimers');
    if (!hasCompleteCc0) violations.push(`${name}: package/LICENSE lacks the complete CC0-1.0 terms for its corpus`);
  }

  for (const p of paths) {
    if (!p.startsWith('package/')) {
      violations.push(`${name}: entry escapes the package root: ${p}`);
    }
    for (const { re, why } of FORBIDDEN_FILE) {
      if (re.test(p)) violations.push(`${name}: ${why}: ${p}`);
    }
  }

  const corpusEntries = paths.filter((p) => /(^|\/)(corpus|examples)\/.*\.json$/.test(p));
  if (CORPUS_FORBIDDEN.includes(name) && corpusEntries.length > 0) {
    violations.push(`${name}: duplicates the fixture corpus (${corpusEntries.length} files) — only ${CORPUS_OWNER} may ship it`);
  }
  if (name === CORPUS_OWNER && corpusEntries.length === 0) {
    violations.push(`${name}: ships no fixture corpus — the corpus package must include corpus/examples/**`);
  }

  for (const [p, buf] of entries) {
    if (!/\.(m?js|d\.ts|json|ts)$/.test(p)) continue;
    const text = buf.toString('utf8');
    for (const escape of findSourceEscapes(text)) {
      violations.push(`${name}: ${p} — ${escape}`);
    }
    for (const abs of forbiddenAbsolute) {
      if (abs && text.includes(abs)) {
        violations.push(`${name}: ${p} references an absolute source path (${abs})`);
      }
    }
  }

  return violations;
}

/** Count corpus JSON files shipped inside a tarball entry map. */
export function countCorpusFixtures(entries) {
  return [...entries.keys()].filter((p) => /(^|\/)corpus\/examples\/.*\.json$/.test(p)).length;
}

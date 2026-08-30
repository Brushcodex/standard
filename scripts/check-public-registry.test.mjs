/**
 * Regression tests for the public paint-identity registry gate
 * (scripts/lib/public-registry.mjs) and for the artifact this repository
 * actually publishes.
 *
 * Run with `pnpm test:gate` (Node's built-in node:test; no test-runner
 * dependency). The gate guards a file that anyone can fetch, in a repository
 * whose `main` forbids force-pushes — so what reaches it cannot be taken back,
 * and every case below is written against a way that could go wrong quietly:
 * an unknown field carrying colour or provenance, an identifier that resolves
 * to two paints, a redirect onto a live id, a version bump nobody noticed.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ASSIGNED_ID_PATTERN,
  CANONICAL_ASSIGNED_ID_PATTERN,
  PUBLIC_FORMAT_VERSION,
  checkPublicRegistry,
  resolve,
} from './lib/public-registry.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const published = JSON.parse(
  readFileSync(join(repoRoot, 'registry', 'paint-identity.v1.json'), 'utf8'),
);

/** A well-formed two-paint registry, used as the base every case deviates from. */
function fixture() {
  return {
    publicFormatVersion: PUBLIC_FORMAT_VERSION,
    generator: 'brushcodex-public-identity@1.0.0',
    identifierNamespace: 'brushcodex:paint:',
    coverage: { published: 2 },
    paints: [
      {
        id: 'brushcodex:paint:0000001'.replace(':0', ':p0'),
        manufacturer: 'Example Paints',
        ranges: ['Base'],
        name: 'Example Red',
        codes: ['EX-01'],
        aliasIds: ['brushcodex:paint:example-paints/base/example-red', 'brushcodex:paint:p00001'],
        supersededIds: ['brushcodex:paint:p0000009', 'brushcodex:paint:p00009'],
      },
      {
        id: 'brushcodex:paint:p0000002',
        manufacturer: 'Example Paints',
        ranges: ['Base'],
        name: 'Example Blue',
        status: 'discontinued',
        aliasIds: ['brushcodex:paint:p00002'],
      },
    ],
  };
}

test('the published artifact passes the gate', () => {
  assert.deepEqual(checkPublicRegistry(published), []);
});

test('the published artifact declares the version this gate enforces', () => {
  // A generator that moved to a new major without this repository agreeing
  // would otherwise publish a contract nothing here checks.
  assert.equal(published.publicFormatVersion, PUBLIC_FORMAT_VERSION);
});

test('the published artifact publishes only canonical assigned ids', () => {
  for (const paint of published.paints) {
    assert.match(paint.id, CANONICAL_ASSIGNED_ID_PATTERN);
  }
});

test('a well-formed registry passes, and resolution answers every published form', () => {
  const document = fixture();
  assert.deepEqual(checkPublicRegistry(document), []);

  const [red] = document.paints;
  // The four things a consumer may hold: the canonical id, the pre-widening
  // five-digit id, a historical slug, and an id merged away into this one.
  assert.equal(resolve(document, 'brushcodex:paint:p0000001')?.name, 'Example Red');
  assert.equal(resolve(document, 'brushcodex:paint:p00001')?.name, 'Example Red');
  assert.equal(
    resolve(document, 'brushcodex:paint:example-paints/base/example-red')?.id,
    red.id,
  );
  assert.equal(resolve(document, 'brushcodex:paint:p0000009')?.id, red.id);
  assert.equal(resolve(document, 'brushcodex:paint:p00009')?.id, red.id);

  // An identifier the registry does not carry is simply unresolved — never a
  // guess, and never an error (Common §5.7).
  assert.equal(resolve(document, 'brushcodex:paint:p0000999'), undefined);
  assert.equal(resolve(document, 'vendor:paint:whatever'), undefined);
  assert.equal(resolve(document, ''), undefined);
  // And resolution does not do padding arithmetic: `p1` was never issued.
  assert.equal(resolve(document, 'brushcodex:paint:p1'), undefined);
});

test('an unknown field fails, and says what kind of thing leaked', () => {
  const withColour = fixture();
  withColour.paints[0].observations = [{ hex: '#ff0000', authority: 'licensed_open_dataset' }];
  const findings = checkPublicRegistry(withColour);
  assert.ok(findings.some((f) => f.includes('unknown field observations')));
  assert.ok(findings.some((f) => f.includes('private catalogue material')));

  // Nested is caught too: the allowlist is per record, the material scan is
  // over the whole document.
  const nested = fixture();
  nested.paints[1].ranges = [{ name: 'Base', sourceId: 'src-a' }];
  assert.ok(checkPublicRegistry(nested).some((f) => f.includes('private catalogue material')));
});

test('an identifier that resolves to two paints fails', () => {
  const clash = fixture();
  clash.paints[1].aliasIds = [...clash.paints[1].aliasIds, 'brushcodex:paint:p00001'];
  assert.ok(checkPublicRegistry(clash).some((f) => f.includes('resolves to two paints')));

  const duplicated = fixture();
  duplicated.paints[1].id = duplicated.paints[0].id;
  assert.ok(checkPublicRegistry(duplicated).some((f) => f.includes('published twice')));
});

test('a redirect onto a live id fails rather than becoming a two-step walk', () => {
  const chained = fixture();
  chained.paints[0].supersededIds = ['brushcodex:paint:p0000002'];
  assert.ok(
    checkPublicRegistry(chained).some((f) => f.includes('both a published id and an alias')),
  );

  const selfAlias = fixture();
  selfAlias.paints[0].aliasIds = [selfAlias.paints[0].id];
  assert.ok(checkPublicRegistry(selfAlias).some((f) => f.includes('its own id as an alias')));
});

test('a count that disagrees with the array fails', () => {
  const miscounted = fixture();
  miscounted.coverage.published = 99;
  assert.ok(checkPublicRegistry(miscounted).some((f) => f.includes('coverage.published 99')));
});

test('a record without an identity to state fails', () => {
  for (const field of ['manufacturer', 'name']) {
    const document = fixture();
    delete document.paints[0][field];
    assert.ok(checkPublicRegistry(document).some((f) => f.includes(`${field} is missing`)));
  }
});

test('a non-canonical or foreign identifier fails', () => {
  const narrow = fixture();
  narrow.paints[0].id = 'brushcodex:paint:p00001';
  assert.ok(checkPublicRegistry(narrow).some((f) => f.includes('not a canonical assigned')));

  const foreign = fixture();
  foreign.paints[0].aliasIds = ['vendor:paint:something'];
  assert.ok(checkPublicRegistry(foreign).some((f) => f.includes('outside the BrushCodex')));
});

test('the accepted id syntax is wider than the issued width, and still narrow', () => {
  // The width is padding, not meaning (Common §5.7). A consumer pinned to
  // seven digits breaks the day the sequence outgrows them; one that accepts
  // anything answers for identifiers nobody minted.
  for (const id of [
    'brushcodex:paint:p00001',
    'brushcodex:paint:p0000001',
    'brushcodex:paint:p12345678',
  ]) {
    assert.match(id, ASSIGNED_ID_PATTERN);
  }
  for (const id of [
    'brushcodex:paint:p0001',
    'brushcodex:paint:p',
    'brushcodex:paint:P0000001',
    'brushcodex:paint:p0000001 ',
    'brushcodex:paint:p-0000001',
    'brushcodex:paint:example/base/red',
  ]) {
    assert.doesNotMatch(id, ASSIGNED_ID_PATTERN);
  }
  assert.match('brushcodex:paint:p10000000', CANONICAL_ASSIGNED_ID_PATTERN);
  assert.doesNotMatch('brushcodex:paint:p00001', CANONICAL_ASSIGNED_ID_PATTERN);
});

test('a malformed document fails rather than passing vacuously', () => {
  assert.ok(checkPublicRegistry({}).some((f) => f.includes('no paints[] array')));
  assert.ok(checkPublicRegistry(null).some((f) => f.includes('no paints[] array')));
  const wrongVersion = { ...fixture(), publicFormatVersion: '2.0.0' };
  assert.ok(checkPublicRegistry(wrongVersion).some((f) => f.includes('publicFormatVersion')));
  const extra = { ...fixture(), matcherWeights: {} };
  assert.ok(checkPublicRegistry(extra).some((f) => f.includes('unknown top-level field')));
});

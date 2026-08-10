/**
 * Regression tests for the public-snapshot gate logic (scripts/lib/public-snapshot.mjs).
 *
 * Run with `pnpm test:gate` (Node's built-in node:test; no test-runner dependency). These drive the
 * pure functions with in-memory trees and parsed histories, proving the gate DETECTS sensitive
 * content, a non-noreply commit identity, an imported development commit, a merge, and more than one
 * root — and, above all, that it REFUSES to pass judgement on a shallow clone.
 *
 * That last case is the reason this file exists. From its introduction until 2026-08-10 the gate
 * asserted `git rev-list --count HEAD === 1` while CI checked out at the default `fetch-depth: 1`,
 * where that count is 1 for any history whatsoever. The assertion never once verified the property
 * the publish-once design was believed to rest on, and it had no test. Both are fixed here.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  historyDiscrepancies,
  parseCommitLog,
  scanTrackedFile,
} from './lib/public-snapshot.mjs';

const NOREPLY = '1633263+Artzp@users.noreply.github.com';

/**
 * The sensitive strings below are assembled from fragments on purpose.
 *
 * This file is tracked, so `pnpm check:public-snapshot` scans it like any other — and a test that
 * spelled these patterns out literally would trip the very scanner it exercises. (It did: CI caught
 * exactly that on 2026-08-10, because the file passed locally while still untracked.) The
 * alternative, exempting this path from the scan, would put a permanent hole in the privacy net for
 * a file that will only grow. Fragments keep the scan universal, with no exceptions.
 */
const REAL_EMAIL = `someone${'@'}gmail.com`;
const SAMPLE = {
  retiredDomain: `see brushcodex${'.'}org for more`,
  workstationPath: `open E:${'\\'}GitHub${'\\'}BrushCodex${'\\'}notes.md`,
  ssn: `ssn ${'123'}-${'45'}-${'6789'}`,
  privateKey: `-----BEGIN OPENSSH ${'PRIVATE'} KEY-----`,
  githubToken: `token ghp_${'A'.repeat(24)}`,
  awsKey: `key AKIA${'B'.repeat(16)}`,
  realEmail: `write to a.person${'@'}gmail.com`,
};

/** A well-formed release commit; override one field per test to drive a single failure class. */
const releaseCommit = (over = {}) => ({
  sha: 'a'.repeat(40),
  subject: 'Release BrushCodex Standard v1.0.0 public snapshot',
  authorEmail: NOREPLY,
  committerEmail: NOREPLY,
  parents: 0,
  ...over,
});

// --- the content scan (runs in every repository) ---------------------------------------------

test('scanTrackedFile flags each sensitive content class', () => {
  const cases = [
    [SAMPLE.retiredDomain, 'retired schema-domain identifier'],
    [SAMPLE.workstationPath, 'private workstation path'],
    [SAMPLE.ssn, 'SSN-shaped value'],
    [SAMPLE.privateKey, 'private key material'],
    [SAMPLE.githubToken, 'GitHub token shape'],
    [SAMPLE.awsKey, 'AWS access-key shape'],
  ];
  for (const [text, label] of cases) {
    const findings = scanTrackedFile('f.md', text);
    assert.ok(
      findings.some((f) => f.includes(label)),
      `expected ${label} for ${JSON.stringify(text)}, got ${JSON.stringify(findings)}`,
    );
  }
});

test('scanTrackedFile flags a real email but allows example.com and noreply identities', () => {
  assert.deepEqual(scanTrackedFile('f.md', SAMPLE.realEmail), ['f.md: non-example email address']);
  assert.deepEqual(scanTrackedFile('f.md', 'write to painter@example.com'), []);
  assert.deepEqual(scanTrackedFile('f.md', `authored by ${NOREPLY}`), []);
});

test('this test file does not itself trip the scan it exercises', () => {
  // Guards the fragment discipline above: if someone spells a pattern out literally, this fails
  // here rather than in CI after the file is already committed and tracked.
  const self = readFileSync(new URL(import.meta.url), 'utf8');
  assert.deepEqual(scanTrackedFile('scripts/check-public-snapshot.test.mjs', self), []);
});

test('scanTrackedFile passes clean prose', () => {
  assert.deepEqual(scanTrackedFile('specs/recipe.md', 'A recipe declares `paints[]`.'), []);
});

// --- the history assertions (public snapshot repository only) ---------------------------------

test('historyDiscrepancies REFUSES a shallow clone instead of silently passing', () => {
  const findings = historyDiscrepancies({ shallow: true, commits: [] });
  assert.equal(findings.length, 1);
  assert.match(findings[0], /shallow clone/);
  assert.match(findings[0], /fetch-depth: 0/);
});

test('historyDiscrepancies accepts an append-only mirror of several release commits', () => {
  // The D-A shape: one clean squashed commit per release, history grows, exactly one root.
  const commits = [
    releaseCommit({ sha: 'c'.repeat(40), subject: 'Release BrushCodex Standard v1.0.0 public snapshot', parents: 1 }),
    releaseCommit({ sha: 'b'.repeat(40), subject: 'Release BrushCodex Standard v1.0.0-rc.1 public snapshot', parents: 1 }),
    releaseCommit({ sha: 'a'.repeat(40), subject: 'Release BrushCodex Standard v0.9.0-draft public snapshot', parents: 0 }),
  ];
  assert.deepEqual(historyDiscrepancies({ shallow: false, commits }), []);
});

test('historyDiscrepancies accepts the single-commit history the repo has today', () => {
  assert.deepEqual(historyDiscrepancies({ shallow: false, commits: [releaseCommit()] }), []);
});

test('historyDiscrepancies flags a non-noreply author and a non-noreply committer', () => {
  const authored = historyDiscrepancies({
    shallow: false,
    commits: [releaseCommit({ authorEmail: REAL_EMAIL })],
  });
  assert.ok(authored.some((f) => /non-noreply commit identity/.test(f)));

  const committed = historyDiscrepancies({
    shallow: false,
    commits: [releaseCommit({ committerEmail: REAL_EMAIL })],
  });
  assert.ok(committed.some((f) => /non-noreply commit identity/.test(f)));
});

test('historyDiscrepancies flags imported development history', () => {
  // The failure this actually guards: the private repo's commits do not read like releases.
  const commits = [
    releaseCommit({ sha: 'd'.repeat(40), subject: 'release: pack 1.0.0-rc.1 through the packed gate', parents: 1 }),
    releaseCommit({ sha: 'e'.repeat(40), subject: 'specs: define paintRef.kind by function', parents: 1 }),
    releaseCommit({ sha: 'f'.repeat(40), parents: 0 }),
  ];
  const findings = historyDiscrepancies({ shallow: false, commits });
  assert.equal(findings.filter((f) => /is not a release commit/.test(f)).length, 2);
});

test('historyDiscrepancies flags a merge commit', () => {
  const findings = historyDiscrepancies({ shallow: false, commits: [releaseCommit({ parents: 2 })] });
  assert.ok(findings.some((f) => /merge commit/.test(f)));
});

test('historyDiscrepancies flags more than one root', () => {
  const commits = [releaseCommit({ sha: 'a'.repeat(40) }), releaseCommit({ sha: 'b'.repeat(40) })];
  const findings = historyDiscrepancies({ shallow: false, commits });
  assert.ok(findings.some((f) => /exactly one root commit, found 2/.test(f)));
});

test('historyDiscrepancies flags an empty history', () => {
  assert.deepEqual(historyDiscrepancies({ shallow: false, commits: [] }), ['history: no commits found']);
});

// --- the parser -------------------------------------------------------------------------------

test('parseCommitLog counts parents and survives separators in the subject', () => {
  const sha = 'a'.repeat(40);
  const parent = 'b'.repeat(40);
  const stdout = [
    `${sha}\x1f${parent} ${'c'.repeat(40)}\x1f${NOREPLY}\x1f${NOREPLY}\x1fRelease: merged | piped, "quoted"`,
    `${parent}\x1f\x1f${NOREPLY}\x1f${NOREPLY}\x1fRelease BrushCodex Standard v0.9.0-draft public snapshot`,
  ].join('\n');

  const commits = parseCommitLog(stdout);
  assert.equal(commits.length, 2);
  assert.equal(commits[0].parents, 2);
  assert.equal(commits[0].subject, 'Release: merged | piped, "quoted"');
  assert.equal(commits[1].parents, 0);
  assert.equal(commits[1].authorEmail, NOREPLY);
});

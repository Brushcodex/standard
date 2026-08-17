/**
 * Regression tests for the publication-safety gate logic (scripts/lib/publication-safety.mjs).
 *
 * Run with `pnpm test:gate` (Node's built-in node:test; no test-runner dependency). These drive the
 * pure functions with in-memory trees and parsed histories, proving the gate DETECTS sensitive
 * content and a non-noreply commit identity in either field — and, above all, that it REFUSES to
 * pass judgement on a shallow clone or an empty range.
 *
 * Those last two cases are the reason this file exists. From this gate's introduction until
 * 2026-08-10 it asserted `git rev-list --count HEAD === 1` while CI checked out at the default
 * `fetch-depth: 1`, where that count is 1 for any history whatsoever. The assertion never once
 * verified the property the publish-once design was believed to rest on, it had no test, and its
 * passing was read as evidence. A gate that silently checks nothing is worse than no gate.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  commitIdentityDiscrepancies,
  parseCommitLog,
  scanTrackedFile,
} from './lib/publication-safety.mjs';

const NOREPLY = '1633263+Artzp@users.noreply.github.com';

/**
 * The two identities an API-pushed commit carries. The signer is assembled from fragments under
 * the same discipline as the samples below — it is NOT a `@users.noreply.github.com` identity, so
 * `allowedInContent` does not permit it, and spelling it out would trip the scan this file drives.
 */
const GITHUB_SIGNER = `noreply${'@'}github.com`;
const DEPENDABOT = '49699333+dependabot[bot]@users.noreply.github.com';

/**
 * The sensitive strings below are assembled from fragments on purpose.
 *
 * This file is tracked, so `pnpm check:publication-safety` scans it like any other — and a test
 * that spelled these patterns out literally would trip the very scanner it exercises. (It did: CI
 * caught exactly that on 2026-08-10, because the file passed locally while still untracked.) The
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

/** A well-formed ordinary development commit; override one field per test. */
const commit = (over = {}) => ({
  sha: 'a'.repeat(40),
  subject: 'docs: explain the additive boundary',
  authorEmail: NOREPLY,
  committerEmail: NOREPLY,
  parents: 1,
  ...over,
});

// --- the content scan (runs on every event) ----------------------------------------------------

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
  assert.deepEqual(scanTrackedFile('scripts/check-publication-safety.test.mjs', self), []);
});

test('scanTrackedFile passes clean prose', () => {
  assert.deepEqual(scanTrackedFile('specs/recipe.md', 'A recipe declares `paints[]`.'), []);
});

test('the gate library does not itself trip the scan it implements', () => {
  // The committer exemption names an address the content scan does NOT permit, so writing it as a
  // string literal in the library would make the gate fail on its own tracked source — a failure
  // that could only surface in CI, on a public repository, after the change was already pushed.
  // The library had no such guard until the exemption made one necessary; the sibling test above
  // has covered this file since 2026-08-10, for the same reason.
  const lib = readFileSync(new URL('./lib/publication-safety.mjs', import.meta.url), 'utf8');
  assert.deepEqual(scanTrackedFile('scripts/lib/publication-safety.mjs', lib), []);
});

// --- the commit-identity assertion --------------------------------------------------------------

test('commitIdentityDiscrepancies REFUSES a shallow clone instead of silently passing', () => {
  const findings = commitIdentityDiscrepancies({ shallow: true, commits: [] });
  assert.equal(findings.length, 1);
  assert.match(findings[0], /shallow clone/);
  assert.match(findings[0], /fetch-depth: 0/);
});

test('commitIdentityDiscrepancies REFUSES an empty range rather than reporting success', () => {
  // "Nothing to check" must never read as "checked and clean" — an empty result means the range
  // was wrong, and a silent pass is exactly the failure mode this gate was rebuilt to end.
  assert.deepEqual(commitIdentityDiscrepancies({ shallow: false, commits: [] }), [
    'identity: no commits found to check',
  ]);
});

test('commitIdentityDiscrepancies accepts ordinary development commits', () => {
  // The whole point of developing in the open: these are the normal case now, and the retired
  // snapshot gate would have rejected every one of them for not being a release commit.
  const commits = [
    commit({ sha: 'c'.repeat(40), subject: 'docs: make the adoption on-ramp work from a clean clone' }),
    commit({ sha: 'b'.repeat(40), subject: 'specs: define paintRef.kind by function' }),
    commit({ sha: 'a'.repeat(40), subject: 'Release BrushCodex Standard v0.9.0-draft public snapshot', parents: 0 }),
  ];
  assert.deepEqual(commitIdentityDiscrepancies({ shallow: false, commits }), []);
});

test('commitIdentityDiscrepancies flags a non-noreply author, naming the field', () => {
  const findings = commitIdentityDiscrepancies({
    shallow: false,
    commits: [commit({ authorEmail: REAL_EMAIL })],
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0], /non-noreply author/);
  assert.match(findings[0], /cannot be undone once pushed/);
});

test('commitIdentityDiscrepancies flags a non-noreply committer, naming the field', () => {
  // The squash/rebase hazard measured on 2026-08-10: GitHub's merge machinery rewrote the author
  // on squash and the COMMITTER on rebase. A check that only looked at the author would have
  // passed the rebase case straight into a public, un-force-pushable history.
  const findings = commitIdentityDiscrepancies({
    shallow: false,
    commits: [commit({ committerEmail: REAL_EMAIL })],
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0], /non-noreply committer/);
});

test('commitIdentityDiscrepancies reports both fields at once when both are wrong', () => {
  const findings = commitIdentityDiscrepancies({
    shallow: false,
    commits: [commit({ authorEmail: REAL_EMAIL, committerEmail: REAL_EMAIL })],
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0], /non-noreply author and committer/);
});

test("commitIdentityDiscrepancies accepts GitHub's signer as the COMMITTER of an API-pushed commit", () => {
  // Dependabot pushes through GitHub's API, which signs the commit and stamps GitHub's own generic
  // address in the committer field while the author stays a user-noreply identity. Ten dependency
  // pull requests were measured failing on exactly this on 2026-08-17 — at the identity step, so
  // not one of them had ever been built, typechecked or tested. `--no-merges` already exempts this
  // address on a synthetic merge commit; these are ordinary commits, so it never reached them.
  const findings = commitIdentityDiscrepancies({
    shallow: false,
    commits: [commit({ authorEmail: DEPENDABOT, committerEmail: GITHUB_SIGNER })],
  });
  assert.deepEqual(findings, []);
});

test('the signer exemption does NOT rescue a commit whose author was rewritten', () => {
  // Why the exemption is conditional on the author rather than standing alone. GitHub's squash
  // machinery was measured rewriting the author to a personal address on 2026-08-10; a generic
  // committer must never launder that, and must not start doing so if the author assertion is
  // ever relaxed.
  const findings = commitIdentityDiscrepancies({
    shallow: false,
    commits: [commit({ authorEmail: REAL_EMAIL, committerEmail: GITHUB_SIGNER })],
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0], /non-noreply author/);
});

test('the signer exemption applies to the committer field only, never the author', () => {
  const findings = commitIdentityDiscrepancies({
    shallow: false,
    commits: [commit({ authorEmail: GITHUB_SIGNER, committerEmail: NOREPLY })],
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0], /non-noreply author/);
});

test('the signer exemption does not widen to any other github.com address', () => {
  // It is one exact address, anchored at both ends — not a domain allowance.
  const findings = commitIdentityDiscrepancies({
    shallow: false,
    commits: [commit({ committerEmail: `someone${'@'}github.com` })],
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0], /non-noreply committer/);
});

test('commitIdentityDiscrepancies reports every offending commit, not just the first', () => {
  const commits = [
    commit({ sha: 'd'.repeat(40), authorEmail: REAL_EMAIL }),
    commit({ sha: 'e'.repeat(40) }),
    commit({ sha: 'f'.repeat(40), committerEmail: REAL_EMAIL }),
  ];
  const findings = commitIdentityDiscrepancies({ shallow: false, commits });
  assert.equal(findings.length, 2);
  assert.ok(findings.some((f) => f.startsWith('identity: dddddddd')));
  assert.ok(findings.some((f) => f.startsWith('identity: ffffffff')));
});

test('commitIdentityDiscrepancies treats a missing identity field as unsafe', () => {
  const findings = commitIdentityDiscrepancies({
    shallow: false,
    commits: [commit({ authorEmail: undefined })],
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0], /non-noreply author/);
});

test('commitIdentityDiscrepancies no longer judges commit subject, merges, or root count', () => {
  // Explicitly pinned as retired. The snapshot model is gone; asserting release-commit shape would
  // turn main red on the first honest commit, and linearity is enforced by branch protection.
  const commits = [
    commit({ sha: 'a'.repeat(40), subject: 'chore: whatever', parents: 2 }),
    commit({ sha: 'b'.repeat(40), subject: 'wip', parents: 0 }),
    commit({ sha: 'c'.repeat(40), subject: 'wip again', parents: 0 }),
  ];
  assert.deepEqual(commitIdentityDiscrepancies({ shallow: false, commits }), []);
});

// --- the parser -------------------------------------------------------------------------------

test('parseCommitLog counts parents and survives separators in the subject', () => {
  const sha = 'a'.repeat(40);
  const parent = 'b'.repeat(40);
  const stdout = [
    `${sha}\x1f${parent} ${'c'.repeat(40)}\x1f${NOREPLY}\x1f${NOREPLY}\x1fRelease: merged | piped, "quoted"`,
    `${parent}\x1f\x1f${NOREPLY}\x1f${NOREPLY}\x1fdocs: the first commit`,
  ].join('\n');

  const commits = parseCommitLog(stdout);
  assert.equal(commits.length, 2);
  assert.equal(commits[0].parents, 2);
  assert.equal(commits[0].subject, 'Release: merged | piped, "quoted"');
  assert.equal(commits[1].parents, 0);
  assert.equal(commits[1].authorEmail, NOREPLY);
});

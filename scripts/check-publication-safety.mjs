/**
 * Publication-safety gate: orchestrator.
 *
 * Reads the tracked tree and (when asked) the git history, and delegates every judgement to the
 * pure functions in scripts/lib/publication-safety.mjs, which the regression suite drives directly.
 *
 * Usage:
 *   node scripts/check-publication-safety.mjs                     # sensitive-content scan of the tree
 *   node scripts/check-publication-safety.mjs --identity          # ... plus commit identity, all history
 *   node scripts/check-publication-safety.mjs --identity --range=<base>..HEAD
 *                                                                 # ... plus commit identity, one range
 *
 * This repository is public and `main` forbids force-pushes, so both checks guard things that
 * cannot be taken back. The content scan runs on every event. `--identity` additionally asserts
 * that every commit under examination carries a `@users.noreply.github.com` address in BOTH the
 * author and committer fields, and requires a full clone to mean anything. The committer field
 * alone also accepts GitHub's own signer on a commit whose author is already a noreply identity,
 * which is how commits pushed through GitHub's API (Dependabot, the web UI) are stamped; the
 * reasoning, and why it is conditional, is at `GITHUB_SIGNER_EMAIL` in lib/publication-safety.mjs.
 *
 * `--range` exists so a pull request can be judged on the commits it proposes, *before* they are
 * permanent. Merges are excluded from the range: on a `pull_request` event the checked-out ref is a
 * synthetic merge commit created by GitHub, committed by GitHub's own bot address rather than a
 * *user* noreply identity, and failing a contributor for an artefact of the checkout would be
 * wrong. Real merges cannot reach `main` anyway; branch protection requires linear history.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import {
  commitIdentityDiscrepancies,
  parseCommitLog,
  scanTrackedFile,
} from './lib/publication-safety.mjs';

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const argv = process.argv.slice(2);
const withIdentity = argv.includes('--identity');
const rangeArg = argv.find((a) => a.startsWith('--range='));
const range = rangeArg ? rangeArg.slice('--range='.length).trim() : '';

const findings = [];

const tracked = git(['ls-files', '-z']).split('\0').filter(Boolean);
for (const file of tracked) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  if (text.includes('\0')) continue; // binary
  findings.push(...scanTrackedFile(file, text));
}

let identityScope = '';
if (withIdentity) {
  const shallow = git(['rev-parse', '--is-shallow-repository']).trim() === 'true';
  const logArgs = ['log', '--no-merges', '--format=%H%x1f%P%x1f%ae%x1f%ce%x1f%s'];
  if (range) logArgs.push(range);

  const commits = shallow ? [] : parseCommitLog(git(logArgs));
  findings.push(...commitIdentityDiscrepancies({ shallow, commits }));
  identityScope = range
    ? `, identity verified across ${commits.length} commit(s) in ${range}`
    : `, identity verified across all ${commits.length} commit(s)`;
}

if (findings.length) {
  console.error([...new Set(findings)].join('\n'));
  process.exit(1);
}

console.log(`Publication safety passed (${tracked.length} tracked files${identityScope}).`);

/**
 * Public-snapshot gate: orchestrator.
 *
 * Reads the tracked tree and (when asked) the git history, and delegates every judgement to the
 * pure functions in scripts/lib/public-snapshot.mjs, which the regression suite drives directly.
 *
 * Usage:
 *   node scripts/check-public-snapshot.mjs              # sensitive-content scan of the tracked tree
 *   node scripts/check-public-snapshot.mjs --history    # ... plus the public-snapshot history assertions
 *   node scripts/check-public-snapshot.mjs --tree-only  # deprecated alias for the default
 *
 * The content scan runs in EVERY repository holding this tree. `--history` is only correct in the
 * public release repository (Brushcodex/standard), whose history is a squashed release-per-commit
 * mirror; the private source repository's history is real development work and would rightly fail.
 * It requires a full clone and says so rather than silently verifying nothing — see the module
 * comment in scripts/lib/public-snapshot.mjs for why that mattered.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { historyDiscrepancies, parseCommitLog, scanTrackedFile } from './lib/public-snapshot.mjs';

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const withHistory = process.argv.includes('--history');
if (process.argv.includes('--tree-only')) {
  console.warn('note: --tree-only is the default; the flag is retained only for compatibility.');
}

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

if (withHistory) {
  const shallow = git(['rev-parse', '--is-shallow-repository']).trim() === 'true';
  const commits = shallow
    ? []
    : parseCommitLog(git(['log', '--format=%H%x1f%P%x1f%ae%x1f%ce%x1f%s']));
  findings.push(...historyDiscrepancies({ shallow, commits }));
}

if (findings.length) {
  console.error([...new Set(findings)].join('\n'));
  process.exit(1);
}

const scope = withHistory ? ', history verified against a full clone' : ', tree only';
console.log(`Public snapshot scan passed (${tracked.length} tracked files${scope}).`);

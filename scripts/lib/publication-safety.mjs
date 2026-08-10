/**
 * Pure logic for the publication-safety gate.
 *
 * Everything here is a pure function over already-read data (file text, parsed `git log` output),
 * with no filesystem or process access, so the regression suite
 * (scripts/check-publication-safety.test.mjs) can drive each failure class with controlled
 * in-memory inputs. The orchestrator (scripts/check-publication-safety.mjs) reads the tree and the
 * git history and calls these.
 *
 * This repository is developed **in the open** (2026-08-10). `main` is public, protected against
 * force-pushes and deletions, and every change lands through a pull request. Nothing here can be
 * taken back once it is pushed, so the gate guards the two things that are permanent:
 *
 * 1. `scanTrackedFile` — the sensitive-content scan, over file *contents*. Runs on every event.
 * 2. `commitIdentityDiscrepancies` — the commit-identity assertion, over *commit metadata*.
 *    Author and committer must both be a `@users.noreply.github.com` address.
 *
 * Keeping them separate is the point, because **the content scan cannot see a commit author.** An
 * address that appears nowhere in any file still becomes permanent the moment it is committed, and
 * the branch forbids the force-push that would remove it. That is not hypothetical: on 2026-08-10
 * GitHub's own merge machinery was measured rewriting the author (squash) and the committer
 * (rebase) to a personal address, which would have published it irreversibly.
 *
 * The identity assertion REQUIRES a full clone. Under a shallow checkout `git log` yields only the
 * tip, so the assertion silently passes while verifying almost nothing. That is not hypothetical
 * either: it is how this gate's predecessor behaved from its introduction until 2026-08-10, when
 * `git rev-list --count HEAD === 1` was found to be vacuous at `fetch-depth: 1`, and the entire
 * publish-once design was believed to rest on it. `commitIdentityDiscrepancies` therefore treats
 * "asked to verify identity, given a shallow clone" as a failure in its own right.
 *
 * **What deliberately is NOT here any more.** Until 2026-08-10 this gate also asserted that every
 * commit was a squashed release commit, that history was linear, and that there was exactly one
 * root — the shape of a snapshot mirror exported from a private source repository. That model is
 * retired: ordinary development commits are now the normal case, and asserting otherwise would turn
 * `main` red on the first honest commit. Linearity is still enforced, by branch protection
 * (`required_linear_history`), which is where it belongs.
 */

/** Content patterns that must never appear in a tracked file. */
export const SENSITIVE_RULES = Object.freeze([
  ['retired schema-domain identifier', /brushcodex[.]org/i],
  ['private workstation path', /(?:E:[\\/]+GitHub[\\/]+BrushCodex|\/home\/[^/\s]+\/[^\r\n]*BrushCodex)/i],
  ['SSN-shaped value', /\b\d{3}-\d{2}-\d{4}\b/],
  ['private key material', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['GitHub token shape', /\b(?:gh[opusr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ['AWS access-key shape', /\bAKIA[0-9A-Z]{16}\b/],
]);

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

/** The only commit identity permitted in this repository. */
export const NOREPLY_EMAIL = /@users\.noreply\.github\.com$/i;

/** An email that may legitimately appear in tracked content (documentation examples, git identities). */
function allowedInContent(email) {
  return /@example\.(?:com|net|org)$/i.test(email) || NOREPLY_EMAIL.test(email);
}

/**
 * Scan one tracked file's text. Returns a list of findings (empty when clean).
 * Binary content is the caller's problem — it should skip such files.
 */
export function scanTrackedFile(file, text) {
  const findings = [];
  for (const [label, pattern] of SENSITIVE_RULES) {
    if (pattern.test(text)) findings.push(`${file}: ${label}`);
  }
  for (const email of text.match(EMAIL_PATTERN) ?? []) {
    if (!allowedInContent(email)) findings.push(`${file}: non-example email address`);
  }
  return findings;
}

/**
 * Assert that every commit under examination carries a noreply identity in BOTH fields.
 *
 * @param {object} input
 * @param {boolean} input.shallow  `git rev-parse --is-shallow-repository`
 * @param {Array<{sha: string, subject: string, authorEmail: string, committerEmail: string, parents: number}>} input.commits
 *        The commits to check, newest first. Empty is a failure: it means the range was wrong, and
 *        "nothing to check" must never read as "checked and clean".
 * @returns {string[]} findings (empty when every commit is safe to publish)
 */
export function commitIdentityDiscrepancies({ shallow, commits }) {
  if (shallow) {
    return [
      'identity: refusing to verify commit identity from a shallow clone — ' +
        'git log would show only the tip commit regardless of the real history. ' +
        'Check out with fetch-depth: 0.',
    ];
  }

  if (!Array.isArray(commits) || commits.length === 0) {
    return ['identity: no commits found to check'];
  }

  const findings = [];
  for (const commit of commits) {
    const at = commit.sha ? commit.sha.slice(0, 8) : '(unknown)';
    const bad = [];
    if (!NOREPLY_EMAIL.test(commit.authorEmail ?? '')) bad.push('author');
    if (!NOREPLY_EMAIL.test(commit.committerEmail ?? '')) bad.push('committer');
    if (bad.length) {
      findings.push(
        `identity: ${at} has a non-noreply ${bad.join(' and ')} ` +
          `("${commit.subject ?? ''}") — this cannot be undone once pushed`,
      );
    }
  }

  return [...new Set(findings)];
}

/**
 * Parse `git log --format=%H%x1f%P%x1f%ae%x1f%ce%x1f%s` output into commit records.
 * Unit-separated so a subject containing any printable character cannot corrupt the parse.
 */
export function parseCommitLog(stdout) {
  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [sha, parents, authorEmail, committerEmail, subject] = line.split('\x1f');
      return {
        sha,
        parents: parents.trim() ? parents.trim().split(/\s+/).length : 0,
        authorEmail,
        committerEmail,
        subject: subject ?? '',
      };
    });
}

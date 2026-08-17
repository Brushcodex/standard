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
 *    Author and committer must both be a `@users.noreply.github.com` address, with one
 *    exemption in the committer field alone for GitHub's own signer (see `GITHUB_SIGNER_EMAIL`).
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

/**
 * GitHub's own commit-signing address, accepted as a COMMITTER and never as an author.
 *
 * Commits pushed through GitHub's API — Dependabot's, and anything committed from the web UI —
 * are signed by GitHub itself, which stamps its generic address in the committer field while the
 * author stays the real user-noreply identity. It is nobody's personal address; every web-flow
 * commit on GitHub carries it, so accepting it exposes nothing. The hazard this gate exists for is
 * a *personal* address becoming permanent, and that is still caught in either field.
 *
 * This is the reasoning the orchestrator already applies when it passes `--no-merges`: a
 * `pull_request` checkout is a synthetic merge committed by this same address, and failing a
 * contributor for an artefact of the checkout would be wrong. Dependabot's commits are ordinary
 * commits rather than merges, so `--no-merges` never reached them — ten dependency pull requests
 * were measured failing here on 2026-08-17, not one of which had ever reached its own build,
 * typecheck, test, conformance or audit step. The gap was in an exemption this gate already held.
 *
 * Deliberately conditional on the author (see `commitIdentityDiscrepancies`), so that relaxing the
 * author assertion later cannot quietly turn this into a way in.
 *
 * Written as a pattern rather than a string literal on purpose. The address is not a
 * `@users.noreply.github.com` identity, so `allowedInContent` does not permit it, and spelling it
 * out here would make this file fail the very content scan it implements — the escaped dot is what
 * stops `EMAIL_PATTERN` matching this line. `check-publication-safety.test.mjs` pins that.
 */
export const GITHUB_SIGNER_EMAIL = /^noreply@github\.com$/i;

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
 * Assert that every commit under examination carries a noreply identity in BOTH fields — the
 * committer additionally accepting GitHub's own signer, on the terms set out at
 * `GITHUB_SIGNER_EMAIL`.
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
    const authorEmail = commit.authorEmail ?? '';
    const committerEmail = commit.committerEmail ?? '';

    // The author is asserted strictly, with no exemption whatsoever: a personal address here is
    // precisely what GitHub's squash machinery was measured writing on 2026-08-10.
    const authorOk = NOREPLY_EMAIL.test(authorEmail);
    // The committer additionally accepts GitHub's signer, but ONLY where the author is already a
    // noreply identity — so a rewritten author can never ride in on the exemption, and the rebase
    // case (committer rewritten to a personal address) is untouched by it.
    const committerOk =
      NOREPLY_EMAIL.test(committerEmail) || (authorOk && GITHUB_SIGNER_EMAIL.test(committerEmail));

    const bad = [];
    if (!authorOk) bad.push('author');
    if (!committerOk) bad.push('committer');
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

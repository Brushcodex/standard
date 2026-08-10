/**
 * Pure logic for the public-snapshot gate.
 *
 * Everything here is a pure function over already-read data (file text, parsed `git log` output),
 * with no filesystem or process access, so the regression suite (scripts/check-public-snapshot.test.mjs)
 * can drive each failure class with controlled in-memory inputs. The orchestrator
 * (scripts/check-public-snapshot.mjs) reads the tree and the git history and calls these.
 *
 * Two independent concerns live here, and keeping them separate is the point:
 *
 * 1. `scanTrackedFile` — the sensitive-content scan. Runs against EVERY repository that holds this
 *    tree (the private source, the public snapshot, and every pull request). This is the privacy net
 *    and it must never be conditional.
 * 2. `historyDiscrepancies` — the public-snapshot history assertions. Only meaningful in the public
 *    release repository, whose history is a squashed release-per-commit mirror. Asserting these
 *    against the private source repository is a category error: its history is real development
 *    work by a real author, which is exactly what it should be.
 *
 * The history assertions REQUIRE a full clone. Under a shallow checkout `git rev-list --count HEAD`
 * returns 1 and `git log` yields only the tip, so the assertions silently pass while verifying
 * nothing. That is not a hypothetical: it is how this gate behaved from its introduction until
 * 2026-08-10, and the whole publish-once design was believed to rest on it. `historyDiscrepancies`
 * therefore treats "asked to verify history, given a shallow clone" as a failure in its own right.
 */

/** Content patterns that must never appear in a tracked file, in any repository. */
export const SENSITIVE_RULES = Object.freeze([
  ['retired schema-domain identifier', /brushcodex[.]org/i],
  ['private workstation path', /(?:E:[\\/]+GitHub[\\/]+BrushCodex|\/home\/[^/\s]+\/[^\r\n]*BrushCodex)/i],
  ['SSN-shaped value', /\b\d{3}-\d{2}-\d{4}\b/],
  ['private key material', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['GitHub token shape', /\b(?:gh[opusr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ['AWS access-key shape', /\bAKIA[0-9A-Z]{16}\b/],
]);

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

/** The only commit identity permitted in the public snapshot repository. */
export const NOREPLY_EMAIL = /@users\.noreply\.github\.com$/i;

/**
 * Every commit in the public snapshot must be a release commit. This is the assertion that actually
 * prevents the private development history from being imported: those commits read `docs: …`,
 * `specs: …`, `release: pack …`, never this.
 */
export const RELEASE_SUBJECT = /^Release BrushCodex Standard v\d/;

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
 * Assert the public snapshot's history shape.
 *
 * @param {object} input
 * @param {boolean} input.shallow      `git rev-parse --is-shallow-repository`
 * @param {Array<{sha: string, subject: string, authorEmail: string, committerEmail: string, parents: number}>} input.commits
 *        Every commit reachable from HEAD, newest first.
 * @returns {string[]} findings (empty when the history is a clean append-only release mirror)
 */
export function historyDiscrepancies({ shallow, commits }) {
  if (shallow) {
    return [
      'history: refusing to verify history from a shallow clone — ' +
        'rev-list would report 1 commit regardless of the real history. ' +
        'Check out with fetch-depth: 0.',
    ];
  }

  const findings = [];
  if (!Array.isArray(commits) || commits.length === 0) {
    findings.push('history: no commits found');
    return findings;
  }

  for (const commit of commits) {
    const at = commit.sha ? commit.sha.slice(0, 8) : '(unknown)';
    if (!NOREPLY_EMAIL.test(commit.authorEmail) || !NOREPLY_EMAIL.test(commit.committerEmail)) {
      findings.push(`history: ${at} non-noreply commit identity`);
    }
    if (!RELEASE_SUBJECT.test(commit.subject)) {
      findings.push(`history: ${at} is not a release commit ("${commit.subject}")`);
    }
    if (commit.parents > 1) {
      findings.push(`history: ${at} is a merge commit; the snapshot must stay linear`);
    }
  }

  const roots = commits.filter((commit) => commit.parents === 0);
  if (roots.length !== 1) {
    findings.push(`history: expected exactly one root commit, found ${roots.length}`);
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

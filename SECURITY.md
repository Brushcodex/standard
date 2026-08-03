# Security Policy

BrushCodex is a set of specifications, JSON Schemas, and a reference validation
toolkit — there is no hosted service in this repository. Security-relevant issues
are most likely in the reference tooling under `packages/` (for example, a way to
make the validator crash, hang, or wrongly accept a malformed document).

## Reporting a vulnerability

Please report suspected vulnerabilities **privately** — do not open a public issue:

- Use GitHub's **"Report a vulnerability"** button under this repository's **Security** tab
  (Security → Advisories → Report a vulnerability). This opens a private report visible only to
  the reporter and the maintainers. Private vulnerability reporting is the supported contact
  path; the project does not publish a personal maintainer email address.

Please include the affected file or package, the version or commit, and the
smallest input or steps that reproduce the problem. We aim to acknowledge a report
within a few days and will keep you posted on the fix.

## Scope

- **In scope:** the reference validator, CLI, and tooling in `packages/` and
  `scripts/`; schema definitions that could cause unsafe validation behavior.
- **Out of scope:** third-party applications that implement the standard, and any
  hosted BrushCodex service — they have their own reporting channels.

Thank you for helping keep BrushCodex and its implementers safe.

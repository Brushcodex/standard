# Releasing & the packed release gate

The `@brushcodex/*` packages are consumed as **packed tarballs / distributable artifacts**, never as
this source checkout. This document defines the local pack workflow and the committed gate that
must pass before any release step.

> **No `@brushcodex/*` package is currently published** to any registry. Everything here is about
> proving the packages are release-ready; actual publishing is a separate, explicit maintainer
> decision and is out of scope for the gate.

## The packages

`brushcodex-standard` owns five package candidates (all `1.0.0-rc.1`, `private`, `type: module`):

| Package | Runtime deps (after pack) | Ships |
|---|---|---|
| `@brushcodex/schema` | none | the 7 JSON Schemas as data (`schema` bundled from `schemas/`) |
| `@brushcodex/types` | `@brushcodex/validator` | the 7 canonical document TS types (`.d.ts`) |
| `@brushcodex/validator` | `ajv`, `ajv-formats`, `fflate`, `zod` | validators + conformance runner + renderer (schema bundled in) |
| `@brushcodex/fixtures` | none | the corpus (`corpus/examples/**`) + manifest + Node loaders |
| `@brushcodex/cli` | `@brushcodex/fixtures`, `ajv`, `ajv-formats`, `fflate`, `zod` | `validate` + `conformance` bins (validator bundled in) |

Build order is topological: `schema → validator → {types, fixtures} → cli`. `pnpm -r build`
resolves it from the declared dependency graph. Only `@brushcodex/fixtures` ships the corpus; the
CLI and validator must **not** duplicate it.

## The required check

```bash
pnpm verify:packed
```

Run — and require in CI — **before**:

- any package **version** change;
- **tagging**;
- **publishing**;
- a **release**;
- any **package-boundary refactor** (moving code between packages, changing `exports`, `files`,
  `bin`, or the dependency graph).

**Passing the source-repository tests (`pnpm -r test`, `pnpm conformance`) is not sufficient** —
distributable package candidates must also pass the packed release gate.

### What it does (no publishing, ever)

1. Cleans gitignored build/pack outputs, then **builds all five packages from zero**.
2. **Packs** each with `pnpm pack` into `artifacts/local-packages/` (gitignored). pnpm pack rewrites
   `workspace:*` to the concrete version, so the packed manifests carry no workspace protocol.
3. Asserts the produced set is **exactly** the five expected packages and inspects each packed
   manifest + its contents (no `workspace:` leak, no repo-relative escape, no absolute source path,
   no cross-package `src/` import, no `.env`/dev-report/test files, corpus shipped only by
   `@brushcodex/fixtures`).
4. Creates a **throwaway consumer outside the repo** (a path containing a space) and installs
   **only the tarballs** with `npm` (workspace-blind; `overrides` pin every `@brushcodex/*` to its
   tarball, so nothing in our scope is fetched from a registry).
5. Runs, under **plain Node ESM** and via the installed **`.bin` shims** from a foreign working
   directory: schema loads the 7 schemas; `@brushcodex/types` type-checks (consumer `tsc`) all 7
   document types; the validator accepts a valid Recipe and rejects an invalid one (root + per-spec
   subpath); fixtures enumerate the manifest and load the corpus (exactly **99**); the CLI reports
   **99/99** conformance and correct validate exit codes.
6. **Source-checkout absence proof:** renames `examples/`, `packages/*/dist`, and the local tarball
   dir away, re-runs the essential checks **without reinstalling**, then restores every rename
   (guaranteed via `finally` + signal handlers).
7. On success, removes the consumer and tarballs (`--keep` / `BCX_KEEP_CONSUMER=1` retains them;
   on failure they are preserved and their paths printed).

The gate's own assertion logic is unit-tested (`pnpm test:gate`, Node's built-in `node:test`),
proving it detects a missing packed dependency, a repo-relative import in packed output, a missing
fixture corpus, a broken CLI bin, and a version/manifest mismatch.

## The publication-safety gate

This repository is **developed in the open** (since 2026-08-10). `main` is public, requires a pull
request, and forbids force-pushes and deletions. Nothing that lands can be taken back, so
`scripts/check-publication-safety.mjs` guards the two things that are permanent:

```bash
pnpm check:publication-safety                              # sensitive-content scan of the tree
pnpm check:publication-safety -- --identity                # ... plus commit identity, all history
pnpm check:publication-safety -- --identity --range=<base>..HEAD   # ... over one range
```

**The content scan runs on every event**, unconditionally. It is the privacy net (retired domain,
workstation paths, key/token/SSN shapes, non-example email addresses) and must never be made
conditional.

**The commit-identity assertion** requires a `@users.noreply.github.com` address in **both** the
author and committer fields of every commit under examination. The two checks are separate because
**the content scan cannot see a commit author**: an address appearing in no file at all still
becomes permanent the moment it is committed.

That is not a theoretical concern. Measured on 2026-08-10, GitHub's own merge machinery rewrote the
**author** on squash-merge and the **committer** on rebase-merge to a personal address — either
would have published it irreversibly. Rebase-merge is the supported method and squash must not be
used; the gate is what stops that discipline being a thing someone has to remember.

CI checks the range a pull request proposes (`base.sha..HEAD`) so a bad identity is caught *before*
merge, and re-checks the full history on push so the property holds for the repository as a whole.
Merges are excluded from the range: a `pull_request` checkout is a synthetic merge commit committed
by GitHub's own bot address rather than a *user* noreply identity, and failing a contributor for an
artefact of the checkout would be wrong. Real merges cannot reach `main` — branch protection
requires linear history.

> **It requires a full clone, and says so.** From this gate's introduction until 2026-08-10 it
> asserted `git rev-list --count HEAD === 1` while CI checked out at `actions/checkout`'s default
> `fetch-depth: 1` — a depth at which that count is 1 for *any* history. The assertion never once
> verified the property the publish-once design was believed to rest on, and its passing was read as
> evidence. The workflow sets `fetch-depth: 0`, and the gate refuses to pass judgement on a shallow
> clone — or on an empty commit range — rather than silently approving. `pnpm test:gate` pins both
> refusals.

> **Retired 2026-08-10 with the snapshot model.** The gate no longer asserts that every commit is a
> squashed release commit, that history is linear, or that there is exactly one root. Those
> described a mirror exported from a private source repository. Ordinary development commits are now
> the normal case, and keeping those rules would have turned `main` red on the first honest commit.
> Linearity is still enforced, by branch protection, which is where it belongs.

## Local pack workflow (manual, if needed)

`pnpm verify:packed` is the supported path. To inspect a single tarball by hand:

```bash
cd packages/<pkg> && pnpm pack --pack-destination ../../artifacts/local-packages
```

`artifacts/` is gitignored — never commit tarballs.

## CI

[.github/workflows/quality.yml](../.github/workflows/quality.yml) runs the
full source verification plus `pnpm test:gate` and `pnpm verify:packed` on **Linux and Windows**
(the two bin-shim regimes) for every push to `main` and every pull request touching packages,
schemas, examples, tooling, the lockfile, or manifests. It caches only pnpm's store — never the
isolated consumer (which could mask a packed-package defect) — and holds **no publish credentials**.
A future publish/release job must depend on this workflow.

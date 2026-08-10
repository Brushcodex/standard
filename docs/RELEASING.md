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
   subpath); fixtures enumerate the manifest and load the corpus (exactly **95**); the CLI reports
   **95/95** conformance and correct validate exit codes.
6. **Source-checkout absence proof:** renames `examples/`, `packages/*/dist`, and the local tarball
   dir away, re-runs the essential checks **without reinstalling**, then restores every rename
   (guaranteed via `finally` + signal handlers).
7. On success, removes the consumer and tarballs (`--keep` / `BCX_KEEP_CONSUMER=1` retains them;
   on failure they are preserved and their paths printed).

The gate's own assertion logic is unit-tested (`pnpm test:gate`, Node's built-in `node:test`),
proving it detects a missing packed dependency, a repo-relative import in packed output, a missing
fixture corpus, a broken CLI bin, and a version/manifest mismatch.

## The public-snapshot gate

`scripts/check-public-snapshot.mjs` covers two separate concerns, and the separation is load-bearing:

```bash
pnpm check:public-snapshot              # sensitive-content scan of the tracked tree
pnpm check:public-snapshot -- --history  # ... plus the public-snapshot history assertions
```

**The content scan runs everywhere** — private source repository, public snapshot repository, every
pull request. It is the privacy net (retired domain, workstation paths, key/token/SSN shapes,
non-example email addresses) and must never be made conditional.

**The history assertions describe the public repository only.** The public snapshot is an
*append-only squashed release mirror*: one clean commit per release, so history grows, `v0.9.0-draft`
stays reachable, and existing clones keep working. Every commit must therefore be a release commit
(`Release BrushCodex Standard v…`), authored *and* committed by the `@users.noreply.github.com`
identity, with a linear history and exactly one root. Those rules are what stop the private
development history being imported — its commits read `docs: …`, `specs: …`, `release: pack …`,
and each would be reported by name.

Running them against the private source repository is a category error: its history is real
development work by a real author, which is what it should be. CI scopes them with
`if: github.repository == 'Brushcodex/standard'`.

> **They require a full clone, and say so.** From this gate's introduction until 2026-08-10 it
> asserted `git rev-list --count HEAD === 1` while CI checked out at `actions/checkout`'s default
> `fetch-depth: 1` — a depth at which that count is 1 for *any* history. The assertion never once
> verified the property the publish-once design was believed to rest on, and its passing was read as
> evidence. The workflow now sets `fetch-depth: 0`, and the gate refuses to pass judgement on a
> shallow clone rather than silently approving it. `pnpm test:gate` pins that refusal.

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

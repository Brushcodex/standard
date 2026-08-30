# packages/

The **application-independent** toolkit for the BrushCodex standard, as a pnpm workspace. It
runs under Node with no web application. Extracted from the reference app at commit `9bd4bb0`
(see [../PROVENANCE.md](../PROVENANCE.md)).

```bash
pnpm install       # from the repo root
pnpm -r build      # generate/build every package into its dist/ (+ the fixtures corpus)
pnpm -r test       # @brushcodex/schema + @brushcodex/validator + @brushcodex/fixtures
pnpm -r typecheck  # validator + cli + types + fixtures
pnpm verify:packed # PROVE all five work from packed tarballs in an isolated, source-absent consumer
```

> **Package changes must pass [`pnpm verify:packed`](../docs/RELEASING.md), not only `pnpm -r test`.**
> The in-repo suites run against the workspace (symlinks, source `.ts`, shared store); external
> consumers install packed tarballs. The gate builds, packs, installs the tarballs into a throwaway
> npm project outside the repo, and re-runs the checks with the source checkout renamed away — so it
> catches repo-relative imports, missing runtime deps, wrong `exports`, `workspace:` leaks, corpus
> omissions, and broken CLI bins that source tests cannot see. It never publishes.

## Present packages

| Package | Purpose | Status |
|---|---|---|
| [`schema`](schema/) `@brushcodex/schema` | The 7 JSON Schemas as data (zero deps) | ✅ smoke-tested |
| [`validator`](validator/) `@brushcodex/validator` | Ajv (draft 2020-12) validators, conformance runner, reference HTML renderer, extension-graduation helper (`/migrate`), authoring helpers (`/authoring`) | ✅ 377 tests pass, typecheck clean |
| [`types`](types/) `@brushcodex/types` | Canonical document TS types (re-exported from the validator's Zod model) | ✅ 7/7 covered, typecheck clean |
| [`cli`](cli/) `@brushcodex/cli` | `validate` + `conformance` bins; conformance loads the corpus from `@brushcodex/fixtures` (runs packed, no source checkout) | ✅ conformance 99/99, integration tests and typecheck clean |
| [`fixtures`](fixtures/) `@brushcodex/fixtures` | The example/conformance corpus + a stable manifest + Node loaders | ✅ 16 tests pass; corpus ships in-package |

All are versioned `1.0.0-rc.2` (lockstep) and **private** (not published to any registry). Each ships a built
`dist/` (self-contained: `validator`/`cli` bundle the schema in; `fixtures` ships the corpus).

## Dependency direction

```text
@brushcodex/schema  (data)
        │
        ▼
@brushcodex/validator  (engine) ──► @brushcodex/types   (types, re-export)
        │        │              └──► @brushcodex/cli     (tooling; validator bundled into the bins)
        │        │                        ▲
        │        ▼ (dev-only: build/verify the manifest)   │ (runtime dep; external, not bundled)
        └────► @brushcodex/fixtures  (corpus + manifest + loaders) ─┘
```

`@brushcodex/fixtures` ships the canonical `examples/` corpus inside the package (generated from the
repo-root `examples/`, the single source of truth) so consumers never read this repository at
runtime; it uses `@brushcodex/validator` only at build/test time to prove the manifest is truthful.
`@brushcodex/cli` depends on `@brushcodex/fixtures` **at runtime** (kept external, not bundled) so its
`conformance` bin loads the corpus from the installed fixtures package — the packed CLI runs `99/99`
from any directory with no source checkout. None of the packages import the website, Creator
Assistant, a database, or any hosted API.

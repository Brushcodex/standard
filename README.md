# BrushCodex Standard

The **open, implementation-neutral family of versioned specifications** for portable
miniature-painting knowledge: Painting Workflows (technical spec name `recipe`), palettes,
inventories, projects, techniques, and the
bundle manifest that packages them — each with a common document envelope carrying identity,
versioning, provenance, licensing, and extensions.

This repository is the **canonical home** of the standard. The BrushCodex web application
(`brushcodex-community`) is a *reference implementation* that proves the specs are useful; it
is not part of the standard. Documents in these formats never require a central BrushCodex
registry and remain usable when no BrushCodex service is available.

> **Status: DRAFT.** Every specification here is DRAFT until explicitly frozen by the
> maintainer. Draft schemas MAY change incompatibly. See [VERSIONING.md](VERSIONING.md).

**New here?** The **[Quickstart](docs/QUICKSTART.md)** takes you from zero to a validated
document in about five minutes. The full path from first contact to extending a document:

## The adoption on-ramp

Using only this repository — no account, no server, no BrushCodex service — you can:

1. **Understand** — what BrushCodex is and its seven document types. The
   [Quickstart](docs/QUICKSTART.md) opens with the essentials; the normative definitions live in
   [`specs/`](specs/), and [LAYOUT.md](LAYOUT.md) maps every directory.
2. **Author** — build a valid document of any type with the reference helpers, using the
   [Authoring cookbook](docs/AUTHORING.md); or start from a [worked example](docs/EXAMPLES.md).
3. **Validate** — one document with the CLI (see the
   [Quickstart](docs/QUICKSTART.md#step-2--validate-it)), the whole corpus with
   `pnpm --filter @brushcodex/cli conformance`, or from another language via the
   [Python path](docs/VALIDATE_WITH_JSONSCHEMA.md).
4. **Extend** — carry data the core does not model in namespaced
   [extensions](docs/EXTENSIONS.md).

## Layout

```text
specs/         Normative human-readable specification text (RFC 2119 keywords)
schemas/       Versioned JSON Schemas (draft 2020-12). Immutable once a version is frozen.
examples/      Informative corpus: *.valid.json + invalid/*.json + invalid/EXPECTATIONS.json
conformance/   How to check an implementation against the corpus
migrations/    (placeholder) Deterministic migrations for major version transitions
packages/      @brushcodex/{schema,types,validator,fixtures,cli} — the app-independent toolkit
scripts/       Repo tooling, incl. the packed release gate (verify-packed.mjs)
docs/          QUICKSTART.md, AUTHORING.md, EXAMPLES.md, EXTENSIONS.md, PAINT_DATA_MODEL.md, LICENSING.md, …
LAYOUT.md      Per-directory intent, and where a given change belongs
VERSIONING.md  Specification versioning & compatibility policy
GOVERNANCE.md  How the standard is governed and how gaps are validated
LICENSES/      Canonical license texts (Apache-2.0, CC0-1.0); NOTICE is at the repo root
```

New here? [LAYOUT.md](LAYOUT.md) maps every directory to its purpose and explains the split
between **the standard** (`specs/` + `schemas/`, normative) and **the toolkit** (`packages/`,
a reference implementation).

Specs covered (all Draft v1): `common` (envelope), `recipe`, `palette`, `inventory`,
`project`, `technique`, `bundle`.

## Normative vs. informative

- **Normative** (binding): the prose in each `specs/**/README.md` **and** the corresponding
  versioned JSON Schema. If prose and schema disagree, that is a defect to fix — not an
  implementer's choice.
- **Informative**: everything in `examples/`, this README, and any note marked _informative_.

## Validating documents

The reference toolkit lives in [`packages/`](packages/README.md) and runs without any web
application:

```bash
pnpm install
pnpm -r build                                             # required before any command below
pnpm --filter @brushcodex/cli conformance                 # validate the whole corpus (99/99)
pnpm --filter @brushcodex/cli validate /abs/path/doc.json # validate one document / .brushcodex.zip
pnpm -r test                                              # schema, validator, fixtures, and CLI suites
```

> **`pnpm -r build` is not optional.** The packages resolve to built output; without it every
> command above fails with `ERR_MODULE_NOT_FOUND` for a missing `dist/index.js`. To validate with
> no build step, use [any Draft 2020-12 library against `schemas/`](docs/VALIDATE_WITH_JSONSCHEMA.md).

> `validate` runs with `packages/cli` as its working directory — **pass an absolute path**.
> A path relative to the repo root is not found, and the document is reported invalid.

- **`@brushcodex/schema`** — the seven JSON Schemas as data (zero deps).
- **`@brushcodex/types`** — canonical TypeScript document types.
- **`@brushcodex/validator`** — Ajv (draft 2020-12) validators, conformance runner, authoring
  helpers, and reference renderer.
- **`@brushcodex/fixtures`** — the self-contained example and conformance corpus.
- **`@brushcodex/cli`** — `validate` + `conformance` commands.

Schemas reference each other by absolute `$id` (`https://brushcodex.com/schemas/...`), so any
draft-2020-12 validator that loads all seven can validate a document against its declared `spec`.
For a worked example in another language, see
[docs/VALIDATE_WITH_JSONSCHEMA.md](docs/VALIDATE_WITH_JSONSCHEMA.md) — validating from Python with
only the published schemas, no `@brushcodex/*` packages.

To check a third-party implementation, validate every `examples/<spec>/v1/*.valid.json`
(expect accept) and every `examples/<spec>/v1/invalid/*.json` (expect reject, for the reason
in `EXPECTATIONS.json`). See [conformance/README.md](conformance/README.md).

## Packed release gate

Passing the source-repository tests is **not** sufficient to trust the packages. External
consumers install **packed tarballs**, not this checkout, so package-boundary defects
(repo-relative imports, missing runtime deps, wrong `exports`, leaked `workspace:` protocols,
corpus omissions, broken CLI bins) are invisible to in-repo tests. One committed command proves
all five packages work from packed artifacts in a clean, isolated, **source-absent** consumer:

```bash
pnpm verify:packed        # build → pack → install tarballs in a throwaway npm project → verify
pnpm test:gate            # fast unit tests for the gate's own assertion logic
```

`verify:packed` builds from zero, packs with pnpm (rewriting `workspace:*`), installs only the
tarballs into a fresh project **outside the repo** (a path containing a space) with npm, then runs
schema/types/validator/fixtures/CLI checks under plain Node ESM and via the installed `.bin`
shims — including a pass with `examples/`, `packages/*/dist`, and the tarballs renamed away, to
prove the installed packages need no source checkout. It runs in CI on Linux and Windows
([.github/workflows/quality.yml](.github/workflows/quality.yml)) and
**never publishes**. See [docs/RELEASING.md](docs/RELEASING.md).

> **Required before** any package version change, tag, publish, release, or package-boundary
> refactor. **No `@brushcodex/*` package is currently published** to any registry.

## Licensing

Multiple licenses apply by path (see [docs/LICENSING.md](docs/LICENSING.md), decided and
applied by the maintainer 2026-07-15):

| Path | License |
|---|---|
| `specs/**`, `schemas/**` | Apache-2.0 (`LICENSES/LICENSE-APACHE-2.0.txt`, `NOTICE`) |
| `examples/**`, `conformance/**` | CC0-1.0 (`LICENSES/LICENSE-CC0-1.0.txt`) |
| `packages/**` (schema/validator/types/cli/fixtures) | Apache-2.0 |

Per-directory `LICENSE` files inside `specs/`, `schemas/`, `examples/`, and `conformance/`
state the applicable license for that subtree. "BrushCodex" and logos are trademarks and are
**not** granted by any code/spec license.

## Provenance

This public repository starts from a reviewed `0.9.0-draft` snapshot and is the canonical source
for the Standard going forward. **Since 2026-08-10 the Standard is developed here, in the open** —
branches and pull requests happen in this repository, and releases are ordinary tags on `main`.
Earlier development history remains preserved privately, because it carries a personal email
address; it is not required to use or implement the formats, and the published tree has been
verified byte-identical to it. See [PROVENANCE.md](PROVENANCE.md).

## Contributing

Read [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md) first. In short: a core
field must have a concrete consumer that cannot work without it; representable-but-unstructured
is not automatically a gap; sibling specs may already own the concept; every change ships with
complete conformance fixtures and a backward-compatibility assessment.

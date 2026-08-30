# Repository layout and folder intent

Orientation for this repository: what each directory is *for*, whether it is binding on
implementers, whether it ships to consumers, and where a given change belongs.

This is an **informative** document. It describes the repository; it does not define the
formats. Normative meaning lives only in `specs/` and `schemas/` (see
[§ Normative vs informative](#normative-vs-informative)).

## The one distinction that matters

Two different things live here and are easy to confuse:

| | The standard | The toolkit |
|---|---|---|
| **What** | The formats themselves | Software that reads/writes/checks them |
| **Where** | `specs/` + `schemas/` | `packages/` (`@brushcodex/*`) |
| **Binding?** | Yes — normative | No — a reference implementation |
| **If it disappeared** | The standard is gone | The standard still stands; someone rewrites the tools |

A third party can implement the standard from `specs/` + `schemas/` alone and prove it with
`examples/` + `conformance/`, never installing a single `@brushcodex/*` package. That is the
point of the split. `packages/` exists to prove the specs are implementable and to save
consumers the work — not to define anything.

## Directory map

| Path | What it holds | Normative | Ships to consumers | Generated |
|---|---|:---:|:---:|:---:|
| [`specs/`](specs/) | Human-readable specification text, RFC 2119 keywords, one `README.md` per spec version | **Yes** | via repo/tarball of the repo | No |
| [`schemas/`](schemas/) | Versioned JSON Schemas (draft 2020-12), one per spec version | **Yes** | via `@brushcodex/schema` | No |
| [`examples/`](examples/) | The corpus: `*.valid.json`, `invalid/*.json`, `invalid/EXPECTATIONS.json` | No | via `@brushcodex/fixtures` | No |
| [`conformance/`](conformance/) | How to check an implementation against the corpus | No | Docs only | No |
| [`registry/`](registry/) | The open paint-identity registry: a versioned, unauthenticated projection mapping BrushCodex paint identifiers to the minimum identity record. Identity only — no colour, provenance or catalogue data. **Generated in a private repository and committed here**, which is why its gate runs here too | No | Yes — fetched directly over HTTP | **Yes** |
| [`migrations/`](migrations/) | Deterministic major-version migrations — **placeholder, none exist yet** | No | Not yet | No |
| [`packages/`](packages/) | The app-independent toolkit: `schema`, `validator`, `types`, `cli`, `fixtures` | No | **Yes** — this is the shipping surface | Partly |
| [`scripts/`](scripts/) | Repo tooling: the packed release gate `verify-packed.mjs`, the prose↔schema consistency check `check-consistency.mjs`, and the published-registry gate `check-public-registry.mjs` | No | No | No |
| [`docs/`](docs/) | Policy: extensions, licensing, data policy, releasing | No | No | No |
| [`experiments/`](experiments/) | Time-boxed spikes testing a proposal before it is proposed. Informative and disposable; outside the conformance corpus | No | No | No |
| [`LICENSES/`](LICENSES/) | Canonical license texts referenced by the per-path `LICENSE` files | No | Yes (vendored) | No |
| `artifacts/` | Locally packed tarballs from `verify:packed`. **Empty and git-ignored by design** | No | No | **Yes** |
| `node_modules/`, `packages/*/dist/`, `packages/fixtures/corpus/`, `packages/schema/generated/` | Build output and installs | No | `dist/` ships inside tarballs | **Yes** |

Root policy documents, all normative for *contributors* rather than for document formats:
[`VERSIONING.md`](VERSIONING.md) (compatibility rules), [`GOVERNANCE.md`](GOVERNANCE.md) (how
gaps are validated), [`CONTRIBUTING.md`](CONTRIBUTING.md), [`AGENTS.md`](AGENTS.md) (the hard
rules for changing the standard), [`PROVENANCE.md`](PROVENANCE.md) (where this material was
extracted from), [`CHANGELOG.md`](CHANGELOG.md).

## Normative vs informative

- **Normative** (binding): the prose in each `specs/**/README.md` **and** the corresponding
  versioned JSON Schema.
- **Informative**: everything else — `examples/`, `conformance/`, `packages/`, this file, and
  any note marked _informative_.

If prose and schema disagree, that is a **defect to fix**, not an implementer's choice.

## The folders in detail

### `specs/` — what the format means

One directory per spec, one per version: `specs/<spec>/v<N>/README.md`. Seven specs, all
**Draft v1**: `common` (the envelope every document carries), `recipe`, `palette`, `inventory`,
`project`, `technique`, `bundle` (the `.brushcodex.zip` manifest).

Draft text may change incompatibly. Once a version is frozen it is immutable — corrections ship
as `v<N+1>`.

### `schemas/` — what a validator enforces

`schemas/<spec>/v<N>/<spec>.schema.json`, draft 2020-12. Schemas reference each other by
absolute `$id` (`https://brushcodex.com/schemas/...`), so any conforming validator that loads
all seven can validate a document against its declared `spec`.

**This directory is the single source of truth.** `packages/schema/generated/` is produced from
it at build time; never hand-edit the copy.

### `examples/` — the shared proof

`examples/<spec>/v1/` holds:

- `*.valid.json` — MUST validate.
- `invalid/*.json` — MUST be rejected. Each is validated against the spec named by its
  *directory*, so a fixture that deliberately declares the wrong `spec` still counts as invalid.
- `invalid/EXPECTATIONS.json` — the exact constraint each invalid fixture violates.

Current corpus: **99 cases — 22 valid, 77 invalid**, across 7 specs (measured 2026-08-28).

| Spec | valid | invalid |
|---|---:|---:|
| `common` | 2 | 10 |
| `recipe` | 8 | 23 |
| `palette` | 4 | 9 |
| `inventory` | 2 | 9 |
| `project` | 2 | 10 |
| `technique` | 2 | 8 |
| `bundle` | 2 | 8 |

### `conformance/` — how an outsider checks themselves

Documentation, not code: validate every `*.valid.json` (expect accept) and every
`invalid/*.json` (expect reject, for the stated reason). The runner itself lives in
`@brushcodex/validator`; the corpus is installable as `@brushcodex/fixtures` so a third party
never has to clone this repository.

### `migrations/` — deliberately empty

No migrations exist. Every spec is Draft v1 and nothing has been frozen, so there is no released
major line to migrate from. The first breaking transition adds the first migration, which must
be deterministic, must emit a machine-readable loss report, and must be pinned by golden
fixtures.

> Note: `@brushcodex/validator/migrate` is **not** this. It graduates stranded `extensions` data
> into core members it later became — an in-version helper, not a major-version migration.

### `experiments/` — spikes, before anything is proposed

A capability that might one day earn a core field is prototyped here first, as a namespaced
extension plus a handful of documents and an executable proof. Nothing in `experiments/` is
normative, none of it is referenced by `specs/`/`schemas/`, none of it is in the conformance corpus
or `@brushcodex/fixtures`, and all of it can be deleted in one commit — which matters, because a
spike may honestly conclude *reject*, and a rejected idea must not have grown the corpus that third
parties validate against in the meantime.

An experiment may be exercised by a `*.experiment.test.ts` in `packages/validator/src/**`; test
files are excluded from the build, so an experiment ships nothing. Details and the current list:
[`experiments/README.md`](experiments/README.md).

### `packages/` — the toolkit (the "SDK")

Five packages, versioned in lockstep at `1.0.0-rc.1`, all **private — none is published to any
registry**.

| Package | Role |
|---|---|
| `@brushcodex/schema` | The seven schemas as data. Zero dependencies. Generated from `schemas/` |
| `@brushcodex/validator` | The engine: Ajv 2020-12 + Zod reference models, conformance runner, reference HTML renderer, extension-graduation helper, authoring helpers. Subpath exports per spec and per concern |
| `@brushcodex/types` | Canonical TypeScript types, re-exported from the validator's model |
| `@brushcodex/cli` | `brushcodex-validate` and `brushcodex-conformance` bins |
| `@brushcodex/fixtures` | The corpus plus a stable manifest and Node loaders, shipped in-package |

Dependency direction: `schema → validator → {types, cli, fixtures}`, with `cli → fixtures` at
runtime so the packed CLI can run conformance with no source checkout. Details and the build
graph: [`packages/README.md`](packages/README.md).

### `scripts/` — the release gate

`verify-packed.mjs` builds, packs, installs the tarballs into a throwaway npm project **outside
this repo**, and re-runs the checks with the source renamed away. It catches package-boundary
defects that in-repo tests structurally cannot see: repo-relative imports, missing runtime deps,
wrong `exports`, leaked `workspace:` protocols, corpus omissions, broken bins. It never
publishes.

`check-consistency.mjs` asserts that every enum value and property name in each schema is
documented in the spec prose — the two normative surfaces are both binding, so a member the
schema defines but the prose never names (or vice versa) is a defect. Most valuable **right
before a freeze**, which makes any such gap permanent. It does not check semantic rules or the
reverse direction; those bounds are stated in `scripts/lib/consistency.mjs`.

## Where does my change go?

| I want to… | Touch |
|---|---|
| Change what a field *means* | `specs/<spec>/v1/README.md` **and** `schemas/<spec>/v1/*.schema.json` — always both; then `pnpm check:consistency` |
| Add or tighten a constraint | Both of the above **plus** an `invalid/` fixture and its `EXPECTATIONS.json` entry |
| Add a new optional field | Both, plus a `*.valid.json` that exercises it |
| Fix a validator bug | `packages/validator/` only — if the schema was right, the spec does not change |
| Change how documents render | `packages/validator/src/render/` — presentation is not normative |
| Change how documents are *built* | `packages/validator/src/authoring/` — envelope minting and revision rules |
| Add a CLI flag | `packages/cli/` |
| Record a policy decision | `docs/` (extensions, licensing, data policy, releasing) or the relevant root `*.md` |
| Store application state, catalogue data, or model prompts | **Not in this repository** — see [`AGENTS.md`](AGENTS.md) § "Never here" |

Before adding any **core** field, [`AGENTS.md`](AGENTS.md) requires: a named concrete consumer
that cannot work without it, a check that no sibling spec already owns the concept, complete
conformance fixtures, and a backward-compatibility assessment against
[`VERSIONING.md`](VERSIONING.md). Representable-but-unstructured is not automatically a gap.

## What never lives here

Application code (auth, databases, hosted APIs, UI, deployment), affiliate/analytics/search/
accounts, private or enriched catalogue data, measured colors, substitution algorithms, retailer
maps, and Creator Assistant internals (transcription, extraction, prompts, model orchestration,
private evaluation data).

The dependency rule is one-directional and absolute: **this repository depends on nothing else in
the workspace.** Consumers depend on the standard, never the reverse.

## Commands

```bash
pnpm install
pnpm -r build       # topological: schema -> validator -> {types, fixtures} -> cli
pnpm -r typecheck
pnpm -r test
pnpm conformance    # validate the whole corpus (99/99); exit 1 on any mismatch
pnpm check:consistency   # assert every schema enum value + property is documented in the prose
pnpm --filter @brushcodex/cli validate <absolute-file>   # one document or .brushcodex.zip
```

> `validate` runs with `packages/cli` as its working directory. **Pass an absolute path** — a
> path relative to the repo root resolves to nothing and the document is reported invalid
> (`0/1 valid.`). The installed `brushcodex-validate` bin resolves paths normally.

Before any package version change, tag, publish, release, or package-boundary refactor:

```bash
pnpm verify:packed  # build -> pack -> install tarballs in an isolated, source-absent consumer
pnpm test:gate      # unit tests for the gate's own assertion logic
```

Passing `pnpm -r test` is **not** sufficient to trust the packages. See
[`docs/RELEASING.md`](docs/RELEASING.md).

## Licensing by path

| Path | License |
|---|---|
| `specs/**`, `schemas/**`, `packages/**` | Apache-2.0 |
| `examples/**`, `conformance/**` | CC0-1.0 |

Per-directory `LICENSE` files state the applicable license for each subtree. "BrushCodex" and
its logos are trademarks and are not granted by any code or spec license. See
[`docs/LICENSING.md`](docs/LICENSING.md).

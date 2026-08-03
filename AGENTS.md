# AGENTS.md — brushcodex-standard

Read this first. This repository is the **canonical, application-independent** home of the
BrushCodex open standard. It is the canonical, upstream repository of a multi-repository
project: the standard depends on nothing else, and the other repositories (a reference web
application and downstream datasets) consume it.

## What lives here (and what must never)

**Here:** normative spec text (`specs/`), JSON Schemas (`schemas/`), the example/conformance
corpus (`examples/`, `conformance/`), versioning/governance/licensing docs, and the
app-independent validator/types/CLI (`packages/`). Per-directory intent, and where a given
change belongs, is mapped in [LAYOUT.md](LAYOUT.md).

**Never here:**
- authentication, databases, hosted API code, application UI, deployment/hosting config;
- affiliate systems, analytics, search, accounts;
- private/enriched catalogue data, measured colors, substitution algorithms, retailer maps;
- Creator Assistant implementation: transcription, extraction, prompts, model orchestration,
  private evaluation/blind-gold data.

## Dependency direction (hard rule)

```text
brushcodex-standard  →  (brushcodex-community, brushcodex-creator-assistant, catalogue)
```

The standard depends on **nothing** in this workspace. It must never import the website,
Creator Assistant, a database schema, a private catalogue, or a hosted API. Consumers depend
on the standard, never the reverse.

## Rules for changing the standard

1. **Representable-but-unstructured is not automatically a core gap.** If the information
   already fits existing prose/`extensions`/a sibling spec, that is not a reason to add a core
   field. (The recipe-schema gap research applies this gate explicitly.)
2. **Every core field requires a named concrete consumer** — a specific operation that cannot
   work on the current representation (e.g. "shopping-list generation cannot parse tools out of
   free-text `instruction`"). No consumer, no core field.
3. **Consider sibling ownership first.** A concept may already belong to `palette`, `project`,
   `technique`, or the `common` envelope. Do not duplicate it into another spec.
4. **App-specific requirements are not standard requirements.** They belong in the application,
   the database, or namespaced `extensions` — never in core just because one implementation
   wants them.
5. **Complete conformance fixtures are required** with every change: at least one
   `*.valid.json` exercising the new/changed member and, for every new constraint, an
   `invalid/*.json` plus its `invalid/EXPECTATIONS.json` entry. Positive examples MUST validate;
   negative examples MUST fail for the intended reason.
5a. **Prose and schema must agree.** A member the schema defines but the prose never documents
   (or vice versa) is a defect, not an implementer's choice. Run `pnpm check:consistency` after
   any change to `specs/**` or `schemas/**`; it asserts every enum value and property name is
   documented in the prose.
6. **Assess backward compatibility** against [VERSIONING.md](VERSIONING.md). New optional
   members / open-vocabulary additions are minor; new required members / removals / tightened
   constraints are major and need a migration note (and tool where practical).
7. **Draft schemas** may change in place; **frozen** schemas are immutable — corrections ship
   as a new version directory (`schemas/<spec>/vN+1/`).
8. **No private commercial data. No relicensing.** Keep the applied per-path licenses
   ([docs/LICENSING.md](docs/LICENSING.md)); ship license files when vendoring.

## Cross-repository changes

The standard is upstream of every consumer, so change it **here first**: update the spec prose
and schema, add conformance fixtures, then update the validator/types/CLI in `packages/`. Only
after the standard is green do downstream consumers (the reference web application, any dataset)
adopt the change. Test each repository independently and commit per repository; a cross-repo
change is not "done" while any required consumer is still broken.

## Working commands (current)

The app-independent toolkit now lives in `packages/` (pnpm workspace); this repo self-hosts build,
test, and conformance with no web application:

```bash
pnpm install
pnpm -r build             # topological: schema -> validator -> {types, fixtures} -> cli
pnpm -r typecheck
pnpm -r test              # @brushcodex/schema + validator + fixtures + cli suites
pnpm conformance          # validate the whole corpus (92/92); exit 1 on any mismatch
pnpm check:consistency    # assert every schema enum value + property is documented in the prose
pnpm --filter @brushcodex/cli validate <absolute-file>   # one document / .brushcodex.zip
```

`validate` runs with `packages/cli` as its cwd — pass an **absolute** path, or a repo-relative
path silently resolves to nothing and the document is reported invalid.

**Before any package version change, tag, publish, release, or package-boundary refactor**, run the
packed release gate — source tests alone do not prove the published packages work:

```bash
pnpm verify:packed        # build -> pack -> install tarballs in an isolated, source-absent consumer
pnpm test:gate            # unit tests for the gate's own assertion logic
```

The gate never publishes; no `@brushcodex/*` package is published. See
[docs/RELEASING.md](docs/RELEASING.md).

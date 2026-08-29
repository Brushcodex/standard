# Contributing to brushcodex-standard

Thank you for helping build a portable, implementation-neutral standard. Please read
[AGENTS.md](AGENTS.md) and [GOVERNANCE.md](GOVERNANCE.md) first — they define what belongs in
the standard and how a core field earns its place — and follow our
[Code of Conduct](CODE_OF_CONDUCT.md).

## Before you propose a change

Ask, in order:

1. **Is it already representable?** In existing prose, in namespaced `extensions`, or in a
   sibling spec (`common`, `recipe`, `palette`, `inventory`, `project`, `technique`, `bundle`)?
   If yes, it is not a core gap.
2. **Who is the concrete consumer?** Name a specific operation that cannot work on today's
   representation. No consumer → not core.
3. **What is the smallest viable shape?** Prefer optional, backward-compatible additions.

## What every change must include

- **Spec prose** update in `specs/<spec>/v1/README.md` (RFC 2119 keywords where normative).
- **Schema** update in `schemas/<spec>/v1/<spec>.schema.json` (draft 2020-12).
- **Conformance fixtures**: at least one `examples/<spec>/v1/*.valid.json` exercising the change
  and, for every new constraint, an `examples/<spec>/v1/invalid/*.json` plus its entry in
  `invalid/EXPECTATIONS.json`.
- **Compatibility classification** per [VERSIONING.md](VERSIONING.md) (patch / minor / major).

## Conformance

Every `*.valid.json` MUST validate; every `invalid/*.json` MUST be rejected for the reason in
`EXPECTATIONS.json`. The toolkit now lives in [`packages/`](packages/README.md) and runs conformance
here, with no web application:

```bash
pnpm -r build && pnpm -r test    # build + unit/integration suites
pnpm conformance                 # validate the whole corpus (99/99)
pnpm check:consistency           # prose and schema agree (enum values + property names)
pnpm --filter @brushcodex/cli validate /absolute/path/to/document.json
```

`check:consistency` enforces the rule stated at the top of every spec: the prose and the schema
are **both** normative, so a member defined in one but absent from the other is a defect. Run it
whenever you touch `specs/**` or `schemas/**` — and especially before a freeze, which makes any
gap permanent.

> `validate` runs with `packages/cli` as its working directory, so **pass an absolute path**;
> a path relative to the repo root will not be found and the file is reported as invalid.

## Changing the packages

If your change touches `packages/**` — code, `exports`, `files`, `bin`, or the dependency graph —
run the **packed release gate** as well; source tests alone do not prove distributable package
artifacts work:

```bash
pnpm verify:packed   # build → pack → install tarballs in an isolated, source-absent consumer
pnpm test:gate       # unit tests for the gate's own logic
```

It is **required before any package version change, tag, publish, release, or package-boundary
refactor** and never publishes. See [docs/RELEASING.md](docs/RELEASING.md).

## Style

- Schemas: draft 2020-12, absolute `$id` under `https://brushcodex.com/schemas/...`,
  `unevaluatedProperties: false` on closed objects, namespaced `extensions` for open data.
- Prose: Markdown, LF line endings (`.gitattributes`), RFC 2119 keywords capitalized.
- Do not relicense; do not add application- or extraction-specific fields to core.

## What does not belong here

Application code, databases, auth, UI, deployment, private catalogue data, and Creator
Assistant / extraction logic. Those live in their own repositories, downstream of this one.

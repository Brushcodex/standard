# BrushCodex Conformance Corpus

This directory documents the **conformance corpus** — the set of example documents
under [`../examples`](../examples) that every BrushCodex implementation should agree
on — and the standalone tools that run against it.

The corpus and tools run **without** the reference web application. They depend only
on `@brushcodex/validator` (the reference validators), so they demonstrate that the
formats can be validated by an independent consumer. The corpus is also published as a
self-contained package, `@brushcodex/fixtures` (a stable manifest + Node loaders + the
corpus files), so a third party can install it and run conformance without cloning this
repository — see [`../packages/fixtures`](../packages/fixtures).

## The corpus

For each specification, `examples/<spec>/v1/` contains:

- `*.valid.json` — documents that MUST validate against `<spec>`.
- `invalid/*.json` — documents that MUST be rejected as `<spec>` (each is validated
  against the specification named by its **directory**, so a fixture that
  deliberately declares the wrong `spec` still counts as invalid).
- `invalid/EXPECTATIONS.json` — for each invalid fixture, the exact constraint it
  violates (used by the per-spec conformance tests).

Specifications covered: `common`, `recipe`, `palette`, `technique`, `inventory`,
`project`, and the `bundle` manifest.

## Running conformance

```bash
pnpm conformance          # validate the whole corpus; exit 1 on any mismatch
pnpm conformance --json   # machine-readable report
```

The runner (`@brushcodex/cli` → `runConformance` from `@brushcodex/validator`)
validates every `*.valid.json` (expecting acceptance) and every `invalid/*.json`
(expecting rejection) and prints a per-spec tally plus a pass/fail summary. It is also
exercised by the package tests (`@brushcodex/validator` and `@brushcodex/fixtures`).

## Validating your own files

```bash
pnpm --filter @brushcodex/cli validate /abs/path/my.brushrecipe.json
pnpm --filter @brushcodex/cli validate --json /abs/a.brushpalette.json /abs/a.brushcodex.zip
```

> Run from this repo, `validate` uses `packages/cli` as its working directory, so **pass
> absolute paths**. The installed `brushcodex-validate` bin has no such caveat — it resolves
> relative to wherever you invoke it.

The `validate` bin (`@brushcodex/cli`, installed as `brushcodex-validate`) detects a
document's `spec` and validates it, and reads/validates `.zip` bundles with the safe
archive reader. Exit code: `0` when every input is valid, `1` when any is invalid.

## For third-party implementers

To check a **different** implementation against the corpus, validate every
`*.valid.json` with your validator (expect accept) and every `invalid/*.json` (expect
reject). Round-trip tools should additionally confirm that `parse → serialize → parse`
preserves every supported member and unknown namespaced extensions. A conformant
reader of `.brushcodex.zip` bundles MUST enforce the safe-archive rules in
[`../specs/bundle/v1/README.md`](../specs/bundle/v1/README.md) §5.

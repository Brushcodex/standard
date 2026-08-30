# @brushcodex/cli

Command-line tools for the BrushCodex open standard — no web application. The two bins prove the
formats can be validated by an independent consumer:

- **`brushcodex-validate`** — validate documents / `.brushcodex.zip` bundles against the specs.
- **`brushcodex-conformance`** — run the whole canonical conformance corpus.

```bash
# Validate user documents and/or .brushcodex.zip bundles:
pnpm --filter @brushcodex/cli validate my.brushrecipe.json
pnpm --filter @brushcodex/cli validate --json a.brushrecipe.json a.brushcodex.zip

# Run the whole conformance corpus (loaded from @brushcodex/fixtures):
pnpm --filter @brushcodex/cli conformance
pnpm --filter @brushcodex/cli conformance -- --json
```

## Behavior & exit codes

- `validate` — reads only the file paths you pass. `0` all valid · `1` any invalid · `2` usage error.
  Default output is one `OK`/`FAIL` line per file plus an `N/M valid.` summary. `--json` prints an
  array of `{ file, kind, spec, valid, issues[], documents?, media? }`, one object per input, where
  each `issues[]` entry is `{ path, code, message, layer }`: `path` is a JSON Pointer to the
  offending location (`""` for file-level problems), `code` is an Ajv keyword, a semantic-rule id, or
  a CLI code (`unreadable`, `not-json`, `bundle-unreadable`), and `layer` is
  `schema | semantic | syntax | archive | io`.
  A valid document has `issues: []`; a valid bundle also reports `documents` and `media` counts.
- `conformance` — validates every `*.valid.json` (expect accept) and every `invalid/*.json` (expect
  reject) across the 7 specs. Prints a per-spec tally (`recipe 23/23`, one line per spec) followed by
  `Conformance: <passed>/<total> cases passed across N specifications.`; `--json` prints the full
  `{ total, passed, failed, bySpec[], cases[] }` report, where `bySpec[]` is the per-spec
  `{ spec, total, passed, failed }` aggregate. Failing
  cases print `FAIL <spec> <file>: expected … got …` to stderr. `0` when the corpus matches
  expectations, `1` otherwise. Ordinary conformance failures do **not** print a stack trace.

## Self-contained: no source checkout needed

`conformance` loads the corpus through **`@brushcodex/fixtures`** (its shipped `examplesRoot`), a
runtime dependency — not the repository. The CLI bundles `@brushcodex/validator` (and
`@brushcodex/schema`) at build time and keeps `@brushcodex/fixtures` external, so the installed
package resolves the corpus from `node_modules/@brushcodex/fixtures/corpus/**`. The packed CLI runs
`99/99` from any working directory, with **no repo-relative path** and even with the source repo
absent. (Historically `conformance` read the repo-root `examples/` via `../../../examples`, which
broke once packed; that is fixed.)

## Dependency graph

```text
@brushcodex/schema ─► @brushcodex/validator  ──(bundled into the bins)──► @brushcodex/cli
                                    │                                          ▲
                                    └──(dev only)──► @brushcodex/fixtures ──────┘  (runtime dep;
                                                     ships the corpus)             external, not bundled
```

## Local pack workflow (unpublished)

```bash
pnpm -r build
(cd packages/cli && pnpm pack --pack-destination ../../artifacts/local-packages)
# also pack @brushcodex/fixtures; an external install needs both tarballs (a pnpm override maps the
# CLI's transitive @brushcodex/fixtures to the fixtures tarball — see the workspace docs).
```

**Status:** `1.0.0-rc.2`, `private` — **not published** to any registry. License: Apache-2.0.

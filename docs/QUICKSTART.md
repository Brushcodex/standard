# Quickstart — validate your first BrushCodex document in 5 minutes

**New here?** This is the shortest path from "what is this?" to a document you authored and
proved valid, using only this repository — no account, no server, no BrushCodex service.

## What BrushCodex is

BrushCodex is an **open, implementation-neutral family of versioned specifications** for
portable miniature-painting knowledge. A BrushCodex *document* is a plain JSON file that
declares which specification it follows and carries a small shared envelope (identity,
versioning, provenance, licensing). There are seven document types:

| `spec` | What it captures |
|---|---|
| `recipe` | A Painting Workflow — an ordered plan, reusable process, or as-painted record |
| `palette` | A named set of paints and mixes |
| `inventory` | Paints you own, with quantities and condition |
| `project` | A painting project — subjects, journal, progress |
| `technique` | A reusable technique (drybrush, glaze, …) |
| `bundle` | A manifest that packages the documents above |
| `common` | The shared envelope every document embeds |

Documents are just files. They never require a central registry and stay valid when no
BrushCodex service is running. The specifications live in [`../specs`](../specs) (normative
prose) and [`../schemas`](../schemas) (the matching JSON Schemas); everything below is
*informative* convenience over them.

## Prerequisites

- **Node.js ≥ 20.11** and **pnpm** (`npm install -g pnpm`).
- This repository, checked out locally.

```bash
pnpm install     # from the repo root — installs the reference toolkit
```

## Step 1 — Author a minimal document

A minimal document needs the envelope (`spec`, `specVersion`, `id`, `revision`) plus the one
or two members its type requires. For a Painting Workflow (technical spec name `recipe`), that is
a `title` and at least one step.
Save this as `hello.brushrecipe.json` **anywhere on disk**:

```json
{
  "spec": "recipe",
  "specVersion": "1.0.0",
  "id": "urn:uuid:a1b2c3d4-e5f6-4712-8901-234567890abc",
  "revision": "rev-1",
  "title": "Quick black basecoat",
  "steps": [{ "instruction": "Prime black, then basecoat the whole model with two thin coats." }]
}
```

That is the whole document. What each envelope member means:

- **`spec`** — which specification this file follows. Selects the schema it is checked against.
- **`specVersion`** — the spec version; every spec here is Draft `1.0.0`.
- **`id`** — a URI that identifies the document. `urn:uuid:<uuid>` needs no registry and is the
  default the toolkit mints for you (see [Step 4](#step-4--go-further)).
- **`revision`** — an opaque token for this state of the document. Any string; editing the
  document later MUST change it (see [`../specs/common/v1/README.md`](../specs/common/v1/README.md) §4).

The same shape works for every type — this file is a copy of
[`../examples/recipe/v1/minimal.valid.json`](../examples/recipe/v1/minimal.valid.json). Each
spec ships its own `examples/<spec>/v1/minimal.valid.json` you can start from.

## Step 2 — Validate it

The CLI validates one document (or a `.brushcodex.zip` bundle) against the spec it declares:

```bash
pnpm --filter @brushcodex/cli validate /absolute/path/to/hello.brushrecipe.json
```

> **Pass an absolute path.** `validate` runs with `packages/cli` as its working directory, so a
> path relative to the repo root is not found. Use the file's full path.

You get one `OK`/`FAIL` line per file and a summary; exit code `0` means every file is valid:

```text
OK    recipe  /absolute/path/to/hello.brushrecipe.json

1/1 valid.
```

Add `--json` for machine-readable output — an array of one object per input file:

```json
[
  {
    "file": "/absolute/path/to/hello.brushrecipe.json",
    "kind": "document",
    "spec": "recipe",
    "valid": true,
    "issues": []
  }
]
```

## Step 3 — See what "invalid" looks like

Validation earns its keep by catching mistakes. Delete the `steps` line from the file and
validate again:

```text
FAIL  recipe  /absolute/path/to/broken.brushrecipe.json
        - (root) must have required property 'steps' (steps)

0/1 valid.
```

Exit code is now `1`. With `--json`, the same problem appears as a structured issue you can act
on — a JSON Pointer `path` to the offending location, an Ajv/semantic `code`, a `message`, and a
`layer` (`schema | semantic | syntax | archive | io`):

```json
{ "path": "", "code": "required", "message": "(root) must have required property 'steps' (steps)", "layer": "schema" }
```

That is the whole loop: **author → validate → read the issue → fix → re-validate.**

## Step 4 — Go further

You have authored and validated a document. The rest of the on-ramp:

- **Understand the shape** — [LAYOUT.md](../LAYOUT.md) maps every directory; each
  [`../specs/<spec>/v1/README.md`](../specs) is the normative definition of one type.
- **Understand Painting Workflows** — [Painting Workflows](PAINTING_WORKFLOWS.md) explains reusable,
  planned, recorded, derived, and tutorial-presented uses of the `recipe` document.
- **Author every type, valid by construction** — the [Authoring cookbook](AUTHORING.md) builds a
  valid document of each type with the `@brushcodex/validator/authoring` helpers, which mint the
  envelope for you and refuse to return an invalid document.
- **Validate without the toolkit** — any Draft 2020-12 JSON Schema validator works from the
  published schemas alone. Worked example in Python:
  [VALIDATE_WITH_JSONSCHEMA.md](VALIDATE_WITH_JSONSCHEMA.md).
- **Check a whole implementation** — run the full corpus with
  `pnpm --filter @brushcodex/cli conformance` (92/92), or point your own validator at the
  fixtures: [conformance/README.md](../conformance/README.md).
- **Extend a document** — carry data the core does not model in namespaced `extensions`:
  [EXTENSIONS.md](EXTENSIONS.md).

See a realistic, complete document for every type in the
[Worked examples](EXAMPLES.md) catalogue.

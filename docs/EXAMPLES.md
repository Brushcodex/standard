# Worked examples — a complete, valid document of every type

The [Quickstart](QUICKSTART.md) starts from the *minimal* document; this page points at the
*comprehensive* one for each type — a realistic document that exercises the full vocabulary of its
specification. Every file here is part of the conformance corpus, so each one **must validate**
(they are among the 99 cases `pnpm --filter @brushcodex/cli conformance` checks). They are
[CC0-1.0](../examples/LICENSE) — copy and adapt them freely.

Each type ships two or three files under `examples/<spec>/v1/`:

- `minimal.valid.json` — the smallest thing that validates (great starting point).
- `comprehensive.valid.json` — a realistic document using the whole spec.
- a few types add a variant that highlights one authoring choice (see the notes below).

## One complete document per type

| Type | Worked example | What it demonstrates |
|---|---|---|
| **recipe** (Painting Workflow) | [comprehensive](../examples/recipe/v1/comprehensive.valid.json) · [minimal](../examples/recipe/v1/minimal.valid.json) | A full workflow: `target` substrate/scale and a Painted Subject `identity`, `paints`, `resources`, `techniqueRefs`, `media` with step citations, richly-roled `steps`, plus `attribution`, `license`, `difficulty`, timing and `dryingNotes`. |
| **palette** | [comprehensive](../examples/palette/v1/comprehensive.valid.json) · [minimal](../examples/palette/v1/minimal.valid.json) | A palette with `intent` and a class-level `target` (no `identity` — a broad target is first-class), entries carrying paint identity and roles, and `relationships` between entries (mixes, substitutes). |
| **inventory** | [comprehensive](../examples/inventory/v1/comprehensive.valid.json) · [minimal](../examples/inventory/v1/minimal.valid.json) | Owned paints as `items` with quantities and condition, plus a human `summary`. |
| **project** | [comprehensive](../examples/project/v1/comprehensive.valid.json) · [minimal](../examples/project/v1/minimal.valid.json) | A painting project: `status` and `progress`, `subjects`, `recipeRefs`/`paletteRefs`, `substitutions`, a `journal`, `results`, and `toolsUsed`. |
| **technique** | [comprehensive](../examples/technique/v1/comprehensive.valid.json) · [minimal](../examples/technique/v1/minimal.valid.json) | A reusable technique: `purpose`, `tools`, `parameters`, `suitablePaintClasses`/`unsuitablePaintClasses`, `commonProblems`, `safetyNotes`, `citations`, and `variants`. |
| **bundle** | [comprehensive](../examples/bundle/v1/comprehensive.valid.json) · [minimal](../examples/bundle/v1/minimal.valid.json) | A manifest packaging several documents as `entries`, with `authors`, `license`, and `tags` on the bundle itself. |
| **common** | [comprehensive](../examples/common/v1/comprehensive.valid.json) · [minimal](../examples/common/v1/minimal.valid.json) | The shared envelope exercised on its own: `links`, `provenance`, `translations`, namespaced `extensions`, and an `integrity` seal. |

### Variants worth seeing

- **Reusable army workflow** — [recipe/v1/reusable-army-workflow.valid.json](../examples/recipe/v1/reusable-army-workflow.valid.json)
  records a repeatable scheme for many related miniatures.
- **Complex model record** — [recipe/v1/complex-model-record.valid.json](../examples/recipe/v1/complex-model-record.valid.json)
  preserves exact paints, structured ratios, mixture wording, target areas, and drying observations.
- **Tutorial-derived workflow** — [recipe/v1/tutorial-derived-workflow.valid.json](../examples/recipe/v1/tutorial-derived-workflow.valid.json)
  treats a tutorial as optional source provenance rather than as the document's defining purpose.
- **Catalogue-free recipe** — [recipe/v1/literal-paints-no-catalogue.valid.json](../examples/recipe/v1/literal-paints-no-catalogue.valid.json)
  names paints inline instead of referencing a catalogue, so a recipe is self-contained.
- **Water-thinned mixture** — [recipe/v1/water-thinned-mixture.valid.json](../examples/recipe/v1/water-thinned-mixture.valid.json)
  declares tap water as an `additive` paintRef and mixes it at an authored ratio: the blessed
  pattern for a household diluent, beside a `medium` in the same mixture.
- **Literal-only palette** — [palette/v1/literal-only.valid.json](../examples/palette/v1/literal-only.valid.json)
  does the same for a palette, with `relationships` still linking the literal entries.
- **Registry-free subject identity** — [recipe/v1/literal-subject-no-registry.valid.json](../examples/recipe/v1/literal-subject-no-registry.valid.json)
  names the exact subject with `target.identity` and **no** `subjectId`: the literal `authority`
  and `designation` are the whole identity, which is what makes it readable offline.
- **Subject-specific palette** — [palette/v1/exact-subject.valid.json](../examples/palette/v1/exact-subject.valid.json)
  carries the *same* `target.identity` as the comprehensive recipe. One `subjectId` therefore
  reaches both a Painting Workflow and a Palette, while the two human `description` strings do not
  match each other — which is the whole point of the member.

The comprehensive files also declare a `$schema` member pointing at the schema `$id`, which turns
on autocomplete and inline validation in editors like VS Code — an optional, informative
convenience the envelope allows.

## Validate any of them

They are ordinary documents. Validate one with the CLI (**absolute path** — the CLI runs with
`packages/cli` as its working directory):

```bash
pnpm --filter @brushcodex/cli validate /absolute/path/to/examples/recipe/v1/comprehensive.valid.json
```

```text
OK    recipe  …/examples/recipe/v1/comprehensive.valid.json

1/1 valid.
```

…or without the toolkit at all, using the Python path from
[VALIDATE_WITH_JSONSCHEMA.md](VALIDATE_WITH_JSONSCHEMA.md):

```bash
python validate.py examples/recipe/v1/comprehensive.valid.json   # -> valid
```

To validate the entire corpus at once, run `pnpm --filter @brushcodex/cli conformance` (99/99).

## Next steps

- **Understand a type in full** — each [`../specs/<spec>/v1/README.md`](../specs) is the normative
  definition the worked example illustrates.
- **Build your own** — the [Authoring cookbook](AUTHORING.md) constructs a valid document of each
  type with the reference helpers.
- **Extend one** — carry data the core does not model in namespaced `extensions`:
  [EXTENSIONS.md](EXTENSIONS.md).

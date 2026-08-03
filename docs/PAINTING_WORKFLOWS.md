# Painting Workflows

A BrushCodex Recipe document represents a **Painting Workflow**: an ordered, reproducible record of
paints, mixtures, materials, techniques, and actions used — or intended to be used — to paint a
subject.

`recipe` is the stable technical spec name. Painting Workflow is the broader human-facing concept;
it does not introduce a second format or change `spec: "recipe"`.

## What a workflow can be

The same document shape supports several uses:

| Use | What the workflow records |
|---|---|
| Reusable army scheme | A repeatable sequence for many related miniatures |
| Painting plan | The intended paints, mixtures, tools, and steps before work begins |
| As-painted record | What was actually done, including working mixtures and deviations preserved in prose |
| Derived workflow | A process adapted from a tutorial, class, article, demonstration, or prior workflow |
| Published guidance | A workflow rendered as instructions for another painter |

These are usage profiles, not separate document types. A workflow may begin as a plan, be revised
while it is performed, and later be published as guidance.

## How the document types work together

- A **Painting Workflow** (`recipe`) records the ordered process.
- A **Palette** records a reusable, unordered paint and colour system.
- A **Technique** records a method such as glazing or wet blending independently of one scheme.
- A **Project** records execution: subjects, progress, substitutions, journal entries, and results.
- A **Bundle** packages related documents and media for portable exchange.

An army Project can therefore reference several workflows — infantry armour, character faces,
vehicles, weapons, and bases — while each workflow remains independently reusable.

## Worked profiles

- [Reusable army workflow](../examples/recipe/v1/reusable-army-workflow.valid.json) records a stable
  scheme intended for repetition across an army.
- [Complex model record](../examples/recipe/v1/complex-model-record.valid.json) records exact paints,
  structured ratios, the painter's original mixture wording, target areas, and drying observations.
- [Tutorial-derived workflow](../examples/recipe/v1/tutorial-derived-workflow.valid.json) shows a
  tutorial as optional source provenance, including rights metadata and step citations.

All three are ordinary conformant `recipe` documents. None requires a catalogue or a BrushCodex
service.

## Planned work versus recorded work

The core intentionally does not add a `planned`, `recorded`, or `tutorial` classifier. Those
labels do not change how a paint, mixture, or step is interpreted, and one document may move through
all three uses. Authors can state important context in `summary` or `description`; revisions
preserve later edits.

A Project journal supplies execution context, but it currently cannot structurally point to an
individual workflow step or pin a workflow revision. It can record that information in `body`
prose. That is a known representational limitation, not evidence by itself for a new core field; a
future proposal needs a named consumer operation that cannot work with the present representation.

## Tutorial provenance

A tutorial is one possible source, not the definition of a workflow. When a workflow is derived
from another work:

- `media[].relation: "source"` identifies the linked source work;
- `steps[].source` may cite the precise passage used;
- the linked work's `creator`, `license`, and `rightsNote` remain separate from the workflow's
  own authors and licence;
- `attribution` can preserve a document-level credit statement.

The normative rules are in the [Recipe v1 specification](../specs/recipe/v1/README.md).

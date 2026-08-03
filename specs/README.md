# BrushCodex Open Standards

This directory holds the **normative** specification text for the BrushCodex family of
portable, implementation-neutral formats for miniature-painting knowledge. It is deliberately
separate from:

- `../schemas/` — the machine-readable JSON Schemas that formalize these specs;
- `../examples/` — informative example documents (valid and intentionally invalid);
- `../packages/` — the app-independent reference toolkit (`@brushcodex/*`).

Per-directory intent for the whole repository is mapped in [../LAYOUT.md](../LAYOUT.md).

## What is normative vs. informative

- **Normative** (binding on conformant implementations): the prose in each `specs/**/README.md`
  using RFC 2119 keywords (MUST, SHOULD, MAY) **and** the corresponding versioned JSON Schema.
- **Informative** (non-binding, for illustration): examples, the reference application's
  behavior, and any explanatory note marked _informative_.

If prose and schema ever disagree, that is a **defect** to be fixed, not a choice for an
implementer to make. The reference validator (`@brushcodex/validator`) is tested against the
example corpus to keep prose, schema, and examples honest.

## Status

All specifications here are **DRAFT** until explicitly frozen. Draft schemas MAY change in
incompatible ways. Once a specification version is frozen and released, its JSON Schema is
**immutable**; changes ship as a new version. See [../VERSIONING.md](../VERSIONING.md).

## Specifications

| Spec | Status | Location |
|---|---|---|
| Common document envelope | Draft v1 | [common/v1/](common/v1/README.md) |
| Recipe (Painting Workflow) | Draft v1 | [recipe/v1/](recipe/v1/README.md) |
| Palette | Draft v1 | [palette/v1/](palette/v1/README.md) |
| Paint inventory | Draft v1 | [inventory/v1/](inventory/v1/README.md) |
| Project | Draft v1 | [project/v1/](project/v1/README.md) |
| Technique | Draft v1 | [technique/v1/](technique/v1/README.md) |
| Bundle (`.brushcodex.zip` manifest) | Draft v1 | [bundle/v1/](bundle/v1/README.md) |

Identifiers in these formats never require a central BrushCodex registry, and documents remain
usable when no BrushCodex service is available.

# Governance

## Scope

This document governs the BrushCodex **open standard** (`specs/`, `schemas/`, `examples/`,
`conformance/`, and future `packages/`). It does not govern the reference application's
releases (those live in `brushcodex-community`).

## Decision authority

The **maintainer** freezes specifications and applies licenses. Automated loops and
contributors may *propose*; only the maintainer *decides*. Two decisions are explicitly
irreversible and reserved to the maintainer: **freezing a specification version** and
**relicensing** any path.

## Draft → freeze lifecycle

1. All specs are **DRAFT** until frozen (see [VERSIONING.md](VERSIONING.md)). Draft schemas may
   change incompatibly and are marked DRAFT in title and prose.
2. The Common envelope stays DRAFT until the specs that embed it (recipe/palette/inventory/
   project/technique) are drafted, so their needs can still shape the core.
3. On **freeze**, a version's JSON Schema becomes **immutable**; corrections ship as a new
   version directory. Released versions stay on disk so old documents keep validating.

## The gap-validation gate (how a core field earns its place)

A proposed addition is a **core** gap only if **both** hold:

1. it is genuinely unrepresentable, **or** required by a **named concrete consumer** (a
   specific operation) that cannot function on the current representation; **and**
2. it is not already owned by a sibling spec (`common`, `palette`, `project`, `technique`) or
   satisfiable by namespaced `extensions`.

Outcomes for any observation: `CORE_CANDIDATE`, `EXTENSION_CANDIDATE`, `SIBLING_OWNED`,
`AUTHORING_GUIDANCE`, `ALREADY_REPRESENTABLE`, or `INSUFFICIENT_EVIDENCE`. "Representable but
unstructured" is **not** automatically a core gap. Every promoted field must ship with a stated
consumer, a validated shape, and complete conformance fixtures. (This is the discipline used in
the reference app's recipe-schema gap research.)

## Change process

1. Open a proposal describing the concept, the concrete consumer, sibling-ownership analysis,
   and the smallest viable shape.
2. Add/adjust conformance fixtures (valid + invalid + `EXPECTATIONS.json`).
3. Update the validator/types (once `packages/` exists) so prose, schema, examples, and model
   cannot drift.
4. Classify the change under [VERSIONING.md](VERSIONING.md) (patch/minor/major) and, if major,
   provide a migration note and (where practical) a tool.
5. Maintainer review and, for freezes, an explicit decision.

## Data & rights

The example and conformance corpus in this repository is entirely **synthetic** — no scraped,
proprietary, or third-party data. Catalogue and measured-color data governance (allowed sources,
provenance, takedowns) is out of scope for the standard and belongs to the downstream dataset
that consumes it.

## Interoperability principle

> The standard contains the **portable meaning required for interoperability** — nothing more.
> Application behavior, hosting, accounts, UI state, business logic, and extraction/AI
> workflows live in their own repositories.

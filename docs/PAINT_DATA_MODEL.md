# Paint & Color Data Model

> **Informative, not normative.** This document explains *how* paint and color data is
> represented across the BrushCodex specs, and *why*. The binding rules live in the
> `common`, `palette`, `recipe`, `inventory`, and `project` schemas and their prose. A color's
> *meaning* is declared by each item's `provenance` (defined in the `common` envelope); this
> document covers the *shape* and the document↔catalogue relationship.

## The goal: adoption without a central service

A format spreads only if adopting it costs nothing. So the governing design rule is:

> **Every BrushCodex document is self-contained. It MUST stay valid and useful with no
> central catalogue, no color value, and no BrushCodex service running.**

An app can read a recipe or palette and understand every paint from the fields written
*inside the document* — no API key, no database, no network. That property is what makes the
standard adoptable: a third party can implement it in an afternoon with nothing but the schema.

At the same time, **common paints are the same for everyone.** Citadel Mephiston Red or
Vallejo Model Color 70.950 should not have to be re-described by hand in every document. So the
model also allows an **optional** link to a shared catalogue that fills in richer data once —
the "don't reinvent common paints" path — **without ever making that catalogue a requirement.**

Those two goals — self-contained *and* shared enrichment — are reconciled by a layered model.

## Three layers

| Layer | Holds | Where it lives | Required? |
|---|---|---|---|
| **1. Reference *shape*** | The fields a paint/color may carry (`paintRef`, `colorValue`) | **This standard** (`common` envelope) | — |
| **2. The paint, *inline*** | The actual paint a document uses, written literally | **Inside each document** | Always present |
| **3. The catalogue** | The master set of real paints + enriched data | **A downstream dataset — not this repo** | Never required |

Only layer 1 is the standard. Layer 2 travels with every document. Layer 3 is out of scope
here (see [What this standard does not contain](#what-this-standard-does-not-contain)).

## Layer 1 — the reference shape (`paintRef`)

`common`'s [`paintRef`](../schemas/common/v1/common.schema.json) is the single paint reference
shared by Recipe, Palette, Inventory, and Project. A reference MAY carry: `manufacturer`,
`range`, `name`, `code` (the number printed on the bottle), `kind`, `chemistry`, an inline
`color`, an optional `catalogueId`, `provenance`, and a `note`.

**The only requirement is `manufacturer` OR `name`.** Everything else is optional. That single
rule *is* the literal fallback: a paint with no catalogue entry and no color is still a valid
reference.

`color` is a `colorValue` — an sRGB `{ "hex": "#rrggbb" }`. Its *meaning* (a measured swatch, a
manufacturer digital swatch, an estimate) is never assumed from the value; it is declared by the
owning item's `provenance`.

The colour source classes are deliberately distinct, and an approximate value must never be
presented as a physical one (Common §5.3):

| `sourceType` | The claim being made |
|---|---|
| `physical_measurement` | An instrument measured a dried physical sample. |
| `manufacturer_digital_swatch` | The manufacturer published this screen colour. Approximate. |
| `community_estimate` | A person estimated it visually. Approximate. |
| `digital_approximation` | A screen approximation of derived or unstated origin. Approximate. |
| `photographed_sample` | Sampled from a photograph. Lighting-dependent. |

## Layer 2 — the paint written inline (the portable core)

Because a reference is valid from literal fields alone, the paint data a document needs lives
*in the document*. A literal-only reference — valid anywhere, zero infrastructure:

```json
{
  "manufacturer": "Citadel",
  "range": "Base",
  "name": "Mephiston Red",
  "code": "21-03",
  "color": { "hex": "#9a1115" }
}
```

Any reader understands this paint. Nothing external is consulted. This is the guaranteed floor:
**even with no catalogue in existence, every document already works.**

## Layer 3 — the optional shared catalogue (enrichment, never a gate)

When a shared catalogue exists, a document MAY add a `catalogueId` — an **OPTIONAL, opaque**
stable token or URI — so a catalogue-aware app can resolve extra data (measured color,
substitutions, availability) that is *too large or too volatile to write into every document*:

```json
{
  "manufacturer": "Citadel",
  "name": "Mephiston Red",
  "catalogueId": "brushcodex:paint:citadel/base/mephiston-red",
  "color": { "hex": "#9a1115" }
}
```

This is **progressive enhancement**:

- A simple app ignores `catalogueId` and uses the literal fields — still works.
- A catalogue-aware app follows `catalogueId` and shows enriched data — works better.
- The document is valid and useful in **both** cases.

The shared `catalogueId` namespace is also what lets two independent apps agree they are talking
about *the same* paint: a recipe authored in one app resolves to the same catalogue entry in
another. That agreement is how "a common paint is described once, not reinvented per document"
actually happens — the catalogue carries the canonical record, and documents just point at it.

`catalogueId` is an **external** identifier. An internal database primary key MUST NOT be placed
here — nor in `code`, which is strictly the manufacturer's printed product code.

## What this standard does not contain

The **catalogue itself** — the master list of real paints, ranges, measured colors, substitution
mappings, retailer/price data — is **not** part of this repository and is not governed by these
schemas. It is a downstream data concern: a separate catalogue dataset that *consumes* the
standard. (The standard depends on nothing; consumers depend on it. See
[AGENTS.md](../AGENTS.md).) Keeping the catalogue out is deliberate:

- **A spec must be stable; a catalogue is not.** Paint ranges change constantly — new releases,
  reformulations, discontinuations. Volatile data cannot live in a versioned, freezable spec.
- **The catalogue is commodity data** assembled from public sources. The standard's value is the
  portable *shape*, not the values — so the shape is what gets frozen and protected here.

The legal and provenance rules any catalogue dataset must follow (allowed color sources,
prohibited sources, corrections/takedowns) are a concern of that downstream dataset, not this
standard.

> **Status.** A baseline catalogue dataset now exists as a separate, openly licensed repository
> (`brushcodex-catalogue-data`), which issues ids in the `brushcodex:paint:…` form described in
> §5.7 of the Common spec. It remains **optional**: documents rely on layer 2 (literal
> references), and the standard is designed to *never* require layer 3. The catalogue makes
> documents richer, never valid.

## Invariants (informative summary)

- A document MUST remain valid with **literal references only** — no catalogue, no color.
- `catalogueId` is OPTIONAL, external, and opaque; never required to read or use a document.
- Internal database ids MUST NOT appear in `catalogueId` or `code`.
- A `colorValue` carries no authority on its own; `provenance` declares what it means.
- The standard never depends on a catalogue, a service, or an application.

# BrushCodex Palette — v1 (DRAFT)

- **Spec name:** `palette`
- **Version:** `1.0.0` (draft; not frozen)
- **JSON Schema:** [`schemas/palette/v1/palette.schema.json`](../../../schemas/palette/v1/palette.schema.json)
- **Media type (provisional):** `application/vnd.brushcodex.palette+json`
- **File suffix (provisional):** `.brushpalette.json`
- **Status:** DRAFT — MAY change incompatibly until frozen.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, and **MAY** are
to be interpreted as described in RFC 2119 and RFC 8174.

## 1. Purpose

A Palette is a reusable, named collection of paints, mixtures, and colors with semantic roles and
optional relationships (for example a shadow-to-highlight sequence). Unlike a Painting Workflow
(`recipe`) it is **not** an ordered process — it is a set that workflows and projects can reference
or embed.

It **embeds the Common document envelope** ([../../common/v1/README.md](../../common/v1/README.md))
by composing its `envelopeCore` fragment and closing the object with
`unevaluatedProperties: false`, so a palette carries all envelope members plus the palette-specific
members below and rejects unknown top-level members.

## 2. Envelope constraints

- `spec` **MUST** equal `palette`.
- `specVersion`, `id`, `revision`, `title` are REQUIRED (from the envelope).
- All optional envelope members behave identically to the Common spec.

## 3. Palette members

| Member | Type | Rule |
|---|---|---|
| `entries` | array of Entry (§4) | **REQUIRED**, at least one entry. |
| `summary` | string | Optional short description. |
| `intent` | string | Optional free-text aesthetic/material intent. |
| `target` | Target | Optional subject (the shared Common `target`: `kind?` + required `description` + optional `scale`/`substrate`). |
| `relationships` | array of Relationship (§5) | Optional relationships between entries. |

## 4. Entry

Each entry is a named slot. `name` is REQUIRED, and an entry **MUST** carry at least one of a
`paint`, a literal `color`, or a `mix` (an empty named slot is not permitted). Optional members:

- `ref` — a document-local anchor that mixtures and relationships point to.
- `role` — the coarse grouping vocabulary shared with Recipe (Common `role`): `primer`, `basecoat`,
  `undercoat`, `shadow`, `midtone`, `layer`, `highlight`, `edge_highlight`, `spot_highlight`, `wash`,
  `glaze`, `drybrush`, `weathering`, `metallic`, `texture`, `decal`, `varnish`, `other`.
- `paint` — a PaintRef (§6).
- `color` — a literal `{ hex }` sRGB value; its meaning is defined by `provenance`.
- `mix` — a mixture of **two or more** entries, each `{ paint (anchor), parts (> 0) }`. `parts`
  are author-provided ratios, relative within the one mixture.
- `provenance` — Common provenance entries for digital color data on this entry.
- `note`.

## 5. Relationship

An ordered or grouped association between entries. `type` (one of `shadow_to_highlight`,
`analogous`, `complementary`, `triadic`, `custom`) and `sequence` (**two or more** anchors into
`entries[].ref`) are REQUIRED; `note` is optional.

## 6. PaintRef — literal references are first-class

A palette **MUST** be valid using purely literal paint references, with **no** central catalogue
entry and **no** color value. A PaintRef MUST include at least one of `manufacturer` or `name`;
`range`, `code`, `catalogueId` (an OPTIONAL external identifier, never a BrushCodex internal
database id), `color` (`{ hex }`), `provenance`, and `note` are optional. A hex value **MUST NOT**
be presented as a physical measurement unless a provenance entry says so.

## 7. Anchor integrity (semantic)

Every anchor used by `entries[].mix[].paint` and `relationships[].sequence[]` **MUST** resolve to
an `entries[]` entry whose `ref` equals that anchor. The JSON Schema cannot express this
cross-reference; the reference validator enforces it as a semantic rule and reports the offending
anchor. Envelope semantic rules (e.g. `updatedAt >= createdAt`) also apply.

## 8. Security & privacy considerations

- `paint.provenance[].sourceUrl` and all envelope URIs are author-supplied and untrusted;
  consumers MUST treat them as data, sanitize before rendering, and MUST NOT auto-dereference
  them without user intent.
- A palette carries no user account identifier.

## 9. Conformance

A document conforms to Palette v1 if it validates against `palette.schema.json` (which includes
the Common envelope via composition) **and** satisfies the semantic rules in §7. The reference
validator (`@brushcodex/validator/palette`) enforces both layers and is tested against the example
corpus in `examples/palette/v1`, including a `parse -> serialize -> parse` round trip that
preserves every member and unknown namespaced extensions.

## 10. Note on shared definitions

`paintRef`, `colorValue`, the `role` vocabulary, and `target` are shared with the Recipe spec and
defined once in the Common `$defs`; Palette `$ref`s them. Only `mixEntry` stays palette-local,
because a palette mixture anchors into `entries[]` while a recipe mixture anchors into `paints[]` —
the same shape but different anchor semantics. See [VERSIONING.md §8](../../../VERSIONING.md) for the
shared-building-blocks policy.

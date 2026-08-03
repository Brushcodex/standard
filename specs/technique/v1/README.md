# BrushCodex Technique — v1 (DRAFT)

- **Spec name:** `technique`
- **Version:** `1.0.0` (draft; not frozen)
- **JSON Schema:** [`schemas/technique/v1/technique.schema.json`](../../../schemas/technique/v1/technique.schema.json)
- **Media type (provisional):** `application/vnd.brushcodex.technique+json`
- **File suffix (provisional):** `.brushtechnique.json`
- **Status:** DRAFT — MAY change incompatibly until frozen.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, and **MAY** are
to be interpreted as described in RFC 2119 and RFC 8174.

## 1. Purpose

A Technique is a reusable definition of a way of applying paint (e.g. two thin coats, edge
highlighting, glazing, wet blending). It is referenced by recipes and shared across projects.

It **embeds the Common document envelope** ([../../common/v1/README.md](../../common/v1/README.md))
by composing its `envelopeCore` fragment and closing the object with
`unevaluatedProperties: false`, so a technique carries all envelope members plus the
technique-specific members below and rejects unknown top-level members.

## 2. Envelope constraints

- `spec` **MUST** equal `technique`.
- `specVersion`, `id`, `revision`, `title` are REQUIRED (from the envelope).

## 3. Technique members

| Member | Type | Rule |
|---|---|---|
| `purpose` | string | **REQUIRED**, non-empty — what the technique achieves and when to use it. |
| `difficulty` | `beginner` \| `intermediate` \| `advanced` | Optional. |
| `prerequisites` | array of strings | Optional skills / prior techniques. |
| `tools` | array of ToolItem (§4) | Optional required/optional tools and materials. |
| `steps` | array of Step (§5) | Optional ordered instructions. |
| `parameters` | array of Parameter (§6) | Optional parameter guidance (instead of or alongside steps). |
| `suitablePaintClasses` | array of PaintClass (§7) | Optional; unique. |
| `unsuitablePaintClasses` | array of PaintClass (§7) | Optional; unique. |
| `commonProblems` | array of Problem (§8) | Optional problems + corrections. |
| `safetyNotes` | array of strings | Optional health/safety guidance. |
| `citations` | array of Citation (§9) | Optional source attribution. |
| `variants` | array of Variant (§10) | Optional named variants. |

A technique MAY provide `steps`, `parameters`, both, or neither — the simplest valid technique is
just an envelope plus a `purpose` (gradual complexity). Revision and lineage are handled by the
envelope (`revision`, `links.predecessor`/`successor`); `variants` are named alternatives, not
history.

## 4. ToolItem (shared Resource)

Each `tools[]` item is the shared Common `resource` (also used by Recipe `resources` and Project
`toolsUsed`). `name` is REQUIRED; optional `kind` (`tool` | `material`), `optional` (true when the
item is optional rather than required), `specification` (human-readable, e.g. `"Size 2 round"`,
`"0.3 mm nozzle"`), `quantity` (human-readable, e.g. `"a few drops"`), and `note`.

## 5. Step

`instruction` (non-empty) is REQUIRED; optional `note`. Array order is authoritative.

## 6. Parameter

`name` and `guidance` (both non-empty) are REQUIRED; optional `typicalValue` (e.g. `"1:1"`,
`"15–20 psi"`). Numeric ranges are expressed as human-readable strings, not fabricated precision.

## 7. PaintClass

One of `acrylic`, `oil`, `enamel`, `lacquer`, `ink`, `wash`, `contrast`, `technical`, `metallic`.
`suitablePaintClasses` and `unsuitablePaintClasses` are advisory guidance, not a guarantee.

## 8. Problem

`problem` (non-empty) is REQUIRED; optional `correction`.

## 9. Citation

`text` (non-empty) is REQUIRED; optional `url` (absolute URI). A citation attributes a source; it
does not imply endorsement.

## 10. Variant

`name` (non-empty) is REQUIRED; optional `summary` and `note`.

## 11. Security & privacy considerations

- `citations[].url` and all envelope URIs are author-supplied and untrusted; consumers MUST treat
  them as data, sanitize before rendering, and MUST NOT auto-dereference them without user intent. A
  renderer emitting an `href` MUST allow only safe schemes (e.g. `http`, `https`, `mailto`); a
  `javascript:`/`data:` URL is valid input and MUST NOT become a clickable link.
- A technique carries no user account identifier.

## 12. Conformance

A document conforms to Technique v1 if it validates against `technique.schema.json` (which
includes the Common envelope via composition) **and** satisfies the envelope semantic rules (e.g.
`updatedAt >= createdAt`). The reference validator (`@brushcodex/validator/technique`) enforces
both layers and is tested against the example corpus in `examples/technique/v1`, including a
`parse -> serialize -> parse` round trip that preserves every member and unknown namespaced
extensions.

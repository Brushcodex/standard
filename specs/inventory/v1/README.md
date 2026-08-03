# BrushCodex Paint Inventory — v1 (DRAFT)

- **Spec name:** `inventory`
- **Version:** `1.0.0` (draft; not frozen)
- **JSON Schema:** [`schemas/inventory/v1/inventory.schema.json`](../../../schemas/inventory/v1/inventory.schema.json)
- **Media type (provisional):** `application/vnd.brushcodex.inventory+json`
- **File suffix (provisional):** `.brushinventory.json`
- **Status:** DRAFT — MAY change incompatibly until frozen.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, and **MAY** are
to be interpreted as described in RFC 2119 and RFC 8174.

## 1. Purpose

A Paint Inventory is a portable record of a painter's personal paint collection. Every item
records the **user's own observations** (how many they own, condition, where it is stored) — which
are distinct from global catalogue truth. It **embeds the Common document envelope** and closes
with `unevaluatedProperties: false`.

## 2. Envelope constraints

- `spec` **MUST** equal `inventory`.
- `specVersion`, `id`, `revision`, `title` are REQUIRED (from the envelope).

## 3. Inventory members

| Member | Type | Rule |
|---|---|---|
| `items` | array of Item (§4) | **REQUIRED** (the key must be present). MAY be empty. |
| `summary` | string | Optional. |

## 4. Item

`paint` (§5) is REQUIRED. Shareable fields:

- `ref` — a document-local anchor; also a **non-destructive duplicate-detection hint** (see §7).
- `quantity` (≥ 0), `unit` (`bottle`/`pot`/`tube`/`dropper`/`ml`/`g`/`other`), `bottleSizeMl` (> 0).
- `condition` (`sealed`/`in_use`/`low`/`empty`/`dried_out`/`unknown`), `lowStock` (boolean).
- `aliases` — the user's own unique names for the paint.
- `visibility` — `shareable` (default) or `private`. A `private` item is omitted **entirely** from
  a shared export profile (§6).

Private fields live under `private` (§6) so they can be stripped as a group.

## 5. PaintRef — stable identity or literal fallback

`paint` MUST include at least one of `manufacturer` or `name`. `catalogueId` is **OPTIONAL** — an
item stays valid with no shared catalogue entry (literal fallback). `range`, `code`, `color`
(`{ hex }`), `provenance`, and `note` are optional. An item's `color`/`provenance` describe the
paint, not a measurement of the specific bottle, and a hex value **MUST NOT** be presented as a
physical measurement unless provenance says so. This keeps a user's observation distinct from
catalogue truth.

## 6. Privacy — separated private fields and export profiles

Sensitive fields are grouped under a per-item `private` object: `storageLocation`, `notes`, `lot`
(batch), `acquiredAt`, `acquiredNote`. This separation makes a **shared export profile**
mechanical and auditable:

- The **full** profile is the document as authored (all fields, all items).
- The **shared** profile MUST omit every item whose `visibility` is `private`, and MUST remove the
  `private` object from every remaining item. It MUST NOT alter any other field.

The reference implementation provides `toSharedInventory(doc)` which produces the shared profile;
the result is itself a valid Inventory document. Implementations MUST NOT require destructive
merging to share an inventory.

## 7. Duplicate detection (non-destructive)

Duplicates are detected by paint identity — `catalogueId` when present, otherwise
`manufacturer` + `name` (+ `range`) — and MAY use `ref`/`aliases` as hints. Detection is advisory:
an implementation **MUST NOT** silently merge or delete items; it surfaces candidates for the user
to resolve.

## 8. Security & privacy considerations

- Inventory data is personal. Sharing an inventory shares whatever the chosen profile contains; the
  **shared** profile is the safe default for publishing.
- `paint.provenance[].sourceUrl` and envelope URIs are author-supplied and untrusted; consumers
  MUST sanitize before rendering and MUST NOT auto-dereference them without user intent.

## 9. Conformance

A document conforms to Inventory v1 if it validates against `inventory.schema.json` (which includes
the Common envelope via composition) **and** satisfies the envelope semantic rules (e.g.
`updatedAt >= createdAt`). The reference validator (`@brushcodex/validator/inventory`) enforces both
layers and is tested against the example corpus in `examples/inventory/v1`, including a
`parse -> serialize -> parse` round trip that preserves every member (private data included) and
unknown namespaced extensions, and a shared-profile test proving private data is removed while the
result stays valid.

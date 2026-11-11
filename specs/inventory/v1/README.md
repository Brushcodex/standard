# Open Paint Format Paint Inventory — v1 (DRAFT)

- **Spec name:** `inventory`
- **Version:** `1.0.0` (draft; not frozen)
- **JSON Schema:** [`schemas/inventory/v1/inventory.schema.json`](../../../schemas/inventory/v1/inventory.schema.json)
- **Media type (provisional):** `application/vnd.openpaintformat.inventory+json`
- **File suffix (provisional):** `.paintinventory.json`
- **Status:** DRAFT — MAY change incompatibly until frozen.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, and **MAY** are
to be interpreted as described in RFC 2119 and RFC 8174.

## 1. Purpose

A Paint Inventory is a portable record of a painter's personal paint collection, including the
paints they want but do not have yet. Every item records the **user's own observations** (how many
they own, condition, where it is stored) — which are distinct from global catalogue truth. It **embeds the Common document envelope** and closes
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

- `ref` — a document-local anchor, unique within `items[]`; also a **non-destructive
  duplicate-detection hint** across documents (see §7).
- `owned` (boolean, default `true`) and `wanted` (boolean, default `false`) — whether the user has
  the paint and whether they intend to acquire it (§4a).
- `quantity` (≥ 0), `unit` (`bottle`/`pot`/`tube`/`dropper`/`ml`/`g`/`other`), `bottleSizeMl` (> 0).
- `condition` (`sealed`/`in_use`/`low`/`empty`/`dried_out`/`unknown`), `lowStock` (boolean).
- `aliases` — the user's own unique names for the paint.
- `visibility` — `shareable` (default) or `private`. A `private` item is omitted **entirely** from
  a shared export profile (§6).

Private fields live under `private` (§6) so they can be stripped as a group.

## 4a. Owned and wanted

Whether the user has a paint and whether they want it are independent facts, so an item records
them as two members. A paint can be owned, wanted, or both, as when someone wants to restock a
paint they already have.

| `owned` | `wanted` | Meaning |
|---|---|---|
| `true` (or absent) | `false` (or absent) | In the collection. Every document written before these members existed reads this way. |
| `true` (or absent) | `true` | In the collection, and the user wants more of it. |
| `false` | `true` | Not in the collection; the user wants it (a wishlist entry). |
| `false` | `false` (or absent) | **Invalid.** The item records nothing. |

A reader **MUST** treat an absent `owned` as `true` and an absent `wanted` as `false`. A writer
**MAY** omit either when it holds its default.

**An item that is not owned describes no bottle.** When `owned` is `false`, `wanted` **MUST** be
`true`, and the item **MUST NOT** carry the members that describe a bottle in hand: `quantity`,
`unit`, `bottleSizeMl`, `condition`, `lowStock`, or the `private` members `storageLocation`, `lot`,
`acquiredAt` and `acquiredNote`. `private.notes` remains available. The schema enforces both rules,
so any JSON Schema validator applies them.

**Only owned items are the user's paints.** Any operation that treats an inventory as the paints
a user has (checking whether they can follow a recipe, suggesting a substitute from their own
collection, counting their stock) **MUST** count only items whose `owned` is `true` or absent. A
wishlist entry is not stock.

**`wanted` is intent; `lowStock` is an observation.** Neither implies the other. An implementation
**MAY** suggest wanting a paint that is low, but **MUST NOT** set `wanted` unless the user
expressed it.

The wishlist is deliberately minimal. Prices, retailers, links, priorities and target quantities
are not part of it: they vary by market and by application, and an application that needs them
records them under `extensions` (Common §6), which the shared profile removes (§6).

**One paint, one item, for owned and wanted.** Wanting more of a paint the user already has is
recorded by setting `wanted: true` on the owned item, and a writer **MUST NOT** record it as a
second, not-owned item for the same paint: the two items together would say both that the user has
the paint and that they do not. Several owned items for one paint (separate bottles, §7) remain
valid. A validator cannot check this rule, because whether two items name the same paint is a
matching question (§7), not a schema one. A reader that nevertheless receives an owned and a
not-owned item for the same paint **SHOULD** treat the paint as owned and wanted, and **MUST NOT**
silently delete either item (§7).

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
- The **shared** profile MUST omit every item whose `visibility` is `private`, MUST remove the
  `private` object from every remaining item, MUST remove `extensions` (Common §6) from every
  location in the document that carries it, and MUST remove the envelope `integrity` (Common
  §5.5). It MUST NOT alter any other field.

**Extensions are removed because they are opaque.** An extension is namespaced data whose meaning
only its writer knows, so the profile cannot prove it carries nothing private — an
`app.example:locations` object keyed by item `ref`, for instance, would otherwise survive into the
export after the items and `private` objects it describes were removed. The shared profile
therefore fails closed. In Inventory v1 the only member where `extensions` is allowed is the
document envelope (Common §4): the Item, its `private` object, and every nested Common structure
(`paintRef`, `colorValue`, `provenanceEntry`, `agent`, `license`, `translation`, `links`,
`integrity`) are closed and define no `extensions` member. Should a later version open an
extension point elsewhere in an Inventory document, this rule applies to it too.

This is **not** a violation of the Common §6 preservation rule. Preservation governs a read/write
round trip of a document; the shared profile is a deliberate, privacy-reducing export transform
that produces a different, smaller document. The **full** profile preserves every extension
unchanged, and an implementation that claims preservation support MUST still round-trip them
there.

**`integrity` is removed, not recomputed.** It is the author's hash of the canonical form of the
full document, private items and extensions included. On the shared output it no longer matches
the content, so a consumer checking it would report corruption; and because it is a hash of the
removed content, anyone who can guess that content (a storage location, a lot number) could
confirm the guess against it. The profile does not compute a new value: a shared export MUST NOT
claim an integrity value its author never produced. A publisher MAY compute one for the shared
document as a separate, deliberate step. `revision` is carried as authored: the shared profile is a view of that revision, not an edit (Common §3).

The reference implementation provides `toSharedInventory(doc)` which produces the shared profile;
the result is itself a valid Inventory document. Implementations MUST NOT require destructive
merging to share an inventory.

## 7. Anchor uniqueness and duplicate detection (non-destructive)

Within one document, an `items[].ref` **MUST** be unique within `items[]` (`item-ref-unique`). JSON
Schema cannot express uniqueness of one property across array objects, so the reference validator
enforces this as a semantic rule and reports the offending item.

That rule is about the anchor, not about the paint. Two items that describe the **same paint** — a
second bottle recorded separately — are valid, provided they carry different `ref`s (or none).
Uniqueness says only that one `ref` names one item.

Duplicates are detected by paint identity — `catalogueId` when present, otherwise
`manufacturer` + `name` (+ `range`) — and MAY use `ref`/`aliases` as hints. Inside one document,
a `ref` cannot repeat, so as a hint it matters **across** documents: when merging or importing
another inventory, an equal `ref` on both sides suggests the same item, but it is **not** an
identity — two independently authored inventories may use the same `ref` for different paints.
Detection is advisory: an implementation **MUST NOT** silently merge or delete items; it surfaces
candidates for the user to resolve.

## 8. Security & privacy considerations

- Inventory data is personal. Sharing an inventory shares whatever the chosen profile contains; the
  **shared** profile is the safe default for publishing. It removes the members the format marks
  as private (private items, `private` objects) and the members the format cannot see into
  (`extensions`, plus the now-stale `integrity`); it does not inspect free text. Envelope prose (`title`, `description`,
  `summary`, `tags`, `provenance[].note`) and shareable item fields (`aliases`, `paint.note`) are
  published as written, so an author who names a private paint there publishes that name.
- `paint.provenance[].sourceUrl` and envelope URIs are author-supplied and untrusted; consumers
  MUST sanitize before rendering and MUST NOT auto-dereference them without user intent.

## 9. Conformance

A document conforms to Inventory v1 if it validates against `inventory.schema.json` (which includes
the Common envelope via composition) **and** satisfies the semantic rules: the envelope rules (e.g.
`updatedAt >= createdAt`) and the anchor uniqueness rule in §7. The reference validator
(`@brushcodex/validator/inventory`) enforces both layers and is tested against the example corpus in `examples/inventory/v1`, including a
`parse -> serialize -> parse` round trip that preserves every member (private data included) and
unknown namespaced extensions, and a shared-profile test proving private data, `extensions`, and
`integrity` are removed while the result stays valid.

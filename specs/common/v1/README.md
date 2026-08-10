# BrushCodex Common Document Envelope — v1 (DRAFT)

- **Spec name:** `common`
- **Version:** `1.0.0` (draft; not frozen)
- **JSON Schema:** [`schemas/common/v1/common.schema.json`](../../../schemas/common/v1/common.schema.json)
- **Media type (provisional):** `application/vnd.brushcodex.common+json`
- **Status:** DRAFT — MAY change incompatibly until frozen.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, and **MAY** are
to be interpreted as described in RFC 2119 and RFC 8174.

## 1. Purpose

The Common envelope is the shared metadata carried by **every** BrushCodex document (recipe,
palette, inventory, project, technique). It establishes stable identity, versioning,
attribution, licensing, provenance, cross-document links (revision and fork lineage),
translations, namespaced extensions, and optional integrity information.

Concrete document specifications embed these fields and add their own domain fields. A document
whose only content is the envelope (`spec: "common"`) is itself valid — this is what the
reference validator and round-trip tests exercise.

The envelope is **implementation-neutral**: it encodes no assumption about Next.js, Prisma,
PostgreSQL, a UI, or any internal database identifier (strategy §3.2).

## 2. Serialization

- The normative serialization is **JSON** (UTF-8).
- A document is a single JSON object.
- Unknown **top-level** members are **NOT** permitted (`additionalProperties: false`). Extra,
  non-standard data MUST be carried under `extensions` (§6), which is how the format stays
  extensible without silently accepting typos or incompatible fields.

## 3. Required members

Every document **MUST** include:

| Member | Type | Rule |
|---|---|---|
| `spec` | string | Lowercase spec name matching `^[a-z][a-z0-9-]*$` (e.g. `common`, `recipe`). |
| `specVersion` | string | SemVer 2.0.0 (e.g. `1.0.0`). |
| `id` | string | A stable, globally unique **absolute URI** (e.g. `urn:uuid:…` or `https://…`). MUST NOT require a central registry. |
| `revision` | string | Non-empty opaque identifier for this exact document state (UUID, hash, or monotonic token). |
| `title` | string | Non-empty human-readable title. |

Editing published content **MUST** produce a new `revision`; where storage permits, prior
revisions SHOULD remain addressable (strategy §5.8).

## 4. Optional members

| Member | Type | Notes |
|---|---|---|
| `$schema` | string (URI-reference) | Pointer to the schema the document claims to satisfy. |
| `description` | string | Human-readable description. |
| `createdAt` / `updatedAt` | string (RFC 3339 date-time) | Timestamps when known. `updatedAt` SHOULD be `>= createdAt`. |
| `language` | string | BCP 47 tag, or `und` if undetermined. |
| `authors` / `contributors` | array of Agent (§5) | The people who made the document. |
| `attribution` | string (non-empty) | Credit prose for the document as a whole — see §4a. |
| `license` | License (§5) | Content license. |
| `links` | object | `source`, `canonical`, `predecessor`, `successor`, `forkOrigin` — each an absolute URI. Carries revision/fork lineage. |
| `provenance` | array of Provenance (§5) | Where the document/values came from. |
| `tags` | array of unique strings | Free-form classification. |
| `translations` | array of Translation (§5) | Localized `title`/`description`. |
| `extensions` | object | Namespaced extension data (§6). |
| `integrity` | object | `{ algorithm, value }` content hash (§5). |

Unknown values remain **absent** — implementations **MUST NOT** fabricate identifiers, colors,
measurements, licenses, provenance, authors, or timestamps (strategy §3.4).

## 4a. Attribution

`attribution` is a human-readable credit statement for the document as a whole: who or what it is
based on, and any acknowledgement the author owes — e.g. `"Based on a scheme taught at the Tuesday
club night; posted with the group's blessing."`

It is deliberately **free text**, because credit obligations are prose. That makes the rules about
what it is *not* the important part:

- It **does not** state or grant a licence. A licence is `license` (§5.2); an acknowledgement is not
  permission, and permission is not a licence.
- It **does not** make anyone an author. `authors`/`contributors` are the people who made *this*
  document; a credited third party is not one of them.
- A consumer **MUST** preserve it verbatim and **MUST NOT** parse it into agents, licences, or
  links. Displaying it is a rendering choice; rewriting it is not.
- An empty string is **invalid** — omit the member rather than credit nobody.

Credit for a specific linked work belongs on that work instead: `mediaRef.creator` and
`mediaRef.rightsNote` (§5.6). `attribution` is about the document.

## 5. Sub-objects

### 5.1 Agent (author / contributor)

`name` is REQUIRED. Optional `id` (URI, e.g. an ORCID or `mailto:`), `role`, and `url`.

### 5.2 License

At least one of `spdxId` or `name` **MUST** be present. Optional `url` and `notice`. Use the
SPDX tokens `NONE`/`NOASSERTION` or a `LicenseRef-…` id when a standard SPDX id does not apply.
A license value is a **claim by the author**; it is not verified by BrushCodex.

### 5.3 Provenance entry

`sourceType` is REQUIRED and MUST be one of:

`manufacturer_digital_swatch`, `physical_measurement`, `community_estimate`,
`digital_approximation`, `photographed_sample`, `synthetic_test_fixture`, `unknown`.

For colour-bearing values these classes are distinct and MUST NOT be conflated:

| Source class | Means |
|---|---|
| `physical_measurement` | Instrument measurement of a physical painted sample. |
| `manufacturer_digital_swatch` | A screen colour published by the manufacturer. Approximate. |
| `community_estimate` | A visual estimate contributed by a person. Approximate. |
| `digital_approximation` | A screen-display approximation of unstated, derived, or third-party origin (e.g. an aggregated colour list). Carries neither manufacturer nor measurement authority. |
| `photographed_sample` | Sampled from a photograph of painted material. Lighting-dependent. |

A color value **MUST NOT** be labelled `physical_measurement` unless it was produced by
instrument measurement of a physical sample. In particular, an approximate sRGB/HEX value
**MUST NOT** be represented as a physical paint measurement. Optional members: `reviewStatus`
(`pending_review` | `approved` | `rejected` | `deprecated`), `confidence`
(`high` | `medium` | `low` | `unknown`), `sourceName`, `sourceUrl`, `contributor`,
`retrievedAt`, `license`, `transformationVersion`, `method`, `derivedFrom` (URIs), and `note`.

`approved` means "reviewed under the project's policy"; it does **not** imply endorsement by a
manufacturer.

### 5.4 Translation

`language` (BCP 47) is REQUIRED; optional localized `title` and `description`.

### 5.5 Integrity

`algorithm` (`sha-256` | `sha-512`) and `value` (lowercase hex) are both REQUIRED when present.
The hash is computed over the **canonical serialization** (§7) of the document with the
`integrity` member removed.

### 5.6 Shared cross-spec building blocks

Beyond the envelope, Common `$defs` also defines the structures that more than one concrete spec
references, so they are defined **once** and cannot drift:

- **`paintRef`** — a paint reference (Recipe, Palette, Inventory, Project). At least one of
  `manufacturer`/`name`; optional `ref`, `range`, `code`, `catalogueId`, `color`, `provenance`,
  `note`, and the classifiers `kind` (`paint` | `medium` | `thinner` | `additive` | `varnish`;
  absence means `paint`) and `chemistry` (`acrylic` | `enamel` | `oil` | `lacquer` | `other` — the
  binder-family subset of Technique's paintClass). `kind` classifies **any component referenced the
  way paints are**, bottled or not, by its **function in the mixture**: a household diluent (water)
  is an `additive`, `thinner` is for a product sold as a thinner, a colour-bearing component (a dry
  pigment) stays a `paint` because it determines the resulting colour, and an `additive` is **not**
  implied to be an acquirable product. A renderer **SHOULD NOT** draw a colour swatch for a
  non-`paint` kind even when `color` is present. `color` is a `colorValue` `{ hex }` whose meaning
  is set by provenance. `color` is OPTIONAL: a paint reference carrying **no** colour at all is
  valid, and a conforming implementation **MUST** accept it. `catalogueId` is an OPTIONAL, opaque,
  **external** identifier; see §5.7. Internal database primary keys **MUST NOT** appear in
  `catalogueId` or in `code` (which is strictly the manufacturer's printed product code).
- **`resource`** — a tool or non-paint material (Recipe `resources`, Technique `tools`, Project
  `toolsUsed`). `name` REQUIRED and the **only** required member (no manufacturer/catalogue
  identity); optional `kind` (`tool` | `material`), `optional`, `specification`, `quantity`, `note`.
  A reusable **tool** is a resource unconditionally and **MUST NOT** be modelled as a paintRef. A
  **consumable material** goes by usage: referenced in `paints[]`/`mix[]` (it joins a mixture at an
  authored ratio) it is a paintRef classified by `kind`; used in the process — sprinkled, glued,
  applied dry — it is a resource. Recipe §6a carries the worked examples.
- **`documentRef`** — a soft reference to another document by stable id URI (Recipe `techniqueRefs`,
  Project `recipeRefs`/`paletteRefs`): `{ id (uri, REQUIRED), title? }`. An unresolved reference is
  **not** an error.
- **`role`** — the coarse, closed grouping vocabulary shared by Recipe steps and Palette entries
  (18 values, `primer` … `other`, including `spot_highlight`). Named specific techniques use a
  free-text field, never this enum.
- **`target`** — the subject a Recipe or Palette is for: `{ kind?, description (REQUIRED), scale?,
  substrate? }`, where `scale` is `{ system: nominal_mm | ratio, value }` and `substrate` is
  `resin` | `plastic` | `metal` | `mdf` | `foam` | `pla` | `other`.
- **`mediaRef`** — a linked media item with its **own** rights metadata (Recipe `media` and step
  `media`, Project `results`). `url` (absolute URI) REQUIRED; optional `id` (a document-local
  anchor, unique within the array, so a `mediaCitation` can target it), `kind`
  (`image` | `video` | `other`), `relation` (`source` | `result` | `reference`), `caption`,
  `creator` (an `agent`), `license`, `rightsNote`. `creator` and `license` describe the **linked
  work**, never the document: deriving a workflow from a tutorial, class, article, or other work
  does not make that work's creator an author of the document, and reachable media is **not**
  thereby openly licensed. Neither is ever inferred —
  absent means unknown. Media is referenced, never embedded (see §9).
- **`mediaCitation`** — a moment or range in a time-based source the document links (Recipe
  `step.source`): `{ media? (anchor into media[].id), startSeconds (REQUIRED, ≥ 0), endSeconds?,
  label? }`. Time is carried in **seconds** so any consumer can seek deterministically without
  parsing human timecode text; `label` preserves the author's written form (e.g. `"1:00-1:35"`) so
  a round trip through a human-timecode representation loses nothing. A renderer MAY show `label`
  but **MUST NOT** parse it in preference to the seconds. `media` may be omitted only when exactly
  one linked media item has `relation: "source"`; resolution and range order are semantic rules
  enforced per spec (Recipe §9).

### 5.7 Resolving a paint reference

A `paintRef` is **self-sufficient**. Its literal members (`manufacturer`, `range`, `name`, `code`,
`color`) are the guaranteed floor: a conforming implementation **MUST** be able to read and present
a paint reference using those alone, with no catalogue, no network, and no BrushCodex service.

`catalogueId` is an OPTIONAL progressive enhancement. When present, an implementation MAY resolve
it against any of:

1. the optional BrushCodex reference catalogue (an openly published dataset);
2. a BrushCodex hosted service;
3. any other catalogue that uses the same identifier namespace;
4. the implementation's **own** local paint data.

Resolution is **best-effort**. An unresolved `catalogueId` is **NOT** an error: the implementation
falls back to the literal members. Implementations **MUST NOT** require resolution in order to
consider a document valid.

The RECOMMENDED form of a BrushCodex-namespaced identifier is a URN-style, lowercase, slugged
triple:

```text
brushcodex:paint:<manufacturer>/<range>/<paint>
```

for example `brushcodex:paint:citadel/base/mephiston-red`. This form is a **convention, not a
constraint** — the schema types `catalogueId` as an opaque non-empty string so other namespaces
(`vendor:…`, a URI, an opaque token) remain valid. Resolvers **MUST** treat an identifier they do
not recognise as simply unresolvable.

## 6. Extensions

- Keys under `extensions` **MUST** be namespaced (contain a `.` or `:` separator), e.g.
  `com.example.tool:layerMap` or `org.miniac.difficulty`.
- An extension **MUST NOT** change the meaning of a core member.
- Extensions are OPTIONAL for baseline conformance.
- An implementation that claims **preservation support** **MUST** round-trip unknown extensions
  unchanged. The BrushCodex reference validator claims and tests this (see
  [../../../docs/EXTENSIONS.md](../../../docs/EXTENSIONS.md)).

## 7. Canonical serialization

For hashing, deduplication, and stable comparison, the canonical form of a document is JSON with
object members sorted lexicographically by key (UTF-16 code-unit order), no insignificant
whitespace, and arrays left in document order. The reference implementation provides
`toCanonicalJson()`; a canonical round trip (`parse → serialize → parse`) MUST preserve all
supported members and unknown extensions.

## 8. Conformance

A document is **conformant to the Common envelope v1** if it validates against
`common.schema.json` **and** satisfies the additional prose rules that JSON Schema cannot
express, which the reference validator enforces:

1. If both `createdAt` and `updatedAt` are present, `updatedAt >= createdAt`.
2. `license`, when present, carries at least one of `spdxId`/`name` (also enforced by schema).

**Version negotiation.** A consumer validates a document against the schema matching its declared
`specVersion` ([VERSIONING.md](../../../VERSIONING.md) §8.5). A consumer that ships only the `1.0`
schema — the reference validator does — **MUST NOT** silently validate a document declaring a
higher minor or a different major against it: a `1.1` document may legitimately carry members and
enum values `1.0` never had, and reporting those as ordinary schema errors tells the reader the
document is malformed when it is merely newer. The reference validator reports the mismatch as a
single distinct issue (`spec-version-unsupported`) and validates no further, so no misleading `1.0`
errors appear beside it. A patch difference (`1.0.1`) is not a surface change and is accepted.

## 9. Security & privacy considerations

- `id`, `links.*`, `sourceUrl`, and agent `url` are URIs supplied by document authors and may be
  untrusted. Consumers MUST treat them as data, MUST NOT auto-dereference them without user
  intent, and MUST sanitize before rendering (no `javascript:`/`data:` execution surfaces).
- The envelope carries attribution and provenance that MAY be personal data; privacy-aware
  export profiles (defined by the inventory/project specs) decide what is shareable.
- Integrity hashes detect accidental corruption; they are not signatures and do not establish
  authorship.

## 10. Status of open decisions

The final media type/suffix and the frozen field set are **open decisions** tracked in
[../../../VERSIONING.md](../../../VERSIONING.md); they are **not** finalized by this draft. The
specification license is **decided and applied** — Apache-2.0 for the spec text and schemas (see
[../../../docs/LICENSING.md](../../../docs/LICENSING.md)).

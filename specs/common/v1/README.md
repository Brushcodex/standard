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
  substrate?, identity? }`, where `scale` is `{ system: nominal_mm | ratio, value }` and `substrate`
  is `resin` | `plastic` | `metal` | `mdf` | `foam` | `pla` | `other`. `kind`, `description`,
  `scale` and `substrate` state **applicability** — what the document applies to. The OPTIONAL
  `identity` states **which exact Painted Subject** that applicability denotes, when one is known;
  see §5.8.
- **`subjectIdentity`** — the identity of the Painted Subject a `target` denotes:
  `{ authority (REQUIRED), designation (REQUIRED), qualifier?, authorityId?, subjectId? }`. Reached
  only through `target.identity`; see §5.8.
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

**That is a durability guarantee rather than a convenience.** A conforming document stays fully
readable and fully usable if BrushCodex, its catalogue and every BrushCodex service cease to
exist. Nothing in this specification may be read as making a document's meaning, its validity or
its usefulness contingent on any BrushCodex artifact, endpoint or dataset being reachable — now or
at any point in the future. An implementation that needs one to read a document has misread this
section.

`catalogueId` is an OPTIONAL progressive enhancement. When present, an implementation MAY resolve
it against any of:

1. the optional BrushCodex reference catalogue (an openly published dataset);
2. a BrushCodex hosted service;
3. any other catalogue that uses the same identifier namespace;
4. the implementation's **own** local paint data.

Resolution is **best-effort**. An unresolved `catalogueId` is **NOT** an error: the implementation
falls back to the literal members. Implementations **MUST NOT** require resolution in order to
consider a document valid.

An implementation that reads a document and writes it out again **SHOULD** preserve a
`catalogueId` it does not recognise — verbatim, unparsed — rather than dropping it. An identifier
this implementation cannot resolve may be one another implementation can, or one this
implementation will resolve after its next catalogue update; discarding it destroys something the
author put there deliberately, and does so silently. This is the rule §6 already states for
unknown extensions, applied here for the same reason.

The CANONICAL form of a BrushCodex-namespaced identifier is an **assigned, opaque** token:

```text
brushcodex:paint:p0000001
```

It is assigned once and never reused, and it carries no manufacturer, range, name or code. A
consumer **MUST NOT** parse meaning out of its segments, and **MUST** compare it by whole-string
equality. Its stability is the reason it exists: renaming a paint, moving it between ranges, or
rebranding its manufacturer **does not change** the identifier, because none of those facts is
part of it. Every identifier a product has previously been published under is retained as an
alias, so an older document keeps resolving.

It is a **precision aid and never a dependency.** What it buys is that two implementations can
agree they mean the same paint without comparing spellings, and it buys that precisely by carrying
nothing. A document that omits it is not a lesser document; a consumer that cannot resolve one has
lost precision, not meaning, and §5.7's opening rule still tells it exactly what to do.

**The seven-digit zero padding is an issuance convention, not a promise about the number.**
Identifiers are currently issued at a minimum width of seven digits; that width MAY grow, and a
consumer **MUST NOT** treat it as a parsing ceiling, a fixed length, or a validity rule. Nothing
may be derived from the numeric part — not manufacturer, not range, not chronology, not catalogue
order, not how many paints exist. A consumer that needs to recognise the form at all **SHOULD**
accept `brushcodex:paint:p` followed by one or more digits and otherwise treat the value whole; it
**MUST NOT** compare two identifiers by stripping or adding padding, and **MUST NOT** reject an
identifier merely for being wider than the examples here.

A second, LEGACY form is still valid and still widely held by documents already exported — a
URN-style, lowercase, slugged triple:

```text
brushcodex:paint:<manufacturer>/<range>/<paint>
```

for example `brushcodex:paint:citadel-colour/base/mephiston-red`. It is derived from three facts
that can each change, so it names a paint only as long as all three hold. It is now treated as an
**alias** of the assigned identifier rather than as the identity itself, and a resolver that knows
the assigned form **SHOULD** treat both as naming the same product.

Assigned identifiers issued before 2026-08-30 were written five digits wide
(`brushcodex:paint:p00001`). Those are the SAME identities, not different ones: they remain valid,
and BrushCodex retains each of them as an alias of its canonical form. A resolver that knows the
canonical form **SHOULD** resolve the older one to the same paint.

**This specification does not require that any resolver exist.** Whether BrushCodex — or anyone
else — offers a way to turn an identifier into a paint record is an integration concern outside
this specification, and a conforming implementation is never obliged to have one. Resolution is a
capability an implementation MAY have; portability is a property every conforming document has
already.

Both forms are a **convention, not a constraint** — the schema types `catalogueId` as an opaque
non-empty string so other namespaces (`vendor:…`, a URI, an opaque token) remain valid. Resolvers
**MUST** treat an identifier they do not recognise as simply unresolvable.

None of this weakens §5.7's opening rule. `manufacturer`, `range`, `name` and `code` remain
DESCRIPTIVE literals and the guaranteed floor for reading a document; they are evidence about a
paint, never its permanent identity. An implementation with no catalogue at all still reads every
document correctly, and an unresolved identifier of either form is still not an error.

## 5.8 Painted Subject identity

A **Painted Subject** is the discrete, authority-named thing a Painting Workflow or Palette is
actually applied to: a sculpt, a model, a named build, or a unit/set the authority itself names as
one thing. `target.identity` states which Painted Subject a `target` denotes.

`target` and `identity` answer different questions and both are needed:

| | Question | Members |
|---|---|---|
| Applicability | What does this document apply to? | `kind`, `description`, `scale`, `substrate` |
| Identity | Which exact Painted Subject does that denote, if known? | `identity` |

`identity` is a **refinement**, never a replacement. `description` remains REQUIRED whenever
`target` is present, and a consumer **MUST NOT** drop, regenerate, or treat it as decoration
because an `identity` is present. The identity carries no description, kind, scale, or substrate,
so it cannot become a second applicability statement.

### 5.8.1 The literal floor

When `identity` is present, `authority` and `designation` are both **REQUIRED**. The rule is
**unconditional** — it does not depend on whether `subjectId` is present, and a `subjectId`
**MUST NOT** be treated as licence to omit either literal.

- `authority` — the party whose designation the identity is anchored to: the manufacturer, studio,
  or sculptor. Never a retailer or storefront.
- `designation` — the subject's name as that authority gives it.
- `qualifier` (OPTIONAL) — only the paint-relevant distinction needed to remove ambiguity between
  subjects an authority names alike, such as an original sculpt versus a remaster whose geometry
  changes the painting order.
- `authorityId` (OPTIONAL) — an identifier the authority itself assigns, such as a sculpt or part
  code. It is reader-facing, like `paintRef.code`, and is **not** a SKU, GTIN, or product number.

This is the same discipline as §5.7: the literals are the guaranteed floor, so an implementation
can read and present a Painted Subject with no registry, no network, and no BrushCodex service.

### 5.8.2 The stable subject identifier

`subjectId` is an OPTIONAL progressive enhancement, and behaves exactly as `catalogueId` does for a
paint (§5.7):

- It denotes the **Painted Subject** — never the Recipe or Palette document, never a Source
  Product, commercial box, bundle, SKU, GTIN, retailer listing, storefront URL, or internal
  database row.
- It is **opaque**. Equality is **whole-string equality**, and a consumer **MUST NOT** parse
  meaning out of its segments.
- Resolution is **best-effort**. An unresolved `subjectId` is **NOT** an error, an implementation
  **MUST NOT** require resolution in order to consider a document valid, and a consumer that
  cannot resolve one **MUST** fall back to the literal floor.
- The RECOMMENDED form is `brushcodex:subject:<authority>/<line>/<subject>`, e.g.
  `brushcodex:subject:example-miniatures/vanguard/standard-bearer`. As with `catalogueId` this is a
  **convention, not a constraint**: the schema types it as an opaque non-empty string, no
  BrushCodex namespace is required, and a resolver **MUST** treat an identifier it does not
  recognise as simply unresolvable.

Allocation is registry policy, not a validation rule: which subjects share an identifier across a
rebox, and when a remaster earns a new one, is decided by whoever mints identifiers, never by this
schema.

### 5.8.3 What identity is not, and when to omit it

`identity` is OPTIONAL and, like every unknown value (§4), **MUST NOT** be fabricated. A `target`
with only a `description` is fully valid, and so is a Recipe or Palette with no `target` at all.
A broad or class-level target — ordinary infantry of a squad, generic terrain, a reusable army
scheme — simply carries no `identity`, and a consumer comparing two such documents concludes
nothing rather than guessing.

Source Product identity is deliberately **outside** this capability and outside the Common
envelope: no product identifier, SKU, GTIN, containment, bundle membership, release history,
availability, retailer data, price, stock, or affiliate link belongs in `identity` or anywhere in
`target`. A commercial rebox or SKU change does not by itself create a new Painted Subject.

`identity` is also distinct from Project `subjects[]`, which are **document-local execution
records**: one Painted Subject may correspond to many tracking records (ten squad members built
from one sculpt), so the two are never interchangeable.

`target` is **singular**, and `identity` is singular with it — one target, one denoted subject.
That is deliberate for this version: a workflow spanning several distinct exact subjects (paired
models, a multi-subject diorama) already exceeds what a single `target` can state through
`description`, `scale`, and `substrate`, so plural targets are a separate question and not one this
member answers.

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

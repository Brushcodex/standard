# Changelog

All notable changes to the BrushCodex standard are recorded here. Specification versions follow
SemVer per [VERSIONING.md](VERSIONING.md). This changelog tracks the *repository*; individual
specs also carry their own `specVersion`.

## [Unreleased]

### Public draft preparation — 2026-08-03

#### Changed

- Canonical Draft schema identifiers move from the previous unregistered domain to
  resolvable `https://brushcodex.com/schemas/...` URLs. This is an identifier change to Draft
  schemas, not a document-shape change; implementations must refresh schema registries that keyed
  the earlier Draft IDs.
- Package metadata and legal contents are now self-contained in every packed artifact while all
  packages remain `private: true` and unpublished.
- Public documentation, package versions, conformance totals, release statements, and provenance
  now describe the reviewed public snapshot rather than earlier internal migration state.
- The synthetic invalid-inventory fixture no longer contains an SSN-shaped dummy value.

#### Security

- `fast-uri` is pinned to patched version `3.1.5`, resolving
  [GHSA-v2hh-gcrm-f6hx](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx).
- CI now runs the complete source, conformance, audit, package-content, and packed-artifact gates
  on Linux and Windows with explicit permissions and immutable Action revisions.

### Painting Workflows — 2026-08-02

No format change: every field, constraint, semantic rule, technical identifier, and document
`specVersion` remains unchanged. The `recipe` spec is now positioned explicitly as a **Painting
Workflow** rather than as a tutorial-shaped document. `recipe` remains the stable wire identifier
and `.brushrecipe.json` remains the provisional suffix.

#### Changed

- Recipe §1 now defines a Painting Workflow as an ordered, reproducible record of paints, mixtures,
  materials, techniques, and actions used — or intended to be used — to paint a subject.
- Recipe §3a defines reusable, planned, as-painted, derived, and published-guidance usage profiles.
  They are uses of one document type, not a new discriminator or parallel specification.
- Recipe, Common, and Project prose and schema descriptions now treat a tutorial as one possible
  source work. Source attribution, rights, and step citations retain exactly the same semantics.
- The Quickstart, authoring cookbook, specification index, and worked-example catalogue use
  Painting Workflow as the human-facing concept while retaining all `recipe` APIs and identifiers.
- The reference bundle renderer labels `recipe` entries “Painting workflow”; the rendered
  document footer still exposes the technical `recipe` spec identifier.

#### Added

- `docs/PAINTING_WORKFLOWS.md` explains the concept, document boundaries, provenance model, and the
  current Project journal limitation.
- Three valid Recipe fixtures demonstrate a reusable army workflow, a complex model's as-painted
  record, and a tutorial-derived workflow. The conformance corpus grows from **89 to 92** cases.

All five `@brushcodex/*` packages bump `0.8.0-draft → 0.9.0-draft` in lockstep because the packed
schema descriptions and fixture corpus changed.

### Paint-reference resolution and honest approximate colour — 2026-07-25

Two additive changes to the DRAFT Common envelope, made so an optional reference
catalogue could exist **without** the standard growing a dependency on one. Existing documents
remain valid; nothing was removed or renamed, and every `specVersion` stays `1.0.0`.

#### Added

- **`digital_approximation` provenance source class** (`common` §5.3). The existing vocabulary
  could not express the most common kind of colour in the wild: a screen approximation of
  *derived or unstated* origin — an aggregated third-party colour list, say. Filing those under
  `community_estimate` overstated them (nobody estimated anything) and filing them under
  `manufacturer_digital_swatch` was simply false. §5.3 now carries a table stating what each
  colour-bearing class claims, and an explicit **MUST NOT**: an approximate sRGB/HEX value must
  never be represented as a physical paint measurement.

- **`common` §5.7 "Resolving a paint reference"** — the resolution model, previously only
  implied. A `paintRef` is self-sufficient from its literal members; `catalogueId` is a
  progressive enhancement that MAY be resolved against the optional BrushCodex reference
  catalogue, a hosted service, any catalogue sharing the namespace, or an implementation's own
  local data. Resolution is best-effort: **an unresolved `catalogueId` is NOT an error**, and an
  implementation MUST NOT require resolution for a document to be valid. Documents the
  RECOMMENDED `brushcodex:paint:<manufacturer>/<range>/<paint>` form as a *convention, not a
  constraint* — the schema still types `catalogueId` as an opaque string, so other namespaces
  stay valid.

- Tests: `packages/validator/src/common/paint-reference.test.ts` (21 cases) pins the
  catalogue-independence contract — colourless references, name-only references, unresolvable
  ids, the four distinct colour authorities, and hex validation.

#### Changed

- `docs/PAINT_DATA_MODEL.md` — records that a baseline catalogue dataset now exists as a
  separate, openly licensed repository, and restates that layer 3 remains optional.

- `examples/common/v1/comprehensive.valid.json` — exercises the new `digital_approximation`
  class, so the vocabulary addition is covered by the conformance corpus and not by unit tests
  alone. Extended in place rather than added as a new case: the corpus stays at **89** fixtures,
  which `scripts/verify-packed.mjs` asserts exactly and eight documents quote.

## [0.8.0-draft] — Authoring: the write half of the round trip

_2026-07-22._ No format change: schemas, vocabularies and semantic rules are byte-identical to
`0.7.0-draft`, and every `specVersion` stays `1.0.0`. This is a toolkit feature, so the five
`@brushcodex/*` packages bump `0.7.0-draft → 0.8.0-draft` in lockstep.

The toolkit could read, validate, render, round-trip, and bundle documents — but it could not
**construct** one. Every producer hand-rolled the envelope (`spec`, `specVersion`, `id`,
`revision`, timestamps), which is the one place a format drifts without any test noticing,
because a hand-rolled envelope that is merely *wrong* still often validates.

### Added

- **`@brushcodex/validator/authoring`** — a new subpath export.
  - `createDocument(spec, draft, options)` plus typed per-spec helpers (`createRecipe`,
    `createPalette`, `createInventory`, `createProject`, `createTechnique`,
    `createCommonDocument`, `createBundleManifest`). Each mints the envelope and then runs the
    document through the same reference parser a third party would use, so an authored document
    is **valid by construction** or it throws that spec's validation error carrying `issues`.
  - `reviseDocument(document, changes, options)` enforces the envelope rule that editing
    published content **MUST** produce a new `revision` (common spec §4) — a rule a hand-rolled
    producer forgets precisely because the stale-revision document still validates. It preserves
    `spec`/`id`/`createdAt`, refuses to change them, and **drops a now-stale `integrity`**
    rather than carrying a hash that no longer describes the content.
  - `newDocumentId` mints a registry-free `urn:uuid:` URI; `newRevision` mints the timestamped
    opaque token the corpus already uses. Both the clock and the UUID source are injectable, so
    authored output is byte-reproducible.
- 18 authoring tests, including one that authors every one of the seven specs from the corpus
  minimal fixtures and asserts the result validates.
- The packed release gate now exercises the `/authoring` subpath in both its normal and its
  source-absent phase, so the new export cannot ship broken.
- **`pnpm check:consistency`** (`scripts/check-consistency.mjs`) — a prose↔schema consistency
  guard. Every README states that a disagreement between the normative prose and the normative
  schema is a defect, but nothing tested it. The check asserts every enum value and property name
  in each schema is documented in the spec prose; it is dependency-free, self-tested under
  `pnpm test:gate`, and currently reports all seven specs consistent. Most valuable before the v1
  freeze, which would make any undocumented member permanent. (Repo tooling; no package version
  impact.)

### Fixed (documentation)

- Stale facts corrected across the repository: conformance counts (`76/76`, `81/81` → **89/89**),
  package version (`0.5.0-draft` → `0.7.0-draft`), `specs/README.md` pointing at a `../src/`
  directory that no longer exists and at a `docs/SPEC_VERSIONING.md` that was renamed to
  `VERSIONING.md`, and `conformance/README.md` documenting a `pnpm validate` script and a
  `scripts/validate.ts` that do not exist.
- Documented a real footgun: run from this repo, `pnpm --filter @brushcodex/cli validate` uses
  `packages/cli` as its working directory, so a repo-relative path silently resolves to nothing
  and a valid document is reported `0/1 valid.` Pass an absolute path.

### Added (documentation)

- **`LAYOUT.md`** — per-directory intent for the whole repository, the normative/informative
  split, and a "where does my change go?" routing table.

## [0.7.0-draft] — Inventory and Project become readable

No format change: schemas, vocabularies and semantic rules are byte-identical to `0.6.0-draft`.

Extending last release's coverage guard to the remaining specs turned up something larger than a
missing test: **Inventory and Project had no reference renderer at all**. Two of the format's
document types could be validated and parsed but not *read* by a human without an application —
which is precisely the claim the renderers exist to demonstrate. A bundle containing them listed
them on its index as "Data document — not rendered as a page".

### Added

- **`renderInventoryHtml`** — paints owned, quantities, conditions, aliases, and the `private`
  block. An inventory is the most personal document in the format, so the page is explicit about
  what it holds: private fields render in their own labelled group, and the meta list states the
  profile (`full — 1 private item(s), 1 with private fields`, or `no private data present`). The
  renderer does **not** strip: deciding what to share belongs to whoever produces the document
  (`toSharedInventory`), and a page that quietly disagreed with its source file would be the more
  dangerous behaviour.
- **`renderProjectHtml`** — subjects with stages and checklists, the recipes and palettes followed,
  accepted substitutions, tools used, the journal, and result media. Two honesty rules carry over:
  a substitution keeps its class (`mathematical` renders as "mathematical (color distance)", never
  as though anyone tested it), and logged time is labelled "sum of journal entries" so a derived
  figure never reads as one the author stated. A `private` journal entry is flagged, not hidden.
- Both are wired into `renderDocumentHtml`, `RENDERABLE_SPECS`, and the bundle site renderer, so a
  bundle now produces a page for **every** document it contains.
- The renderer-coverage guard now walks all five specs, and the new renderers passed it after two
  exemptions were added (`condition` and `visibility` print as labels, and `shareable` is the
  default and is deliberately not badged).

### Changed

- The bundle index's fallback note changed from "Data document — not rendered as a page" to "No
  renderer for this spec", which is now only reachable for a bare `common` document.
- All `@brushcodex/*` packages bumped `0.6.0-draft -> 0.7.0-draft` (lockstep).

### Known limitations

- The Bundle **index** page is not walked by the coverage guard — only document pages are. The
  index is generated from a manifest rather than a document, and would need its own fixture.
- Inventory `ref` anchors are not shown; nothing in Inventory cross-references them yet.

## [0.6.0-draft] — The reference renderers stop omitting members

No format change: every schema, vocabulary, and semantic rule is byte-identical to `0.5.0-draft`.
This fixes the reference **renderers**, which are how the project demonstrates that a document is
usable with no application present — a claim weakened every time one of them quietly dropped a
member the format defines.

Found by walking each comprehensive fixture and asking which values never appear in the rendered
page. Most apparent gaps were false alarms (closed vocabularies print as human labels, anchors
resolve to paint names). Five were real, and three of those are safety- or honesty-relevant.

### Fixed

- **`recipe.resources`** — tools and materials were absent entirely. A reader without the airbrush
  or the sponge cannot follow the recipe; the page looked complete while withholding the list.
- **`recipe.techniqueRefs`** — never shown. A recipe deliberately does not duplicate a technique's
  content, so the reference is the only thing a reader can follow.
- **`target.scale` / `target.substrate`** — absent. Substrate drives priming and solvent safety (a
  solvent primer melts bare foam), so this is needed before starting, not after.
- **`paintRef.kind` / `paintRef.chemistry`** — absent. Chemistry is the substitution-safety axis;
  an enamel must never be silently swapped for an acrylic.
- **`step.technique`** — absent. The free-text label exists so a named technique never has to be
  forced into the closed `role` vocabulary; printing "varnish" but not "spray varnish" defeated it.
- **`provenance[].note`** (shared swatch, so Recipe and Palette both) — absent. Showing a colour's
  source class while dropping the author's caveat ("Screen swatch; approximate, not a physical
  measurement") states the weaker warning.

### Added

- **A renderer-coverage guard** (`src/render/coverage.test.ts`): every leaf value in each spec's
  comprehensive fixture must appear in the rendered HTML, escaped or humanised. Values that
  legitimately are not printed live in an exemption list **with a stated reason**, and a second
  test asserts every exemption has one. Adding an exemption is now a deliberate act; forgetting to
  render something is a failure.

### Changed

- All `@brushcodex/*` packages bumped `0.5.0-draft -> 0.6.0-draft` (lockstep) — the packed tarballs
  render differently, and one version must never carry two behaviours.

### Known limitations

- The guard covers Recipe, Palette and Technique. Inventory, Project and Bundle have renderers too
  and are not yet walked; extending it is mechanical and unblocked.
- Matching is substring-based, so a value that happens to be a substring of other output passes
  without being rendered in its own right. It catches omissions, not misplacements.

## [0.5.0-draft] — Extension graduation helper

No format change: every schema, vocabulary, and semantic rule is byte-identical to `0.4.0-draft`.
This release adds the **tooling** half of the graduations that shipped in `0.3.0-draft` and
`0.4.0-draft`.

### Added

- **`@brushcodex/validator/migrate`** — `graduateRecipeDocument(doc, options?)`, the documented,
  deterministic upgrade for documents whose meaning predates a core member. A document written
  before `media[]`, `steps[].source`, `targetArea`, `mixNote`, or envelope `attribution` existed is
  still valid, but its meaning is stranded in an `org.brushcodex.*` extension that only the writing
  tool can read. This recovers it into the core members, and reports what it moved and what it
  could not.
  - Never overwrites a core member the document already states; moves only when the result is
    valid; removes what it moved so one fact never has two homes; does not mutate its input; a
    second run is a no-op.
  - Handles the reference application's `…recipe:attribution`, `…recipe:sourceUrl`, and
    `…recipe:stepDetails[].{area,mixture,timecode}`, and the Creator Assistant's
    `…creator:extraction.source` (including a recorded `creator`, never a licence) and its per-step
    timestamps.
  - **Refuses to invent semantics.** `mediaCitation.label` is free text and the format defines no
    timecode grammar, so a *text* timecode graduates only when the caller passes `readTimecode`.
    `readClockTimecode` implements the common `[H:]M:SS` form and is offered, never applied
    automatically; without a reader the value is reported unmoved and left untouched.
- docs/EXTENSIONS.md §3a documents the graduation contract.

### Changed

- All `@brushcodex/*` packages bumped `0.4.0-draft -> 0.5.0-draft` (lockstep). The bump exists
  because the packed tarballs gained API surface — consumers pin by version, so identical filenames
  must never carry different content.

### Known limitations

- Graduation assumes its input is already valid; it is a compatibility step, not a repair tool. A
  document that was invalid before stays invalid.
- Per-step extension entries are matched to document steps by step id where both carry one, else by
  a declared 0- or 1-based order. An entry that matches neither is reported unmoved rather than
  guessed into position.
- Only Recipe is covered, because only Recipe has had members graduate so far.

## [0.4.0-draft] — Document credit & prose mixtures

The last two facts the reference application had to keep in vendor extensions become core. Both are
prose the format **keeps** rather than structure it fakes, in the same spirit as `step.technique`
beside the closed `role` enum. Backward-compatible: both members are optional and every previously
valid document stays valid.

### Added

- **`attribution`** on the Common envelope, so **every** spec gains it — a human-readable credit
  statement for the document as a whole ("Based on a scheme taught at the Tuesday club night;
  posted with the group's blessing"). Non-empty when present.
  - It does **not** state or grant a licence (that is `license`), does **not** make anyone an author
    (that is `authors`), and consumers **MUST** preserve it verbatim and **MUST NOT** parse it into
    agents or links. Credit for a specific linked work stays on that work (`mediaRef.creator`).
  - The reference application carried this in `org.brushcodex.recipe:attribution`, where an
    attribution obligation was invisible to every other consumer — a provenance gap, not a
    convenience one (Common §4a).
- **`recipe.steps[].mixNote`** — the mixture as the author wrote it ("1:1 Caliban + Moot"), for a
  mixture the structured `mix` cannot express: a component that is not a declared paint (water, an
  undeclared medium) or a ratio written as prose. When `mix` is also present it stays authoritative
  for computation and `mixNote` is the human wording; a consumer MUST NOT parse `mixNote` into
  ratios (Recipe §5).
- **Renderer support** — all four HTML renderers (recipe, palette, technique, bundle) show
  `Attribution` beside authors and licence, so a credit obligation cannot silently vanish in
  rendering; the recipe renderer shows a prose mixture beside the structured ratios, never instead
  of them.
- Two new invalid conformance fixtures (empty `attribution`, empty `mixNote` — crediting nobody and
  describing no mixture are errors, not silently useless values). Corpus: 87 -> **89** fixtures.

### Changed

- All `@brushcodex/*` packages bumped `0.3.0-draft -> 0.4.0-draft` (lockstep).

### Known limitations

- `attribution` is free text by design, so it cannot be machine-checked against a licence or an
  author list; a renderer can only display it. That is the honest shape for a credit obligation —
  the alternative would be inventing structure the author never supplied.
- `mixNote` and `mix` can disagree, and no validator rule can detect it (one is prose). The spec
  makes `mix` authoritative for computation; a producer that writes both is responsible for their
  agreement.

## [0.3.0-draft] — Source attribution & media citations

Backward-compatible additions closing the last evidenced gap where a consumer had to invent a
vendor extension for **portable** meaning: a recipe transcribed from a video tutorial, and the
passage of that video each step came from. Every new member is OPTIONAL; a document valid before
this release stays valid.

Before this release the reference application carried the recipe's source URL and its per-step
timecodes in `org.brushcodex.recipe:sourceUrl` / `:stepDetails` extensions — round-tripping only
between BrushCodex implementations, opaque to every other consumer, and with nowhere to record who
made the cited work or under what licence.

### Added

- **Shared Common `$defs`**:
  - `mediaRef` — promoted to Common from the identical Recipe and Project copies (which now `$ref`
    it), and extended with `id` (a document-local anchor), `relation` (`source`|`result`|
    `reference`), and `creator` (an `agent`). `creator`/`license` describe the **linked work**, not
    the document; neither is ever inferred.
  - `mediaCitation` — `{ media?, startSeconds (required, ≥ 0), endSeconds?, label? }`. Time in
    seconds so any consumer seeks deterministically; `label` preserves the author's written
    timecode so a round trip through a human-timecode representation is loss-free.
- **`recipe.media[]`** — media the recipe as a whole links (the tutorial it transcribes, the
  result, material consulted). Previously only `steps[].media[]` existed, so a recipe could not
  cite its own source at all.
- **`recipe.steps[].source`** — the passage a step was taken from, as a `mediaCitation`.
- **Semantic rules** (Recipe §9), each with an invalid fixture: `media-id-unique`,
  `media-anchor-resolves`, `media-citation-resolves` (an anchorless citation needs exactly one
  `relation: "source"` item), `media-citation-range` (`endSeconds` > `startSeconds`).
- **Renderer support** — the reference HTML renderer shows a "Source & media" section (crediting
  the linked work separately from the recipe) and per-step `Source: 1:00–1:35 of …`, derived from
  the seconds, linked but never embedded. It stays provider-agnostic: constructing a YouTube `?t=`
  or Vimeo `#t=` seek URL is an application's job, not the format's.
- Six new invalid conformance fixtures + expectations; the recipe comprehensive fixture now
  exercises source media, a range citation, a point citation, and an anchorless citation. Corpus:
  81 -> **87** fixtures.

### Changed

- Recipe §7 now distinguishes `recipe.media[]` (the whole recipe) from `steps[].media[]` (one
  step), and §10 states the linked-never-embedded rule: a renderer MUST NOT load media on page
  view, though mounting a player on an explicit press is user intent.
- Project §8 `results[]` documented as the shared `mediaRef` (gains `id`, `relation`, `creator`).
- All `@brushcodex/*` packages bumped `0.2.0-draft -> 0.3.0-draft` (lockstep).

### Known limitations

- Free-text document-level attribution (the reference app's `attribution`) and free-text step
  mixtures still have no core home; they remain in `org.brushcodex.recipe:*` extensions pending
  evidence for the right portable shape. Structured attribution of a cited work is now expressible
  via `mediaRef.creator`.
- `mediaRef.kind` stays `image|video|other`; `audio` and `document` were not added without an
  evidenced case, so a cited podcast is `other`.
- Technique documents still have no `media[]`; a technique sourced from a video cannot cite it yet.

## [0.2.0-draft] — Recipe v1 freeze-prep

Backward-compatible additions preparing Recipe (and the shared Common definitions it embeds) for a
coordinated v1 freeze. Every new member is OPTIONAL; a document valid before this release stays
valid. See the reference app's `RECIPE_V1_FREEZE_PREP_PLAN.md`.

### Added

- **Shared Common `$defs`** consolidated so cross-spec structures are defined once and cannot drift:
  - `resource` — a tool or non-paint material (`name` required; optional `kind: tool|material`,
    `optional`, `specification`, `quantity`, `note`). Recipe `resources`, Technique `tools`, and
    Project `toolsUsed` all `$ref` it (Technique/Project tool shapes gained optional
    `specification`/`quantity`; Project tools also gained `optional` — additive).
  - `documentRef` — a soft cross-document reference `{ id (uri), title? }`. Recipe `techniqueRefs`
    and Project `recipeRefs`/`paletteRefs` `$ref` it.
  - `role` — the coarse step/entry vocabulary, now shared by Recipe and Palette. **`spot_highlight`
    added to Palette** (previously in Recipe only), resolving the drift.
  - `target` — the Recipe/Palette subject, now shared, with new optional `scale`
    (`{ system: nominal_mm|ratio, value }`) and `substrate` (`resin|plastic|metal|mdf|foam|pla|other`).
- **`paintRef.kind`** (`paint|medium|thinner|additive|varnish`; absence = `paint`) and
  **`paintRef.chemistry`** (`acrylic|enamel|oil|lacquer|other`) on the shared paint reference.
- **`recipe.resources[]`**, **`recipe.techniqueRefs[]`**, and a free-text **`step.technique`** label.
- Five new invalid conformance fixtures + expectations for the new closed vocabularies; the recipe
  comprehensive fixture now exercises every new member. Corpus: 76 -> **81** fixtures.

### Changed

- `paintRef.code` description tightened to "the manufacturer's printed product code / item number on
  the bottle," explicitly distinct from `catalogueId` and internal ids.
- Recipe spec §5 role list now includes `spot_highlight` (documentation drift fix).
- VERSIONING.md §8 added (coordinated freeze; post-freeze additive-minor mechanism; enum
  compatibility; schema version negotiation; migration expectations); §7 shared-blocks note corrected
  to reflect the consolidation.
- All `@brushcodex/*` packages bumped `0.1.0-draft -> 0.2.0-draft` (lockstep).

## [0.1.0-draft] — Initial standalone toolkit

### Added

- **Packed release gate** — `pnpm verify:packed` (`scripts/verify-packed.mjs`), one committed,
  cross-platform, CI-runnable command that proves all five package candidates work from **packed
  tarballs** in a clean, isolated consumer with **no source checkout**. It builds from zero, packs
  with pnpm (rewriting `workspace:*`), installs only the tarballs into a throwaway npm project
  outside the repo (a path with a space), and runs schema/types/validator/fixtures/CLI checks under
  plain Node ESM and via the installed `.bin` shims — then repeats the essential checks with
  `examples/`, `packages/*/dist`, and the tarballs renamed away (restored via `finally` + signal
  handlers). It asserts the produced package set, internal version compatibility, and packed
  contents (no `workspace:` leak, repo-relative escape, absolute source path, cross-package `src/`
  import, corpus duplication, or private files), and reports `81/81` conformance from the installed
  corpus. Dependency-free tar reader + assertion helpers (`scripts/lib/**`) are unit-tested via
  `pnpm test:gate` (Node's `node:test`), proving the gate detects a missing packed dependency, a
  repo-relative import, a missing corpus, a broken CLI bin, and a version mismatch. Wired into a new
  GitHub Actions workflow (Linux + Windows). **Never publishes.** See
  [docs/RELEASING.md](docs/RELEASING.md).

- Initial standalone specification snapshot (see [PROVENANCE.md](PROVENANCE.md)):
  - `specs/` — Draft v1 normative text for `common`, `recipe`, `palette`, `inventory`,
    `project`, `technique`, and the `bundle` manifest.
  - `schemas/` — matching JSON Schemas (draft 2020-12), immutable once frozen.
  - `examples/` — valid + intentionally-invalid conformance corpus with `EXPECTATIONS.json`.
  - `conformance/` — corpus documentation.
  - Governance/versioning/licensing docs and canonical license texts.
- **SDK toolkit** in `packages/` (pnpm workspace):
  - `@brushcodex/schema` — the seven JSON Schemas as data (zero deps); smoke-tested.
  - `@brushcodex/validator` — Ajv validators + conformance runner + renderer; its test and
    typecheck suites run self-hosted.
  - `@brushcodex/cli` — `validate` + `conformance` commands; conformance **76/76** across
    7 specs.
- **`@brushcodex/fixtures`** — the example/conformance corpus (76 fixtures across 7 specs)
  packaged as data: a stable, deterministic manifest (`fixtures`, `getFixture`, per-spec
  selectors) plus a Node loader (`loadFixture`, `examplesRoot` for `runConformance`). The corpus
  is generated from the repo-root `examples/` (single source of truth) and **ships inside the
  package**, so an installed consumer never reads this repository; a test gate proves every valid
  fixture validates and every invalid one fails for its documented reason. 16 tests pass; verified
  from an isolated, out-of-repo, source-unavailable consumer.

### Changed

- **`@brushcodex/cli` conformance is now self-contained.** The `brushcodex-conformance` bin loaded
  the corpus via a repo-relative `../../../examples` path, which worked in-repo but broke once the
  CLI was packed and installed. It now loads the corpus through `@brushcodex/fixtures` (its shipped
  `examplesRoot`) — added as a **runtime dependency** kept **external** in the esbuild bundle, so the
  installed CLI resolves the corpus from `node_modules/@brushcodex/fixtures/corpus/**`. The packed
  CLI runs `76/76` from any working directory with the source repo absent. Adds 5 CLI integration
  tests (static no-escape, plain-Node exec from a foreign cwd, manifest-count, packed-layout
  simulation, validate bin). No user-visible behavior, exit codes, or output changed.

### Status at this historical milestone

- All specifications were **DRAFT**. No version was frozen or published.
- Packages were versioned `0.1.0-draft` and **private** (not published to any registry).

### Known limitations at this historical milestone

- `@brushcodex/types` and the packed build gate arrived in later draft milestones.
- Consumer adoption of packed artifacts was tracked independently from the Standard.

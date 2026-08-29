# BrushCodex Recipe (Painting Workflow) — v1 (DRAFT)

- **Spec name:** `recipe`
- **Version:** `1.0.0` (draft; not frozen)
- **JSON Schema:** [`schemas/recipe/v1/recipe.schema.json`](../../../schemas/recipe/v1/recipe.schema.json)
- **Media type (provisional):** `application/vnd.brushcodex.recipe+json`
- **File suffix (provisional):** `.brushrecipe.json`
- **Status:** DRAFT — MAY change incompatibly until frozen.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, and **MAY** are
to be interpreted as described in RFC 2119 and RFC 8174.

## 1. Purpose

A Recipe is a **Painting Workflow**: an ordered, reproducible record of paints, mixtures,
materials, techniques, and actions used — or intended to be used — to paint a subject. A workflow
may be a reusable scheme for an army, a plan prepared before painting, an as-painted record of one
complex miniature, a personal variation of another workflow, or guidance presented as a tutorial.
No one usage is privileged by the format.

`recipe` remains the stable technical spec name and `.brushrecipe.json` remains the provisional
file suffix. Human-facing applications and documentation MAY label the document a **Painting
Workflow**. Calling it a workflow does not change its wire format or create a second document type.

A Recipe **embeds the Common document envelope**
([../../common/v1/README.md](../../common/v1/README.md)) and adds paints, ordered steps, mixtures,
roles, media, and classified alternatives.

The Recipe schema composes the Common envelope by referencing its `envelopeCore` fragment and
closing the object with `unevaluatedProperties: false`, so a Recipe carries **all** envelope
members (identity, versioning, attribution, license, provenance, links, extensions, integrity)
plus the recipe-specific members below, and rejects unknown top-level members.

## 2. Envelope constraints

- `spec` **MUST** equal `recipe`.
- `specVersion`, `id`, `revision`, `title` are REQUIRED (from the envelope).
- All optional envelope members (§4 of the Common spec) MAY appear and behave identically.

## 3. Recipe members

| Member | Type | Rule |
|---|---|---|
| `steps` | array of Step (§5) | **REQUIRED**, at least one step. |
| `summary` | string | Optional short description of the result. |
| `difficulty` | `beginner` \| `intermediate` \| `advanced` | Optional. |
| `estimatedActiveMinutes` | integer ≥ 0 | Optional active hands-on time. |
| `dryingNotes` | string | Optional overall drying guidance. |
| `target` | Target (§4) | Optional subject the workflow is for. |
| `paints` | array of PaintRef (§6) | Optional paints referenced by anchor from steps/mixtures/alternatives. |
| `resources` | array of Resource (§6a) | Optional tools and non-paint materials needed to reproduce the workflow. |
| `techniqueRefs` | array of DocumentRef (§6b) | Optional soft references to Technique documents (by stable id URI). |
| `media` | array of MediaRef (§7) | Optional media the workflow as a whole links — source work it was derived from, results, or material consulted. |

### 3a. Usage profiles are not document types

The same core members support several authoring profiles:

- **Reusable workflow** — instructions intended to be repeated across subjects, such as an army
  scheme. `target`, `paints`, `resources`, and ordered `steps` carry the repeatable process.
- **Planned workflow** — instructions written before work begins. The format does not claim that a
  step was performed merely because it is present.
- **As-painted record** — instructions and mixtures recorded from what the painter actually did.
  Envelope revisions preserve later edits; a Project journal records execution context and progress.
- **Derived workflow** — a workflow adapted from a video, article, class, another recipe, or other
  source. `media`, `steps[].source`, `attribution`, and envelope links preserve that provenance.
- **Published guidance** — a renderer may present any workflow as a tutorial or step-by-step guide.
  Presentation does not alter the document's meaning.

The core deliberately has no `planned` / `recorded` / `tutorial` discriminator. Those labels do
not change how paints, mixtures, or steps are interpreted, and a single workflow can move between
these uses over its lifetime. Producers SHOULD state important context in `summary` or
`description`.

## 4. Target

`description` is REQUIRED; optional `kind` is one of `miniature`, `model`, `material`,
`surface`, `terrain`, `generic`. Target is a shared Common definition (also used by Palette).

- `scale` — optional `{ system, value }`. `system` is `nominal_mm` (wargame/heroic nominal size,
  value like `"28"`) or `ratio` (scale-model ratio, value like `"1:35"`). Physical height and
  subject form (e.g. a bust) are intentionally **not** collapsed into scale — form belongs to
  `kind`/`description`; a physical-height system may be added in a future minor only if evidenced.
- `substrate` — optional physical composition: `resin`, `plastic`, `metal`, `mdf`, `foam`, `pla`,
  `other`. Drives priming and solvent safety (e.g. a solvent primer melts bare foam). Distinct from
  `kind` (a category) and from the `kind` value `material`.
- `identity` — optional Painted Subject identity, defined once in Common (`subjectIdentity`,
  §5.8 there) and inherited here through the shared `target`. It says **which exact subject** the
  workflow's applicability statement denotes: `authority` and `designation` are REQUIRED whenever
  it is present, `qualifier`, `authorityId` and the opaque `subjectId` are optional. It does not
  replace `description`, which stays REQUIRED.

  This is what makes reverse discovery deterministic: two workflows carrying the same `subjectId`
  identify the same Painted Subject without any network resolution, where matching the two
  `description` strings cannot. A workflow written for a class of models — a reusable army scheme,
  ordinary infantry of a squad — carries **no** `identity`, and one **MUST NOT** be invented for
  it. The Recipe spec adds nothing to the Common definition and defines no identity member of its
  own.

## 5. Step

`instruction` (non-empty string) is REQUIRED. Array order is authoritative. Optional members:

- `id`, `title` — a document-local anchor and a short label.
- `role` — a coarse, closed grouping vocabulary shared with Palette (Common `role`): `primer`,
  `basecoat`, `undercoat`, `shadow`, `midtone`, `layer`, `highlight`, `edge_highlight`,
  `spot_highlight`, `wash`, `glaze`, `drybrush`, `weathering`, `metallic`, `texture`, `decal`,
  `varnish`, `other`.
- `technique` — an optional free-text label for the specific named technique/application (e.g.
  `"wet blending"`, `"pin wash"`, `"zenithal"`). Named techniques go here, never into the closed
  `role` enum, so the vocabulary stays small and stable.
- `targetArea` — where on the subject the step applies.
- `paintRefs` — anchors into `paints[].ref` used in this step.
- `mix` — a mixture of **two or more** components, each `{ paint (anchor), parts (> 0) }`. `parts`
  are author-provided ratios, relative within the one mixture. Ratios are **authored**, never
  computed and presented as authored. A component that is not a paint — water, a medium, a thinner —
  joins a mixture the same way, declared in `paints[]` and classified by `kind` (§6). A consumer
  deriving a colour from a mixture **MUST** skip components whose `kind` marks them as not
  colour-determining, and **MUST NOT** present the derived colour as authored. The `parts` of a
  skipped component remain authored data (they record dilution and opacity) and **MUST NOT** be
  renormalised away in what is shown to the reader.
- `mixNote` — the mixture as the author wrote it (e.g. `"1:1 Caliban + Moot"`), for a mixture `mix`
  cannot express: an undeclared component, or a ratio written as prose. Non-empty when present.
  When `mix` is also present, **`mix` is authoritative for
  computation** and `mixNote` is the human wording; a consumer **MUST NOT** parse `mixNote` into
  ratios, and **MUST NOT** drop it when structuring the mixture. This is the same free-text escape
  hatch as `technique` beside `role`: prose the format keeps rather than a structure it fakes.
- `method` — `brush`, `airbrush`, `sponge`, `stipple`, `other`.
- `coats` (integer ≥ 1), `thinning`, `dryingNotes`, `expectedResult`, `warnings`.
- `media` — see §7.
- `source` — the passage of a linked media item this step was taken from (§7a).
- `alternatives` — see §8.

## 6. PaintRef — literal references are first-class

A recipe **MUST** be valid using purely literal paint references, with **no** central catalogue
entry and **no** color value. A PaintRef MUST include at least one of `manufacturer` or `name`;
everything else is optional:

- `ref` — a document-local anchor (so steps/mixtures/alternatives can point at it).
- `manufacturer`, `range`, `name` — literal identity.
- `code` — the manufacturer's printed product code / item number on the bottle (e.g. a Vallejo item
  number like `70.950`). Distinct from `catalogueId` and from any internal database id (forbidden).
- `kind` — OPTIONAL classifier for **any component referenced the way paints are** (in
  `paints[]`/`mix[]`), bottled or not: `paint` (the default when absent), `medium`, `thinner`,
  `additive`, `varnish`. A component that does not determine the resulting colour is marked so the
  color engine skips it (§5). Three rules keep the vocabulary from drifting between implementers:
  - **A household diluent — water above all — is an `additive`.** `thinner` is for a product sold
    and identified as a thinner (a branded airbrush thinner, white spirit). Without this line two
    implementers legally classify "water" differently and the same substance forks inside a
    five-value enum.
  - **`kind` classifies function in the mixture, not purchasability.** A consumer that aggregates
    across documents (a shopping list, an inventory) **MUST NOT** infer that an `additive` is an
    acquirable product; tap water is not a line item.
  - **A colour-bearing component is a `paint` whatever its form.** A dry pigment stirred into a
    carrier determines the resulting colour, so it is referenced with `kind: paint` and the color
    engine **MUST NOT** skip it. `additive` is for what does not determine colour.

  Ordinary tools are `resources` (§6a), never paintRefs; for consumable materials §6a draws the
  line by usage.

- `chemistry` — OPTIONAL binder/solvent family: `acrylic`, `enamel`, `oil`, `lacquer`, `other`. The
  substitution-safety axis (an enamel MUST NOT be silently substituted for an acrylic). These are
  the binder-family subset of Technique's paintClass vocabulary; `chemistry` is distinct from
  paintClass.
- `catalogueId` — an OPTIONAL external stable identifier (opaque token or URI). It is **never**
  required and **MUST NOT** be a BrushCodex internal database id.
- `color` — an OPTIONAL `{ hex }` sRGB value. Its meaning is defined by `provenance`; a hex value
  **MUST NOT** be presented as a physical measurement unless a provenance entry says so.
- `provenance` — Common provenance entries (source class, confidence, review status, …).
- `note`.

This keeps recipes portable and honest: unknown values remain absent, and a recipe never depends
on a giant paint database to be valid.

## 6a. Resources — tools and non-paint materials

`recipe.resources[]` lists everything needed to reproduce the workflow beyond paints: reusable tools
(brush, airbrush, wet palette, hobby knife, UV lamp) and consumable non-paint materials **when used
in the process** (PVA glue, masking putty, static grass, pigments, IPA, sandpaper, resin, gloves;
and mediums/varnish where **not** represented as a paint). A consumable that joins a mixture at an
authored ratio is referenced as a paintRef for that recipe instead — see the line below. Each
Resource is the shared Common `resource` type (also used by `technique.tools` and
`project.toolsUsed`):

- `name` — REQUIRED, and the **only** required member; a resource carries **no** manufacturer or
  catalogue identity.
- `kind` — `tool` (reusable) or `material` (consumable non-paint); optional.
- `optional` — true when the item is optional rather than required (absence means required).
- `specification` — optional human-readable spec, e.g. `"Size 2 round"`, `"0.3 mm nozzle"`,
  `"120-grit"`. Never an invented precise value.
- `quantity` — optional human-readable quantity, e.g. `"a few drops"`, `"2 sheets"`. Never an
  invented measurement.
- `note` — optional free text.

**paintRef vs resource.** Membership follows how the item is used, and the rule splits in two:

- **Tools — unconditional.** A reusable tool (brush, airbrush, wet palette, hobby knife, sandpaper,
  UV lamp, gloves) is a `resource` and **MUST NOT** be modelled as a paintRef, in any recipe, under
  any usage. A tool is never a mixture component.
- **Consumable materials — by usage.** If it is referenced in `paints[]`/`mix[]`, it is a `paintRef`
  classified by `kind` (§6); otherwise it is a `resource`. A consumable that joins a mixture at an
  authored ratio is a paintRef **for that recipe**; the same substance used in the process —
  sprinkled, glued, applied dry — is a `resource`. The same substance may therefore be a paintRef
  in one document and a resource in another; that is the usage speaking, not a contradiction.

Worked examples, because the margin is a judgement call:

- **Sand stirred into a basecoat at 2:1** — a mixture component at an authored ratio, so it is a
  declared paintRef with `kind: additive`, anchored from `mix[]`. (It does not determine the
  colour; the basecoat does.)
- **Sand sprinkled onto wet basecoat** — used in the process, not mixed, so it is a `resource` with
  `kind: material`. The step's `instruction` says how it is applied.
- **Static grass glued on** — a `resource`, *even when the glue mixture's ratio is written down*.
  The ratio belongs to the glue-and-water mixture in that step, not to the grass; the grass never
  enters `mix[]`.

Identity is free text, so no validator can check any of this — it is guidance a producer follows,
not a constraint a consumer may enforce by rejecting documents.

## 6b. Technique references

`recipe.techniqueRefs[]` holds soft references to Technique documents this workflow uses — each a
DocumentRef `{ id, title? }` where `id` is the Technique's stable id URI (the shared Common
`documentRef`, also used by `project.recipeRefs`/`paletteRefs`). A consumer resolves a reference if
it holds the document, otherwise renders `title` (or the id). **An unresolved reference is not an
error.** A workflow never duplicates a technique's fields; the per-step named technique is the
free-text `step.technique` label (§5).

## 7. Media

Media is the shared Common `mediaRef` (also used by Project `results`). `url` (absolute URI) is
REQUIRED. Optional `id`, `kind` (`image`/`video`/`other`), `relation`
(`source`/`result`/`reference`), `caption`, `creator` (a Common Agent), `license` (a Common License
object), and `rightsNote`. Authors are responsible for the rights of linked media; consumers
**MUST NOT** auto-dereference URLs without user intent (see §10).

A workflow carries media in two places, and they mean different things:

- `recipe.media[]` — media the **workflow as a whole** links: source material it was derived from
  (`relation: "source"`), a record of the finished result, or material consulted. A tutorial is one
  possible source, not a required origin.
- `steps[].media[]` — media of **that step**, e.g. a photo of the model after it.

`creator` and `license` describe the **linked work**, not the workflow. Citing a source does not
make its creator an author of the workflow (`authors`), does not place the workflow under the
source's licence, and does not place the source under the workflow's. An absent `creator` or
`license` means
**unknown** and MUST NOT be filled in by inference; that a video is publicly reachable says nothing
about its licence. A `source` relation carries an attribution obligation and grants no rights.

## 7a. Step source citations

`steps[].source` is a Common `mediaCitation`: the passage of a linked media item the step was taken
from — `{ media? (anchor into media[].id), startSeconds (REQUIRED, ≥ 0), endSeconds?, label? }`.

- Time is stated in **seconds**, so any consumer — web, print, mobile, a CLI — can seek without
  parsing human timecode text. `label` preserves the author's written form (e.g. `"1:00-1:35"`) so
  round-tripping through a human-timecode representation is loss-free; a renderer MAY show it but
  **MUST NOT** parse it in preference to the seconds.
- `media` MAY be omitted only when exactly one `recipe.media[]` entry has `relation: "source"`,
  which the citation then targets (§9).
- `source` is deliberately **singular**: a step derives from one passage. Additional material a
  step merely shows belongs in `steps[].media[]`.
- The format states an offset, not a deep link. Constructing a provider-specific seek URL (a
  YouTube `?t=`, a Vimeo `#t=`) is an **application's** job; a document that hard-coded one would
  bind the recipe to one provider's URL syntax.

## 8. Alternatives — classification is mandatory

An alternative substitution MUST declare `type`, one of:

- `authored` — documented by the recipe author;
- `manufacturer_published` — from a manufacturer's own published equivalence;
- `mathematical` — a color-space nearest match (e.g. CIEDE2000); a claim about color distance
  only, **not** about practical substitutability;
- `community_tested` — reported to work by the community;
- `verified_practical` — verified against physical swatches under stated conditions.

These classes **MUST** be kept distinct; an implementation **MUST NOT** relabel a `mathematical`
match as any stronger class. An alternative MUST reference a paint by `paint` (anchor) or carry
an inline `paintRef`.

## 9. Anchor integrity (semantic)

Every anchor used by `steps[].paintRefs`, `steps[].mix[].paint`, and `alternatives[].paint`
**MUST** resolve to a `paints[]` entry whose `ref` equals that anchor. The JSON Schema cannot
express this cross-reference; the BrushCodex reference validator enforces it as a semantic rule
and reports the offending anchor. Envelope semantic rules (e.g. `updatedAt >= createdAt`) also
apply.

Media anchors and citations are subject to the same treatment (rule codes in parentheses):

- A `media[].id` **MUST** be unique within `media[]` (`media-id-unique`) — a reused anchor makes a
  citation non-deterministic.
- A `steps[].source.media` anchor **MUST** resolve to a `media[].id` (`media-anchor-resolves`).
- A citation that omits `media` **MUST** have exactly one `media[]` entry with `relation: "source"`
  to target (`media-citation-resolves`); with none, or with several, it cites nothing definite and
  a consumer **MUST NOT** guess one.
- `endSeconds`, when present, **MUST** be greater than `startSeconds` (`media-citation-range`).

## 10. Security & privacy considerations

- Media is **linked, never embedded**. A renderer MUST NOT turn `media[].url` into a player or
  image that loads **on page view**: that contacts a third party, and discloses the reader to it,
  without intent. Mounting a player in response to an explicit action (the reader presses play) is
  user intent and is permitted. A `source` citation is an offset into the linked work, never
  permission to fetch it.
- `media[].url`, `paintRef.provenance[].sourceUrl`, and all envelope URIs are author-supplied and
  untrusted. Consumers MUST treat them as data, MUST sanitize before rendering, and MUST NOT
  execute or auto-fetch them without explicit user intent. In particular, a renderer that emits an
  `href` MUST allow only safe schemes (e.g. `http`, `https`, `mailto`) — the format permits any
  absolute URI, so a `javascript:`/`data:` URL is valid input and MUST NOT become a clickable link.
- Recipe text and captions are user-authored; a renderer MUST escape them (no HTML/script
  injection).
- A recipe carries no user account identifier; sharing a recipe shares only what the document
  contains.

## 11. Conformance

A document conforms to Recipe v1 if it validates against `recipe.schema.json` (which includes
the Common envelope via composition) **and** satisfies the semantic rules in §9. The reference
validator (`@brushcodex/validator/recipe`) enforces both layers and is tested against the example
corpus in `examples/recipe/v1`, including a full `parse -> serialize -> parse` round trip that
preserves every member and unknown namespaced extensions.

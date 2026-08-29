# Painted Subject Identity — Core Graduation Proposal

A proposal under [GOVERNANCE.md](../GOVERNANCE.md) § "Change process", asking the maintainer to
decide whether an optional, portable Painted Subject identity graduates from the experimental
extension into the Common core.

> **Status, 2026-08-28 — APPROVED and IMPLEMENTED.** The maintainer chose **APPROVE MINIMAL CORE
> GRADUATION** (§15). Common `$defs` now defines `subjectIdentity` and Common `target` carries the
> optional `identity` member; Recipe and Palette inherit it through the shared `target` and Project
> is unchanged. Final member names are `authority`, `designation`, `qualifier`, `authorityId`,
> `subjectId`. See [CHANGELOG.md](../CHANGELOG.md) for what shipped.
>
> This document is kept in its pre-decision voice below, as the decision record. Three figures in it
> were **predictions** and the measured outcome differs — §13's corpus impact and its survey of where
> the corpus total is stated are corrected in place; everything else stands as written.
>
> Every figure below was measured on 2026-08-28 **before** implementation. Re-measure before relying
> on one.

## Versions this was checked against

Read from the installed tree on 2026-08-28, not from prose.

| Where | Item | Version |
| --- | --- | --- |
| this repository | `HEAD` | `8abfeea` (working tree carries the uncommitted spike) |
| `packages/*` | `@brushcodex/schema` · `validator` · `types` · `cli` · `fixtures` | **1.0.0-rc.1** (lockstep) |
| toolchain | Node · pnpm | 22.14.0 · 8.15.0 |
| validator deps | ajv · zod · vitest · typescript | 8.20.0 · 3.23.8 · 2.0.5 · 5.5.4 |
| corpus | `pnpm conformance` | **95/95** across 7 specs (20 valid, 75 invalid) |
| toolkit | `pnpm -r test` | 485 tests green (validator 456 / 23 files, fixtures 16, cli 13) |

All seven specs are **Draft v1**; nothing is frozen.

---

## 1. Problem statement

A Painting Workflow says what it is for in exactly one place: Common `target`, whose only required
member is a free-text `description` (Common §5.6, Recipe §4, Palette §3). That string is durable,
human-readable, offline, and registry-independent — and it supports exactly one machine operation:
string matching.

String matching is wrong in both directions, and the spike measured both:

- **False negatives.** Two painters describing the same sculpt write different sentences
  (`"Example Miniatures Vanguard standard bearer — 32mm plastic, single-pose, banner cast with the
  arm"` vs `"The banner carrier from the Vanguard Strike Force box — 32mm plastic, one piece, banner
  moulded to the arm"`). Normalised comparison returns **false**; they are the same subject.
- **False positives.** A remastered sculpt keeps the manufacturer's name while the geometry — and
  therefore the workflow — changes. Name matching returns **true**; the workflows are not
  interchangeable.

There is no other member a consumer could use instead. The envelope `id` identifies the *document*.
`paintRef.catalogueId` identifies a *paint*. Project `subjects[]` are document-local tracking
records. Nothing in the format denotes the painted thing itself.

**This is not a "representable but unstructured" complaint** (AGENTS.md rule 1). The information is
representable; what is missing is a *deterministic equality key* and a rule that guarantees the
literal identity travels with it. Those are interoperability properties, not authoring convenience.

## 2. Named concrete consumer

> **Given an exact miniature, model, sculpt, or build, find the Painting Workflows and Palettes that
> apply to it** — after which an implementation can perform the operation it already supports:
> translate the selected workflow into paints the painter owns or can obtain.

This is reverse discovery, and it cannot function on `target.description`:

| Requirement | On `target.description` | With a subject identity |
| --- | --- | --- |
| Two independently authored documents agree they are about one subject | Heuristic; **measured false** on the spike fixtures | Deterministic |
| Survives a rebox / new SKU | Cannot match at all | Matches |
| Distinguishes a remaster from the original sculpt | **Measured wrong** — the designations are identical | Distinguishes |
| Declines to answer when the subject is a broad class | Silent | Explicit `undetermined` |
| Works with no network and no registry | Yes | Yes |

The second consumer — paint translation — already works today and is unchanged by this proposal.
It is named only to show that subject identity is the missing *first* step of a pipeline whose
remaining steps the Standard already supports, not a capability seeking a purpose.

### The gap-validation gate (GOVERNANCE.md)

| Gate condition | Assessment |
| --- | --- |
| (1) Genuinely unrepresentable **or** required by a named concrete consumer that cannot function on the current representation | **Met** via the consumer. Reverse discovery is measurably wrong in both directions on today's representation. |
| (2) Not already owned by a sibling spec, **or** satisfiable by namespaced `extensions` | **Sibling ownership: clear** (§5 — no sibling owns it). **Extensions: contested, and argued in §7.** |

**Proposed outcome: `CORE_CANDIDATE`.** The honest counter-reading is recorded in §7 and §14.

## 3. Domain boundary — five concepts that must not be conflated

| Concept | Answers | Where it lives | Portable? |
| --- | --- | --- | --- |
| **Painted Subject identity** | *Which exact thing in the world does this denote?* | Proposed: Common `$defs`, attached inside `target` | Yes — open |
| **Target / applicability** | *What class of thing does this document apply to?* | Common `target` today (`kind`, `description`, `scale`, `substrate`) | Yes — unchanged |
| **Source Product identity** | *Which commercial box did it come in?* | **Nowhere in the Standard**, by decision | Out of scope |
| **Project tracking subject** | *Which unit of work in this painter's project?* | Project `subjects[]` — `name` + a document-local `ref` | Document-local only |
| **Document identity** | *Which document, at which revision?* | Envelope `id` / `revision` | Yes — unchanged |

A sixth already exists and must not be drawn into the same bucket: `paintRef.catalogueId` identifies
a *paint*, not a subject.

**A live naming hazard.** Three of these want the same English word. Project already calls its
tracking records `subjects[]`, and Common `target`'s own schema description reads *"The subject a
document is for."* An implementation task must choose member names and prose that keep the three
apart in a reader's head; this proposal deliberately does not fix final member names (§6).

## 4. Evidence from the extension spike

Measured, not argued. The spike carries five Recipe documents and 26 tests; the full repository gate
was green with the spike in the tree.

| Case | Measured result |
| --- | --- |
| Exact subject, two independent authors | Same identifier → `same`; normalised description matching → `false` |
| Differently authored, differing literals | One document carries an authority-assigned code, the other does not; qualifiers differ; equality unaffected |
| Multi-model box / SKU false positive | Sergeant and ordinary trooper share one SKU. SKU equality → "same" (**wrong**). Subject comparison → `undetermined`, never a false match |
| Reissue / rebox | Different product name, different SKU, identical identifier → `same` |
| Resculpt | Identical designation, so name matching → "same" (**wrong**). Distinct identifiers → `distinct` |
| Broad target, no identifier | Fully valid; round trip fabricates nothing; an absent identifier never yields a match, **not even against itself** |
| Registry unavailable | With a resolver that throws, every document still renders a complete subject from its literals; equality still decides; the one official URL is never consulted |
| Product context deleted entirely | All four verdicts unchanged. **No Product ID was defined and none was required** |
| Cost to the Standard | `5/5 valid` against the **unchanged** Recipe v1 schema and semantic rules; conformance stayed at 95/95 |

Two further measurements bound the claim honestly:

- **The tests are load-bearing.** Altering one shared identifier by a single token failed 6 of the
  26 tests across four cases. They are not vacuous assertions.
- **The comparator is nine lines** of ordinary consumer code — no service, no catalogue, no network.

## 5. Sibling ownership analysis

Measured: exactly two schemas `$ref` Common `$defs/target` — `recipe` and `palette`. Technique,
Inventory, Project and Bundle do not.

**Common owns the structure.** This is the repository's established pattern, applied deliberately:
VERSIONING §7 records the consolidation of `paintRef`, `colorValue`, `resource`, `documentRef`,
`role` and `target` into Common `$defs` "so they are defined once and cannot drift". `resource` is
the closest precedent — one definition, three different attachment points (Recipe `resources`,
Technique `tools`, Project `toolsUsed`), each with its own semantics.

**Recipe and Palette consume it through the shared `target`.** One attachment point; both specs gain
the capability without either adding a member of its own. Palette is a genuine sibling consumer, not
a symmetry argument: a palette authored for one exact sculpt has the identical reverse-discovery
need, and Palette §10 states the sharing of `target` exists precisely "so the two cannot drift".

**Project does not change.** Measured: `subjects[]` requires only `name`; `ref` is a document-local
anchor whose entire contract is the semantic rule `subject-anchor-resolves` binding
`journal[].subjectRef` to it; every other member is status, progress, stages, checklist, note. The
comprehensive fixture's subjects are `"Sergeant"` and `"Trooper A"` — instance labels. One Painted
Subject maps to **many** tracking records (ten troopers from one sculpt are ten records), so the two
layers are orthogonal and must not be collapsed. **No current Project consumer requires the identity
structure**, and GOVERNANCE's gate would correctly reject adding it for symmetry. Common ownership
keeps that door open at zero cost if a consumer later appears.

### Why the two rejected placements were rejected

- **Identity beside `target`** (a separate member on each spec) — rejected because Recipe would need
  its own subject member and Palette its own: two members, two prose sections, two things to drift.
  That is exactly the condition VERSIONING §7's consolidation was performed to end. Reintroducing it
  for the newest concept moves backwards.
- **Recipe-local identity** — rejected because Palette shares the very structure the identity refines
  and has the same consumer. A Recipe-only field would force Palette to copy or diverge.

## 6. Proposed semantic capability — the smallest addition

Two conceptual additions. Nothing else.

**(a) One reusable Common `$defs` structure: a Painted Subject identity.** Five members:

| Member (conceptual) | Presence | Meaning |
| --- | --- | --- |
| identity authority | **REQUIRED when the structure is present** | The party whose designation the identity is anchored to — manufacturer, studio, or sculptor. Never a retailer. |
| subject designation | **REQUIRED when the structure is present** | The subject's name as that authority gives it. |
| stable subject identifier | optional | The opaque equality key (§8). |
| identity-relevant qualifier | optional | Only the paint-relevant distinction needed to remove ambiguity. Not a description. |
| authority-assigned subject identifier | optional | A sculpt or part code the authority itself issues. Never a SKU. |

**Zero new closed vocabularies** — so nothing new must be settled in
[VOCABULARY_SIGNOFF.md](VOCABULARY_SIGNOFF.md) before a freeze.

**Deliberately absent from the structure:** any description, `kind`, `scale`, or `substrate` — so it
is structurally incapable of becoming a second `target`; and **the optional references/URL array the
spike carried**. That last is a narrowing this proposal makes against the spike: links carry a
rights and attribution surface that Common already owns properly through `mediaRef`
(`creator` / `license` / `rightsNote`), and no consumer needed them — the spike proved equality with
a reference present on one document, absent on the other, and consulted in neither.

**(b) One new OPTIONAL member on the shared Common `target`,** referencing that structure. Recipe and
Palette gain the capability with no change to either spec's own member list.

**Recipe / Palette:** no independent identity structures. **Project:** no change.

The structure's shape is **domain-neutral** — authority, designation, qualifier, identifiers describe
any authority-named discrete object, so no miniature vocabulary enters Common. Its bound is normative
prose, not an enum whitelist: it denotes a **Painted Subject** — the discrete, authority-named object
a workflow is applied to — and MUST NOT identify a consumable material or a commercial product.

A schema-level conditional on `target.kind` (`miniature` / `model` / `terrain` only) is **not**
proposed, for three measured reasons: `kind` is optional, so the conditional cannot fire reliably; it
would hard-couple two vocabularies that then freeze together (VOCABULARY_SIGNOFF records
`target.kind` as *Settled* at six values); and the repository's own practice is to bound by meaning
and keep closed vocabularies small.

### Illustrative shape — NON-NORMATIVE

> Member names below are **illustrative only** and are not proposed for adoption. They exist so a
> reviewer can see the shape at a glance. Naming is an implementation-task decision (§3).

```jsonc
// NON-NORMATIVE illustration
"target": {
  "kind": "miniature",
  "description": "Example Miniatures Vanguard standard bearer — 32mm plastic, single-pose",
  "scale": { "system": "nominal_mm", "value": "32" },
  "substrate": "plastic",
  "identity": {
    "authority": "Example Miniatures",
    "designation": "Vanguard Standard Bearer",
    "qualifier": "original sculpt; banner cast integral to the left arm",
    "authorityId": "VG-SB-01",
    "subjectId": "brushcodex:subject:example-miniatures/vanguard/standard-bearer"
  }
}
```

## 7. The literal-floor invariant

> **Whenever a Painted Subject identity is present, an identity authority and a subject designation
> MUST both be present.** The stable subject identifier, the qualifier, and the authority-assigned
> identifier are each OPTIONAL. The requirement is **unconditional** — it does not depend on whether
> a stable identifier is present.

Four reasons, in order of weight:

1. **Offline portability, which is the whole point.** Under a conditional rule ("floor required only
   when an ID is present") a document could carry a qualifier alone — neither resolvable nor
   readable. The unconditional rule guarantees that *every* identity a reader meets is legible with
   the network down.
2. **It is the `paintRef` rule, one level up.** Common already enforces a literal floor with
   `anyOf: [{required: ["manufacturer"]}, {required: ["name"]}]` inside `paintRef`, and ships
   `paint-without-identity.json` invalid fixtures in three specs. One unconditional `required`, no
   conditional schema logic, a proven fixture pattern.
3. **A hollow object is not "unknown".** The envelope's rule is that unknown values remain *absent*.
   Absence must mean the member is absent — not an object present and saying nothing.
4. **It costs no legitimate document.** The spike's broad case is exactly floor-present,
   identifier-absent, and passes unchanged.

### Why extensions cannot enforce it — and the honest counter-argument

`extensions` is open JSON: any value is schema-valid. More decisively, `docs/EXTENSIONS.md` §3 makes
an extension **optional for baseline conformance** — "a reader ignorant of it stays conformant". So
no independent implementation may *rely* on the floor travelling. Under the extension, a document
can carry an identifier with nothing readable beside it and remain a fully conformant Recipe. The
spike's five fixtures observe the rule because their author chose to; the format cannot require it.

That is a **reliance** gap, not a representability gap, and it is the entire reason to graduate. But
it should be weighed honestly, because GOVERNANCE gate condition (2) asks whether the need is
"satisfiable by namespaced `extensions`" — and semantically, it was. **A maintainer could reasonably
read gate (2) as unmet and return `EXTENSION_CANDIDATE`.** The argument against that reading: an
extension that two implementations must agree to honour, with no way for either to state or check
the agreement, is a private convention, not interoperability — and interoperability is what
GOVERNANCE says the Standard exists to carry. Running the extension for longer cannot change this;
no amount of further extension iteration can make an optional-by-definition member enforceable.

## 8. Identifier semantics

The stable subject identifier is an optional **progressive enhancement**, modelled directly on
`paintRef.catalogueId` (Common §5.7), whose rules are proven and already frozen-ready:

- **Optional.** Its absence is honest and common; it MUST NOT be fabricated (envelope rule, Common §4).
- **External and opaque.** Equality is **whole-string equality**. Consumers **MUST NOT** infer
  semantics from identifier segments — a parser that reads a trailing token as "remaster" would make
  registry allocation policy leak into the file format.
- **Denotes the Painted Subject** — never the Recipe or Palette document, a Source Product, a SKU, a
  retailer listing, a storefront URL, or an internal database row.
- **Resolution is best-effort.** An unresolved identifier is **NOT** an error, and an implementation
  **MUST NOT** require resolution in order to consider a document valid. A consumer that cannot
  resolve it **MUST** fall back to the literal identity.
- **No network requirement** anywhere in validation, equality, or rendering.

The RECOMMENDED form is a URN-style, lowercase, slugged path — conceptually
`brushcodex:subject:…` — stated as a **convention, not a constraint**, exactly as Common §5.7 states
`brushcodex:paint:<manufacturer>/<range>/<paint>`. The member is typed as an opaque non-empty string
so other namespaces stay valid, and resolvers treat an identifier they do not recognise as simply
unresolvable. **This proposal does not finalise the syntax**; nothing in the capability depends on
it, because equality is whole-string.

## 9. Cardinality

> **This proposal graduates the proven single-target identity capability only.**

Common `target` is singular today in every respect: one optional object, one `description`, one
`scale`, one `substrate`. A singular optional identity refinement inherits that cardinality and
introduces no new assumption — it sharpens an existing one, from "one description" to "one denoted
entity", which the prose must state plainly.

The cases that want plurality already exceed singular `target` independently of identity:

- **multiple exact sculpts** and **paired subjects** — cannot express two substrates or two
  descriptions today either;
- **hero + companion + terrain diorama** — three `kind` values under one singular `target` today;
- **a complete squad** — has a first-class single-identity answer where the authority names the unit
  (the unit is then the Painted Subject), and otherwise is a broad-class target with no identifier.

If a future concrete consumer requires plural targets, that is a **separate target/cardinality
proposal**, not a silent expansion of this one. Recording the choice matters because it is
asymmetrically expensive: singular → plural after a freeze is a **major** change.

## 10. Scope exclusions

Explicitly **not** proposed, now or as an implied next step:

BrushCodex Product ID · Source Product graph · SKU semantics · product containment · bundle
membership · release history · retailer information · price · stock · affiliate URLs · geographic
availability · sponsorship · live commercial lifecycle · alias resolution · historical names ·
same-sculpt equivalence graph · resculpt/remaster relationship graph · matching or ranking
confidence · resolution confidence · evidence reconciliation · inferred applicability · image
recognition · subject-resolution algorithms.

Painted Subject and Source Product remain distinct domains. A commercial rebox or SKU change does
not create a new Painted Subject; the spike measured that a shared SKU is a false equality key and
that deleting all product context changes no verdict.

## 11. Open Subject Registry boundary

> **Identity is open. Intelligence is not open by default.**

**Normative in the Standard**, because interoperability fails without it: what the identity denotes;
the literal floor (§7); opacity and whole-string equality (§8); unresolved-identifier behaviour;
no fabrication; the Product/SKU exclusion.

**Registry policy, and deliberately not Standard text:** identifier allocation; stability across
rebox and SKU change; when a resculpt or remaster earns a new identity; collision handling;
canonicalisation and slugging; registry governance; alias and equivalence handling.

**No allocation rule needs to be normative.** Test it: two implementations holding the same document
agree on equality regardless of how the identifier was allocated; two implementations minting
independently diverge, and the format already defines that case as *unresolvable*. Opacity is the
only adjacent rule that must be normative, and it is a format rule, not an allocation rule —
without it, allocation semantics would leak into the file format through segment parsing.

The minimum public identity record is the five members of §6(a) and nothing else. Everything in §10
is derived, commercial, or judgemental, and none of it is needed to answer "are these two documents
about the same miniature?"

## 12. Compatibility and versioning assessment

**Classification: MINOR** under [VERSIONING.md](../VERSIONING.md) §2 — new optional members only. A
document valid under `1.0` remains valid. No migration is required (§8.6).

| Change | Class | Proposed? |
| --- | --- | --- |
| New optional identity structure in Common `$defs` | minor | **Yes** |
| New optional member on `target` referencing it | minor | **Yes** |
| Redefining, moving, or removing `target.description` | **major** | No |
| Making identity REQUIRED on existing targets | **major** | No |
| Changing `target` cardinality | **major** | No — §9 |

**Before freeze** (today): `target` is DRAFT, so the addition is an in-place edit to the shared
Common definition, entering the coordinated `1.0.0` freeze with its embedders (§8.2). What freezes is
the required-when-present rule and the member semantics; there are no new closed vocabularies to
settle.

**After freeze**: §8.3 forbids editing the frozen file. The same optional addition would ship as
additive, immutable **sibling schemas** — and because `target` is shared, that means **common +
recipe + palette `1.1` together**, each with its own `$id` and `specVersion`. §8.5 then applies: a
strict `1.0`-only consumer **MUST NOT** silently validate a `1.1` document, so the capability would
arrive behind a version wall, unreadable to every `1.0` implementation. That is an interoperability
cost, not merely paperwork.

**Freeze timing is not the justification for this proposal.** The justification is the
interoperability gap in §1–§2. Freeze timing is implementation cost and risk context, and it is
recorded here so the maintainer can weigh *when*, having decided *whether*.

## 13. Conformance plan (specification only — not implemented)

What a later implementation task must produce. Per CONTRIBUTING, prose and schema must both change
and `pnpm check:consistency` must pass, since it asserts every schema property name appears in the
prose.

**New valid fixtures (3):**

| Fixture | Proves |
| --- | --- |
| Recipe — exact identity **with** a stable identifier | The equality key, and that a Recipe carrying it validates |
| Recipe — literal identity **without** an identifier | Unknown precision stays honest inside the structure |
| Palette — exact identity | Palette inherits the capability through shared `target`, with no palette-local member |

**New invalid fixtures (2), each with an `invalid/EXPECTATIONS.json` entry:**

| Fixture | Expected rejection |
| --- | --- |
| identity object missing the authority | `required` at the identity instance path |
| identity object missing the designation | `required` at the identity instance path |

These two are the *only* enforcement the graduation buys over the extension (§7). If they cannot be
written, the proposal has failed and should be rejected.

**Cases already covered — assert as regressions, do not add files:**

- **Target-less Recipes must remain valid.** Measured: 3 of 7 valid recipe fixtures
  (`minimal`, `literal-paints-no-catalogue`, `tutorial-derived-workflow`) carry **no `target` at
  all**.
- **A broad target with no identity must remain valid.** Measured: `palette/v1/comprehensive.valid.json`
  targets `"28mm heavy infantry"` — a class, not an entity. Recipe's `comprehensive`,
  `reusable-army-workflow` and `water-thinned-mixture` are the same shape.

**Corpus impact:** predicted 95 → 100 (23 valid, 77 invalid); **measured after implementation:
95 → 99 (22 valid, 77 invalid)** — one fewer new valid fixture, because the exact-identity Recipe
case was folded into the comprehensive fixture rather than added beside it. The corpus total is
stated in **ten places** across `AGENTS.md`, `CONTRIBUTING.md`, `README.md`, `LAYOUT.md`,
`docs/EXAMPLES.md`, `docs/QUICKSTART.md`, `docs/RELEASING.md`, `packages/README.md` and
`packages/cli/README.md`; they already disagree with one another (`92`, `95`, `89 cases — 16 valid,
73 invalid`) and must be **re-measured and corrected together**, not re-cited. (Predicted;
**measured after implementation: fourteen places across ten files** — this survey missed
`docs/VALIDATE_WITH_JSONSCHEMA.md`, and `docs/RELEASING.md` and `packages/README.md` each state the
total twice.)

**Two consequences that are easy to miss, both measured:**

1. **The renderer coverage test will force a decision.** `packages/validator/src/render/coverage.test.ts`
   walks each spec's *comprehensive* fixture and asserts every leaf value reaches the reader, with an
   explicit exemption list. If identity is added to the comprehensive Recipe and Palette fixtures —
   which this proposal **recommends**, because it is the strongest proof that identity does not
   become invisible machinery — then the authority and designation **must be rendered**, and the
   opaque identifier should be **exempted with a reason**, mirroring the existing
   `/catalogueId$/ → "an external database id is not reader-facing"` entry.
2. **The packed release gate is required.** The fixtures package content changes, so
   `pnpm verify:packed` and `pnpm test:gate` must run in addition to `pnpm -r test`, `pnpm -r typecheck`,
   `pnpm conformance`, `pnpm check:consistency`, `pnpm check:links` and `pnpm check:publication-safety`.

**Toolkit work:** the Zod model in `packages/validator/src/common/structures.ts` (beside
`targetSchema`), the re-exported types in `@brushcodex/types` and its `cover.test-d.ts`,
round-trip preservation, and the regenerated fixtures manifest.

**Graduation helper:** documents already written with the experimental extension would be left
stranded (EXTENSIONS §3a). Whether to extend `@brushcodex/validator/migrate` to move
`org.brushcodex.subject:identity` into the core member is a judgement for the implementation task —
the spike's five documents are synthetic and no production document is known to carry the extension,
so the honest default is **no helper** unless a real corpus is found.

## 14. Alternatives rejected

| Alternative | Why rejected |
| --- | --- |
| **Keep `target.description` only** | Measured wrong in both directions (§1). The consumer cannot function. |
| **Extension forever** | The extension carries the semantics but cannot *enforce* the literal floor, and EXTENSIONS §3 makes it optional for baseline conformance, so no implementation may rely on it (§7). A private convention, not interoperability. |
| **Recipe-local field** | Palette shares the structure identity refines and has the same consumer; a Recipe-only field forces Palette to copy or diverge. |
| **Identity beside `target`** | Forces one member per spec — two definitions, two prose sections, two things to drift. Exactly what VERSIONING §7's consolidation ended. |
| **Reuse the document `id`** | The envelope `id` identifies the *document*. Two workflows about one subject are two documents with two ids, by design; forks and revisions would break equality further. |
| **Reuse `paintRef.catalogueId`** | Identifies a *paint*. Overloading it would conflate two identity domains and break the resolution contract in Common §5.7. |
| **Use the Source Product SKU** | **Measured false**: a sergeant and an ordinary trooper share one box SKU and are different painted subjects. The SKU comparator returns "same" and is wrong. |
| **Add a Product ID now** | No consumer required it — the spike deleted all product context and every verdict was unchanged. Adding it would import commerce, availability, and a containment graph the Standard has decided not to hold (AGENTS.md § "Never here"). |

## 15. Decision requested

The maintainer is asked to choose one:

- **APPROVE MINIMAL CORE GRADUATION**
- **KEEP EXPERIMENTAL**
- **REVISE PROPOSAL**
- **REJECT**

### Recommendation: APPROVE MINIMAL CORE GRADUATION

The consumer is named and measurably blocked on today's representation; sibling ownership is settled
against measured evidence; the addition is two optional members and no new vocabulary; the
compatibility class is minor with no migration; and the only capability graduation actually buys
over the extension — an enforceable literal floor — is testable by two invalid fixtures, so approval
is falsifiable rather than a matter of taste.

**What would make REVISE the right answer instead:** a maintainer who reads GOVERNANCE gate (2)
strictly — "satisfiable by namespaced extensions" — may hold that the semantics *were* satisfiable
and that enforceability alone does not clear the gate. That is a defensible reading, and §7 states
the counter-argument rather than hiding it. It is a governance judgement, not an evidence gap, and
running the extension longer cannot resolve it.

**No architectural question remains open.** The one decision this proposal deliberately defers —
final member names — is an implementation-task decision, and the one it deliberately declines —
plural target cardinality — is a separate proposal with its own consumer requirement (§9).

**On approval, the single next action:** open the implementation task that writes the Common `$defs`
structure and the optional `target` member, in prose and schema together, with the five fixtures of
§13 — and nothing else.

# Free-Form Mixture Ingredients — Does the Standard Move?

One recommendation per decision, with the evidence behind it. Companion to
`brushcodex-community/STEP_MIXTURE_DECISIONS.md` (whose B1 this partially supersedes),
`brushcodex-community/RECIPE_V1_FREEZE_PREP_PLAN.md` (D2/D3 there drew today's
paintRef/resource line), and [VERSIONING.md](../VERSIONING.md) §2/§3/§7/§8.

> **Status, 2026-08-10 — D1 and D2 are executed; D3 and D4 are not.** This document was written as
> a recommendation and is kept in that voice below; what follows is what actually happened, so a
> later reader does not act on a stale premise.
>
> | Decision | Status |
> | --- | --- |
> | **D1** — water as a structured mixture component | **Executed** in the Standard: prose, schema descriptions, both example rewordings, the new `water-thinned-mixture.valid.json` fixture, and the renderer swatch alignment with its test. Item 10 (the declined product-vs-ambient signal) stands **declined** and is now backed by normative prose: `kind` classifies function, not purchasability, and an aggregating consumer MUST NOT read an `additive` as acquirable. |
> | **D2** — scenic materials and the MUST NOT | **Executed**: the rule is split (tools unconditional, consumables by usage), the three worked examples are normative prose in Recipe §6a, and the `additive`/pigment hole is closed. |
> | **D3** — `resource` anchor on `mixEntry` | **Still deferred.** Both reopen triggers below remain unfired and still read correctly against the executed prose — see the note under them. |
> | **D4** — freeze sequencing | **In progress**, as `docs/plans/V1_FREEZE_PLAN.md` in the workspace root. Steps 1–2 of its order are done in this repo. |
>
> Re-measure before relying on any figure in this document; every number below was true on the day
> it was taken. The `paintRef.kind` vocabulary's settlement is recorded in
> [VOCABULARY_SIGNOFF.md](VOCABULARY_SIGNOFF.md).

**Nothing here was implemented when this was written.** This document was the recommendation only;
the owner authorised execution separately, and the status table above records the outcome. Every
"what moves" list below is the proposal as written.

## The question

On 2026-08-10 the Standard's first and only adopter shipped "Add ingredient" to production
(`brushcodex-community:20260810-mix-ingredient.1`): an author types `water` and it becomes a
declared `paintRef` with `kind: "additive"`, referenced by a structured `mix[]` row. That
document **validates** — proven below, against both installed validators — while the
Standard's prose says, in three places, that it should not exist: the comprehensive
fixture's `mixNote` demonstrates that *"water is not a declared paint, so this mixture has
no structured form"*; `kind` is described as classifying *"a paint-like bottled product"*
(Recipe §6, `common.schema.json`); and *"ordinary tools and scenic materials MUST NOT be
modelled as a paintRef"* (Recipe §6a, Common §5.6) — while the shipped control accepts
`sand` as readily as `water`. The first adopter and the prose disagree on day one. One of
them moves. These are the decisions about which, per component class.

Every option below is judged through the stated project goal, **wide adoption**:

- Would a second implementer, reading only the spec, do the right thing without asking?
- Does a simple document stay simple (the `mixNote` escape hatch survives untouched)?
- Does it avoid freezing a mistake? v1 is DRAFT: in-place semantics changes are free now
  and cost an immutable sibling schema plus version negotiation after freeze
  (VERSIONING §3, §8.3). Tightenings and semantics changes are **only cheap now**.
- Does the first adopter conform on day one of the frozen v1, and with how much rework?

## Versions this was checked against

Read from the installed trees on 2026-08-10, not from prose:

| Where | Package | Version |
| --- | --- | --- |
| `brushcodex-standard` (this repo, `40705d4`, clean) | `@brushcodex/schema`/`types`/`validator`/`fixtures`/`cli` | **0.9.0-draft** |
| `brushcodex-standard` | `artifacts/` | **empty** — no 0.9.0-draft tarball exists anywhere |
| `brushcodex-community` (`e66b9ba`, 2 commits ahead of origin) | vendored `@brushcodex/*` tarballs | **0.8.0-draft** |
| `brushcodex-community` | `next` / `react` / `zod` | 16.3.0-preview.10 / 19.2.8 / 3.23.8 |

`pnpm conformance` in this repo: **92/92 green**. Production (asked the host via
`pnpm prod:status`, same day): image `brushcodex-community:20260810-mix-ingredient.1`,
healthy, 10 migrations, none pending, ledger agrees.

## One premise re-measured, one correction

**"The owner has since authored water mixes on the live site" is not what production
holds.** Measured today: the prod database has **1 user, 0 recipes, 0 recipe steps**. The
demand evidence is real but different in kind: commit `20eaa7e` records that *"the owner
hit exactly this on the live site"* — a friction event (water could not join a structured
mixture without a three-stop tour), not persisted data. So the honest statement of demand
is: the corpus measured 2026-08-09 (0 medium/thinner mixtures, 6 water mentions all
consistency-talk, 3 paint+paint mixes) still stands, **plus one recorded attempt by the
project's only real user to write a water ratio down**. Community's B1 set its own
reversal bar at "recorded ratios in ~5% of steps"; what arrived was n=1. That is thin —
and it is also 100% of the users the platform has.

## Facts established by running them (2026-08-10)

Five scenario documents were built from `examples/recipe/v1/comprehensive.valid.json` and
run through **both** installed validators (`validateBySpec('recipe', …)`) and the reference
HTML renderer (`packages/validator/src/render/recipe-html.ts`):

| Scenario | 0.8.0-draft (Community's) | 0.9.0-draft (this repo) |
| --- | --- | --- |
| S1 — drybrush thinned with tap water (`kind: additive`, exactly what the app emits) | valid | valid |
| S2 — oil wash cut with white spirit (`kind: thinner`, `chemistry: oil`) | valid | valid |
| S3 — glaze medium at a recorded ratio (`kind: medium`) | valid | valid |
| S4 — sand stirred into a basecoat (`kind: additive`) | valid | valid |
| S5 — orange juice with a colour hex (`kind: additive`) | valid | valid |

What the runs establish:

- **The schema has never encoded the prose's prohibition.** `mixEntry` is
  `{ paint, parts }`; the anchor-integrity rule (`packages/validator/src/recipe/validate.ts`)
  checks only that `mix[].paint` resolves to a `paints[].ref` — `kind` plays no part in
  either validation layer. A `paintRef` needs only a `name`. Water, sand, and orange juice
  are all conformant documents *today*, under the current draft and under the version the
  adopter ships. Any third-party producer could already emit them.
- **The renderer tells a reader less than the prose promises.** `kind` renders as a badge
  in the Paints section only; inside the Mix list, `water — 1 part(s)` is typographically
  indistinguishable from a paint. And S5 proves the schema description's claim that a
  renderer "does not draw a swatch" for non-paint kinds is false in the reference
  implementation: an `additive` carrying `color.hex` gets a full swatch chip. Swatch
  suppression is currently an accident of the producer omitting `color`, not a behaviour
  anyone implements.
- **The "colour engine skips them" mechanism is implemented nowhere.** In the only
  adopter, `src/modules/color` and `src/modules/shopping` contain no reference to `kind`
  at all (grep, today); its only uses are display labels. No conformance case pins the
  skip behaviour. The spec's central justification for `kind` is currently unenforced,
  untested prose.
- **Chemistry on a non-paint is legal and meaningful.** S2's white spirit as
  `kind: thinner, chemistry: oil` validates and renders both badges. The prose describes
  `chemistry` as the binder/solvent family; for a thinner it reads naturally as the
  compatibility family. No change needed; noted because D1's rewording must not
  accidentally forbid it.

## What comparable formats did (researched 2026-08-10, sources cited)

- **BeerXML 1.0** — the format that actually won mass hobbyist adoption — models
  miscellaneous ingredients as a **structured envelope with free-text identity**: `MISC`
  has a small closed *role* enum (`Spice | Fining | Water Agent | Herb | Flavor | Other`)
  and a free-text `NAME`; identity is never a controlled vocabulary
  (http://www.beerxml.com/beerxml.htm). Its `WATER` record is first-class but demands six
  ion-concentration fields, so casual users simply omit it — the cautionary half of the
  lesson: a commodity made first-class **with required attributes** gets skipped. BeerXML
  froze with documented flaws and stayed the universal interchange floor for ~20 years;
  BeerXML 2, the tightening, never shipped (https://en.wikipedia.org/wiki/BeerXML,
  https://github.com/brewpoo/BeerXML-Standard).
- **BeerJSON 1.0** kept the same misc pattern (enum for role, free text for identity,
  optional `producer`/`product_id` hooks) while fixing BeerXML's unit ambiguity with
  typed unit/value objects — and its stricter, richer surface measurably slowed adoption:
  years after release it is still "public beta" in major tools, described by an
  implementer as "quite a large task"
  (https://github.com/beerjson/beerjson, https://github.com/Brewtarget/brewtarget/discussions/795,
  https://docs.brewfather.app/getting-started/import-recipes).
- **schema.org/Recipe** put ingredients in free text: maximal publisher adoption, and a
  decade of consumer-side pain — the NYT trained a model on ~130,000 hand-labelled
  examples to parse its *own* ingredient lines; the best current parser still misses ~1
  line in 24; structure is now being bolted on additively
  (https://github.com/nytimes/ingredient-phrase-tagger, https://ingredient-parser.readthedocs.io/,
  https://github.com/schemaorg/schemaorg/issues/4454). Free text is fine as annotation and
  a liability the moment consumers must **compute** from it. A recorded ratio is computable
  data.
- **GPX** froze without a first-class slot for commonly-needed data; vendors invented
  incompatible extension names for the same concept (`hr` vs `heartrate`) and tools
  silently drop each other's data on round-trip
  (https://logiqx.github.io/gps-wizard/gpx/extensions.html). An undirected escape hatch
  fragments. This is what `mixNote`-as-the-only-home for water invites once there is more
  than one producer.
- **Versioning:** no documented case was found of a format tightening semantics after
  adoption and surviving; tightening efforts fail to ship (BeerXML 2), while additive-only
  evolution (schema.org's supersede-never-remove) preserved trust. Whatever the Standard
  wants to say about mixtures, it must say **before** the freeze.

---

<a id="d1"></a>

## D1. Household liquids: is water a legitimate structured mixture component?

### Recommendation

**Yes — bless it, in prose, before the freeze. The schema does not change; no new enum
value; the app does not change.** `kind: additive` is the correct classification for a
household liquid joining a mixture at an authored ratio, and the prose moves to say so.
The `mixNote` escape hatch survives untouched as the home for prose ratios and unratioed
splashes.

This ratifies what Community shipped — knowingly, and on the record: it reverses the
resolution of B1 ("the rows hold the paints, the note holds the water"), which was written
as the design 24 hours before the owner's friction event demonstrated its cost. The
reversal must be recorded in `STEP_MIXTURE_DECISIONS.md` the same day this lands, with the
old evidence bar and what actually moved it.

### Evidence

- **The prohibition exists only in prose, so "keep water out" is not a reachable state.**
  All five scenarios validate under both installed validators today (table above). The
  option "water stays mixNote-only and Community reverts the feature" was argued
  adversarially and fails on this: reverting one UI control cannot restore an ontology the
  schema never encoded. Any third-party producer can emit water rows now and the reference
  validator accepts them. Reverting buys back the contradiction, not the design.
- **The only real user's only recorded act was to try to write a water ratio down**
  (commit `20eaa7e`). The corpus says recorded water ratios are rare (0 in ~18.5k words of
  tutorial transcript); it also says water-*thinning* is the single most common mixture
  concept in beginner material (Community B1: every one of Duncan Rhodes's five "mix"
  usages means paint thinned with water). Rare-as-recorded + universal-as-practised is
  exactly the profile where a cheap structured slot beats a free-text convention.
- **Prior art converges on this shape.** BeerXML's adoption-winning misc pattern is a role
  enum plus free-text identity — which is precisely `kind: additive` + `name: "water"`.
  The losing patterns are both avoided: no required attributes (BeerXML WATER's six ions;
  our additive demands only a name) and no computable data trapped in free text
  (schema.org's decade of parsers; a ratio in `mixNote` is unparseable by rule — the spec
  itself says a consumer MUST NOT parse it).
- **The escape hatch survives with a cleaner job description.** `mixNote` remains for: a
  ratio written as prose ("about one part…"), an unratioed splash ("a wet brush-tip of
  water"), and any wording `mix` cannot carry. What it stops being is the mandatory home
  for a component class.

### What moves (exact passages and fixtures)

1. `specs/recipe/v1/README.md` §6 `kind` bullet (lines 127–130): replace *"classifier for
   a paint-like bottled product"* with a functional definition — a classifier for **any
   non-paint component referenced the way paints are** (in `paints[]`/`mix[]`), bottled or
   not. Add two boundary sentences: *(a)* household diluents (water) default to
   `additive`; `thinner` is for products sold and identified as thinners — without this,
   two implementers will legally pick different values for "water" (the GPX `hr`/`heartrate`
   fork inside a five-value enum); *(b)* `kind` classifies **function in the mixture, not
   purchasability** — an aggregating consumer (shopping list, inventory) MUST NOT infer
   that an `additive` is an acquirable product.
2. `specs/recipe/v1/README.md` §5 `mixNote` bullet (lines 105–110): the parenthetical
   "(water, an undeclared medium)" becomes "(an undeclared component, or a ratio written
   as prose)" — water can now be declared.
3. `specs/recipe/v1/README.md` §5 `mix` bullet: add the computation sentence — a consumer
   deriving colour from a mixture skips components whose `kind` marks them as not
   colour-determining and MUST NOT present the derived colour as authored; an additive's
   `parts` remain authored data (dilution/opacity), never renormalised away in what is
   shown to the reader. Today the spec says nothing about what a computing consumer does
   with an additive's parts, and silence here guarantees divergence.
4. `schemas/common/v1/common.schema.json` `paintRef.kind` description: same functional
   rewording, and **remove or demote the false claim** "a renderer does not draw a
   swatch". Decide it as: a renderer SHOULD NOT draw a colour swatch for a non-`paint`
   kind even when `color` is present (S5 proves the reference renderer currently does) —
   and align `recipe-html.ts` plus a test before freeze. The alternative — softening the
   prose to match the renderer — leaves "orange juice, #ffa500" rendering as a paint chip.
5. `specs/common/v1/README.md` §5.6 `paintRef` bullet (lines 144–152): mirror the §6
   rewording (shared definition, shared prose).
6. `specs/palette/v1/README.md` §6: the member list never mentions `kind`/`chemistry` at
   all, though the schema `$ref`s the Common `paintRef` that carries them — a
   prose↔schema gap independent of this decision, found while checking Palette parity.
   List the classifiers; Palette then gets water-in-a-palette-mix for free through the
   shared definition, with no palette-local semantics.
7. `examples/recipe/v1/comprehensive.valid.json` step `s2` `mixNote`: currently the
   verbatim counter-demonstration ("water is not a declared paint, so this mixture has no
   structured form") — now false as doctrine. Reword to demonstrate what stays
   mixNote-only: an approximate prose ratio the author chose not to structure.
8. **Add one conformance fixture** exercising the blessed pattern — water declared
   `kind: additive`, referenced from `mix[]` at a ratio (S1 is ready-made). The corpus is
   what implementers actually test against; after this decision it must teach the pattern,
   not only the escape hatch. (Fixtures-with-every-change is this repo's own rule.)
9. `examples/recipe/v1/complex-model-record.valid.json`: "add one wet brush-tip of water"
   stays — it is the legitimate unratioed-splash case — but its step gains a clarifying
   note so it reads as the escape-hatch demonstration, not as the old doctrine.
10. **Declined, on the record:** a product-vs-ambient signal (an `ambient` boolean, a
    `household` value). No named consumer needs it today (this repo's rule: no consumer,
    no core field), and identity members are not a reliable proxy either way. Cost of
    declining, stated per VERSIONING §8.4: adding a signal later is a 1.x minor
    (backward-compatible, forward-incompatible). If shopping-list generation lands and
    stumbles here, that is the named consumer.

### Cost

Prose, two example files, one new fixture, one renderer behaviour + test, `pnpm
check:consistency` / `pnpm conformance` re-runs. No schema shape change, no migration, no
app change. The first adopter's shipped output becomes prose-conformant the moment this
lands. Rework for a second implementer: none — the documents they would have accepted
yesterday are the documents the prose now describes.

### If we do nothing

The contradiction ships to the freeze. §8.1 freezes the prose semantics along with the
schema; after that, blessing water is a semantics change on frozen text — the class of
change that, per the research, never ships. Every future implementer reads "bottled
product" and "MUST NOT", looks at the reference adopter emitting water rows, and has to
ask. A standard whose reference implementation contradicts its prose on day one is the
"dead on arrival" branch.

### What would change my mind

A soak period (D4) in which the owner — now that the control exists — records **zero**
water ratios while water keeps appearing in `mixNote` prose. That would show the friction
event was about the wall, not the want, and the prose could stay narrow (though the false
"no structured form" fixture sentence must change regardless, because it is false).

---

<a id="d2"></a>

## D2. Scenic materials: what happens to the MUST NOT when the app accepts `sand`?

### Recommendation

**Narrow the MUST NOT to a functional line; do not delete it, and do not make the app
police free text.** Tools are never paintRefs — unchanged, unconditional. For consumable
materials, membership follows **usage**: a consumable that joins a mixture at an authored
ratio is referenced as an `additive` paintRef *in that recipe*; a consumable used in the
process (sprinkled, glued, applied dry) is a `resource`. Sand stirred into a basecoat at
2:1 is an additive; sand sprinkled onto wet paint is a resource. This is the line the
freeze-prep reconciliation already drew — *"if it is in `paints[]`/`mix[]`, it is a
paintRef (+kind); otherwise it is a resource"* — promoted from a plan document into
normative prose, with worked examples.

### Evidence

- **The prohibition is mechanically unenforceable, so it can only ever be guidance.**
  Identity is free text; no validator can know `sand` is scenic (S4 validates under both
  validators today). A MUST NOT that no layer can check, aimed at producers who have
  already shipped the violating control, is not a rule — it is a trap for the honest.
- **The data model already forces membership-by-usage.** `mix[]` rows anchor only into
  `paints[]`. Anything an author records at a ratio *is* a paintRef, or it is nothing
  structured at all. The choice is between blessing the forced outcome with a teachable
  line, or keeping prose that condemns what the schema requires.
- **The current §6a example list self-contradicts under any usage-based reading — this
  was the adversarial pass's strongest finding.** §6a names pigments, PVA, IPA and static
  grass as resources, yet each routinely joins mixtures at authored ratios (a weathering
  slurry is pigment + IPA at a ratio; texture paste is PVA + sand + water). And `additive`
  is currently described as "non-pigment", so a **dry pigment** stirred into a carrier —
  the one component that *determines* the resulting colour — has no correct value in the
  enum. The list and the definition must both move (below), or the freeze locks the
  contradiction.
- **App-side policing is rejected on the adoption lens.** A vocabulary check on free text
  is the three-stop bottle-shaped form again — the thing the feature was built to remove.
  BeerXML's misc bucket never policed identity and won; helper text with examples is the
  most the app should do.

### What moves (exact passages)

1. `specs/recipe/v1/README.md` §6a closing paragraph (lines 163–165) and
   `specs/common/v1/README.md` §5.6 `resource` bullet (lines 153–156): split the rule —
   tools: MUST NOT, unconditional; consumable materials: the functional line, with the
   promoted reconciliation sentence stated normatively.
2. `specs/recipe/v1/README.md` §6a example list (lines 148–150) and the `resource`
   description in `common.schema.json`: qualify with usage ("…are resources **when used
   in the process**; a consumable that joins a mixture at an authored ratio is referenced
   as an additive paintRef for that recipe").
3. **Three worked examples, in normative prose, not app helper text** (a second
   implementer reads only the spec): sand stirred at 2:1 → additive paintRef; sand
   sprinkled onto wet basecoat → resource; static grass glued on → resource, even when
   the *glue mixture's* ratio is written down (the ratio belongs to the mixture step, not
   the grass).
4. Close the pigment hole: reword `additive`'s "non-pigment" description to "does not
   determine the resulting colour", and state that a colour-bearing dry pigment joining a
   mixture is referenced with `kind: paint` (the colour engine must not skip it). This
   keeps five enum values and no new vocabulary.
5. Community (recommendation only, not this session): one helper-text line naming the
   stirred/sprinkled distinction with the same examples. No enforcement.

### Cost

Prose in four places plus the schema description; no schema shape change; no app change
required for conformance. The cost that is real: "joins a mixture at an authored ratio" is
a judgement call at the margins, and the spec pays for that with the worked examples —
which is cheaper than either a controlled identity vocabulary (BeerJSON's tax) or a
physically-checkable rule that checks nothing (bottled-ness never reached the wire).

### If we do nothing

The shipped app keeps accepting `sand` and emitting documents the prose forbids; a strict
second implementation reading the MUST NOT would **reject on import or strip the row** —
the silent-loss round trip GPX demonstrates. The §6a list's pigment contradiction freezes.

### What would change my mind

Evidence that consumers materially need substance identity across documents (inventory
matching on "sand", cross-recipe aggregation) — that would justify reopening the D3
resource-anchor with its `specification`/`quantity` members rather than stretching
`additive` further. Or a soak corpus showing scenic-at-ratio simply never occurs, making
the narrowing moot (it would still be harmless).

---

<a id="d3"></a>

## D3. An optional `resource` anchor on `mixEntry` (plus `ref` on `resource`)?

### Recommendation

**Not now — deferred under the gap gate, with named reopen triggers. Not "never": two of
the reasons this was previously argued down turn out to be wrong, and are corrected here.**

The sketch (2026-08-09; the freeze-prep plan's "not unless clearly required" deferral of
per-step resource references is the recorded ancestor) would let a mix row anchor a
resource instead of a paint: `mixEntry: { paint | resource, parts }`. It stays deferred —
but the record must be honest about what does *not* argue against it:

- *"Palette would be forced to follow"* — *wrong.* VERSIONING §7 records `mixEntry` as
  the one deliberately spec-local shape, Recipe anchoring into `paints[]` and Palette into
  `entries[]`. Recipe's `mixEntry` can gain a `resource` anchor without Palette changing
  at all. Palette parity for *this* decision set is already handled: water in a palette
  mixture arrives via the shared `paintRef` (D1), and Palette needs nothing local.
- *"After D1/D2 the additive-paintRef is the single home, so a second home later would
  fragment"* — *overstated.* §6a's "mediums/varnish where **not** represented as a paint"
  hedge means representation-dependent homes already exist; D2 makes that explicit per
  usage. The fragmentation argument against D3 is real but weaker than previously argued.

What actually keeps it deferred:

- **Zero documents need it.** Every scenario in this investigation — including sand —
  lands correctly under D1/D2 with no schema change. The gap gate is this repo's own rule:
  every core field requires a named concrete consumer; there is none.
- **The invariant cost is real and lands on every implementer.** `mixEntry.paint` going
  from required to a union breaks "every mix row resolves to a paint" — the assumption in
  the reference renderer (`resolvedAnchorLabel`), the anchor rule, and any consumer's
  colour path. That is the BeerJSON tax, paid to serve no existing document.
- **Waiting loses nothing.** Relaxing `paint` to a union later is a backward-compatible
  1.x minor (VERSIONING §2, §8.3 — an additive sibling schema), Recipe-local per §7. The
  `extensions` namespace is the sanctioned prototyping path in the meantime.

### Reopen triggers (recorded so the next session doesn't re-litigate)

1. A named concrete consumer needs `resource`-only members (`specification`,
   `quantity`) **inside** a mixture — e.g. shopping-list generation that must distinguish
   "sand, 120-grit, a few pinches" from a product identity.
2. A measured corpus shows the D1/D2 additive pattern producing real identity collisions —
   the same substance materially dual-homed (additive here, resource there) at a frequency
   that breaks aggregation.

**Checked against the executed prose (2026-08-10).** Both triggers still read correctly. Recipe §6a
now states explicitly that the same substance may be a paintRef in one document and a resource in
another — dual-homing is *by design*, not a defect — so trigger 2 is unambiguously about
**frequency and aggregation impact**, never about the existence of a second home. Trigger 1 is
untouched: `mixEntry` still anchors only into `paints[]`, so the `resource`-only members
(`specification`, `quantity`) remain unreachable from inside a mixture, which is the condition it
names.

If reopened post-freeze: 1.x minor, sibling schema, no Palette obligation, renderer +
anchor-rule work in the validator, one new fixture pair (valid + invalid anchor).

### Cost / If we do nothing / What would change my mind

Deferral costs nothing today (no document needs the anchor). Doing it now costs every
implementer union-handling for zero corpus. The triggers above are the change-my-mind
conditions, verbatim.

---

<a id="d4"></a>

## D4. Sequencing against the coordinated v1 freeze

### Recommendation

**Land D1+D2 in this repo first, then gate the freeze on evidence, not a date.** The
ordering is fixed by the versioning policy itself: D1/D2 are semantics changes —
free in place while DRAFT, an unshippable major after freeze. D3-class additions are §8.3
minors either way and never block anything.

Recommended order:

1. **Standard:** D1+D2 prose/schema-description/fixture changes; renderer swatch
   alignment + test; `pnpm check:consistency`, `pnpm -r test`, `pnpm conformance` green.
   (The Palette §6 classifier-documentation gap from D1 item 6 rides along.)
2. **Standard:** pack 0.9.x artifacts through the packed-release gate
   (`pnpm verify:packed`). **Packing is local and is not blocked by the archived origin —
   only pushing/publishing is.** Community's B3 established it cannot upgrade until a
   packed artifact exists; this is the step that unblocks it. (Publishing/tagging and the
   archived-origin question themselves stay out of scope, as decided elsewhere.)
3. **Community:** re-vendor the packed 0.9.x, bump the pinned version literal (its test
   already enforces agreement), record the B1 reversal in `STEP_MIXTURE_DECISIONS.md`,
   and fix the known adapt-to-my-paints defect that silently drops uncatalogued mixture
   rows — after D1, that defect deletes *conformant* water rows with no loss report,
   which is precisely the GPX silent-loss failure this document cites as the cautionary
   tale. It graduates from backlog to freeze-precondition.
4. **Soak:** the owner authors real recipes on production with the shipped control. The
   freeze should not lock mixture semantics against a corpus of zero documents when the
   cost of a few weeks is nothing and the only adopter's only user is the maintainer.
5. **Freeze** (the maintainer's explicit act, VERSIONING §8.2), once: Community ships on
   a packed 0.9.x; at least a handful of real documents exercise the additive pattern;
   and the `paintRef.kind` vocabulary is "deliberately settled" per §8.4 — the D1
   declined-signal record and D2 pigment resolution are that settlement.
6. **Post-freeze:** D3 only if a trigger fires; new enum values as 1.x sibling-schema
   minors.

On sooner-vs-later: the research is unambiguous that *frozen-imperfect beats
perpetually-draft* (BeerXML's 20 years) and that fixing semantics after adoption never
ships (BeerXML 2). Both halves cut the same way here: **fix the prose now, then freeze
promptly on the gates above** — not on the calendar, and not after the semantics have had
zero soak. The one live harm of draft-ness (the site advertising a version it didn't
validate against) was already fixed by Community's B3 pin-and-test.

### If we do nothing

The freeze either happens over a contradiction (freezing prose the reference adopter
violates — §8.1 makes it permanent) or keeps not happening (the perpetual draft that
deters the second adopter this project is trying to attract). Both branches lose the
adoption bet.

---

## Recorded, not done (out of scope **when this was written**)

Struck through where a later session did it; see the status table at the top.

- ~~All spec/schema/fixture/renderer edits above — proposals awaiting the owner.~~
  **Done 2026-08-10** (D1+D2), on `agent/painting-workflows`, local commits only.
- Packing artifacts; anything touching the archived origin. *(Packing is the freeze plan's Phase 3;
  pushing and publishing remain out of scope and authorization-gated.)*
- Community items (B1 reversal record, adapt-defect fix, helper-text line) — recorded
  here as recommendations; **Community was not touched by this repo's work** and is a separate
  session with its own commits.
- ~~The `kind`-skip rule is unimplemented in any colour path and untested in conformance.~~
  **Partly closed.** D1 item 3 landed the computation rule as normative prose in Recipe §5, and the
  renderer half is now implemented and tested (no swatch for a non-`paint` kind). The colour-engine
  half stays prose in this repo by design: the Standard ships no colour engine, so the rule binds
  consumers and is pinned only by the fixture that teaches the pattern.

## Summary

| # | Decision | Recommendation | Effort |
| --- | --- | --- | --- |
| D1 | Water in structured mixtures | Bless `kind: additive` in prose; boundary + computation sentences; fixture that teaches it; no schema/app change; record the B1 reversal | Small (prose + fixtures + one renderer test) |
| D2 | Scenic materials | Tools: MUST NOT stays. Consumables: membership by usage, worked examples in normative prose; fix the `additive`/pigment wording; app polices nothing | Small (prose only) |
| D3 | `resource` anchor on `mixEntry` | Defer under the gap gate with two recorded reopen triggers; corrected record: Palette is not an obstacle; 1.x-minor-able later | ~0 now |
| D4 | Freeze sequencing | D1+D2 → pack 0.9.x (local, unblocked) → Community re-vendors + fixes adapt-loss → short soak → freeze on gates, not dates | Ordering only |

Do D1 and D2 together, first — they are one rewording exercise across the same five files,
they are the only items that get more expensive the moment v1 freezes, and every later
step (packing, re-vendoring, soak, freeze) reads from them.

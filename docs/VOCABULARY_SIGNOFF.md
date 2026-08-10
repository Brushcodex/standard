# Closed-vocabulary sign-off for the v1 freeze

Freezing v1 makes every closed vocabulary immutable ([VERSIONING.md](../VERSIONING.md) §8.1).
After that, **adding** a value is a backward-compatible `1.x` minor shipped as a sibling schema
(§8.3, §8.4); **removing, renaming, or narrowing** one is a breaking major — the class of change
that, per the precedent researched in [MIXTURE_INGREDIENT_DECISIONS.md](MIXTURE_INGREDIENT_DECISIONS.md),
never ships. So the asymmetry that matters is this: *a vocabulary that is too small is cheap to fix
later; a vocabulary that is wrong is permanent.*

This document walks every closed vocabulary in `schemas/**/v1` once, deliberately, before the
freeze. It is the §8.4 "deliberately settled" record. Every value list below was **read from the
schema files**, not from prose — re-measure before relying on any of it:

```bash
node -e "const fs=require('fs');for(const s of ['common','recipe','palette','inventory','project','technique','bundle']){const d=JSON.parse(fs.readFileSync('schemas/'+s+'/v1/'+s+'.schema.json','utf8'));(function w(n,p){if(!n||typeof n!=='object')return;if(Array.isArray(n.enum))console.log(s,p,'('+n.enum.length+')',n.enum.join(' '));for(const[k,v]of Object.entries(n))if(v&&typeof v==='object')w(v,p+'/'+k)})(d,'')}"
```

**Measured 2026-08-10: 27 closed vocabularies across 7 schemas.** VERSIONING §8.1 names eleven of
them as examples; the freeze locks all 27, so all 27 are walked here. The eleven §8.1 names are
marked **[§8.1]**.

**Verdict: all 27 settled. Two observations are recorded below as open items — neither blocks the
freeze**, because both are resolvable as additive `1.x` minors.

---

## Common (`schemas/common/v1/common.schema.json`)

Common's vocabularies are the widest surface: five specs embed them, so a mistake here is a
mistake five times over (§8.2 freezes them all together).

| Vocabulary | Values (measured) | Verdict |
| --- | --- | --- |
| `role` **[§8.1]** | 18: `primer` `basecoat` `undercoat` `shadow` `midtone` `layer` `highlight` `edge_highlight` `spot_highlight` `wash` `glaze` `drybrush` `weathering` `metallic` `texture` `decal` `varnish` `other` | **Settled.** Deliberately coarse and closed, with named specific techniques living in free-text `step.technique` beside it — that escape hatch is what keeps the enum from growing with every named technique. `other` catches the rest, so no producer is ever stuck. |
| `paintRef.kind` **[§8.1]** | 5: `paint` `medium` `thinner` `additive` `varnish` | **Settled by D1/D2** — see [MIXTURE_INGREDIENT_DECISIONS.md](MIXTURE_INGREDIENT_DECISIONS.md) §D1 and §D2, executed this week. The values are unchanged; what was settled is their *meaning*: function in the mixture rather than product form, water as `additive`, colour-bearing components as `paint`. That resolution is why five values are enough and why none of them is a trap. |
| `paintRef.chemistry` **[§8.1]** | 5: `acrylic` `enamel` `oil` `lacquer` `other` | **Settled.** The substitution-safety axis, with `other` for the tail. Confirmed against D1's scenario runs: `chemistry` on a *non-paint* `kind` is legal and reads naturally (white spirit as `thinner` + `oil` means the compatibility family), and the D1 rewording does not forbid it. |
| `resource.kind` **[§8.1]** | 2: `tool` `material` | **Settled**, and now load-bearing: D2 makes the distinction normative (a tool is a resource unconditionally; a consumable material goes by usage). The binary is exhaustive by construction — a resource is either reusable or consumed — so no catch-all is needed and none should be added. |
| `provenanceEntry.sourceType` **[§8.1]** | 7: `manufacturer_digital_swatch` `physical_measurement` `community_estimate` `digital_approximation` `photographed_sample` `synthetic_test_fixture` `unknown` | **Settled.** These are honesty classes, not a taxonomy of the world: each says how much a colour value may be trusted, and `unknown` is the honest floor. Growing it later is a minor; the values here must never be *merged*, because merging would silently upgrade a weaker claim. |
| `provenanceEntry.reviewStatus` | 4: `pending_review` `approved` `rejected` `deprecated` | **Settled.** A complete lifecycle with no gap between the states. |
| `provenanceEntry.confidence` | 4: `high` `medium` `low` `unknown` | **Settled.** Three graded levels plus the honest absence. A numeric confidence was never the design — a scale nobody calibrates is a false precision. |
| `integrity.algorithm` | 2: `sha-256` `sha-512` | **Settled.** Both current, neither deprecated. A future algorithm is an additive minor, which is exactly the right cost for a cryptographic vocabulary. |
| `target.kind` **[§8.1]** | 6: `miniature` `model` `material` `surface` `terrain` `generic` | **Settled.** `generic` is the catch-all. |
| `target.substrate` **[§8.1]** | 7: `resin` `plastic` `metal` `mdf` `foam` `pla` `other` | **Settled**, with `other`. |
| `target.scale.system` **[§8.1]** | 2: `nominal_mm` `ratio` | **Settled, and deliberately narrow.** Only the two observed measurement systems; physical height is intentionally *not* collapsed in here, and the schema already records that a height system may be added in a future minor **only if evidenced**. That is the correct shape: the gate is evidence, the cost is a minor. |
| `mediaRef.kind` | 3: `image` `video` `other` | **Settled**, with `other`. |
| `mediaRef.relation` | 3: `source` `result` `reference` | **Settled, no catch-all on purpose.** Absence means unstated, and the schema says never to infer one — an `other` value would invite producers to assert a relationship they do not know. `source` additionally carries an attribution obligation, so the vocabulary's smallness is a feature. |

## Recipe (`schemas/recipe/v1/recipe.schema.json`)

| Vocabulary | Values (measured) | Verdict |
| --- | --- | --- |
| `step.method` **[§8.1]** | 5: `brush` `airbrush` `sponge` `stipple` `other` | **Settled**, with `other`. |
| `alternative.type` **[§8.1]** | 5: `authored` `manufacturer_published` `mathematical` `community_tested` `verified_practical` | **Settled, no catch-all on purpose.** Each value is an evidence class, and the whole point is that a mathematical match must never masquerade as a verified practical one. An `other` bucket would erase exactly the distinction the member exists to keep. See **Open item 1** on its project-side twin. |
| `difficulty` | 3: `beginner` `intermediate` `advanced` | **Settled.** Shared shape with Technique's `difficulty` (same three values, defined per spec). |

## Palette (`schemas/palette/v1/palette.schema.json`)

| Vocabulary | Values (measured) | Verdict |
| --- | --- | --- |
| `relationship.type` | 5: `shadow_to_highlight` `analogous` `complementary` `triadic` `custom` | **Settled.** `custom` is the catch-all, and the free-text label beside it carries the wording. |

## Inventory (`schemas/inventory/v1/inventory.schema.json`)

| Vocabulary | Values (measured) | Verdict |
| --- | --- | --- |
| `item.unit` | 7: `bottle` `pot` `tube` `dropper` `ml` `g` `other` | **Settled**, with `other`. Mixes container words and measures deliberately — an author records what the bottle says, not a normalised volume nobody has. |
| `item.condition` | 6: `sealed` `in_use` `low` `empty` `dried_out` `unknown` | **Settled.** Complete lifecycle plus the honest `unknown`. |
| `item.visibility` | 2: `shareable` `private` | **Settled.** A privacy boundary, and a binary is the only safe shape: a third value would need a rule for what a consumer does with it, and any ambiguity here leaks data. |

## Project (`schemas/project/v1/project.schema.json`)

| Vocabulary | Values (measured) | Verdict |
| --- | --- | --- |
| `status` (document) | 4: `active` `on_hold` `completed` `archived` | **Settled.** `archived` is documented as non-destructive. |
| `subject.status` | 4: `not_started` `in_progress` `blocked` `done` | **Settled.** See **Open item 2** on the asymmetry with `stage.status`. |
| `stage.status` | 3: `not_started` `in_progress` `done` | **Settled for the freeze.** See **Open item 2**. |
| `substitution.type` | 5: `authored` `manufacturer_published` `mathematical` `community_tested` `verified_practical` | **Settled.** Identical to Recipe's `alternative.type` and for the identical reason. See **Open item 1**. |
| `journalEntry.visibility` | 2: `shareable` `private` | **Settled**, same privacy binary as Inventory's. |

## Technique (`schemas/technique/v1/technique.schema.json`)

| Vocabulary | Values (measured) | Verdict |
| --- | --- | --- |
| `paintClass` **[§8.1]** | 9: `acrylic` `oil` `enamel` `lacquer` `ink` `wash` `contrast` `technical` `metallic` | **Settled, no catch-all — survivable because the member is optional.** This is the broadest product-type advisory in the standard and the one most exposed to the market inventing a new category. It has no `other`, so a producer facing an unlisted class omits the value rather than mis-stating it, which is the honest outcome. Growth is an additive minor. Note the first four values are the binder-family subset shared with `paintRef.chemistry`; the two vocabularies are deliberately distinct axes and must not be merged. |
| `difficulty` | 3: `beginner` `intermediate` `advanced` | **Settled**, matching Recipe's. |

## Bundle (`schemas/bundle/v1/bundle.schema.json`)

| Vocabulary | Values (measured) | Verdict |
| --- | --- | --- |
| `entry.spec` | 6: `common` `recipe` `palette` `technique` `inventory` `project` | **Settled.** `bundle` is absent on purpose: a manifest does not list itself. This vocabulary must grow in lockstep with any new document spec — that growth is an additive minor, and a new spec is itself a `1.x` event. |

---

## Open items — recorded, neither freeze-blocking

Both were found while walking the vocabularies for this sign-off; neither was anticipated by
D1–D4. Neither is improvised into a decision here: both are recorded with what would resolve them,
in the style of [MIXTURE_INGREDIENT_DECISIONS.md](MIXTURE_INGREDIENT_DECISIONS.md).

### Open item 1 — `alternative.type` and `substitution.type` are the same five values, defined twice

Recipe's `alternative.type` and Project's `substitution.type` carry identical value lists in two
schema files. Common §5.6 exists precisely so that a structure more than one spec needs is
"defined **once** and cannot drift" — this pair is not.

**Why it does not block the freeze:** the two lists agree *today*, and freezing makes both
immutable simultaneously, so they cannot drift while v1 is frozen. The duplication costs nothing
until someone wants to change one.

**The real risk, and it is post-freeze:** a `1.x` minor that adds an evidence class to one and not
the other. A recipe could then classify a substitute in a way the project that accepted it cannot
express, and a consumer moving the value between documents would have to drop it — the silent-loss
round trip the D1/D2 research cites GPX for.

**Resolution options, for the owner:**

- *Do nothing.* Correct today; adds a standing obligation that any future minor touching one of
  these must touch both. Cheap, and depends on memory.
- *Share it in Common before the freeze* (`$defs/evidenceClass`, both specs `$ref` it). Validation
  behaviour is byte-identical — the same five values accepted at the same paths — so no document
  changes and no migration exists. But it edits two schema files, and after the freeze it becomes
  impossible: a `$ref` change is a schema-file edit, and frozen schema files are immutable
  byte-for-byte (§8.1). **This is a now-or-never option**, which is why it is recorded here rather
  than deferred silently.

**Recommendation, not executed:** share it in Common. The cost is one refactor while the schemas
are still DRAFT; the alternative is a permanent duplicate that only discipline keeps in step. This
needs the owner's decision because it changes schema files outside the D1/D2 authorization.

### Open item 2 — `stage.status` has no `blocked`, but `subject.status` does

A project subject can be `blocked`; a stage inside it cannot. Nothing in the prose explains the
asymmetry, and a stage is exactly where a blockage is usually observed ("waiting on a resin order"
blocks the assembly stage, not the whole miniature).

**Why it does not block the freeze:** adding `blocked` to `stage.status` is a textbook additive
enum growth — backward-compatible, a `1.x` sibling-schema minor (§8.3, §8.4). Documents written
against `1.0` stay valid. Nothing is locked shut by waiting.

**Reopen trigger:** the first real project corpus in which authors describe a stage-level blockage
in free text. Per this repo's own gate (AGENTS.md rule 2), that would be the named concrete
consumer; there is none today, and the corpus measured for the freeze holds zero projects.

---

## Sign-off

Walked and settled as recorded above, against the schemas measured on **2026-08-10**, as the §8.4
precondition for the coordinated v1 freeze. Two open items recorded; neither blocks. The freeze act
itself remains the maintainer's explicit decision ([GOVERNANCE.md](../GOVERNANCE.md),
VERSIONING §8.2), and **Open item 1 is the one thing on this page that gets harder after it.**

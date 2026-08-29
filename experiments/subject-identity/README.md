# Experiment — portable Painted Subject identity

> **Status, 2026-08-28 — GRADUATED.** The capability this spike tested is now a normative part of
> the Standard: Common `$defs.subjectIdentity`, reached through the optional `target.identity`
> member (Common §5.8). The extension keys below are **superseded** by that core member and should
> not be used in new documents. This directory is kept unchanged as the evidence the decision rested
> on — see [docs/PAINTED_SUBJECT_IDENTITY_PROPOSAL.md](../../docs/PAINTED_SUBJECT_IDENTITY_PROPOSAL.md)
> and [CHANGELOG.md](../../CHANGELOG.md). Read everything below as it stood before graduation.

**Status when written: spike complete. Not normative. Not proposed for the core.**
Nothing in this directory changes `specs/**` or `schemas/**`, and no core field was added.

---

## 1. The question

A **Painted Subject** is the paint-relevant miniature, model, sculpt, build — or intentional subject
class or set — that a Painting Workflow actually applies to. It is not necessarily the commercial
product the miniature arrived in.

Today a Recipe says what it is for in Common `target.description`
([specs/common/v1](../../specs/common/v1/README.md) §5.6): one free-text string. That is honest,
offline-readable, and registry-independent — and it supports exactly one operation, string matching.

The consumer this experiment was built to serve is:

> exact miniature → applicable Painting Workflows → translate that workflow to my paints

The middle arrow is the one `target.description` cannot carry. Two painters describing the same
sculpt write different sentences; the same sentence is written for different sculpts; and a
remastered sculpt keeps the old name while the geometry — and therefore the workflow — changes.

The question was whether a stable Subject ID, carried as a namespaced extension with a literal
fallback, closes that gap without dragging a product catalogue into the standard.

## 2. The prototype

Two keys, both under the document's `extensions` map, both in the `org.brushcodex.*` namespace that
[docs/EXTENSIONS.md](../../docs/EXTENSIONS.md) §5 reserves for BrushCodex-authored experiments.

### 2.1 `org.brushcodex.subject:identity` — the experiment

```json
"org.brushcodex.subject:identity": {
  "subjectId": "brushcodex:subject:example-miniatures/vanguard/standard-bearer",
  "authority": "Example Miniatures",
  "designation": "Vanguard Standard Bearer",
  "qualifier": "original sculpt; banner cast integral to the left arm",
  "authorityId": "VG-SB-01",
  "references": [{ "url": "https://example.org/...", "note": "..." }]
}
```

| Member | Presence | Meaning |
|---|---|---|
| `subjectId` | optional | The opaque equality key. Absent when the evidence does not support one. |
| `authority` | required *when the extension is present* | Whose designation the identity is anchored to — manufacturer, studio, or sculptor. Never a retailer. |
| `designation` | required *when the extension is present* | The subject's name as that authority gives it. |
| `qualifier` | optional | Only the **paint-relevant** distinction needed to remove ambiguity. Not a description. |
| `authorityId` | optional | An identifier the authority itself assigns to the subject (a sculpt or part code), where genuinely known. Not a SKU. |
| `references` | optional | Secondary links. Explicitly **not** the identity. |

`authority` + `designation` are the **literal identity floor**: a bare Subject ID is not sufficient,
so an implementation that carries the extension at all must carry enough for a human and an
independent implementation to know what the subject is with the network down.

Nothing else was added. A `precision` enum (`exact` / `variant` / `class`) was considered and
rejected: the absence of `subjectId` already states that no exact subject is claimed, and a second
member saying the same thing would be metadata invented for symmetry.

`target.description` is untouched and still load-bearing. All five documents here carry a different,
meaningful description, and the identity extension never restates it.

### 2.2 `org.brushcodex.product:sourceContext` — deliberately a separate key

Source Product context appears in these fixtures for exactly one reason: to prove, structurally,
that the subject comparator never reads it. It is a **different extension key in a different
namespace area**, it carries no BrushCodex Product ID, and the proof test deletes it entirely and
re-derives every verdict unchanged.

It carries a product name, a SKU, and a note. It carries no price, stock, availability, retailer,
affiliate link, or bundle graph, and it is not required by the consumer.

## 3. Subject ID form

```text
brushcodex:subject:<authority>/<line>/<subject>
```

This is not a new invention. Common §5.7 already establishes the BrushCodex identifier convention
for paints — `brushcodex:paint:<manufacturer>/<range>/<paint>`, URN-style, lowercase, slugged, "a
convention, not a constraint", with resolvers required to treat an unrecognised identifier as simply
unresolvable. The subject identifier is the same convention applied to a different noun, which is
why the spike did not invent a URI syntax.

Three rules make it usable as an equality key:

1. **It is opaque.** Equality is a whole-string comparison. The readable segments are a debugging
   courtesy; a consumer that parses them has invented a rule the format does not define.
2. **It denotes the Painted Subject** — not a Recipe document, a Source Product, a SKU, a retailer
   listing, a storefront URL, or a database row.
3. **It resolves nothing.** Two documents carrying the same Subject ID may conclude they identify
   the same Painted Subject with no network access at all.

## 4. Stability policy (experimental allocation semantics)

These are **registry identity policy**, not JSON validation rules. No schema can check them, and
this experiment deliberately does not try.

**The same Subject ID SHOULD survive:**

- a commercial rebox;
- a SKU change;
- a storefront URL change;
- a change in bundle membership;
- discontinuation;
- a Made-to-Order rerelease;
- physical versus digital distribution, when the paint-relevant geometry is genuinely the same.

The common thread: none of those changes what the painter is holding.

**A distinct Subject identity SHOULD be possible when:**

- the subject is resculpted;
- remastered geometry changes paint applicability;
- a materially different assembled build changes the truth of the workflow;
- another paint-relevant geometry distinction requires separate applicability.

The common thread: the workflow's claims stop being true of the object.

The experiment does not attempt to settle every equivalence case, and it does not model
same-sculpt equivalence, alias resolution, or resculpt lineage. Those are graph problems for a
registry, not members of a document.

## 5. The fixtures and the six cases

Five Recipe documents. All five validate against the **unchanged** Recipe v1 schema and semantic
rules — `5/5 valid` from `brushcodex-validate`.

| File | Subject ID | Source product |
|---|---|---|
| [`standard-bearer-blister.json`](standard-bearer-blister.json) | `…/vanguard/standard-bearer` | single blister, `EM-2201` |
| [`standard-bearer-reissue.json`](standard-bearer-reissue.json) | `…/vanguard/standard-bearer` | reissue box, `EM-2310` |
| [`squad-sergeant.json`](squad-sergeant.json) | `…/vanguard/squad-sergeant` | squad box, `EM-2105` |
| [`squad-trooper-generic.json`](squad-trooper-generic.json) | *(none — not claimed)* | squad box, `EM-2105` |
| [`standard-bearer-remaster.json`](standard-bearer-remaster.json) | `…/vanguard/standard-bearer-mk2` | Mk2 box, `EM-2402` |

| Case | Demonstrated by | Result |
|---|---|---|
| **1 — Exact subject** | blister × reissue, different authors | Same Subject ID → `same`, while normalised description matching returns `false` |
| **2 — Multi-model box** | sergeant × trooper, one shared SKU | The SKU comparator says "same" and is wrong; the subject comparator returns `undetermined` and never `same` |
| **3 — Rebox / reissue** | blister × reissue, two products | Different product name, different SKU, identical Subject ID; no product history is stored in the identity |
| **4 — Resculpt** | blister × remaster | Identical `designation`, so name matching says "same" and is wrong; distinct Subject IDs → `distinct` |
| **5 — Broad / unknown** | trooper | Fully valid with literal identity and **no** Subject ID; nothing fabricates one; an absent ID never yields a match, not even against itself |
| **6 — Registry unavailable** | all five, with a resolver that throws | A complete subject reads from the document alone; equality still decides; the blister's official URL is never consulted and the reissue has none |

The executable proof is
[`packages/validator/src/recipe/subject-identity.experiment.test.ts`](../../packages/validator/src/recipe/subject-identity.experiment.test.ts)
— 26 tests, run by `pnpm --filter @brushcodex/validator test`. The comparator it uses is nine lines
of ordinary consumer code.

## 6. Baseline versus extension

| | Baseline: `target.description` | Prototype: Subject ID + literal floor |
|---|---|---|
| Equality across two authors | Heuristic string matching; fails on the fixtures here | Deterministic, byte comparison |
| Rebox / SKU change | Unaffected, and still cannot match | Unaffected, and matches |
| Resculpt with the same name | Cannot distinguish | Distinguishes |
| Unknown / broad subject | Honest | Honest — `undetermined`, never a guess |
| Offline | Yes | Yes; the ID resolves nothing |
| Requires a hosted service | No | No |

What the Subject ID explicitly does **not** do: image recognition, alias resolution, candidate
ranking, same-sculpt inference, evidence reconciliation. `distinct` means "two identities were
asserted", not "these are provably different castings".

## 7. Open Subject Registry — the conceptual minimum

Recorded here as a boundary, not built. **No registry service was created by this task.**

The minimum *public, portable* identity record is the identity floor and nothing else:

- the stable BrushCodex Subject ID;
- `authority`;
- `designation`;
- a minimal identity-relevant `qualifier`, only where one is necessary;
- optionally, the authority-assigned subject identifier.

Deliberately **outside** that public minimum — this is the "identity is open, intelligence is not
open by default" line:

aliases · historical names · identity-resolution confidence · same-sculpt equivalence graph ·
resculpt and remaster relationship graphs · product containment · bundle and reissue history ·
current availability · retailer mappings · price · stock · geography · affiliate URLs ·
matching and ranking confidence · evidence reconciliation · inferred workflow applicability.

Everything in that second list is derived, commercial, or judgemental. None of it is needed to
answer "are these two workflows about the same miniature?", which is the entire operation the
identity exists to serve.

## 8. What this experiment did not need

- **No BrushCodex Product ID.** None was defined, and the consumer never asked for one.
- **No product containment.** The proof test deletes every source-product extension and every
  verdict is unchanged.
- **No core `target` change.** `target.description` was not modified, replaced, or deprecated.
- **No schema change.** Not one byte under `schemas/**`.
- **No registry, database, API, or application code.**

## 9. Known limitations of the prototype

Stated plainly, because they are what a graduation proposal would have to answer:

1. **Nothing validates the extension's shape.** `extensions` values are open by design, so a
   document could carry `subjectId` with no `authority` and still be a conformant Recipe. The
   literal-floor rule is prose here, enforced only by the fixtures. Making it enforceable is
   precisely what graduating to a core structure would buy.
2. **Allocation is unproven.** No registry exists, so "the same subject gets the same ID" is
   asserted by the fixtures, not demonstrated against real allocation decisions at scale.
3. **One spec only.** The prototype is exercised on Recipe. Palette shares Common `target`, and
   Project has its own `subjects[]`; neither was touched, and sibling ownership between them would
   need settling before any core shape is proposed.
4. **Synthetic evidence.** Per [GOVERNANCE.md](../../GOVERNANCE.md), the corpus is synthetic. These
   fixtures are invented manufacturers and invented sculpts; they model the *shapes* of the six
   cases faithfully, but they are not field data.

## 10. Core-graduation assessment

Against the criteria set for the spike:

| # | Criterion | Verdict |
|---|---|---|
| 1 | Enables a real interoperable operation `target.description` cannot | **Met** — cross-author subject equality; cases 1, 3, 4 |
| 2 | Literal fallback sufficient without resolution | **Met** — case 6 |
| 3 | Exact and broad targets coexist honestly | **Met** — case 5; `undetermined` is a first-class answer |
| 4 | No Source Product / Product ID required | **Met** — §8, proven by deletion |
| 5 | Shape works across exact sculpt, reissue, and resculpt | **Met** — cases 1, 3, 4 |
| 6 | Semantics are implementation-independent | **Met** — nine lines of consumer code, no service, no catalogue |
| 7 | Graduation needs only a small optional structure, not a catalogue graph | **Met** — five optional members, one of them the ID |

**Outcome: NEEDS ONE MORE IMPLEMENTATION ITERATION.**

All seven criteria are met, and that is exactly why the honest verdict is not "ready". Criteria 1–7
test whether the *shape* works; they were satisfied on one spec, with synthetic data, and with the
literal-floor rule unenforceable (§9.1 and §9.3). The unresolved question is not whether a Subject
ID is useful — it is where the structure belongs once it is real: Common (shared by Recipe and
Palette, alongside `target`), or Recipe-local, or as an optional member *of* `target`. That decision
needs the Palette and Project sibling-ownership analysis this spike did not do, and a shape that can
enforce "an ID never travels without its literal floor".

Nothing here is graduated. Per [GOVERNANCE.md](../../GOVERNANCE.md), that is the maintainer's
decision, made against a written proposal.

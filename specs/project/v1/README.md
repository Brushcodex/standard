# Open Paint Format Project — v1 (DRAFT)

- **Spec name:** `project`
- **Version:** `1.0.0` (draft; not frozen)
- **JSON Schema:** [`schemas/project/v1/project.schema.json`](../../../schemas/project/v1/project.schema.json)
- **Media type (provisional):** `application/vnd.openpaintformat.project+json`
- **File suffix (provisional):** `.paintproject.json`
- **Status:** DRAFT — MAY change incompatibly until frozen.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, and **MAY** are
to be interpreted as described in RFC 2119 and RFC 8174.

## 1. Purpose

A Project records a painter's work on one or more miniatures: what they are painting, its progress,
the Painting Workflows and palettes they selected, substitutions they accepted, a journal with time logs, the
results, and the tools used. It **embeds the Common document envelope** and closes with
`unevaluatedProperties: false`.

## 2. Envelope constraints

- `spec` **MUST** equal `project`.
- `specVersion`, `id`, `revision`, `title` are REQUIRED (from the envelope).
- `links.source` records source material or context from which the project was derived;
  `links.forkOrigin` records a personal fork.

## 3. Project members

| Member | Type | Rule |
|---|---|---|
| `status` | `active` \| `on_hold` \| `completed` \| `archived` | **REQUIRED**. `archived` is non-destructive. |
| `progress` | integer 0–100 | Optional overall completion. |
| `summary` | string | Optional. |
| `subjects` | array of Subject (§4) | Optional miniatures / subprojects. |
| `recipeRefs` / `paletteRefs` | array of DocumentRef (§5) | Optional selected Painting Workflow (`recipe`) / Palette documents. |
| `substitutions` | array of Substitution (§6) | Optional accepted substitutions. |
| `journal` | array of JournalEntry (§7) | Optional journal + time logs. |
| `results` | array of Media (§8) | Optional result photos/media. |
| `toolsUsed` | array of ToolUsed (§9) | Optional tools + materials used. |

## 4. Subject

`name` is REQUIRED. Optional `ref` (a document-local anchor journal entries point to, unique within
`subjects[]` — §11), `status`
(`not_started` / `in_progress` / `blocked` / `done`), `progress` (0–100), `stages`
(`{ name, status? }`, status one of `not_started` / `in_progress` / `done`), `checklist`
(`{ task, done? }`), and `note`.

## 5. DocumentRef (shared)

A soft reference to another Open Paint Format document by its stable `id` URI — the shared Common
`documentRef`, also used by Recipe `techniqueRefs`. `id` (absolute URI) is REQUIRED; `title` is
optional. Selections reference recipes/palettes **by id**, never by an internal database key; an
unresolved reference is not an error.

## 6. Substitution — classification is mandatory

An accepted substitution records `original` and `substitute` paint references (§10) — both REQUIRED
— plus an optional `type` (`authored` / `manufacturer_published` / `mathematical` /
`community_tested` / `verified_practical`) and `note`. As in the Recipe spec, these classes MUST be
kept distinct: a `mathematical` color match MUST NOT be relabelled as a stronger class.

## 7. JournalEntry — time logs and privacy

`body` (non-empty) is REQUIRED. Optional `at` (RFC 3339), `minutesSpent` (≥ 0), `subjectRef` (an
anchor into `subjects[].ref`), and `visibility` (`shareable` default, or `private`). A **shared
export profile** MUST omit every journal entry whose `visibility` is `private`, MUST remove
`extensions` (Common §6) from every location in the document that carries it, and MUST remove the
envelope `integrity` (Common §5.5), leaving all other data untouched; the reference implementation
provides `toSharedProject(doc)` and the result is itself a valid Project document.

**Extensions are removed because they are opaque.** An extension is namespaced data whose meaning
only its writer knows, so the profile cannot prove it carries nothing private — an extension that
indexes the journal, for instance, could repeat the text of an entry the profile just removed. The
shared profile therefore fails closed. In Project v1 the only member where `extensions` is allowed
is the document envelope (Common §4): Subject, Stage, CheckItem, Substitution, JournalEntry, and
every Common structure a Project uses (`documentRef`, `paintRef`, `colorValue`, `mediaRef`,
`resource`, `agent`, `license`, `provenanceEntry`, `translation`, `links`, `integrity`) are closed
and define no `extensions` member. Should a later version open an extension point elsewhere in a
Project document, this rule applies to it too.

This is **not** a violation of the Common §6 preservation rule. Preservation governs a read/write
round trip of a document; the shared profile is a deliberate, privacy-reducing export transform
that produces a different, smaller document. The **full** profile preserves every extension
unchanged, and an implementation that claims preservation support MUST still round-trip them
there.

**`integrity` is removed, not recomputed.** It is the author's hash of the canonical form of the
full document, private journal entries and extensions included. On the shared output it no longer
matches the content, so a consumer checking it would report corruption; and because it is a hash
of the removed content, anyone who can guess that content could confirm the guess against it. The
profile does not compute a new value: a shared export MUST NOT claim an integrity value its author
never produced. A publisher MAY compute one for the shared document as a separate, deliberate step.
`revision` is carried as authored: the shared profile is a view of that revision, not an edit (Common §3).

## 8. Media (shared MediaRef)

Each `results[]` item is the shared Common `mediaRef` (also used by Recipe `media` and Recipe
`steps[].media`). `url` (absolute URI) is REQUIRED. Optional `id` (a document-local anchor), `kind`
(`image`/`video`/`other`), `relation` (`source`/`result`/`reference` — a project result is normally
`result`), `caption`, `creator` (a Common Agent, describing the **linked work's** creator, not the
project's author), `license` (a Common License object, the linked work's own), and `rightsNote`.
Consumers MUST NOT auto-dereference URLs without user intent, and MUST NOT infer a creator or
licence that is absent.

## 9. ToolUsed (shared Resource)

Each `toolsUsed[]` item is the shared Common `resource` (also used by Recipe `resources` and
Technique `tools`). `name` (non-empty) is REQUIRED; optional `kind` (`tool` / `material`),
`optional`, `specification`, `quantity`, and `note`.

## 10. PaintRef

Used by substitutions. MUST include at least one of `manufacturer` or `name`; `range`, `code`,
`catalogueId` (optional external id), `color` (`{ hex }`), and `note` are optional — a literal
paint with no catalogue entry is valid.

## 11. Anchor integrity (semantic)

Every `journal[].subjectRef` **MUST** resolve to a `subjects[]` entry whose `ref` equals that
anchor (`subject-anchor-resolves`). Document-local anchors are unique within the array that
declares them:

- A `subjects[].ref` **MUST** be unique within `subjects[]` (`subject-ref-unique`) — a reused ref
  names two subjects, so a journal entry anchored to it is ambiguous.
- A `results[].id` **MUST** be unique within `results[]` (`media-id-unique`, the Common §5.6
  `mediaRef` rule).

The JSON Schema cannot express these rules (a cross-reference, or uniqueness of one property across
array objects); the reference validator enforces them as semantic rules and reports the offending
anchor. Envelope semantic rules (e.g. `updatedAt >= createdAt`) also apply.

`recipeRefs[]` and `paletteRefs[]` are **references**, not anchors: they point outward at other
documents by `id`, and nothing in the project resolves to them, so no uniqueness rule applies.
Listing the same document twice is redundant, not ambiguous.

## 12. Security & privacy considerations

- Journal entries and notes are personal; the **shared** profile (§7) is the safe default for
  publishing. It removes what the format marks private (private journal entries) and what the
  format cannot see into (`extensions`, plus the now-stale `integrity`); it does not inspect free
  text. Envelope prose, subject and stage names, substitution and tool notes, captions, and
  shareable journal bodies are published as written. `results[].url`, `links.*`, and envelope URIs are untrusted; consumers MUST sanitize
  before rendering and MUST NOT auto-dereference without user intent.
- Archiving a project sets `status: "archived"` and never deletes data.

## 13. Conformance

A document conforms to Project v1 if it validates against `project.schema.json` (which includes the
Common envelope via composition) **and** satisfies the semantic rules in §11. The reference
validator (`@brushcodex/validator/project`) enforces both layers and is tested against the example
corpus in `examples/project/v1`, including a round trip that preserves every member (private
journal entries included) and unknown namespaced extensions, plus a shared-profile test proving
private journal entries, `extensions`, and `integrity` are removed while the result stays valid.

# BrushCodex Project — v1 (DRAFT)

- **Spec name:** `project`
- **Version:** `1.0.0` (draft; not frozen)
- **JSON Schema:** [`schemas/project/v1/project.schema.json`](../../../schemas/project/v1/project.schema.json)
- **Media type (provisional):** `application/vnd.brushcodex.project+json`
- **File suffix (provisional):** `.brushproject.json`
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

`name` is REQUIRED. Optional `ref` (a document-local anchor journal entries point to), `status`
(`not_started` / `in_progress` / `blocked` / `done`), `progress` (0–100), `stages`
(`{ name, status? }`, status one of `not_started` / `in_progress` / `done`), `checklist`
(`{ task, done? }`), and `note`.

## 5. DocumentRef (shared)

A soft reference to another BrushCodex document by its stable `id` URI — the shared Common
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
export profile** MUST omit every journal entry whose `visibility` is `private`, leaving all other
data untouched; the reference implementation provides `toSharedProject(doc)` and the result is
itself a valid Project document.

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
anchor. The JSON Schema cannot express this cross-reference; the reference validator enforces it as
a semantic rule and reports the offending anchor. Envelope semantic rules (e.g.
`updatedAt >= createdAt`) also apply.

## 12. Security & privacy considerations

- Journal entries and notes are personal; the **shared** profile (§7) is the safe default for
  publishing. `results[].url`, `links.*`, and envelope URIs are untrusted; consumers MUST sanitize
  before rendering and MUST NOT auto-dereference without user intent.
- Archiving a project sets `status: "archived"` and never deletes data.

## 13. Conformance

A document conforms to Project v1 if it validates against `project.schema.json` (which includes the
Common envelope via composition) **and** satisfies the semantic rules in §11. The reference
validator (`@brushcodex/validator/project`) enforces both layers and is tested against the example
corpus in `examples/project/v1`, including a round trip that preserves every member (private
journal entries included) and unknown namespaced extensions, plus a shared-profile test proving
private journal entries are removed while the result stays valid.

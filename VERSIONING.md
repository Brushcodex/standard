# Specification Versioning & Compatibility Policy

How BrushCodex open-standard specifications are versioned, frozen, and evolved. This governs
`specs/**`, `schemas/**`, and `examples/**`. It does **not** govern any implementing
application's release version.

## 1. Four distinct version axes

The strategy (§5.8) requires that these never be conflated:

| Axis | Where | Meaning |
|---|---|---|
| **Specification version** | `specVersion` in each document; `schemas/<spec>/vN/` | Which version of a format the document targets. |
| **Document revision** | `revision` in each document | A specific edited state of one document. |
| **Application/database revision** | Implementation-defined | An application's internal schema/build. Never leaks into portable documents. |
| **Content fork lineage** | `links.forkOrigin` / `links.predecessor` | Derivation history between documents. |

## 2. Semantic versioning of specifications

Each specification carries a SemVer 2.0.0 `specVersion`.

- **Patch** (`x.y.Z`): editorial clarification; no schema change that alters accept/reject.
- **Minor** (`x.Y.z`): backward-compatible additions — new **optional** members, new enum values
  in an **open** vocabulary, relaxed constraints. A document valid under `x.y` remains valid
  under `x.(y+1)`. Readers **MUST** ignore (and, where they claim preservation, retain) unknown
  optional members.
- **Major** (`X.y.z`): breaking changes — new required members, removed members, tightened
  constraints, or changed semantics. Requires a migration note and, where practical, a tool.

## 3. Freeze & immutability

- Everything under `specs/**` is **DRAFT** until explicitly frozen. Draft schemas MAY change
  incompatibly and are marked "DRAFT" in their title and prose.
- Once a specification version is **frozen and released**, its JSON Schema file is
  **immutable**. Corrections ship as a new version directory (`schemas/<spec>/vN+1/`), never by
  editing a released file.
- Released versions are additive on disk: `v1/` stays even after `v2/` ships, so old documents
  keep validating.

## 4. Schema directory convention

```text
schemas/<spec>/v<MAJOR>/<spec>.schema.json    # $id ends with the same path
specs/<spec>/v<MAJOR>/README.md               # normative prose for that major line
examples/<spec>/v<MAJOR>/                      # corpus that validates in CI
```

Minor/patch changes update the files in place **only while the version is DRAFT**; after freeze
they require a new major directory or a documented compatible successor process.

## 5. Migrations

- Breaking (major) transitions ship a deterministic, documented migration (data + tooling).
- Migrations MUST be reversible where practical and MUST produce an explicit, machine-readable
  **loss report** when a value cannot be represented in the target version.
- Golden fixtures (`examples/**`) pin migration behavior in tests.

## 6. Conformance & CI

- Every positive example MUST validate; every negative example MUST fail for its intended
  constraint (see `examples/**/invalid/EXPECTATIONS.json`).
- The reference validator (`@brushcodex/validator`, in `packages/`) is tested against the on-disk
  corpus so prose, schema, examples, and model cannot drift. This runs in `pnpm -r test` without
  the web app. `pnpm check:consistency` additionally asserts every schema enum value and property
  name is documented in the prose.

## 7. Decision status (pre-freeze)

Recorded here rather than silently baked into the standard. Items that were open while the specs
were being drafted carry their **current** status, so the coordinated freeze (§8) is made against
a known baseline.

- **Specification license — DECIDED & APPLIED** (maintainer, 2026-07-15). The open-standard stack
  — spec text, schemas, validators, tooling — is **Apache-2.0**; examples and the conformance
  corpus are **CC0-1.0**. Per-path `LICENSE` files are in place; the full matrix and rationale
  are in [docs/LICENSING.md](docs/LICENSING.md).
  (Supersedes the earlier "CC BY 4.0 recommended for spec text; nothing yet applied" note.)
- **Freeze timing for v1 — precondition met.** The Common envelope deliberately stayed DRAFT until
  the specs that embed it were drafted, so their needs could still shape the core. Recipe, Palette,
  Inventory, Project, and Technique are now all Draft v1, so Common is free to freeze together with
  them. Performing the coordinated freeze is the maintainer's explicit act (GOVERNANCE; §8.2).
- **Media types & file suffixes — STILL PROVISIONAL** (the one genuinely open item).
  `application/vnd.brushcodex.*+json` and `.brush*.json` await ergonomics testing before they are
  fixed. A v1 freeze does **not** lock them: §8.1 freezes the schema, its closed vocabularies,
  required members, and the validator-enforced semantics — not a provisional media type or suffix.
  They can be finalized before or after the freeze without a new major version, so they do not
  block it; finalizing them remains a maintainer decision.
- **Shared building blocks** — the genuinely cross-spec structures now live once in the Common
  `$defs` and every spec `$ref`s them: `paintRef` and `colorValue` (Recipe/Palette/Inventory/
  Project), `resource` (Recipe `resources` / Technique `tools` / Project `toolsUsed`), `documentRef`
  (Recipe `techniqueRefs` / Project `recipeRefs`/`paletteRefs`), the `role` vocabulary (Recipe steps
  / Palette entries), and `target` (Recipe / Palette) with its optional `subjectIdentity`
  (`target.identity`, Common §5.8 — reached only through `target`, so Recipe and Palette inherit one
  definition and neither declares an identity member of its own). Adding `subjectIdentity` was a
  **minor**: two new optional members, no new closed vocabulary, and no change to any existing
  member's meaning. The one deliberately un-shared piece is
  `mixEntry`: a recipe mixture anchors into `paints` and a palette mixture into `entries` — the same
  shape, different anchor semantics — so it stays spec-local. (This consolidation, anticipated by
  earlier drafts of this note, is complete as of the pre-freeze cleanup.)

## 8. Coordinated freeze and post-freeze evolution

This section makes the freeze boundary and the post-freeze evolution mechanism explicit, so that
what a freeze locks — and how a compatible `1.x` ships afterwards — is defined before v1 is frozen.

### 8.1 What a freeze locks

On freezing a spec version, the following become immutable for that version:

- the JSON Schema file (byte-for-byte — corrections ship as a new version, never an in-place edit);
- every **closed vocabulary** it references, whether spec-local or shared in Common — e.g. `role`,
  `method`, `target.kind`, `target.substrate`, `target.scale.system`, `alternative.type`,
  `paintRef.kind`, `paintRef.chemistry`, `resource.kind`, `provenanceEntry.sourceType`,
  `technique.paintClass`;
- required members, existing member semantics, and the semantic (prose) rules the reference
  validator enforces.

### 8.2 Coordinated freeze (Common freezes with its embedders)

Recipe, Palette, Inventory, Project, and Technique **embed** the Common envelope and now share
Common `$defs` (`paintRef`, `colorValue`, `resource`, `documentRef`, `role`, `target`). A spec's
frozen surface therefore includes the Common definitions it references. Consequently **Common and
every embedding spec are frozen together as one coordinated `1.0.0` event** — a spec cannot be
frozen while the Common definitions it depends on are still DRAFT and free to change. In practice
the maintainer freezes the whole `v1` family in a single decision.

### 8.3 Backward-compatible `1.x` additions after freeze

A new **optional** member, or a new value **added** to a controlled vocabulary, is a backward-
compatible **minor** (§2): a document valid under `1.y` stays valid under `1.(y+1)`. Because the
frozen `1.0.0` schema file is immutable (§3), a minor does **not** edit it. Instead the minor ships
as an **additive, immutable sibling schema** under the same major line — a new file with its own
`$id` and its own `specVersion` (e.g. `…/v1/recipe-1.1.schema.json`, `$id` ending `/v1/…-1.1…`). The
`1.0.0` file stays on disk untouched so `1.0.0` documents keep validating exactly as before. A minor
adds; it never removes, tightens, or renames (those are major — §2).

### 8.4 Enum compatibility

Adding a value to a controlled vocabulary is **backward-compatible** (documents written before the
addition remain valid) but **forward-incompatible**: a `1.1` document using the new value is
rejected by a strict `1.0` validator that does not know it. Removing or renaming a value, or
narrowing an enum, is a **breaking (major)** change. This is why closed vocabularies must be
deliberately settled at freeze (§8.1) and why consumers select their schema by version (§8.5).

That deliberate settlement is recorded, one vocabulary at a time, in
[docs/VOCABULARY_SIGNOFF.md](docs/VOCABULARY_SIGNOFF.md).

### 8.5 Schema version negotiation

A document declares the spec version it targets in its `specVersion` member. A consumer validates a
document against the schema whose version **matches** that `specVersion` — a `1.0` document against
the `1.0` schema, a `1.1` document against the `1.1` schema. A consumer that only ships the `1.0`
schema MAY reject (or downgrade-with-loss) a document declaring a higher minor it does not
recognise; it MUST NOT silently treat unknown enum values or members as valid `1.0`. This
version-directed selection is what makes additive enum growth (§8.4) safe after freeze.

### 8.6 Migration expectations

- **Minor (`1.x`)** — no migration: additions are optional and backward-compatible; a `1.0`
  document is already a valid `1.1` document.
- **Major (`2.0`)** — ships a documented, deterministic migration (data + tooling), reversible where
  practical, with a machine-readable **loss report** for any value the target version cannot hold,
  and golden fixtures pinning the migration behaviour (§5).

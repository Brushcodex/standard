# BrushCodex Bundle — v1 (DRAFT)

- **Spec name:** `bundle`
- **Version:** `1.0.0` (draft; not frozen)
- **JSON Schema (manifest):** [`schemas/bundle/v1/bundle.schema.json`](../../../schemas/bundle/v1/bundle.schema.json)
- **Archive suffix (provisional):** `.brushcodex.zip`
- **Media type (provisional):** `application/vnd.brushcodex.bundle+zip`
- **Status:** DRAFT — MAY change incompatibly until frozen.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, and **MAY** are
to be interpreted as described in RFC 2119 and RFC 8174.

## 1. Purpose

A Bundle packages several related BrushCodex documents (and permitted media) into one portable
ZIP archive — e.g. a recipe with its palette, technique, and result photos. A bundle is a ZIP
named `.brushcodex.zip` containing:

- **`manifest.json`** — the bundle manifest (this specification), at the archive root.
- Zero or more **standard document** files (recipe, palette, technique, inventory, project,
  common).
- Zero or more **media** files (permitted image types).

## 2. Manifest

The manifest embeds the Common document envelope (composing `envelopeCore`, closed with
`unevaluatedProperties: false`) and adds:

| Member | Type | Rule |
|---|---|---|
| `entries` | array of Entry (§3) | **REQUIRED**, at least one. Lists every file in the archive except `manifest.json` itself. |
| `summary` | string | Optional. |

`spec` **MUST** equal `bundle`.

## 3. Entry

`path` and `mediaType` are REQUIRED.

- `path` — the file's **relative, forward-slash** location in the archive. The schema requires it
  to start with an alphanumeric/underscore and contain only `A-Z a-z 0-9 . _ / -`. The reference
  reader **additionally** rejects `..` segments, absolute paths, and backslashes (§5).
- `spec` — present for **document** entries (`common`/`recipe`/`palette`/`technique`/`inventory`/
  `project`); the file at `path` is validated against that specification. **Absent** marks a
  **media** entry.
- `mediaType` — `application/json` (or a vendor `+json` type) for documents; a **permitted image
  type** for media (§5).
- `integrity` — optional `{ algorithm, value }` hash of the entry's bytes.

## 4. Reading and writing

A conformant reader MUST:

1. Enforce **safe archive handling** (§5) on every entry **before** trusting or fully decompressing
   it.
2. Parse and validate `manifest.json` against this specification.
3. Confirm every manifest `entries[].path` exists in the archive.
4. Validate every **document** entry against its declared `spec`.
5. Confirm every **media** entry's `mediaType` is a permitted image type.

The reference implementation provides `readBundle(bytes)` and `writeBundle(...)` in
`@brushcodex/validator/bundle`.

**Entry integrity (optional).** A writer MAY stamp each entry with an `integrity` hash of the
entry's bytes; a reader that encounters a declared `integrity` SHOULD verify it and reject the
archive on a mismatch. Integrity is advisory (accidental-corruption / tamper detection), not a
signature, and is not required for conformance. The reference implementation provides
`writeBundleWithIntegrity(...)` (stamps every entry) and `verifyBundleIntegrity(bytes)` (recomputes
and compares), and the `pnpm integrity <bundle.zip>` CLI reports per-entry `valid` / `mismatch` /
`missing-file` / `absent`.

## 5. Safe archive handling (security) — REQUIRED

Bundles are untrusted input. A reader **MUST** reject the whole archive (not silently skip
entries) when any of the following holds:

- **Path traversal / absolute paths.** An entry path contains a `..` segment, an empty segment, a
  `.` segment, a leading `/`, a backslash `\`, a Windows drive letter (`C:`), or a NUL byte, or is
  longer than 255 characters. Only relative forward-slash paths are allowed.
- **Unsupported / executable content.** An entry whose extension is not one of `json`, `png`,
  `jpg`, `jpeg`, `webp`, `gif`. (SVG is excluded — it can carry scripts. HTML/JS/executables are
  rejected.) Media `mediaType` MUST be one of `image/png`, `image/jpeg`, `image/webp`,
  `image/gif`.
- **Archive bombs.** An entry whose **uncompressed** size exceeds `MAX_ENTRY_BYTES` (5 MiB), a
  total uncompressed size exceeding `MAX_TOTAL_BYTES` (20 MiB), or more than `MAX_BUNDLE_ENTRIES`
  (200) entries. The reader checks the **uncompressed** size from the archive index **before**
  decompressing, so a decompression bomb is refused, not expanded.

These limits are enforced in `@brushcodex/validator/bundle` and tested with malicious
inputs (a `../` entry, an oversized entry, an over-count archive, and disallowed content).

## 6. Extension preservation

Documents inside a bundle preserve their unknown namespaced extensions exactly (each is validated
and round-tripped by its own spec reader). The manifest's own `extensions` (envelope) are
preserved likewise.

## 7. Conformance

A bundle conforms to Bundle v1 if its `manifest.json` validates against `bundle.schema.json`, its
archive satisfies §5, every manifest entry resolves to an archive file, every document entry is
valid against its `spec`, and every media entry uses a permitted image type. The reference reader
enforces all of these and is tested against valid and malicious inputs.

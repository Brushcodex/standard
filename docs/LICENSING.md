# Licensing

**Status: DECIDED and APPLIED** (adopted by the maintainer, 2026-07-15).

This document records how the **BrushCodex open standard** licenses its artifacts. It is
**not legal advice.** The licenses below are **applied** in this repository (see the `LICENSE`
files listed in §6).

> The BrushCodex reference **web application** and any curated **catalogue / color datasets** are
> *not* part of this repository. They live in their own repositories under their own terms and
> are out of scope here.

## 1. Why separate treatment

One license does not fit both code/specifications and example data:

- **The open standard** — specification text, JSON Schemas, reference validators, SDK, and
  tooling — is meant to be implemented and reused by anyone, including in proprietary tools. A
  permissive license **with an explicit patent grant** best serves an interoperability standard.
- **Examples / the conformance corpus** are meant to be copied verbatim into other test suites;
  the lightest possible terms avoid an attribution burden on hundreds of small test files.

## 2. License matrix (applied)

| Artifact | Paths | License | SPDX |
|---|---|---|---|
| Specification text | `specs/**` | Apache License 2.0 | `Apache-2.0` |
| JSON Schemas | `schemas/**` | Apache License 2.0 | `Apache-2.0` |
| Reference toolkit — validators, SDK, CLI, fixtures loaders | `packages/**` | Apache License 2.0 | `Apache-2.0` |
| Repository tooling | `scripts/**` | Apache License 2.0 | `Apache-2.0` |
| Examples / conformance corpus | `examples/**`, `conformance/**` | CC0 1.0 Universal | `CC0-1.0` |
| User-authored recipes / palettes / media | content inside a document | author's choice via the document `license` field | per-item |
| Trademarks / branding | "BrushCodex", logos | **not granted** by any code/spec license | — |

Full license texts live at
[`LICENSES/LICENSE-APACHE-2.0.txt`](../LICENSES/LICENSE-APACHE-2.0.txt) and
[`LICENSES/LICENSE-CC0-1.0.txt`](../LICENSES/LICENSE-CC0-1.0.txt); attribution is in
[`NOTICE`](../NOTICE).

## 3. Why these licenses

- **Apache-2.0 for the whole standard** (spec text, schemas, and the reference toolkit) — one
  permissive license lets any tool, open or closed, read, quote, implement, and vendor the
  format, and its **explicit patent grant** protects implementers of an interoperability
  standard. A single license across the standard avoids documentation-vs-code license-mismatch
  friction for implementers.
- **CC0-1.0 for examples/conformance** — a third party proving conformance copies the fixtures;
  CC0 lets them do so with zero obligations (no attribution burden on hundreds of small files).

## 4. Compatibility notes

- **Implementing the specifications imposes no license on the implementation.** Attribution and
  the `NOTICE` apply only when the Apache-2.0 material itself (spec text, schemas, toolkit code)
  is redistributed.
- **CC0 examples** impose no terms on the copier.
- Because the standard is Apache-2.0, downstream projects may combine it into more strongly
  copylefted works (for example an AGPL application); the reverse is not implied.

## 5. User data and document content

BrushCodex documents belong to their authors. Each document carries its own license in the
Common envelope `license` field, independent of the license on the standard itself. Nothing in
this repository claims rights over documents authored in these formats.

## 6. Applied `LICENSE` files

| Location | License |
|---|---|
| [`LICENSE`](../LICENSE) | Apache-2.0 full text (repository default, for license discovery) |
| [`LICENSES/LICENSE-APACHE-2.0.txt`](../LICENSES/LICENSE-APACHE-2.0.txt) | Apache-2.0 full text (canonical) |
| [`LICENSES/LICENSE-CC0-1.0.txt`](../LICENSES/LICENSE-CC0-1.0.txt) | CC0-1.0 full text (canonical) |
| [`NOTICE`](../NOTICE) | Apache-2.0 attribution notice |
| `specs/LICENSE` | Apache-2.0 (points to the canonical text) |
| `schemas/LICENSE` | Apache-2.0 |
| `packages/*/LICENSE` | Complete Apache-2.0 text; `packages/fixtures/LICENSE` also includes the complete CC0-1.0 text for its bundled corpus |
| `packages/*/NOTICE` | Self-contained package attribution and license-scope notice |
| `examples/LICENSE` | CC0-1.0 |
| `conformance/LICENSE` | CC0-1.0 |

Each `@brushcodex/*` package also declares `"license": "Apache-2.0"` in its `package.json` and
packs its own complete `LICENSE` and `NOTICE`; the fixtures package additionally carries the
complete CC0-1.0 terms applicable to its bundled corpus. `scripts/**` is covered by the canonical
Apache-2.0 text. Consumers vendoring a repository directory should include its applicable
`LICENSE` (or the canonical text under `LICENSES/`) and the repository `NOTICE`.

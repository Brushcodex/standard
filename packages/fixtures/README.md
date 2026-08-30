# @brushcodex/fixtures

The canonical BrushCodex **example & conformance fixture corpus**, as a self-contained package:
a stable, typed **manifest** plus a small **Node loader**. The corpus travels _inside_ the package
(`corpus/examples/**`), so a consumer validates against it without ever reading the standard's
source repository.

```ts
import { fixtures, validFixtures, getFixture } from '@brushcodex/fixtures';
import { loadFixture, examplesRoot } from '@brushcodex/fixtures/node';
import { validateBySpec, runConformance } from '@brushcodex/validator';

const f = getFixture('recipe/comprehensive.valid');
const result = validateBySpec(f.spec, loadFixture(f.id)); // -> { valid: true, issues: [] }

runConformance(examplesRoot); // validate the whole shipped corpus
```

## What's inside

- **Manifest** (`.` / `./manifest`) — browser-safe, zero `node:*`, no embedded content:
  - `fixtures`, `validFixtures`, `invalidFixtures` — the fixture metadata list.
  - `getFixture(id)`, `fixturesBySpec(spec)` — selectors.
  - types: `BrushCodexFixture`, `SpecName`, `FixtureCategory`, `FixtureExpectation`.
- **Node loaders** (`./node`) — read the packed corpus files:
  - `examplesRoot`, `corpusRoot` — absolute paths (feed `examplesRoot` to `runConformance`).
  - `fixturePath(id)`, `loadFixtureText(id)`, `loadFixture(id)`.

## Fixture categories & the manifest shape

The corpus is the same set of documents that implementations must agree on. For each of the seven
specs (`common`, `recipe`, `palette`, `inventory`, `project`, `technique`, `bundle`):

- `category: 'valid'` — `*.valid.json`; MUST validate against its `spec`.
- `category: 'invalid'` — `invalid/*.json`; MUST be rejected as its `spec`. Each carries an
  `expectation` (from the corpus' `invalid/EXPECTATIONS.json`) naming the exact failure:
  `{ layer: 'schema', keyword, instancePath }` or `{ layer: 'semantic', rule }`.

A fixture's **`spec` is its document type** — pass it straight to `validateBySpec(spec, doc)`.

Stable ids: `"<spec>/<name>.valid"` for valid fixtures, `"<spec>/invalid/<name>"` for invalid ones
(e.g. `recipe/minimal.valid`, `recipe/invalid/missing-steps`).

## Node vs. browser usage

The default entry is pure data and safe to import anywhere. Anything that reads file content lives
under `@brushcodex/fixtures/node` (which imports `node:fs`) — keep fixture loading in tests, scripts,
and build steps, and never pull the corpus into a browser/client bundle. Consumers should load only
the fixture ids they need (`loadFixture(id)`), not the whole corpus.

## Build & pack

```bash
pnpm --filter @brushcodex/fixtures generate   # copy corpus + regenerate src/manifest.generated.ts
pnpm --filter @brushcodex/fixtures build       # generate, then tsc -> dist/
pnpm --filter @brushcodex/fixtures test        # generate, then vitest (manifest + validator gates)
pnpm --filter @brushcodex/fixtures exec pnpm pack   # -> a local tarball (prepack regenerates first)
```

The corpus is generated from the canonical `examples/` at the repository root (single source of
truth) into `corpus/` (gitignored in-repo, shipped in the tarball via `files`) — the same
"generate from root" pattern as `@brushcodex/schema`.

## Third-party conformance

An independent implementation can install this package, enumerate `fixtures`, validate each
`validFixtures` entry (expect accept) and each `invalidFixtures` entry (expect reject) with its own
validator, and — where an `expectation` is present — confirm the rejection is for the stated reason.

## Provenance & license

Package code is Apache-2.0 (see `LICENSE`). The shipped corpus is public-domain **CC0-1.0**; its
notice travels at `corpus/examples/LICENSE`. All corpus documents are synthetic — no scraped or
proprietary data (see `PROVENANCE.md`).

**Status:** `1.0.0-rc.2`, `private` — **not published**. Consumed locally via a packed tarball.

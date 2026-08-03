# @brushcodex/validator

Reference validators, conformance runner, and HTML renderer for the BrushCodex open standard.
Framework-agnostic and application-independent — it runs under Node/Vitest and tooling without
any web application.

```ts
import { validateAnyDocument, validateBySpec, runConformance } from '@brushcodex/validator';

const { spec, result } = validateAnyDocument(parsedJson);
if (!result.valid) console.error(result.issues);
```

## What's inside

- **`registry`** — `validateAnyDocument`, `validateBySpec`, `detectSpec`, `SPEC_NAMES`.
- **per-spec modules** (`common`, `recipe`, `palette`, `inventory`, `project`, `technique`,
  `bundle`) — `validate*Document`, `parse*Document`, `serialize*Document`, round-trip helpers,
  and the reference models.
- **`conformance`** — `runConformance(examplesRoot)` over the on-disk corpus.
- **`render`** — reference HTML renderers.
- **`migrate`** — graduates stranded `extensions` data into the core members it became.
- **`authoring`** — build documents that are valid by construction, and revise them safely.

## Authoring (`@brushcodex/validator/authoring`)

Reading a document was always covered; this is the write half. The helpers mint the envelope
members a producer would otherwise hand-roll — `spec`, `specVersion`, `id`, `revision`, and the
timestamps — then run the result through the same reference parser an outside consumer would
use, so an authored document cannot be born invalid.

```ts
import { createRecipe, reviseDocument } from '@brushcodex/validator/authoring';

const recipe = createRecipe({
  title: 'Rusted power armour',
  steps: [{ instruction: 'Basecoat with two thin coats.' }],
});
// → spec/specVersion/createdAt/updatedAt filled, id minted as a registry-free
//   `urn:uuid:` URI, and already validated. Throws RecipeValidationError otherwise.

const edited = reviseDocument(recipe, { title: 'Rusted power armour, mk II' });
// → new `revision`, refreshed `updatedAt`, same `id`/`createdAt`, no stale `integrity`.
```

Two envelope rules are enforced rather than left to the caller:

- **Editing MUST produce a new `revision`** (common spec §4). `reviseDocument` mints one and
  rejects a revision that reuses the token it replaces.
- **A revision is a new state of the same document.** `spec`, `id`, and `createdAt` carry over
  and cannot be changed through this path. A declared `integrity` is *dropped*, because the old
  hash does not describe the new content — re-seal with `stampIntegrity` when you need one.

Every source of non-determinism is injectable, so authored output is byte-reproducible:

```ts
createRecipe(draft, { now: '2026-07-15T14:00:00Z', uuid: () => 'fixed-uuid' });
```

Precedence for a member is: an explicit value in the draft → the matching option → the minted
default. Nothing here is normative; it is convenience over `specs/` + `schemas/`.

## Provenance & schemas

Extracted **unmodified** from the reference application's `src/modules/standards/**` (see the
repository `PROVENANCE.md`). It loads the normative JSON Schemas from the repository-root
`schemas/` directory (single source of truth), so it can never drift from the published
artifacts. Dependencies: `ajv`, `ajv-formats`, `zod`, `fflate`. License: Apache-2.0.

## Test / typecheck

```bash
pnpm --filter @brushcodex/validator test        # vitest run (unit + corpus)
pnpm --filter @brushcodex/validator typecheck   # tsc --noEmit
```

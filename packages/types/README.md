# @brushcodex/types

Canonical TypeScript types for the seven BrushCodex document formats — a dependency-light type
entry point with no runtime code.

```ts
import type {
  CommonDocument,
  RecipeDocument,
  PaletteDocument,
  PaletteRole,
  InventoryDocument,
  ProjectDocument,
  TechniqueDocument,
  BundleManifest,
} from '@brushcodex/types';
```

## One model, re-exported — never a second one

These types are **re-exported** from the single canonical model defined (via Zod) in
`@brushcodex/validator`; they are not generated from the JSON Schemas. Generating a parallel type
set (e.g. with `json-schema-to-typescript`) would create a second, independently-maintained model
that can silently drift from the validator's runtime model. The Zod-derived types are the canonical
source; this package just gives type-only consumers a stable import that carries no validator
runtime. To *check* a document at runtime, use `@brushcodex/validator`; to *describe* one at compile
time, use this package.

## Dependency graph

```text
@brushcodex/schema ─► @brushcodex/validator ─► @brushcodex/types   (type-only re-export)
```

**Status:** `0.9.0-draft`, `private` — **not published** to any registry. License: Apache-2.0.

# @brushcodex/schema

The BrushCodex open-standard JSON Schemas, as importable data. **Zero dependencies.**

```js
import { schemas, schemaById, SPEC_NAMES } from '@brushcodex/schema';

schemas.recipe;              // the Recipe v1 JSON Schema (draft 2020-12) as an object
schemaById['https://brushcodex.com/schemas/common/v1/common.schema.json'];
SPEC_NAMES;                  // ['common','recipe','palette','inventory','project','technique','bundle']
```

The schemas cross-reference each other by absolute `$id`, so a draft-2020-12 validator can
register all seven and resolve every `$ref`.

## Source of truth

The canonical schemas live in the repository-root `schemas/` directory. At build time
(`pnpm --filter @brushcodex/schema generate`) they are inlined into
`generated/schemas.generated.js`, so the published package is self-contained and never reads
this repository at runtime — it cannot fork the schemas it exposes. License: Apache-2.0.

## Test

```bash
pnpm --filter @brushcodex/schema test   # node ./test.js
```

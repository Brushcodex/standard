# Authoring cookbook — build a valid document of every type

The [Quickstart](QUICKSTART.md) hand-wrote a document and validated it. This cookbook does the
other half: it **builds** a valid document of each core type with the reference authoring
helpers, so you never hand-roll the envelope and an authored document *cannot be born invalid*.

Every snippet and every line of output below was produced by the runnable companion script
[`../packages/validator/examples/authoring-cookbook.mjs`](../packages/validator/examples/authoring-cookbook.mjs).
Run it yourself — see [Run the whole cookbook](#run-the-whole-cookbook).

## Why authoring helpers

Reading and validating documents was always covered; these close the **write** half. A producer
otherwise hand-rolls five envelope members (`spec`, `specVersion`, `id`, `revision`, and the
`createdAt`/`updatedAt` timestamps) and can get any of them subtly wrong. The
`@brushcodex/validator/authoring` helpers mint those for you and then run the result through the
**same reference parser an outside consumer uses**, so `create*` either returns a valid document
or throws that spec's validation error. Nothing here is normative — it is convenience over
[`../specs`](../specs) + [`../schemas`](../schemas).

## Consuming the helpers today

The helpers ship in `@brushcodex/validator`, which is **not yet published to a registry** (that is
a maintainer release step — see [RELEASING.md](RELEASING.md)). Until then you consume them from a
checkout of this repository. The companion script lives *inside* the package, so Node resolves
`@brushcodex/validator` by [self-reference](https://nodejs.org/api/packages.html#self-referencing-a-package-using-its-name)
rather than by a published registry entry. That self-reference resolves through the package's
`exports` map to its **built** entry point, so the workspace must be built once first:

```bash
pnpm install                                          # once, from the repo root
pnpm -r build                                         # required — the helpers ship from dist/
node packages/validator/examples/authoring-cookbook.mjs
```

> **Governance dependency (parked):** publishing `@brushcodex/*` would let external projects
> `npm install @brushcodex/validator` and author from anywhere. That is a maintainer decision;
> this cookbook runs from the repo checkout in the meantime.

## The core idea: you write content, the helper writes the envelope

You pass only the domain content. The helper mints the envelope and validates:

```js
import { createRecipe } from '@brushcodex/validator/authoring';

const recipe = createRecipe({
  title: 'Rusted power armour',
  steps: [
    { instruction: 'Basecoat the armour with two thin coats of dark metal.' },
    { instruction: 'Stipple orange-brown rust into the recesses and edges.' },
  ],
});
```

`recipe` comes back already valid, with the envelope filled in — `spec`, `specVersion`, a
registry-free `urn:uuid:` `id`, a timestamped `revision`, and matching timestamps:

```json
{
  "spec": "recipe",
  "specVersion": "1.0.0",
  "id": "urn:uuid:00000000-0000-4000-8000-000000000001",
  "revision": "rev-2026-07-15T14-00-00Z-000000",
  "title": "Rusted power armour",
  "createdAt": "2026-07-15T14:00:00.000Z",
  "updatedAt": "2026-07-15T14:00:00.000Z",
  "steps": [
    { "instruction": "Basecoat the armour with two thin coats of dark metal." },
    { "instruction": "Stipple orange-brown rust into the recesses and edges." }
  ]
}
```

(The `id`, `revision`, and timestamps are deterministic here only because the script injects a
fixed clock and UUID source — see [Reproducible output](#reproducible-output). Omit them and you
get a fresh random `urn:uuid:` and the current time.)

## One recipe per core type

Each helper takes the same shape — domain content in, valid document out. The minimum content per
type mirrors that spec's `examples/<spec>/v1/minimal.valid.json`.

**Painting Workflow** (technical spec name `recipe`) — an ordered plan, reusable process, or
as-painted record (`createRecipe`, shown above): a `title` and at least one step.

**Palette** — a named set of paints and mixes:

```js
import { createPalette } from '@brushcodex/validator/authoring';

const palette = createPalette({
  title: 'Rust and steel',
  entries: [
    { name: 'Base metal', paint: { name: 'Steel' } },
    { name: 'Rust accent', paint: { name: 'Burnt orange' } },
  ],
});
```

**Inventory** — paints you own, with quantity:

```js
import { createInventory } from '@brushcodex/validator/authoring';

const inventory = createInventory({
  title: 'My paint drawer',
  items: [{ paint: { manufacturer: 'Some Brand', name: 'Steel' }, quantity: 2 }],
});
```

**Project** — a painting project (a `title` and a `status`):

```js
import { createProject } from '@brushcodex/validator/authoring';

const project = createProject({ title: 'Space marines squad', status: 'active' });
```

**Technique** — a reusable technique (a `title` and a `purpose`):

```js
import { createTechnique } from '@brushcodex/validator/authoring';

const technique = createTechnique({
  title: 'Two thin coats',
  purpose: 'Build up opaque, even coverage without obscuring surface detail.',
});
```

**Bundle** — a manifest that packages the documents above:

```js
import { createBundleManifest } from '@brushcodex/validator/authoring';

const bundle = createBundleManifest({
  title: 'A single-recipe bundle',
  entries: [
    { path: 'documents/recipe.brushrecipe.json', spec: 'recipe', mediaType: 'application/json' },
  ],
});
```

**Common** — the shared envelope, authored on its own with `createCommonDocument({ title })`.

## Editing: a revision must be a new revision

The envelope spec is explicit — *editing published content MUST produce a new `revision`* (common
spec §4). `reviseDocument` makes the correct edit the easy one: it mints a fresh `revision`,
refreshes `updatedAt`, carries `id`/`createdAt`/`spec` over unchanged, and drops any stale
`integrity` hash. It **refuses** an edit that would reuse the previous revision token.

```js
import { reviseDocument } from '@brushcodex/validator/authoring';

const editedRecipe = reviseDocument(recipe, { title: 'Rusted power armour, mk II' });
// revision changed=true   id preserved=true
```

## Reproducible output

Every source of non-determinism is injectable, so authored output can be byte-reproducible in
tests and pipelines. Precedence for each envelope member is **explicit draft value → matching
option → minted default**:

```js
createRecipe(draft, { now: '2026-07-15T14:00:00Z', uuid: () => 'fixed-uuid' });
```

## Run the whole cookbook

From the repo root:

```bash
node packages/validator/examples/authoring-cookbook.mjs
```

Every authored document is validated in-process with `validateAnyDocument` — the same entry an
independent consumer uses — and the script exits non-zero if any fails:

```text
OK   recipe    urn:uuid:00000000-0000-4000-8000-000000000001  rev-2026-07-15T14-00-00Z-000000
OK   palette   urn:uuid:00000000-0000-4000-8000-000000000003  rev-2026-07-15T14-00-00Z-000000
OK   inventory urn:uuid:00000000-0000-4000-8000-000000000005  rev-2026-07-15T14-00-00Z-000000
OK   project   urn:uuid:00000000-0000-4000-8000-000000000007  rev-2026-07-15T14-00-00Z-000000
OK   technique urn:uuid:00000000-0000-4000-8000-000000000009  rev-2026-07-15T14-00-00Z-000000
OK   bundle    urn:uuid:00000000-0000-4000-8000-000000000011  rev-2026-07-15T14-00-00Z-000000
OK   common    urn:uuid:00000000-0000-4000-8000-000000000013  rev-2026-07-15T14-00-00Z-000000
OK   recipe→rev  revision changed=true id preserved=true  rev-2026-07-15T15-30-00Z-000000

Authored 8 documents; 8/8 validate.
```

## Validate the authored files with the CLI

To connect this back to the [Quickstart](QUICKSTART.md), write the authored documents to disk and
validate them with the CLI exactly as you would any document (**pass absolute paths** — the CLI
runs with `packages/cli` as its working directory):

```bash
node packages/validator/examples/authoring-cookbook.mjs --out /absolute/path/to/authored
pnpm --filter @brushcodex/cli validate /absolute/path/to/authored/recipe.json \
  /absolute/path/to/authored/palette.json /absolute/path/to/authored/inventory.json \
  /absolute/path/to/authored/project.json /absolute/path/to/authored/technique.json \
  /absolute/path/to/authored/bundle.json /absolute/path/to/authored/common.json
```

```text
OK    recipe  …/authored/recipe.json
OK    palette  …/authored/palette.json
OK    inventory  …/authored/inventory.json
OK    project  …/authored/project.json
OK    technique  …/authored/technique.json
OK    bundle  …/authored/bundle.json
OK    common  …/authored/common.json

7/7 valid.
```

The document you authored in code round-trips through the standalone validator to **valid**.

## Next steps

- **See richer, complete documents** — the [Worked examples](EXAMPLES.md) catalogue links a
  realistic, complete document for every type, exercising the full vocabulary.
- **Validate without the toolkit** — the Python path in
  [VALIDATE_WITH_JSONSCHEMA.md](VALIDATE_WITH_JSONSCHEMA.md) needs only the published schemas.
- **Read the full authoring API** — the
  [validator README](../packages/validator/README.md#authoring-brushcodexvalidatorauthoring) and
  the normative envelope rules in [`../specs/common/v1/README.md`](../specs/common/v1/README.md) §4.
- **Extend a document** — carry data the core does not model in namespaced `extensions`:
  [EXTENSIONS.md](EXTENSIONS.md).

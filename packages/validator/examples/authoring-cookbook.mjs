/**
 * Authoring cookbook — runnable companion to docs/AUTHORING.md.
 *
 * Builds one valid document of every core BrushCodex type using the
 * `@brushcodex/validator/authoring` helpers, then validates each one through
 * `validateAnyDocument` — the same entry an outside consumer uses — and prints a
 * per-type result. Exits non-zero if any authored document fails to validate.
 *
 * Run it from the repository root (no build step, no install beyond `pnpm install`):
 *
 *   node packages/validator/examples/authoring-cookbook.mjs
 *   node packages/validator/examples/authoring-cookbook.mjs --out /some/dir   # also write the JSON
 *
 * The package is resolved by its own name via Node self-reference because this
 * file lives inside `@brushcodex/validator`; the helpers are not (yet) published.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  createRecipe,
  createPalette,
  createInventory,
  createProject,
  createTechnique,
  createBundleManifest,
  createCommonDocument,
  reviseDocument,
} from '@brushcodex/validator/authoring';
import { validateAnyDocument } from '@brushcodex/validator';

// Deterministic clock + UUID source, so the authored output is byte-reproducible
// and this file's printed results match docs/AUTHORING.md. In real use you omit
// both and get a fresh `urn:uuid:` id and current timestamps.
const NOW = '2026-07-15T14:00:00Z';
const LATER = '2026-07-15T15:30:00Z'; // the edit in the revise demo happens later
let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const opts = { now: NOW, uuid };

// One document per core type. You supply only the domain content — the helper
// mints spec/specVersion/id/revision and the timestamps, then validates.
const docs = {
  recipe: createRecipe(
    {
      title: 'Rusted power armour',
      steps: [
        { instruction: 'Basecoat the armour with two thin coats of dark metal.' },
        { instruction: 'Stipple orange-brown rust into the recesses and edges.' },
      ],
    },
    opts,
  ),

  palette: createPalette(
    {
      title: 'Rust and steel',
      entries: [
        { name: 'Base metal', paint: { name: 'Steel' } },
        { name: 'Rust accent', paint: { name: 'Burnt orange' } },
      ],
    },
    opts,
  ),

  inventory: createInventory(
    {
      title: 'My paint drawer',
      items: [{ paint: { manufacturer: 'Some Brand', name: 'Steel' }, quantity: 2 }],
    },
    opts,
  ),

  project: createProject({ title: 'Space marines squad', status: 'active' }, opts),

  technique: createTechnique(
    {
      title: 'Two thin coats',
      purpose: 'Build up opaque, even coverage without obscuring surface detail.',
    },
    opts,
  ),

  bundle: createBundleManifest(
    {
      title: 'A single-recipe bundle',
      entries: [
        { path: 'documents/recipe.brushrecipe.json', spec: 'recipe', mediaType: 'application/json' },
      ],
    },
    opts,
  ),

  common: createCommonDocument({ title: 'The shared envelope, authored on its own' }, opts),
};

// Validate each authored document the way an independent consumer would.
let failures = 0;
const rows = [];
for (const [name, doc] of Object.entries(docs)) {
  const { spec, result } = validateAnyDocument(doc);
  if (!result.valid) failures += 1;
  rows.push({ name, spec, valid: result.valid, id: doc.id, revision: doc.revision });
}

// Editing MUST mint a new revision (common spec §4). `reviseDocument` enforces it.
const editedRecipe = reviseDocument(
  docs.recipe,
  { title: 'Rusted power armour, mk II' },
  { now: LATER, uuid },
);
const revisedCheck = validateAnyDocument(editedRecipe);
if (!revisedCheck.result.valid) failures += 1;
const revisionChanged = editedRecipe.revision !== docs.recipe.revision;
const identityPreserved = editedRecipe.id === docs.recipe.id;

for (const r of rows) {
  console.log(`${r.valid ? 'OK  ' : 'FAIL'} ${r.spec.padEnd(9)} ${r.id}  ${r.revision}`);
}
console.log(
  `${revisedCheck.result.valid ? 'OK  ' : 'FAIL'} recipe→rev  ` +
    `revision changed=${revisionChanged} id preserved=${identityPreserved}  ${editedRecipe.revision}`,
);

// Optionally write the authored documents so you can validate them with the CLI.
const outIdx = process.argv.indexOf('--out');
if (outIdx !== -1 && process.argv[outIdx + 1]) {
  const dir = process.argv[outIdx + 1];
  mkdirSync(dir, { recursive: true });
  for (const [name, doc] of Object.entries(docs)) {
    writeFileSync(join(dir, `${name}.json`), JSON.stringify(doc, null, 2) + '\n');
  }
  console.log(`\nWrote ${Object.keys(docs).length} documents to ${dir}`);
}

const total = rows.length + 1;
console.log(`\nAuthored ${total} documents; ${total - failures}/${total} validate.`);
process.exit(failures === 0 ? 0 : 1);

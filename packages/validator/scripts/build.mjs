// Build @brushcodex/validator into a self-contained ESM dist with esbuild.
//
// @brushcodex/schema is bundled IN (it is a build-time devDependency), so the packed
// package carries the schema artifacts and has no @brushcodex/* runtime dependency —
// only the npm libraries (ajv/ajv-formats/zod/fflate) stay external. Per-spec entry
// points produce dist/<spec>/index.js for the package's subpath exports.

import { build } from 'esbuild';
import { rmSync } from 'node:fs';

rmSync(new URL('../dist', import.meta.url), { recursive: true, force: true });

const specs = ['common', 'recipe', 'palette', 'inventory', 'project', 'technique', 'bundle'];
const entryPoints = {
  index: 'src/index.ts',
  registry: 'src/registry.ts',
  conformance: 'src/conformance.ts',
  'render/index': 'src/render/index.ts',
  'migrate/index': 'src/migrate/index.ts',
  'authoring/index': 'src/authoring/index.ts',
};
for (const spec of specs) entryPoints[`${spec}/index`] = `src/${spec}/index.ts`;

await build({
  entryPoints,
  outdir: 'dist',
  bundle: true,
  splitting: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  external: ['ajv', 'ajv/*', 'ajv-formats', 'zod', 'fflate'],
  logLevel: 'warning',
});

console.log('esbuild: @brushcodex/validator dist built');

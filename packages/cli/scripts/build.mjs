// Build @brushcodex/cli into self-contained ESM bins with esbuild.
//
// @brushcodex/validator (and, transitively, @brushcodex/schema) is bundled IN, so the
// packed CLI carries the validator + schemas; only the npm libraries stay external. Each
// bin gets a Node shebang. `splitting` is off so each bin is a standalone executable file.
//
// @brushcodex/fixtures is kept EXTERNAL (a runtime dependency), not bundled: it ships the
// corpus and resolves it via its own module location, so it must stay an installed package
// at runtime. Bundling it into the CLI dist would break that corpus path resolution.

import { build } from 'esbuild';
import { rmSync } from 'node:fs';

rmSync(new URL('../dist', import.meta.url), { recursive: true, force: true });

await build({
  entryPoints: { validate: 'src/validate.ts', conformance: 'src/conformance.ts' },
  outdir: 'dist',
  bundle: true,
  splitting: false,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  banner: { js: '#!/usr/bin/env node' },
  external: [
    '@brushcodex/fixtures',
    '@brushcodex/fixtures/*',
    'ajv',
    'ajv/*',
    'ajv-formats',
    'zod',
    'fflate',
  ],
  logLevel: 'warning',
});

console.log('esbuild: @brushcodex/cli dist built');

#!/usr/bin/env node
/**
 * Public paint-identity registry gate: orchestrator.
 *
 *   node scripts/check-public-registry.mjs
 *
 * Reads `registry/paint-identity.v1.json` — the file anyone on the internet
 * can fetch — and delegates every judgement to the pure functions in
 * scripts/lib/public-registry.mjs, which the regression suite drives directly.
 *
 * This runs in the PUBLIC repository on purpose. The artifact is generated
 * privately, and a check that only ran beside the generator would be checking
 * an intention rather than a publication.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPublicRegistry } from './lib/public-registry.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(repoRoot, 'registry', 'paint-identity.v1.json');

let document;
try {
  document = JSON.parse(readFileSync(file, 'utf8'));
} catch (error) {
  console.error(`registry/paint-identity.v1.json could not be read: ${error.message}`);
  process.exit(1);
}

const findings = checkPublicRegistry(document);
if (findings.length > 0) {
  console.error(`Public registry check failed (${findings.length} finding(s)):`);
  for (const finding of findings.slice(0, 50)) console.error(`  - ${finding}`);
  process.exit(1);
}

const aliases = document.paints.reduce(
  (n, p) => n + (p.aliasIds?.length ?? 0) + (p.supersededIds?.length ?? 0),
  0,
);
console.log(
  `Public registry v${document.publicFormatVersion} valid: ` +
    `${document.paints.length} identities, ${aliases} resolvable aliases.` +
    (document.paints.length === 0
      ? '\n  Coverage is intentionally zero: no manufacturer currently carries a publication' +
        '\n  decision permitting open identity publication. See registry/README.md.'
      : ''),
);

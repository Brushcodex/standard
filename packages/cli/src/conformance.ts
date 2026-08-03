/**
 * BrushCodex conformance runner — validates the canonical example corpus with the
 * reference validators and reports pass/fail, WITHOUT the web application.
 *
 * The corpus is loaded through the `@brushcodex/fixtures` package (its shipped
 * `examplesRoot`), NOT the repository, so a packed/installed CLI runs conformance
 * with no source checkout and no repo-relative path — from any working directory.
 *
 *   pnpm --filter @brushcodex/cli conformance
 *   pnpm --filter @brushcodex/cli conformance -- --json
 *
 * Exit code: 0 when the whole corpus matches expectations, 1 otherwise.
 */

import { examplesRoot } from '@brushcodex/fixtures/node';
import { runConformance } from '@brushcodex/validator';

const asJson = process.argv.includes('--json');
const report = runConformance(examplesRoot);

if (asJson) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  for (const c of report.cases.filter((entry) => !entry.ok)) {
    const detail = c.detail ? ` (${c.detail})` : '';
    process.stderr.write(`FAIL  ${c.spec}  ${c.file}: expected ${c.expected}, got ${c.actual}${detail}\n`);
  }
  // Per-spec tally (from the report's own aggregates) so a run shows at a glance that
  // every specification's corpus was exercised, not only the grand total.
  for (const summary of report.bySpec) {
    process.stdout.write(`  ${summary.spec.padEnd(10)} ${summary.passed}/${summary.total}\n`);
  }
  process.stdout.write(
    `\nConformance: ${report.passed}/${report.total} cases passed across ${report.bySpec.length} specifications.\n`,
  );
}

process.exit(report.failed === 0 ? 0 : 1);

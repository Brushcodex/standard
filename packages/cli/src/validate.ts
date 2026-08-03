/**
 * BrushCodex document validator — a standalone CLI (run via `tsx`) that validates
 * any BrushCodex document or bundle archive against the published specifications,
 * WITHOUT the web application. It depends only on `@brushcodex/validator`, proving
 * the formats can be validated by an independent consumer.
 *
 *   pnpm --filter @brushcodex/cli validate my.brushrecipe.json
 *   pnpm --filter @brushcodex/cli validate --json my.brushrecipe.json a.brushcodex.zip
 *
 * Exit code: 0 when every input is valid, 1 when any is invalid, 2 on usage error.
 */

import { readFileSync } from 'node:fs';
import { bundle, validateAnyDocument } from '@brushcodex/validator';

/**
 * One problem with a file, in the CLI's own machine-readable shape. For documents
 * these are the validator's issues verbatim (layer `schema` | `semantic`); the CLI
 * adds three file-level layers of its own — `io` (the file could not be read),
 * `syntax` (the bytes are not JSON), and `archive` (a `.brushcodex.zip` could not be
 * opened) — so `--json` consumers can branch on `layer`/`code` and locate every
 * problem by `path` without re-parsing.
 */
interface CliIssue {
  /** JSON Pointer to the offending location; `''` for file-level problems. */
  path: string;
  /** Ajv keyword, a semantic-rule id, or a CLI code (`unreadable`, `not-json`, `bundle-unreadable`). */
  code: string;
  /** Human-readable explanation (the same text the default output prints). */
  message: string;
  /** Which layer rejected the file. */
  layer: 'schema' | 'semantic' | 'syntax' | 'archive' | 'io';
}

interface FileResult {
  file: string;
  kind: 'document' | 'bundle-archive';
  spec: string | null;
  valid: boolean;
  issues: CliIssue[];
  documents?: number;
  media?: number;
}

/** The `io`-layer issue for a path that could not be read at all (missing, permissions, …). */
function unreadableIssue(error: unknown): CliIssue {
  return {
    path: '',
    code: 'unreadable',
    message: `cannot read file: ${error instanceof Error ? error.message : String(error)}`,
    layer: 'io',
  };
}

function validateOne(file: string): FileResult {
  if (file.endsWith('.zip')) {
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(readFileSync(file));
    } catch (error) {
      // A missing/unreadable archive is an io problem, not a corrupt-archive one.
      return { file, kind: 'bundle-archive', spec: 'bundle', valid: false, issues: [unreadableIssue(error)] };
    }
    try {
      const result = bundle.readBundle(bytes);
      return {
        file,
        kind: 'bundle-archive',
        spec: 'bundle',
        valid: true,
        issues: [],
        documents: result.documents.length,
        media: result.media.length,
      };
    } catch (error) {
      return {
        file,
        kind: 'bundle-archive',
        spec: 'bundle',
        valid: false,
        issues: [
          {
            path: '',
            code: 'bundle-unreadable',
            message: error instanceof Error ? error.message : String(error),
            layer: 'archive',
          },
        ],
      };
    }
  }

  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (error) {
    // A missing/unreadable path is NOT a syntax problem; don't report "not valid JSON".
    return { file, kind: 'document', spec: null, valid: false, issues: [unreadableIssue(error)] };
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return {
      file,
      kind: 'document',
      spec: null,
      valid: false,
      issues: [{ path: '', code: 'not-json', message: 'not valid JSON', layer: 'syntax' }],
    };
  }
  const { spec, result } = validateAnyDocument(value);
  return {
    file,
    kind: 'document',
    spec,
    valid: result.valid,
    issues: result.issues,
  };
}

function main(): void {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const files = args.filter((arg) => !arg.startsWith('-'));

  if (files.length === 0) {
    process.stderr.write('Usage: brushcodex-validate [--json] <file.(json|zip)> ...\n');
    process.exit(2);
  }

  const results = files.map(validateOne);

  if (asJson) {
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  } else {
    for (const result of results) {
      const label = result.valid ? 'OK  ' : 'FAIL';
      const extra =
        result.kind === 'bundle-archive' && result.valid
          ? ` (${result.documents} document(s), ${result.media} media)`
          : '';
      process.stdout.write(`${label}  ${result.spec ?? '?'}  ${result.file}${extra}\n`);
      if (!result.valid) {
        for (const issue of result.issues) process.stdout.write(`        - ${issue.message}\n`);
      }
    }
    const invalid = results.filter((result) => !result.valid).length;
    process.stdout.write(`\n${results.length - invalid}/${results.length} valid.\n`);
  }

  process.exit(results.some((result) => !result.valid) ? 1 : 0);
}

main();

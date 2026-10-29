/**
 * Document-local anchor uniqueness, shared by the per-spec reference validators.
 *
 * An anchor (a `ref` or `id` that other members of the same document point at)
 * is only deterministic when it names exactly one member of its array: two
 * members sharing one anchor make every reference to it ambiguous. JSON Schema
 * cannot express uniqueness of a property across array objects (`uniqueItems`
 * compares whole items), so each spec enforces it as a semantic rule.
 *
 * Internal helper — deliberately not re-exported from `common/index.ts`, so the
 * package's public surface is unchanged.
 */

import type { ValidationIssue } from './validate';

/**
 * Report every member of `items` whose `key` repeats an earlier member's value.
 * The first occurrence is accepted; each later duplicate is reported at its own
 * path (`<arrayPath>/<index>/<key>`). Members without the key are skipped — the
 * anchor is optional everywhere it appears.
 */
export function duplicateAnchorIssues<K extends string>(
  items: ReadonlyArray<Partial<Record<K, string>>> | undefined,
  key: K,
  arrayPath: string,
  code: string,
  label: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  (items ?? []).forEach((item, index) => {
    const anchor = item[key];
    if (anchor === undefined) return;
    if (seen.has(anchor)) {
      issues.push({
        path: `${arrayPath}/${index}/${key}`,
        code,
        message: `${label} '${anchor}' is declared more than once`,
        layer: 'semantic',
      });
    }
    seen.add(anchor);
  });
  return issues;
}

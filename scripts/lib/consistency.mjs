/**
 * Pure logic for the prose ↔ schema consistency check.
 *
 * Both the normative prose (`specs/**​/README.md`) and the versioned JSON Schema are binding, and
 * every README in this repo states that a disagreement between them is a *defect to fix, not an
 * implementer's choice*. Nothing tested that. This module supplies the pure functions the checker
 * (`scripts/check-consistency.mjs`) composes; keeping them free of filesystem/process access lets
 * the regression suite (`scripts/check-consistency.test.mjs`) drive every case with in-memory data.
 *
 * ## What this checks (the tractable, high-precision surface)
 *
 * The two most drift-prone parts of a spec that can be compared *mechanically*:
 *
 *  1. **Enum vocabularies** — every value in every `enum` in a schema MUST be documented in the
 *     prose. Enums grow over time (new roles, new source types), and §8.4 of VERSIONING.md makes
 *     the frozen enum baseline load-bearing, so an undocumented value is exactly the drift a freeze
 *     would lock in permanently.
 *  2. **Property names** — every property a schema declares MUST be documented in the prose.
 *
 * A token counts as *documented* when it appears inside a backtick span (inline `code` or a fenced
 * block) in the prose. Looking only inside backticks is what makes this precise: it ignores the
 * enum values that happen to be ordinary English words (`model`, `other`, `high`) in running prose,
 * while still crediting the formal `{ hex }`, `{ task, done? }`, and `a | b` forms the specs use to
 * document a struct's members and a field's vocabulary.
 *
 * ## What this deliberately does NOT check (documented, not silently skipped)
 *
 *  - **Semantic rules** (`updatedAt >= createdAt`, cross-field requirements): not mechanically
 *    derivable from prose; they are covered by the example corpus and the validator's semantic layer.
 *  - **The reverse direction** (prose promising a value the schema rejects): a spec's prose contains
 *    many backtick tokens that are field names, types, or examples rather than vocabulary claims, so
 *    a mechanical reverse check cannot separate a promise from an illustration without false alarms.
 *  - **Descriptions matching**: whether the prose *describes a field correctly* is editorial.
 */

/** Collect every value of every `enum` anywhere in a schema (deep). */
export function schemaEnumValues(node, out = new Set()) {
  if (Array.isArray(node)) {
    for (const v of node) schemaEnumValues(v, out);
  } else if (node && typeof node === 'object') {
    if (Array.isArray(node.enum)) for (const v of node.enum) out.add(v);
    for (const k of Object.keys(node)) schemaEnumValues(node[k], out);
  }
  return out;
}

/** Collect every declared property name anywhere in a schema (deep; includes nested `$defs`). */
export function schemaPropertyNames(node, out = new Set()) {
  if (Array.isArray(node)) {
    for (const v of node) schemaPropertyNames(v, out);
  } else if (node && typeof node === 'object') {
    if (node.properties && typeof node.properties === 'object') {
      for (const k of Object.keys(node.properties)) out.add(k);
    }
    for (const k of Object.keys(node)) schemaPropertyNames(node[k], out);
  }
  return out;
}

/**
 * Every identifier token that appears inside a backtick span of the prose. `$` is a valid leading
 * and interior character so `$schema` is captured whole.
 */
export function backtickTokens(prose, out = new Set()) {
  for (const span of prose.match(/`[^`]+`/g) ?? []) {
    for (const tok of span.match(/[A-Za-z$][A-Za-z0-9_$-]*/g) ?? []) out.add(tok);
  }
  return out;
}

/**
 * Compare one spec's schema against the documented-token sets and return its discrepancies.
 *
 * @param {object}  schema         the parsed JSON Schema for the spec
 * @param {Set}     ownTokens      backtick tokens from this spec's README + the Common README
 * @param {Set}     corpusTokens   backtick tokens from all spec READMEs (shared Common structures
 *                                 such as `role`/`target` are documented in the embedders that use
 *                                 them, so vocabularies are credited corpus-wide)
 * @returns {{ undocumentedEnumValues: string[], undocumentedProperties: string[] }}
 */
export function specDiscrepancies(schema, ownTokens, corpusTokens) {
  const enums = schemaEnumValues(schema);
  const props = schemaPropertyNames(schema);

  const undocumentedEnumValues = [...enums].filter((v) => !corpusTokens.has(v)).sort();
  const undocumentedProperties = [...props]
    .filter((v) => !ownTokens.has(v) && !corpusTokens.has(v))
    .sort();

  return { undocumentedEnumValues, undocumentedProperties };
}

/**
 * Regression tests for the prose ↔ schema consistency logic (scripts/lib/consistency.mjs).
 *
 * Run with `node --test scripts/` (wired as `pnpm test:gate`). No test-runner dependency: uses the
 * built-in node:test. These drive the pure functions with in-memory schemas and prose, proving the
 * checker DETECTS an undocumented enum value and an undocumented property, CREDITS members that are
 * documented only inside a backticked brace/vocabulary form (`{ hex }`, `a | b`) or with a leading
 * `$` (`$schema`), and CREDITS a shared vocabulary documented in a sibling spec (corpus-wide). The
 * live corpus is checked end-to-end by `pnpm check:consistency`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  backtickTokens,
  schemaEnumValues,
  schemaPropertyNames,
  specDiscrepancies,
} from './lib/consistency.mjs';

test('schemaEnumValues collects enum values from nested $defs and arrays', () => {
  const schema = {
    properties: { a: { enum: ['x', 'y'] } },
    $defs: { t: { properties: { b: { enum: ['z'] } } } },
  };
  assert.deepEqual([...schemaEnumValues(schema)].sort(), ['x', 'y', 'z']);
});

test('schemaPropertyNames collects nested property names', () => {
  const schema = {
    properties: { a: {}, b: {} },
    $defs: { t: { properties: { c: {} } } },
  };
  assert.deepEqual([...schemaPropertyNames(schema)].sort(), ['a', 'b', 'c']);
});

test('backtickTokens reads inside inline code, brace forms, pipe lists, and $-identifiers', () => {
  const tokens = backtickTokens('see `role`, a `{ hex }`, `{ task, done? }`, `nominal_mm | ratio`, `$schema`');
  for (const t of ['role', 'hex', 'task', 'done', 'nominal_mm', 'ratio', '$schema']) {
    assert.ok(tokens.has(t), `expected token ${t}`);
  }
});

test('backtickTokens ignores identifiers in plain prose (not between backticks)', () => {
  const tokens = backtickTokens('a generic model made of other things; only `real` is code');
  assert.ok(tokens.has('real'));
  assert.ok(!tokens.has('generic'));
  assert.ok(!tokens.has('model'));
});

test('specDiscrepancies flags an undocumented enum value', () => {
  const schema = { properties: { k: { enum: ['known', 'ghost'] } } };
  const corpus = backtickTokens('the vocabulary is `known`');
  const { undocumentedEnumValues } = specDiscrepancies(schema, corpus, corpus);
  assert.deepEqual(undocumentedEnumValues, ['ghost']);
});

test('specDiscrepancies flags an undocumented property', () => {
  const schema = { properties: { documented: {}, orphan: {} } };
  const own = backtickTokens('the `documented` field');
  const { undocumentedProperties } = specDiscrepancies(schema, own, own);
  assert.deepEqual(undocumentedProperties, ['orphan']);
});

test('specDiscrepancies credits a brace-form member and a $-identifier as documented', () => {
  const schema = { $defs: { c: { properties: { hex: {} }, ...{} } }, properties: { $schema: {} } };
  const own = backtickTokens('color is `{ hex }`; `$schema` points to the schema');
  const { undocumentedProperties } = specDiscrepancies(schema, own, own);
  assert.deepEqual(undocumentedProperties, []);
});

test('specDiscrepancies credits a shared vocabulary documented in a sibling spec (corpus-wide)', () => {
  const schema = { $defs: { role: { enum: ['basecoat', 'glaze'] } } };
  const own = backtickTokens('this spec mentions no roles'); // not in own prose
  const corpus = backtickTokens('Recipe lists `basecoat`, `glaze`'); // documented by a sibling
  const { undocumentedEnumValues } = specDiscrepancies(schema, own, corpus);
  assert.deepEqual(undocumentedEnumValues, []);
});

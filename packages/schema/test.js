// Zero-dependency smoke test for @brushcodex/schema: every spec's schema loads,
// carries a canonical $id, and is indexed by that $id.
import assert from 'node:assert/strict';
import { schemas, schemaById, SPEC_NAMES } from './index.js';

assert.equal(SPEC_NAMES.length, 7, 'expected 7 specifications');

for (const name of SPEC_NAMES) {
  const schema = schemas[name];
  assert.ok(schema && typeof schema === 'object', `${name}: schema object loaded`);
  assert.ok(
    typeof schema.$id === 'string' && schema.$id.startsWith('https://brushcodex.com/schemas/'),
    `${name}: has a canonical $id`,
  );
  assert.equal(schemaById[schema.$id], schema, `${name}: indexed by $id`);
}

console.log(`OK: ${SPEC_NAMES.length} schemas loaded (${SPEC_NAMES.join(', ')})`);

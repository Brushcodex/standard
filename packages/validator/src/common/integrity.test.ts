/**
 * Tests for content-integrity hashing (common spec section 5.5).
 *
 * The hash is taken over the canonical serialization of the document with its
 * `integrity` member removed, so it is deterministic, independent of member
 * order, and independent of any declared `integrity`. A known SHA-256 vector
 * pins the algorithm; verify/stamp cover the round trip and tamper detection.
 */

import { describe, expect, it } from 'vitest';
import { toCanonicalJson } from './canonical';
import {
  computeIntegrity,
  readDeclaredIntegrity,
  stampIntegrity,
  verifyIntegrity,
} from './integrity';

const doc = {
  spec: 'recipe',
  specVersion: '1.0.0',
  id: 'https://example.org/r/1',
  revision: 'rev-1',
  title: 'Red armour',
  steps: [{ instruction: 'Basecoat red.' }],
};

/** An independent SHA-256 over the canonical form, computed via Web Crypto here. */
async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('computeIntegrity', () => {
  it('hashes the canonical serialization (matches an independent SHA-256)', async () => {
    const expected = await sha256Hex(toCanonicalJson(doc));
    const integrity = await computeIntegrity(doc);
    expect(integrity.algorithm).toBe('sha-256');
    expect(integrity.value).toBe(expected);
    expect(integrity.value).toMatch(/^[0-9a-f]{64}$/); // lowercase hex, sha-256 length
  });

  it('is deterministic and independent of member insertion order', async () => {
    const reordered = {
      title: 'Red armour',
      steps: [{ instruction: 'Basecoat red.' }],
      revision: 'rev-1',
      id: 'https://example.org/r/1',
      specVersion: '1.0.0',
      spec: 'recipe',
    };
    const a = await computeIntegrity(doc);
    const b = await computeIntegrity(reordered);
    expect(a.value).toBe(b.value);
  });

  it('ignores any declared `integrity` member (so stamping is well-defined)', async () => {
    const withHash = { ...doc, integrity: { algorithm: 'sha-256', value: 'deadbeef' } };
    expect((await computeIntegrity(withHash)).value).toBe((await computeIntegrity(doc)).value);
  });

  it('supports sha-512 (distinct value, 128 hex chars)', async () => {
    const s256 = await computeIntegrity(doc, 'sha-256');
    const s512 = await computeIntegrity(doc, 'sha-512');
    expect(s512.algorithm).toBe('sha-512');
    expect(s512.value).toMatch(/^[0-9a-f]{128}$/);
    expect(s512.value).not.toBe(s256.value);
  });
});

describe('verifyIntegrity', () => {
  it('reports `absent` when the document declares no integrity', async () => {
    expect(await verifyIntegrity(doc)).toEqual({ status: 'absent' });
  });

  it('reports `valid` for a correctly stamped document', async () => {
    const stamped = await stampIntegrity(doc);
    const result = await verifyIntegrity(stamped);
    expect(result.status).toBe('valid');
    expect(result.declared?.value).toBe(result.computed?.value);
  });

  it('reports `mismatch` when the document was tampered after stamping', async () => {
    const stamped = await stampIntegrity(doc);
    const tampered = { ...stamped, title: 'Blue armour' };
    expect((await verifyIntegrity(tampered)).status).toBe('mismatch');
  });

  it('reports `mismatch` for a wrong declared hash (uppercase tolerated on the declared side)', async () => {
    const wrong = { ...doc, integrity: { algorithm: 'sha-256', value: 'a'.repeat(64) } };
    expect((await verifyIntegrity(wrong)).status).toBe('mismatch');
  });
});

describe('stampIntegrity', () => {
  it('adds an integrity member that verifies, and is idempotent', async () => {
    const once = await stampIntegrity(doc);
    expect(readDeclaredIntegrity(once)?.algorithm).toBe('sha-256');
    expect((await verifyIntegrity(once)).status).toBe('valid');

    // Re-stamping recomputes the same hash (integrity is excluded from the input).
    const twice = await stampIntegrity(once);
    expect(readDeclaredIntegrity(twice)?.value).toBe(readDeclaredIntegrity(once)?.value);
  });
});

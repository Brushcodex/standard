/**
 * Tests for per-entry bundle integrity: `writeBundleWithIntegrity` stamps each
 * entry's byte hash, and `verifyBundleIntegrity` recomputes and compares them.
 */

import { unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { computeBytesIntegrity } from '../common';
import { verifyBundleIntegrity } from './integrity';
import { writeBundle, writeBundleWithIntegrity, type WriteBundleOptions } from './write';

const recipe = {
  spec: 'recipe',
  specVersion: '1.0.0',
  id: 'https://example.org/r/1',
  revision: 'rev-1',
  title: 'Red armour',
  steps: [{ instruction: 'Basecoat red.' }],
};

const palette = {
  spec: 'palette',
  specVersion: '1.0.0',
  id: 'https://example.org/p/1',
  revision: 'rev-1',
  title: 'Rust palette',
  entries: [{ name: 'Rust', color: { hex: '#8a4b2f' } }],
};

const OPTIONS: WriteBundleOptions = {
  id: 'urn:uuid:00000000-0000-4000-8000-0000000000ac',
  title: 'Sample bundle',
  documents: [
    { path: 'recipes/red.brushrecipe.json', spec: 'recipe', document: recipe },
    { path: 'palettes/rust.brushpalette.json', spec: 'palette', document: palette },
  ],
  media: [
    { path: 'media/base.png', mediaType: 'image/png', bytes: new Uint8Array([137, 80, 78, 71]) },
  ],
};

describe('computeBytesIntegrity', () => {
  it('matches an independent SHA-256 and distinguishes different bytes', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const expected = [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const integrity = await computeBytesIntegrity(bytes);
    expect(integrity).toEqual({ algorithm: 'sha-256', value: expected });
    const other = await computeBytesIntegrity(new Uint8Array([1, 2, 3, 5]));
    expect(other.value).not.toBe(integrity.value);
  });
});

describe('verifyBundleIntegrity', () => {
  it('verifies every stamped entry (valid, ok)', async () => {
    const report = await verifyBundleIntegrity(await writeBundleWithIntegrity(OPTIONS));
    expect(report.ok).toBe(true);
    expect(report.checked).toBe(3); // 2 documents + 1 media
    expect(report.entries.every((e) => e.status === 'valid')).toBe(true);
  });

  it('reports every entry `absent` for a bundle written without integrity', async () => {
    const report = await verifyBundleIntegrity(writeBundle(OPTIONS));
    expect(report.ok).toBe(true); // nothing declared -> nothing can mismatch
    expect(report.checked).toBe(0);
    expect(report.entries.every((e) => e.status === 'absent')).toBe(true);
  });

  it('detects a tampered entry (mismatch, not ok)', async () => {
    const zip = await writeBundleWithIntegrity(OPTIONS);
    // Repackage the archive with one document's bytes altered; the manifest keeps
    // the original hashes, so verification must flag exactly that entry.
    const files = unzipSync(zip);
    files['recipes/red.brushrecipe.json'] = new TextEncoder().encode('{"tampered":true}');
    const report = await verifyBundleIntegrity(zipSync(files));
    expect(report.ok).toBe(false);
    const recipeEntry = report.entries.find((e) => e.path === 'recipes/red.brushrecipe.json');
    expect(recipeEntry?.status).toBe('mismatch');
    // The untouched entries still verify.
    expect(report.entries.find((e) => e.path === 'media/base.png')?.status).toBe('valid');
  });

  it('flags a declared entry whose file was removed (missing-file, not ok)', async () => {
    const zip = await writeBundleWithIntegrity(OPTIONS);
    const files = unzipSync(zip);
    delete files['media/base.png'];
    const report = await verifyBundleIntegrity(zipSync(files));
    expect(report.ok).toBe(false);
    expect(report.entries.find((e) => e.path === 'media/base.png')?.status).toBe('missing-file');
  });
});

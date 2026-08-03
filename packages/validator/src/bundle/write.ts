/**
 * Writer for BrushCodex bundles. Builds a manifest from the given documents and
 * media, refuses unsafe paths / unpermitted media, validates the manifest before
 * writing, and returns the ZIP bytes.
 */

import { strToU8, zipSync } from 'fflate';
import { computeBytesIntegrity, type IntegrityAlgorithm } from '../common';
import type { BundleEntry, BundleEntrySpec } from './bundle';
import {
  hasPermittedExtension,
  isPermittedMediaType,
  isSafeEntryPath,
  BundleSafetyError,
} from './safe';
import { parseBundleManifest } from './validate';

export interface WriteBundleDocument {
  path: string;
  spec: BundleEntrySpec;
  document: unknown;
}

export interface WriteBundleMedia {
  path: string;
  mediaType: string;
  bytes: Uint8Array;
}

export interface WriteBundleOptions {
  id: string;
  title: string;
  revision?: string;
  summary?: string;
  documents: WriteBundleDocument[];
  media?: WriteBundleMedia[];
}

function assertWritablePath(path: string): void {
  if (!isSafeEntryPath(path) || !hasPermittedExtension(path)) {
    throw new BundleSafetyError('unsafe-path', `Refusing to write unsafe bundle path '${path}'.`);
  }
}

/** The document/media file bytes plus their manifest entries (no manifest yet). */
interface BuiltBundle {
  files: Record<string, Uint8Array>;
  entries: BundleEntry[];
}

/** Build the entry file bytes + manifest entries, enforcing write-time safety. */
function buildBundleFiles(options: WriteBundleOptions): BuiltBundle {
  const files: Record<string, Uint8Array> = {};
  const entries: BundleEntry[] = [];

  for (const doc of options.documents) {
    assertWritablePath(doc.path);
    files[doc.path] = strToU8(JSON.stringify(doc.document, null, 2));
    entries.push({ path: doc.path, spec: doc.spec, mediaType: 'application/json' });
  }

  for (const item of options.media ?? []) {
    assertWritablePath(item.path);
    if (!isPermittedMediaType(item.mediaType)) {
      throw new BundleSafetyError(
        'unsupported-content',
        `Refusing to write media '${item.path}' with unpermitted type '${item.mediaType}'.`,
      );
    }
    files[item.path] = item.bytes;
    entries.push({ path: item.path, mediaType: item.mediaType });
  }

  return { files, entries };
}

/** Add the validated `manifest.json` to the file map and zip it. */
function assembleBundle(
  options: WriteBundleOptions,
  files: Record<string, Uint8Array>,
  entries: BundleEntry[],
): Uint8Array {
  const manifest: Record<string, unknown> = {
    spec: 'bundle',
    specVersion: '1.0.0',
    id: options.id,
    revision: options.revision ?? 'r1',
    title: options.title,
    entries,
  };
  if (options.summary !== undefined) manifest.summary = options.summary;

  // Safety net: never write a non-conformant manifest.
  parseBundleManifest(manifest);

  return zipSync({ ...files, 'manifest.json': strToU8(JSON.stringify(manifest, null, 2)) });
}

/** Assemble a bundle ZIP. The manifest is validated before writing. */
export function writeBundle(options: WriteBundleOptions): Uint8Array {
  const { files, entries } = buildBundleFiles(options);
  return assembleBundle(options, files, entries);
}

/**
 * Assemble a bundle ZIP that stamps each document/media entry with an `integrity`
 * hash over its file bytes (bundle spec section 3), producing a tamper-evident
 * archive that `verifyBundleIntegrity` can check. Async because it hashes with
 * Web Crypto; `writeBundle` remains the synchronous, integrity-free writer.
 */
export async function writeBundleWithIntegrity(
  options: WriteBundleOptions,
  algorithm: IntegrityAlgorithm = 'sha-256',
): Promise<Uint8Array> {
  const { files, entries } = buildBundleFiles(options);
  const withIntegrity = await Promise.all(
    entries.map(async (entry) => {
      const bytes = files[entry.path];
      if (bytes === undefined) throw new Error(`missing bytes for entry '${entry.path}'`);
      return { ...entry, integrity: await computeBytesIntegrity(bytes, algorithm) };
    }),
  );
  return assembleBundle(options, files, withIntegrity);
}

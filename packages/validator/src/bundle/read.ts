/**
 * Safe reader for BrushCodex bundles (`.brushcodex.zip`).
 *
 * Every entry is checked against the safe-archive rules (./safe) BEFORE it is
 * decompressed (fflate's `filter` receives the uncompressed size from the archive
 * index, so a decompression bomb is refused rather than expanded). The whole
 * archive is rejected on any violation. Then the manifest is validated, every
 * listed file is confirmed present, and every document entry is validated against
 * its declared spec.
 */

import { strFromU8, unzipSync } from 'fflate';
import type { ValidationIssue } from '../common';
import type { BundleEntrySpec, BundleManifest } from './bundle';
import { assertSafeEntry, BundleSizeTracker, isPermittedMediaType } from './safe';
import {
  BundleManifestValidationError,
  parseBundleManifest,
  validateDocumentBySpec,
} from './validate';

const MANIFEST_PATH = 'manifest.json';

export interface BundleDocument {
  path: string;
  spec: BundleEntrySpec;
  document: unknown;
}

export interface BundleMedia {
  path: string;
  mediaType: string;
  bytes: Uint8Array;
}

export interface ReadBundleResult {
  manifest: BundleManifest;
  documents: BundleDocument[];
  media: BundleMedia[];
}

/** Thrown when a bundle's manifest is valid but its contents are not. */
export class BundleContentError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(`Invalid bundle contents: ${issues.map((i) => i.message).join('; ')}`);
    this.name = 'BundleContentError';
    this.issues = issues;
  }
}

/**
 * Read and fully validate a bundle. Throws `BundleSafetyError` on unsafe archive
 * content, `BundleManifestValidationError` on a bad/missing manifest, and
 * `BundleContentError` when a listed file is missing or a contained document is
 * not conformant.
 */
export function readBundle(zip: Uint8Array): ReadBundleResult {
  const tracker = new BundleSizeTracker();
  const files = unzipSync(zip, {
    filter: (file) => {
      // Both calls throw on violation, rejecting the whole archive before decompression.
      assertSafeEntry(file.name, file.originalSize);
      tracker.add(file.originalSize);
      return true;
    },
  });

  const manifestBytes = files[MANIFEST_PATH];
  if (manifestBytes === undefined) {
    throw new BundleManifestValidationError([
      {
        path: '',
        code: 'missing-manifest',
        message: "Bundle has no 'manifest.json'.",
        layer: 'schema',
      },
    ]);
  }
  let manifestValue: unknown;
  try {
    manifestValue = JSON.parse(strFromU8(manifestBytes));
  } catch {
    throw new BundleManifestValidationError([
      {
        path: '/manifest.json',
        code: 'invalid-json',
        message: 'manifest.json is not valid JSON.',
        layer: 'schema',
      },
    ]);
  }
  const manifest = parseBundleManifest(manifestValue);

  const documents: BundleDocument[] = [];
  const media: BundleMedia[] = [];
  const issues: ValidationIssue[] = [];

  for (const entry of manifest.entries) {
    const bytes = files[entry.path];
    if (bytes === undefined) {
      issues.push({
        path: `/entries (${entry.path})`,
        code: 'entry-missing',
        message: `Manifest lists '${entry.path}' but the archive has no such file.`,
        layer: 'schema',
      });
      continue;
    }

    if (entry.spec !== undefined) {
      let value: unknown;
      try {
        value = JSON.parse(strFromU8(bytes));
      } catch {
        issues.push({
          path: entry.path,
          code: 'invalid-json',
          message: `'${entry.path}' is not valid JSON.`,
          layer: 'schema',
        });
        continue;
      }
      const result = validateDocumentBySpec(entry.spec, value);
      if (!result.valid) {
        issues.push({
          path: entry.path,
          code: 'invalid-document',
          message: `'${entry.path}' is not a valid ${entry.spec} document: ${result.issues
            .map((i) => i.message)
            .join('; ')}`,
          layer: 'schema',
        });
        continue;
      }
      documents.push({ path: entry.path, spec: entry.spec, document: value });
    } else {
      if (!isPermittedMediaType(entry.mediaType)) {
        issues.push({
          path: `/entries (${entry.path})`,
          code: 'unsupported-media',
          message: `Media '${entry.path}' declares an unpermitted type '${entry.mediaType}'.`,
          layer: 'schema',
        });
        continue;
      }
      media.push({ path: entry.path, mediaType: entry.mediaType, bytes });
    }
  }

  if (issues.length > 0) {
    throw new BundleContentError(issues);
  }

  return { manifest, documents, media };
}

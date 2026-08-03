/**
 * Safe-archive handling for BrushCodex bundles (bundle spec §5).
 *
 * Bundles are untrusted ZIP input. These guards reject path traversal, absolute
 * paths, unsupported/executable content, and archive bombs BEFORE any entry is
 * trusted or fully decompressed. The reader (./read) applies them per entry and
 * rejects the whole archive on any violation (it never silently skips entries).
 */

/** Maximum number of entries in a bundle. */
export const MAX_BUNDLE_ENTRIES = 200;
/** Maximum uncompressed size of a single entry (5 MiB). */
export const MAX_ENTRY_BYTES = 5 * 1024 * 1024;
/** Maximum total uncompressed size of a bundle (20 MiB). */
export const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

/** Content types permitted for media entries. */
export const PERMITTED_MEDIA_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;

/** File extensions permitted anywhere in a bundle (documents + media). */
const PERMITTED_EXTENSIONS = new Set(['json', 'png', 'jpg', 'jpeg', 'webp', 'gif']);

/** Extensions that map to a permitted media type. */
const MEDIA_TYPE_BY_EXTENSION: Record<string, (typeof PERMITTED_MEDIA_TYPES)[number]> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

/** Machine-readable reason a bundle was rejected on safety grounds. */
export type BundleSafetyCode =
  | 'unsafe-path'
  | 'unsupported-content'
  | 'entry-too-large'
  | 'bundle-too-large'
  | 'too-many-entries';

/** Thrown when a bundle entry violates the safe-archive rules. */
export class BundleSafetyError extends Error {
  readonly code: BundleSafetyCode;

  constructor(code: BundleSafetyCode, message: string) {
    super(message);
    this.name = 'BundleSafetyError';
    this.code = code;
  }
}

/**
 * Whether an archive entry path is safe: a relative, forward-slash path with no
 * traversal. Rejects `..`/`.`/empty segments, absolute paths, backslashes, drive
 * letters, NUL bytes, and overlong names.
 */
export function isSafeEntryPath(path: string): boolean {
  if (path.length === 0 || path.length > 255) return false;
  if (path.includes('\\')) return false;
  if (path.includes('\0')) return false;
  if (path.startsWith('/')) return false;
  if (/^[A-Za-z]:/.test(path)) return false;
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.' || segment === '..') return false;
  }
  return true;
}

/** The lowercase extension of a path (without the dot), or null if none. */
export function extensionOf(path: string): string | null {
  const dot = path.lastIndexOf('.');
  const slash = path.lastIndexOf('/');
  if (dot <= slash + 1) return null; // no dot, or a dotfile with no extension
  return path.slice(dot + 1).toLowerCase();
}

/** Whether a path's extension is permitted in a bundle (json or a permitted image). */
export function hasPermittedExtension(path: string): boolean {
  const ext = extensionOf(path);
  return ext !== null && PERMITTED_EXTENSIONS.has(ext);
}

/** The permitted media type implied by a media path's extension, or null. */
export function mediaTypeForPath(path: string): (typeof PERMITTED_MEDIA_TYPES)[number] | null {
  const ext = extensionOf(path);
  return ext !== null ? (MEDIA_TYPE_BY_EXTENSION[ext] ?? null) : null;
}

/** Whether a declared media type is one of the permitted image types. */
export function isPermittedMediaType(mediaType: string): boolean {
  return (PERMITTED_MEDIA_TYPES as readonly string[]).includes(mediaType);
}

/**
 * Assert a single entry (by name and uncompressed size) is safe. Throws
 * {@link BundleSafetyError} on any violation. Callers additionally track entry
 * count and cumulative size across a bundle (see {@link BundleSizeTracker}).
 */
export function assertSafeEntry(name: string, uncompressedSize: number): void {
  if (!isSafeEntryPath(name)) {
    throw new BundleSafetyError('unsafe-path', `Unsafe bundle entry path: '${name}'.`);
  }
  if (!hasPermittedExtension(name)) {
    throw new BundleSafetyError(
      'unsupported-content',
      `Unsupported bundle entry type: '${name}' (only JSON and PNG/JPEG/WebP/GIF are allowed).`,
    );
  }
  if (uncompressedSize > MAX_ENTRY_BYTES) {
    throw new BundleSafetyError(
      'entry-too-large',
      `Bundle entry '${name}' is ${uncompressedSize} bytes uncompressed (limit ${MAX_ENTRY_BYTES}).`,
    );
  }
}

/** Accumulates entry count + total size across a bundle, throwing when exceeded. */
export class BundleSizeTracker {
  private count = 0;
  private total = 0;

  /** Record one entry's uncompressed size; throws if the count/total limits are exceeded. */
  add(uncompressedSize: number): void {
    this.count += 1;
    if (this.count > MAX_BUNDLE_ENTRIES) {
      throw new BundleSafetyError(
        'too-many-entries',
        `Bundle has more than ${MAX_BUNDLE_ENTRIES} entries.`,
      );
    }
    this.total += uncompressedSize;
    if (this.total > MAX_TOTAL_BYTES) {
      throw new BundleSafetyError(
        'bundle-too-large',
        `Bundle exceeds ${MAX_TOTAL_BYTES} bytes uncompressed.`,
      );
    }
  }
}

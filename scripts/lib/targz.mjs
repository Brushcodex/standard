/**
 * Minimal, dependency-free `.tgz` (gzipped tar) reader for the packed release gate.
 *
 * npm/pnpm tarballs are produced by node-tar, which emits POSIX ustar records and uses pax
 * extended headers ('x') for long paths. This reader inflates with the built-in zlib and parses
 * 512-byte tar blocks — so the gate inspects packed artifacts on Windows/Linux/macOS with no
 * external `tar` binary. It is intentionally small: it reads regular files only and is used for
 * listing entries and reading text manifests, never for extraction to disk.
 */

import { gunzipSync } from 'node:zlib';

const BLOCK = 512;

function readString(buf, offset, length) {
  const slice = buf.subarray(offset, offset + length);
  const nul = slice.indexOf(0);
  const end = nul === -1 ? length : nul;
  return slice.toString('utf8', 0, end);
}

function readOctal(buf, offset, length) {
  const text = readString(buf, offset, length).trim();
  if (text === '') return 0;
  const value = parseInt(text, 8);
  return Number.isNaN(value) ? 0 : value;
}

/** Parse a pax extended-header body into a record map (only the keys we use are relevant). */
function parsePax(text) {
  const record = {};
  let rest = text;
  while (rest.length > 0) {
    const space = rest.indexOf(' ');
    if (space === -1) break;
    const len = parseInt(rest.slice(0, space), 10);
    if (Number.isNaN(len) || len <= 0 || len > rest.length) break;
    const entry = rest.slice(space + 1, len - 1); // drop trailing newline
    const eq = entry.indexOf('=');
    if (eq !== -1) record[entry.slice(0, eq)] = entry.slice(eq + 1);
    rest = rest.slice(len);
  }
  return record;
}

function isZeroBlock(block) {
  for (let i = 0; i < block.length; i += 1) if (block[i] !== 0) return false;
  return true;
}

/**
 * Read a gzipped tar buffer into a Map of `entryPath -> Buffer` for regular files.
 * Directory, symlink, and metadata (pax/global) entries are not included as files, though a pax
 * 'path' override is applied to the record it precedes.
 */
export function readTarGz(input) {
  const buf = gunzipSync(input);
  const entries = new Map();
  let offset = 0;
  let overridePath = null;
  let overrideSize = null;

  while (offset + BLOCK <= buf.length) {
    const header = buf.subarray(offset, offset + BLOCK);
    if (isZeroBlock(header)) break;

    let name = readString(header, 0, 100);
    const prefix = readString(header, 345, 155);
    if (prefix) name = `${prefix}/${name}`;
    let size = readOctal(header, 124, 12);
    const typeflag = header[156] === 0 ? '0' : String.fromCharCode(header[156]);

    const dataStart = offset + BLOCK;

    if (typeflag === 'x' || typeflag === 'g') {
      const body = buf.toString('utf8', dataStart, dataStart + size);
      const rec = parsePax(body);
      if (typeflag === 'x') {
        if (typeof rec.path === 'string') overridePath = rec.path;
        if (typeof rec.size === 'string') overrideSize = parseInt(rec.size, 10);
      }
      offset = dataStart + Math.ceil(size / BLOCK) * BLOCK;
      continue;
    }

    if (typeflag === 'L') {
      // GNU long name: body is the path for the next entry.
      overridePath = buf.toString('utf8', dataStart, dataStart + size).replace(/\0+$/, '');
      offset = dataStart + Math.ceil(size / BLOCK) * BLOCK;
      continue;
    }

    if (overridePath !== null) {
      name = overridePath;
      overridePath = null;
    }
    if (overrideSize !== null) {
      size = overrideSize;
      overrideSize = null;
    }

    if (typeflag === '0') {
      entries.set(name, Buffer.from(buf.subarray(dataStart, dataStart + size)));
    }

    offset = dataStart + Math.ceil(size / BLOCK) * BLOCK;
  }

  return entries;
}

/** Sorted list of regular-file entry paths inside a `.tgz` buffer. */
export function listTarGz(input) {
  return [...readTarGz(input).keys()].sort();
}

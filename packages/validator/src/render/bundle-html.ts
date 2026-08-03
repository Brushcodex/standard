/**
 * BrushCodex Bundle -> static site renderer (reference, framework-agnostic).
 *
 * Turns a validated `.brushcodex.zip` (read by the bundle reader) into a small,
 * self-contained static site: an `index.html` overview plus one rendered HTML page
 * per contained document — every spec the format defines has a renderer, so a
 * bundle becomes fully browsable offline. Packaged media are listed on the index
 * (they are files beside the pages, not embedded). Every page is self-contained
 * (inline CSS, no external requests) and every string is HTML-escaped, so a
 * portable bundle needs nothing from the web application to be read.
 */

import { z } from 'zod';
import type { BundleManifest } from '../bundle/bundle';
import type { BundleMedia, ReadBundleResult } from '../bundle/read';
import { parseRecipeDocument } from '../recipe';
import { parsePaletteDocument } from '../palette';
import { parseTechniqueDocument } from '../technique';
import { parseInventoryDocument } from '../inventory';
import { parseProjectDocument } from '../project';
import { RENDERABLE_SPECS, renderDocumentHtml } from './document';
import { documentLang, escapeHtml, renderHtmlDocument, renderMetaList, renderTags } from './shared';

/** A file to be written to the output site directory. */
export interface BundleSiteFile {
  name: string;
  html: string;
}

/** The specs the renderer can turn into a page (the rest are listed, not rendered). */
const RENDERABLE_BUNDLE_SPECS: ReadonlySet<string> = new Set<string>(RENDERABLE_SPECS);

const SPEC_LABELS: Record<string, string> = {
  recipe: 'Painting workflow',
  palette: 'Palette',
  technique: 'Technique',
  inventory: 'Inventory',
  project: 'Project',
  common: 'Document',
};

const titleSchema = z.object({ title: z.string().min(1) });

/** Extract the envelope title of a validated document (every spec requires one). */
function titleOf(document: unknown): string {
  const parsed = titleSchema.safeParse(document);
  return parsed.success ? parsed.data.title : '(untitled)';
}

/**
 * A deterministic, flat, traversal-safe HTML filename for a bundle entry path.
 * Path separators and any other non-filename character collapse to `_`, so every
 * page lands directly in the output directory (no sub-directories, no `..`).
 */
export function bundleDocFileName(entryPath: string): string {
  const base = entryPath.replace(/\.json$/i, '');
  return `${base.replace(/[^A-Za-z0-9._-]+/g, '_')}.html`;
}

/** Render a renderable bundle document to a full HTML page (already validated). */
function renderRenderable(spec: string, document: unknown): string {
  switch (spec) {
    case 'recipe':
      return renderDocumentHtml(parseRecipeDocument(document));
    case 'palette':
      return renderDocumentHtml(parsePaletteDocument(document));
    case 'technique':
      return renderDocumentHtml(parseTechniqueDocument(document));
    case 'inventory':
      return renderDocumentHtml(parseInventoryDocument(document));
    case 'project':
      return renderDocumentHtml(parseProjectDocument(document));
    default:
      // Unreachable: callers guard with RENDERABLE_BUNDLE_SPECS.
      throw new Error(`spec '${spec}' is not renderable`);
  }
}

interface IndexEntry {
  title: string;
  spec: string;
  path: string;
  fileName: string | undefined;
}

function renderDocumentsSection(entries: IndexEntry[]): string {
  const items = entries
    .map((entry) => {
      const label = SPEC_LABELS[entry.spec] ?? entry.spec;
      const name = entry.fileName
        ? `<a href="${escapeHtml(entry.fileName)}">${escapeHtml(entry.title)}</a>`
        : escapeHtml(entry.title);
      const note = entry.fileName
        ? ''
        : `<div class="entry-note">No renderer for this spec — the document is in the bundle, not on this page.</div>`;
      return (
        `<li class="entry">` +
        `<div class="entry-head"><span class="entry-name">${name}</span>` +
        `<span class="badge role">${escapeHtml(label)}</span></div>` +
        `<div class="entry-note">${escapeHtml(entry.path)}</div>` +
        note +
        `</li>`
      );
    })
    .join('');
  return (
    `<section class="documents" aria-labelledby="docs-h">\n` +
    `<h2 id="docs-h">Documents</h2>\n<ul class="entries">${items}</ul>\n</section>\n`
  );
}

function renderMediaSection(media: BundleMedia[]): string {
  if (media.length === 0) return '';
  const items = media
    .map(
      (item) =>
        `<li>${escapeHtml(item.path)} <span class="rights">${escapeHtml(item.mediaType)}</span></li>`,
    )
    .join('');
  return (
    `<section class="media" aria-labelledby="media-h">\n` +
    `<h2 id="media-h">Media</h2>\n<ul class="media-list">${items}</ul>\n</section>\n`
  );
}

function bundleMeta(manifest: BundleManifest, docCount: number, mediaCount: number): string {
  const rows: Array<[string, string]> = [];
  if (manifest.authors && manifest.authors.length > 0) {
    rows.push(['Authors', manifest.authors.map((author) => author.name).join(', ')]);
  }
  // Credit prose is part of the envelope; a renderer that drops it drops an obligation.
  if (manifest.attribution) {
    rows.push(['Attribution', manifest.attribution]);
  }
  if (manifest.license) {
    rows.push(['License', manifest.license.spdxId ?? manifest.license.name ?? 'see notice']);
  }
  rows.push(['Documents', String(docCount)]);
  if (mediaCount > 0) rows.push(['Media', String(mediaCount)]);
  rows.push(['Revision', manifest.revision]);
  if (manifest.updatedAt) rows.push(['Updated', manifest.updatedAt]);
  return renderMetaList(rows);
}

/** Render the bundle's `index.html` overview page. */
export function renderBundleIndexHtml(
  manifest: BundleManifest,
  entries: IndexEntry[],
  media: BundleMedia[],
): string {
  const articleBody =
    `<header>\n<h1>${escapeHtml(manifest.title)}</h1>\n` +
    (manifest.summary ? `<p class="summary">${escapeHtml(manifest.summary)}</p>\n` : '') +
    (manifest.description
      ? `<p class="description">${escapeHtml(manifest.description)}</p>\n`
      : '') +
    bundleMeta(manifest, entries.length, media.length) +
    renderTags(manifest.tags) +
    `</header>\n` +
    renderDocumentsSection(entries) +
    renderMediaSection(media);

  return renderHtmlDocument({
    lang: documentLang(manifest.language),
    title: manifest.title,
    spec: manifest.spec,
    specVersion: manifest.specVersion,
    articleBody,
    colorCaveat: false, // the bundle index itself shows no swatches
  });
}

/**
 * Return `name`, or a `-2`/`-3`/... variant, so every written file is distinct.
 * `bundleDocFileName` is many-to-one (path separators collapse to `_`), so two
 * distinct entry paths can flatten to the same filename; without this, one page
 * would silently overwrite another (and a `index.json` entry would clobber the
 * overview). `used` is seeded with `index.html` so nothing overwrites it.
 */
function uniqueFileName(name: string, used: Set<string>): string {
  let candidate = name;
  if (used.has(candidate)) {
    const dot = name.lastIndexOf('.');
    const stem = dot >= 0 ? name.slice(0, dot) : name;
    const ext = dot >= 0 ? name.slice(dot) : '';
    let counter = 2;
    do {
      candidate = `${stem}-${counter}${ext}`;
      counter += 1;
    } while (used.has(candidate));
  }
  used.add(candidate);
  return candidate;
}

/**
 * Render a read + validated bundle into a set of self-contained HTML files: the
 * `index.html` overview first, then one page per renderable document. The caller
 * writes each `{ name, html }` into the output directory.
 */
export function renderBundleSite(bundle: ReadBundleResult): BundleSiteFile[] {
  const pages: BundleSiteFile[] = [];
  const usedNames = new Set<string>(['index.html']); // reserve the overview page
  const entries: IndexEntry[] = bundle.documents.map((doc) => {
    const rendered = RENDERABLE_BUNDLE_SPECS.has(doc.spec);
    const fileName = rendered ? uniqueFileName(bundleDocFileName(doc.path), usedNames) : undefined;
    if (rendered && fileName !== undefined) {
      pages.push({ name: fileName, html: renderRenderable(doc.spec, doc.document) });
    }
    return { title: titleOf(doc.document), spec: doc.spec, path: doc.path, fileName };
  });

  const index = renderBundleIndexHtml(bundle.manifest, entries, bundle.media);
  return [{ name: 'index.html', html: index }, ...pages];
}

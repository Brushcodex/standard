/**
 * BrushCodex Palette -> static HTML renderer (reference, framework-agnostic).
 *
 * Turns a validated Palette v1 document into a self-contained HTML page - a
 * swatch-card view of the named entries plus their relationships. Like the recipe
 * renderer it imports only the standards models (no Next.js/React/Prisma/
 * catalogue), and applies the same safety and honesty rules: every string is
 * HTML-escaped, and every color swatch is paired with its hex text and a
 * provenance label (never color-only, never presented as a measurement).
 */

import type { PaletteDocument, PaletteEntry, PaletteRelationship } from '../palette';
import {
  documentLang,
  escapeHtml,
  paintLabel,
  renderHtmlDocument,
  renderMetaList,
  renderSwatch,
  renderTags,
  ROLE_LABELS,
} from './shared';

export { escapeHtml } from './shared';

/** Human labels for the relationship classes (spec section 5). */
const RELATIONSHIP_TYPE_LABELS: Record<PaletteRelationship['type'], string> = {
  shadow_to_highlight: 'Shadow to highlight',
  analogous: 'Analogous',
  complementary: 'Complementary',
  triadic: 'Triadic',
  custom: 'Custom',
};

/** The swatch for an entry: a direct literal color, else the entry paint's color. */
function entrySwatch(entry: PaletteEntry): string {
  if (entry.color) return renderSwatch(entry.color, entry.provenance);
  if (entry.paint?.color) return renderSwatch(entry.paint.color, entry.paint.provenance);
  return '';
}

/** Resolve an entry anchor (mix/relationship) to its entry name, else the raw anchor. */
function resolvedEntryLabel(anchor: string, byRef: Map<string, PaletteEntry>): string {
  const entry = byRef.get(anchor);
  return entry ? entry.name : anchor;
}

function renderEntry(entry: PaletteEntry, byRef: Map<string, PaletteEntry>): string {
  const roleBadge = entry.role
    ? `<span class="badge role">${escapeHtml(ROLE_LABELS[entry.role] ?? entry.role)}</span>`
    : '';

  const paintText = entry.paint
    ? `<div class="entry-paint">${escapeHtml(paintLabel(entry.paint))}</div>`
    : '';

  const mix =
    entry.mix && entry.mix.length > 0
      ? `<div class="entry-paint">Mix: ${entry.mix
          .map(
            (part) =>
              `${escapeHtml(resolvedEntryLabel(part.paint, byRef))} ` +
              `<span class="parts">(${escapeHtml(String(part.parts))})</span>`,
          )
          .join(', ')}</div>`
      : '';

  return (
    `<li class="entry">` +
    `<div class="entry-head"><span class="entry-name">${escapeHtml(entry.name)}</span>` +
    `${roleBadge}</div>` +
    entrySwatch(entry) +
    paintText +
    mix +
    (entry.note ? `<div class="entry-note">${escapeHtml(entry.note)}</div>` : '') +
    `</li>`
  );
}

function renderRelationships(doc: PaletteDocument, byRef: Map<string, PaletteEntry>): string {
  if (!doc.relationships || doc.relationships.length === 0) return '';
  const items = doc.relationships
    .map((relationship) => {
      const typeLabel = RELATIONSHIP_TYPE_LABELS[relationship.type];
      const sequence = relationship.sequence
        .map((anchor) => `<span>${escapeHtml(resolvedEntryLabel(anchor, byRef))}</span>`)
        .join('<span class="rel-arrow"> &rarr; </span>');
      return (
        `<li class="rel">` +
        `<span class="badge">${escapeHtml(typeLabel)}</span> ` +
        `<span class="rel-seq">${sequence}</span>` +
        (relationship.note ? `<div class="alt-note">${escapeHtml(relationship.note)}</div>` : '') +
        `</li>`
      );
    })
    .join('');
  return (
    `<section class="relationships" aria-labelledby="rel-h">\n` +
    `<h2 id="rel-h">Relationships</h2>\n<ul class="rel-list">${items}</ul>\n</section>\n`
  );
}

function paletteMeta(doc: PaletteDocument): string {
  const rows: Array<[string, string]> = [];
  if (doc.intent) rows.push(['Intent', doc.intent]);
  if (doc.target) {
    const kind = doc.target.kind ? `${doc.target.kind}: ` : '';
    rows.push(['Target', `${kind}${doc.target.description}`]);
  }
  if (doc.authors && doc.authors.length > 0) {
    rows.push(['Authors', doc.authors.map((author) => author.name).join(', ')]);
  }
  // Credit prose is part of the envelope; a renderer that drops it drops an obligation.
  if (doc.attribution) {
    rows.push(['Attribution', doc.attribution]);
  }
  if (doc.license) {
    rows.push(['License', doc.license.spdxId ?? doc.license.name ?? 'see notice']);
  }
  rows.push(['Entries', String(doc.entries.length)]);
  rows.push(['Revision', doc.revision]);
  if (doc.updatedAt) rows.push(['Updated', doc.updatedAt]);
  return renderMetaList(rows);
}

/**
 * Render a validated Palette document to a complete, self-contained HTML page.
 * The input must already be a parsed {@link PaletteDocument} (use
 * `parsePaletteDocument` from the palette validator at the trust boundary).
 */
export function renderPaletteHtml(doc: PaletteDocument): string {
  const byRef = new Map<string, PaletteEntry>();
  for (const entry of doc.entries) {
    if (entry.ref) byRef.set(entry.ref, entry);
  }

  const entries = doc.entries.map((entry) => renderEntry(entry, byRef)).join('');

  const articleBody =
    `<header>\n<h1>${escapeHtml(doc.title)}</h1>\n` +
    (doc.summary ? `<p class="summary">${escapeHtml(doc.summary)}</p>\n` : '') +
    (doc.description ? `<p class="description">${escapeHtml(doc.description)}</p>\n` : '') +
    paletteMeta(doc) +
    renderTags(doc.tags) +
    `</header>\n` +
    `<section class="entries-section" aria-labelledby="entries-h">\n` +
    `<h2 id="entries-h">Entries</h2>\n<ul class="entries">${entries}</ul>\n</section>\n` +
    renderRelationships(doc, byRef);

  return renderHtmlDocument({
    lang: documentLang(doc.language),
    title: doc.title,
    spec: doc.spec,
    specVersion: doc.specVersion,
    articleBody,
  });
}

/**
 * BrushCodex Inventory -> static HTML renderer (reference, framework-agnostic).
 *
 * Turns a validated Inventory v1 document into a self-contained HTML page: what
 * the painter owns, how much is left, and where it is kept. Like the other
 * renderers it imports only the standards models (no Next.js/React/Prisma/
 * catalogue) and applies the same rules — every string is HTML-escaped, and a
 * colour swatch is always paired with its hex text and provenance label.
 *
 * **Privacy.** An inventory is the most personal document in the format: storage
 * locations, purchase notes, and lot numbers live under each item's `private`
 * object precisely so they can be stripped as a group (spec §6). This renderer
 * shows a document exactly as given — it neither strips nor hides — because the
 * decision of what to share belongs to whoever produced the document, and the
 * shared export profile (`toSharedInventory`) is where that decision is made.
 * Rendering a private field the caller chose to keep is honest; silently hiding
 * it would make the page disagree with the file it came from. A caller
 * publishing a page from someone else's inventory should render the SHARED
 * profile, and the page says which one it is.
 */

import type { InventoryDocument, InventoryItem } from '../inventory/inventory';
import {
  documentLang,
  escapeHtml,
  paintLabel,
  renderHtmlDocument,
  renderMetaList,
  renderSwatch,
  renderTags,
} from './shared';

export { escapeHtml } from './shared';

/** Human labels for the closed condition vocabulary. */
const CONDITION_LABELS: Record<string, string> = {
  sealed: 'sealed',
  in_use: 'in use',
  low: 'low',
  dried_out: 'dried out',
  unknown: 'unknown',
};

/** "2 bottles (17 ml)" — quantity, unit and bottle size as one readable phrase. */
function quantityText(item: InventoryItem): string {
  const parts: string[] = [];
  if (item.quantity !== undefined) {
    const unit = item.unit ?? '';
    parts.push(unit ? `${item.quantity} ${unit}${item.quantity === 1 ? '' : 's'}` : String(item.quantity));
  }
  if (item.bottleSizeMl !== undefined) parts.push(`${item.bottleSizeMl} ml`);
  return parts.join(' · ');
}

/**
 * The private block, rendered as its own labelled group so a reader can see at a
 * glance which parts of the page would disappear from a shared export.
 */
function renderPrivate(item: InventoryItem): string {
  const priv = item.private;
  if (priv === undefined) return '';
  const rows: Array<[string, string]> = [];
  if (priv.storageLocation) rows.push(['Stored', priv.storageLocation]);
  if (priv.lot) rows.push(['Lot', priv.lot]);
  if (priv.acquiredAt) rows.push(['Acquired', priv.acquiredAt]);
  if (priv.acquiredNote) rows.push(['Acquired note', priv.acquiredNote]);
  if (priv.notes) rows.push(['Notes', priv.notes]);
  if (rows.length === 0) return '';
  const items = rows
    .map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`)
    .join('');
  return (
    `<div class="entry-private">` +
    `<span class="badge">private</span>` +
    `<ul class="bullets">${items}</ul></div>`
  );
}

function renderItem(item: InventoryItem): string {
  const badges = [
    item.condition ? CONDITION_LABELS[item.condition] ?? item.condition : undefined,
    item.lowStock === true ? 'low stock' : undefined,
    item.visibility === 'private' ? 'private item' : undefined,
  ]
    .filter((part): part is string => part !== undefined)
    .map((part) => `<span class="badge">${escapeHtml(part)}</span>`)
    .join(' ');

  const quantity = quantityText(item);
  const aliases =
    item.aliases && item.aliases.length > 0
      ? `<div class="entry-note">Also called: ${escapeHtml(item.aliases.join(', '))}</div>`
      : '';

  return (
    `<li class="entry">` +
    `<div class="entry-head">` +
    `<span class="entry-paint">${escapeHtml(paintLabel(item.paint))}</span> ${badges}` +
    `</div>` +
    renderSwatch(item.paint.color, item.paint.provenance) +
    (quantity ? `<div class="entry-note">${escapeHtml(quantity)}</div>` : '') +
    aliases +
    renderPrivate(item) +
    `</li>`
  );
}

function inventoryMeta(doc: InventoryDocument): string {
  const rows: Array<[string, string]> = [];
  rows.push(['Items', String(doc.items.length)]);
  const privateItems = doc.items.filter((item) => item.visibility === 'private').length;
  const withPrivateData = doc.items.filter((item) => item.private !== undefined).length;
  if (privateItems > 0 || withPrivateData > 0) {
    // State the profile plainly: a reader (and whoever is about to publish this
    // page) should not have to infer that it contains private data.
    rows.push([
      'Profile',
      `full — ${privateItems} private item(s), ${withPrivateData} with private fields`,
    ]);
  } else {
    rows.push(['Profile', 'no private data present']);
  }
  if (doc.authors && doc.authors.length > 0) {
    rows.push(['Authors', doc.authors.map((author) => author.name).join(', ')]);
  }
  // Credit prose is part of the envelope; a renderer that drops it drops an obligation.
  if (doc.attribution) rows.push(['Attribution', doc.attribution]);
  if (doc.license) {
    rows.push(['License', doc.license.spdxId ?? doc.license.name ?? 'see notice']);
  }
  rows.push(['Revision', doc.revision]);
  if (doc.updatedAt) rows.push(['Updated', doc.updatedAt]);
  return renderMetaList(rows);
}

/**
 * Render a validated Inventory document to a complete, self-contained HTML page.
 * The input must already be a parsed {@link InventoryDocument} (use
 * `parseInventoryDocument` at the trust boundary).
 */
export function renderInventoryHtml(doc: InventoryDocument): string {
  const items = doc.items.map(renderItem).join('');

  const articleBody =
    `<header>\n<h1>${escapeHtml(doc.title)}</h1>\n` +
    (doc.summary ? `<p class="summary">${escapeHtml(doc.summary)}</p>\n` : '') +
    (doc.description ? `<p class="description">${escapeHtml(doc.description)}</p>\n` : '') +
    inventoryMeta(doc) +
    renderTags(doc.tags) +
    `</header>\n` +
    `<section class="items" aria-labelledby="items-h">\n` +
    `<h2 id="items-h">Paints owned</h2>\n<ul class="entries">${items}</ul>\n</section>\n`;

  return renderHtmlDocument({
    lang: documentLang(doc.language),
    title: doc.title,
    spec: doc.spec,
    specVersion: doc.specVersion,
    articleBody,
  });
}

/**
 * Inventory export profiles (spec §6).
 *
 * The "full" profile is the document as authored. The "shared" profile omits every
 * item whose `visibility` is `private`, removes the `private` object from every
 * remaining item, and removes `extensions` wherever the document carries it and the
 * envelope `integrity`, leaving all other fields untouched. The result is itself a valid Inventory document — no
 * destructive merging is required to share an inventory.
 *
 * Why `extensions` goes (fail closed): an extension is opaque, namespaced data the
 * profile cannot interpret, so it cannot prove an extension carries nothing private —
 * an `app.example:locations` map keyed by item `ref`, say, would otherwise survive
 * into the export after the items it describes were removed. This is a deliberate
 * privacy-reducing export transform, not a read/write round trip, so it does not
 * conflict with Common §6 preservation; the full profile still preserves every
 * extension.
 *
 * Why `integrity` goes: it is the author's hash of the full document (Common §5.5), so
 * on the shared output it no longer matches the content, and it lets anyone who guesses
 * the removed private content confirm the guess. It is removed, not recomputed — a
 * shared export must not claim an integrity value its author never produced.
 *
 * In Inventory v1 the only member where Common or Inventory allows `extensions` is the
 * document envelope: Common `paintRef`, `provenanceEntry`, `agent`, `license`,
 * `translation`, `links`, `integrity`, the Inventory item and its `private` object are
 * all closed (`additionalProperties: false`) and define no `extensions` member.
 */

import type { InventoryDocument, InventoryItem } from './inventory';

function stripPrivate(item: InventoryItem): InventoryItem {
  const shared: InventoryItem = { ...item };
  delete shared.private;
  return shared;
}

/**
 * Produce the shareable export profile of an inventory: private items are removed,
 * the `private` object is stripped from the rest, and `extensions` and `integrity` are
 * removed. All other fields are preserved exactly.
 */
export function toSharedInventory(doc: InventoryDocument): InventoryDocument {
  const shared: InventoryDocument = {
    ...doc,
    items: doc.items.filter((item) => item.visibility !== 'private').map(stripPrivate),
  };
  delete shared.extensions;
  delete shared.integrity;
  return shared;
}

/** Whether a document carries any private data (a private item or a `private` object). */
export function hasPrivateData(doc: InventoryDocument): boolean {
  return doc.items.some((item) => item.visibility === 'private' || item.private !== undefined);
}

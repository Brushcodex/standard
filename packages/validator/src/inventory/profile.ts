/**
 * Inventory export profiles (spec §6).
 *
 * The "full" profile is the document as authored. The "shared" profile omits every
 * item whose `visibility` is `private` and removes the `private` object from every
 * remaining item, leaving all other fields untouched. The result is itself a valid
 * Inventory document — no destructive merging is required to share an inventory.
 */

import type { InventoryDocument, InventoryItem } from './inventory';

function stripPrivate(item: InventoryItem): InventoryItem {
  const shared: InventoryItem = { ...item };
  delete shared.private;
  return shared;
}

/**
 * Produce the shareable export profile of an inventory: private items are removed
 * and the `private` object is stripped from the rest. All other fields are
 * preserved exactly.
 */
export function toSharedInventory(doc: InventoryDocument): InventoryDocument {
  return {
    ...doc,
    items: doc.items.filter((item) => item.visibility !== 'private').map(stripPrivate),
  };
}

/** Whether a document carries any private data (a private item or a `private` object). */
export function hasPrivateData(doc: InventoryDocument): boolean {
  return doc.items.some((item) => item.visibility === 'private' || item.private !== undefined);
}

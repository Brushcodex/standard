/**
 * BrushCodex Paint Inventory v1 (DRAFT) — reference TypeScript model.
 *
 * An Inventory embeds the Common document envelope (the Zod envelope model is
 * extended, not duplicated) and adds a list of owned paints. Each item records
 * the user's OWN observations, distinct from catalogue truth, and separates
 * sensitive data into a per-item `private` object so a shareable export profile
 * can strip it (see ./profile).
 *
 *   - normative prose:  specs/inventory/v1/README.md
 *   - normative schema:  schemas/inventory/v1/inventory.schema.json
 *   - example corpus:    examples/inventory/v1/**
 */

import { z } from 'zod';
import { commonDocumentSchema } from '../common/envelope';
import { paintRefSchema } from '../common/paint';

export const INVENTORY_UNITS = ['bottle', 'pot', 'tube', 'dropper', 'ml', 'g', 'other'] as const;
export const INVENTORY_CONDITIONS = [
  'sealed',
  'in_use',
  'low',
  'empty',
  'dried_out',
  'unknown',
] as const;

/** The canonical shared paint reference (re-exported under the inventory-local name). */
export const inventoryPaintRefSchema = paintRefSchema;

const privateFieldsSchema = z
  .object({
    storageLocation: z.string().optional(),
    notes: z.string().optional(),
    lot: z.string().optional(),
    acquiredAt: z.string().datetime({ offset: true }).optional(),
    acquiredNote: z.string().optional(),
  })
  .strict();

export const inventoryItemSchema = z
  .object({
    ref: z.string().min(1).optional(),
    paint: inventoryPaintRefSchema,
    quantity: z.number().min(0).optional(),
    unit: z.enum(INVENTORY_UNITS).optional(),
    bottleSizeMl: z.number().positive().optional(),
    condition: z.enum(INVENTORY_CONDITIONS).optional(),
    lowStock: z.boolean().optional(),
    aliases: z
      .array(z.string().min(1))
      .refine((aliases) => new Set(aliases).size === aliases.length, {
        message: 'aliases must be unique',
      })
      .optional(),
    visibility: z.enum(['shareable', 'private']).optional(),
    private: privateFieldsSchema.optional(),
  })
  .strict();

/**
 * The typed Inventory model. Extends the Common envelope (so every envelope
 * member is inherited) and pins `spec` to the literal `inventory`. `items` MAY be
 * empty (a collection with no paints yet).
 */
export const inventoryDocumentSchema = commonDocumentSchema
  .extend({
    spec: z.literal('inventory'),
    summary: z.string().optional(),
    items: z.array(inventoryItemSchema),
  })
  .strict();

export type InventoryDocument = z.infer<typeof inventoryDocumentSchema>;
export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export type InventoryPaintRef = z.infer<typeof inventoryPaintRefSchema>;
export type InventoryUnit = (typeof INVENTORY_UNITS)[number];
export type InventoryCondition = (typeof INVENTORY_CONDITIONS)[number];

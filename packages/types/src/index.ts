/**
 * @brushcodex/types — canonical BrushCodex document TypeScript types.
 *
 * These re-export the single canonical model defined (via Zod) in @brushcodex/validator.
 *
 * Why re-export instead of generating from the JSON Schemas: generating a parallel type
 * set (e.g. with json-schema-to-typescript) would create a SECOND, independently-maintained
 * type model that can drift from the validator's runtime model — exactly the "second
 * independent type model" the integration brief warns against. The Zod-derived types are the
 * canonical source; this package gives consumers a stable, dependency-light type entry point
 * over them. (See STANDARD_PACKAGE_INTEGRATION_RESULT.md, "type-generation strategy".)
 *
 * Covers all seven canonical document types.
 */

export type { CommonDocument } from '@brushcodex/validator/common';
export type { RecipeDocument } from '@brushcodex/validator/recipe';
export type { PaletteDocument, PaletteRole } from '@brushcodex/validator/palette';
export type { InventoryDocument } from '@brushcodex/validator/inventory';
export type { ProjectDocument } from '@brushcodex/validator/project';
export type { TechniqueDocument } from '@brushcodex/validator/technique';
export type { BundleManifest } from '@brushcodex/validator/bundle';

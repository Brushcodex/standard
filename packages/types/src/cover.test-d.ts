/**
 * Compile-time coverage check: all seven canonical document types are exported and resolve.
 * This file only type-checks (it is excluded from the build); if any export is missing or a
 * re-export fails to resolve, `pnpm --filter @brushcodex/types typecheck` fails.
 */
import type {
  CommonDocument,
  RecipeDocument,
  PaletteDocument,
  PaletteRole,
  InventoryDocument,
  ProjectDocument,
  TechniqueDocument,
  BundleManifest,
} from './index.js';

// Reference every export in a type position so an omission is a compile error.
export type _CoversAllSevenDocuments =
  | CommonDocument
  | RecipeDocument
  | PaletteDocument
  | InventoryDocument
  | ProjectDocument
  | TechniqueDocument
  | BundleManifest;

export type _CoversSupportingTypes = PaletteRole;

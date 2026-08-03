/**
 * The single-document dispatcher: render any supported validated document to a
 * self-contained HTML page based on its `spec`. Kept in its own module so the
 * bundle-site renderer can depend on it without a circular import through the
 * package index.
 */

import type { RecipeDocument } from '../recipe';
import type { PaletteDocument } from '../palette';
import type { TechniqueDocument } from '../technique';
import type { InventoryDocument } from '../inventory';
import type { ProjectDocument } from '../project';
import { renderRecipeHtml } from './recipe-html';
import { renderPaletteHtml } from './palette-html';
import { renderTechniqueHtml } from './technique-html';
import { renderInventoryHtml } from './inventory-html';
import { renderProjectHtml } from './project-html';

/** The document specs the static renderer can turn into a standalone HTML page. */
export const RENDERABLE_SPECS = ['recipe', 'palette', 'technique', 'inventory', 'project'] as const;

/** A validated document the renderer accepts (discriminated by `spec`). */
export type RenderableDocument =
  | RecipeDocument
  | PaletteDocument
  | TechniqueDocument
  | InventoryDocument
  | ProjectDocument;

/**
 * Render any supported validated document to a self-contained HTML page,
 * dispatching on its `spec`. The input must already be parsed by the matching
 * spec validator at the trust boundary.
 */
export function renderDocumentHtml(doc: RenderableDocument): string {
  switch (doc.spec) {
    case 'recipe':
      return renderRecipeHtml(doc);
    case 'palette':
      return renderPaletteHtml(doc);
    case 'technique':
      return renderTechniqueHtml(doc);
    case 'inventory':
      return renderInventoryHtml(doc);
    case 'project':
      return renderProjectHtml(doc);
  }
}

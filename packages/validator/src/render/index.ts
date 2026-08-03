/**
 * BrushCodex static renderers — turn portable standard documents into
 * self-contained, printable HTML with no dependency on the web application.
 */

export { renderRecipeHtml } from './recipe-html';
export { renderPaletteHtml } from './palette-html';
export { renderTechniqueHtml } from './technique-html';
export { renderInventoryHtml } from './inventory-html';
export { renderProjectHtml } from './project-html';
export { escapeHtml } from './shared';
export { RENDERABLE_SPECS, renderDocumentHtml, type RenderableDocument } from './document';
export {
  renderBundleSite,
  renderBundleIndexHtml,
  bundleDocFileName,
  type BundleSiteFile,
} from './bundle-html';

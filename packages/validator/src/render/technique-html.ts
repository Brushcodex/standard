/**
 * BrushCodex Technique -> static HTML renderer (reference, framework-agnostic).
 *
 * Turns a validated Technique v1 document into a self-contained, printable HTML
 * page: purpose, prerequisites, tools, ordered steps, parameter guidance, paint-
 * class suitability, common problems, safety notes, citations, and variants. Like
 * the other renderers it imports only the standards models (no Next.js/React/
 * Prisma/catalogue) and HTML-escapes every document-derived string. A technique
 * carries no color values, so there are no swatches; paint-class suitability is
 * conveyed by the section heading (never color alone).
 */

import type { TechniqueDocument, TechniqueTool } from '../technique';
import {
  documentLang,
  escapeHtml,
  renderHtmlDocument,
  renderMetaList,
  renderTags,
  safeHref,
} from './shared';

export { escapeHtml } from './shared';

/** Title-case a controlled paint-class token for display. */
function paintClassLabel(paintClass: string): string {
  return paintClass.length > 0
    ? paintClass.charAt(0).toUpperCase() + paintClass.slice(1)
    : paintClass;
}

/** A simple `<section>` with an `<h2>` and pre-rendered inner HTML (or empty). */
function section(id: string, heading: string, inner: string): string {
  if (inner.length === 0) return '';
  return (
    `<section aria-labelledby="${id}-h">\n<h2 id="${id}-h">${escapeHtml(heading)}</h2>\n` +
    `${inner}\n</section>\n`
  );
}

function renderBulletList(items: string[]): string {
  if (items.length === 0) return '';
  return `<ul class="bullets">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function renderTool(tool: TechniqueTool): string {
  const kind = tool.kind ? `<span class="rights">${escapeHtml(tool.kind)}</span>` : '';
  const optional = tool.optional ? `<span class="badge">optional</span>` : '';
  return (
    `<li class="paint">` +
    `<span class="paint-name">${escapeHtml(tool.name)}</span>${kind}${optional}` +
    (tool.note ? `<span class="paint-note">${escapeHtml(tool.note)}</span>` : '') +
    `</li>`
  );
}

function renderTools(doc: TechniqueDocument): string {
  if (!doc.tools || doc.tools.length === 0) return '';
  return `<ul class="paint-list">${doc.tools.map(renderTool).join('')}</ul>`;
}

function renderSteps(doc: TechniqueDocument): string {
  if (!doc.steps || doc.steps.length === 0) return '';
  const items = doc.steps
    .map(
      (step, index) =>
        `<li class="step">` +
        `<div class="step-head"><span class="step-no">${index + 1}</span></div>` +
        `<p class="instruction">${escapeHtml(step.instruction)}</p>` +
        (step.note ? `<p class="step-meta">${escapeHtml(step.note)}</p>` : '') +
        `</li>`,
    )
    .join('');
  return `<ol class="steps">${items}</ol>`;
}

function renderParameters(doc: TechniqueDocument): string {
  if (!doc.parameters || doc.parameters.length === 0) return '';
  const items = doc.parameters
    .map(
      (param) =>
        `<li class="paint">` +
        `<span class="paint-name">${escapeHtml(param.name)}</span>` +
        (param.typicalValue ? `<span class="badge">${escapeHtml(param.typicalValue)}</span>` : '') +
        `<span class="paint-note">${escapeHtml(param.guidance)}</span>` +
        `</li>`,
    )
    .join('');
  return `<ul class="paint-list">${items}</ul>`;
}

function renderPaintClasses(doc: TechniqueDocument): string {
  const badges = (classes: readonly string[] | undefined): string =>
    classes && classes.length > 0
      ? `<ul class="inline-list">${classes
          .map((c) => `<li>${escapeHtml(paintClassLabel(c))}</li>`)
          .join('')}</ul>`
      : '';
  const suitable = doc.suitablePaintClasses
    ? `<div class="step-block"><h4>Suitable</h4>${badges(doc.suitablePaintClasses)}</div>`
    : '';
  const unsuitable = doc.unsuitablePaintClasses
    ? `<div class="step-block"><h4>Not suitable</h4>${badges(doc.unsuitablePaintClasses)}</div>`
    : '';
  return suitable + unsuitable;
}

function renderProblems(doc: TechniqueDocument): string {
  if (!doc.commonProblems || doc.commonProblems.length === 0) return '';
  const items = doc.commonProblems
    .map(
      (entry) =>
        `<li class="paint">` +
        `<span class="paint-name">${escapeHtml(entry.problem)}</span>` +
        (entry.correction
          ? `<span class="paint-note">Fix: ${escapeHtml(entry.correction)}</span>`
          : '') +
        `</li>`,
    )
    .join('');
  return `<ul class="paint-list">${items}</ul>`;
}

function renderSafety(doc: TechniqueDocument): string {
  if (!doc.safetyNotes || doc.safetyNotes.length === 0) return '';
  return (
    `<div class="warnings"><strong>Safety:</strong><ul>` +
    doc.safetyNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join('') +
    `</ul></div>`
  );
}

function renderCitations(doc: TechniqueDocument): string {
  if (!doc.citations || doc.citations.length === 0) return '';
  const items = doc.citations
    .map((citation) => {
      // Only safe URL schemes become links; an unsafe scheme is shown as inert text.
      const href = citation.url ? safeHref(citation.url) : null;
      return href
        ? `<li><a href="${escapeHtml(href)}" rel="noopener noreferrer nofollow">` +
            `${escapeHtml(citation.text)}</a></li>`
        : `<li>${escapeHtml(citation.text)}</li>`;
    })
    .join('');
  return `<ul class="media-list">${items}</ul>`;
}

function renderVariants(doc: TechniqueDocument): string {
  if (!doc.variants || doc.variants.length === 0) return '';
  const items = doc.variants
    .map(
      (variant) =>
        `<li class="entry">` +
        `<span class="entry-name">${escapeHtml(variant.name)}</span>` +
        (variant.summary ? `<div class="entry-paint">${escapeHtml(variant.summary)}</div>` : '') +
        (variant.note ? `<div class="entry-note">${escapeHtml(variant.note)}</div>` : '') +
        `</li>`,
    )
    .join('');
  return `<ul class="entries">${items}</ul>`;
}

function techniqueMeta(doc: TechniqueDocument): string {
  const rows: Array<[string, string]> = [];
  if (doc.difficulty) rows.push(['Difficulty', doc.difficulty]);
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
  rows.push(['Revision', doc.revision]);
  if (doc.updatedAt) rows.push(['Updated', doc.updatedAt]);
  return renderMetaList(rows);
}

/**
 * Render a validated Technique document to a complete, self-contained HTML page.
 * The input must already be a parsed {@link TechniqueDocument} (use
 * `parseTechniqueDocument` from the technique validator at the trust boundary).
 */
export function renderTechniqueHtml(doc: TechniqueDocument): string {
  const articleBody =
    `<header>\n<h1>${escapeHtml(doc.title)}</h1>\n` +
    `<p class="summary">${escapeHtml(doc.purpose)}</p>\n` +
    (doc.description ? `<p class="description">${escapeHtml(doc.description)}</p>\n` : '') +
    techniqueMeta(doc) +
    renderTags(doc.tags) +
    `</header>\n` +
    section('prereq', 'Prerequisites', renderBulletList(doc.prerequisites ?? [])) +
    section('tools', 'Tools & materials', renderTools(doc)) +
    section('steps', 'Steps', renderSteps(doc)) +
    section('params', 'Parameters', renderParameters(doc)) +
    section('classes', 'Paint suitability', renderPaintClasses(doc)) +
    section('problems', 'Common problems', renderProblems(doc)) +
    section('safety', 'Safety notes', renderSafety(doc)) +
    section('citations', 'Citations', renderCitations(doc)) +
    section('variants', 'Variants', renderVariants(doc));

  return renderHtmlDocument({
    lang: documentLang(doc.language),
    title: doc.title,
    spec: doc.spec,
    specVersion: doc.specVersion,
    articleBody,
    colorCaveat: false, // a technique carries no color values / swatches
  });
}

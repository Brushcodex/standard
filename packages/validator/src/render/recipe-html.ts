/**
 * BrushCodex Recipe -> static HTML renderer (reference, framework-agnostic).
 *
 * Turns a validated Recipe v1 document into a single self-contained HTML page:
 * no external network requests, inline CSS, printable, and responsive. It depends
 * only on the standards models in this folder tree - no Next.js, React, Prisma, or
 * catalogue - so it doubles as an independent consumer that renders the portable
 * format without any part of the reference web application.
 *
 * Safety and honesty rules are enforced by the shared helpers: every
 * document-derived string is HTML-escaped, media is rendered as labelled links
 * (never embedded remote content), and color swatches are always paired with
 * their hex text and a provenance label.
 */

import type { MediaRef } from '../common/structures';
import type { PaintRef, RecipeAlternative, RecipeDocument, RecipeStep } from '../recipe';
import {
  documentLang,
  escapeHtml,
  paintLabel,
  renderHtmlDocument,
  renderMetaList,
  renderSwatch,
  renderTags,
  ROLE_LABELS,
  safeHref,
} from './shared';

export { escapeHtml } from './shared';

/** Human labels for the classified alternative types (kept distinct - never merged). */
const ALTERNATIVE_TYPE_LABELS: Record<RecipeAlternative['type'], string> = {
  authored: 'author-provided',
  manufacturer_published: 'manufacturer-published',
  mathematical: 'mathematical (color distance)',
  community_tested: 'community-tested',
  verified_practical: 'verified practical',
};

/** Render a single declared paint as a list item (label + classifiers + swatch + note). */
function renderPaintEntry(paint: PaintRef): string {
  // `chemistry` is the substitution-safety axis — an enamel must never be
  // silently swapped for an acrylic — and `kind` says whether the bottle is even
  // a paint. Both belong in front of the reader, not only in the file.
  const classifiers = ([paint.kind, paint.chemistry] as Array<string | undefined>)
    .filter((part): part is string => part !== undefined && part.length > 0)
    .map((part) => `<span class="badge">${escapeHtml(part)}</span>`)
    .join(' ');
  return (
    `<li class="paint">` +
    `<span class="paint-name">${escapeHtml(paintLabel(paint))}</span>` +
    (classifiers ? ` ${classifiers}` : '') +
    renderSwatch(paint.color, paint.provenance) +
    (paint.note ? `<span class="paint-note">${escapeHtml(paint.note)}</span>` : '') +
    `</li>`
  );
}

/** Resolve a step's paint anchor to its declared paint, falling back to the raw anchor. */
function resolvedAnchorLabel(anchor: string, byRef: Map<string, PaintRef>): string {
  const paint = byRef.get(anchor);
  return paint ? paintLabel(paint) : anchor;
}

function renderStepPaints(step: RecipeStep, byRef: Map<string, PaintRef>): string {
  if (!step.paintRefs || step.paintRefs.length === 0) return '';
  const items = step.paintRefs
    .map((anchor) => `<li>${escapeHtml(resolvedAnchorLabel(anchor, byRef))}</li>`)
    .join('');
  return `<div class="step-block"><h4>Paints</h4><ul class="inline-list">${items}</ul></div>`;
}

function renderStepMix(step: RecipeStep, byRef: Map<string, PaintRef>): string {
  // The author's wording is shown alongside the structured ratios, never instead of them: `mix` is
  // authoritative, `mixNote` is prose, and a mixture that has only prose still reaches the reader.
  const note = step.mixNote ? `<p class="mix-note">${escapeHtml(step.mixNote)}</p>` : '';
  if (!step.mix || step.mix.length === 0) {
    return note ? `<div class="step-block"><h4>Mix</h4>${note}</div>` : '';
  }
  const items = step.mix
    .map(
      (entry) =>
        `<li>${escapeHtml(resolvedAnchorLabel(entry.paint, byRef))} ` +
        `<span class="parts">${escapeHtml(String(entry.parts))} part(s)</span></li>`,
    )
    .join('');
  return `<div class="step-block"><h4>Mix</h4><ul class="inline-list">${items}</ul>${note}</div>`;
}

function renderAlternative(alt: RecipeAlternative, byRef: Map<string, PaintRef>): string {
  const label = alt.paint
    ? resolvedAnchorLabel(alt.paint, byRef)
    : alt.paintRef
      ? paintLabel(alt.paintRef)
      : 'Unnamed alternative';
  const typeLabel = ALTERNATIVE_TYPE_LABELS[alt.type];
  return (
    `<li>` +
    `<span class="alt-paint">${escapeHtml(label)}</span> ` +
    `<span class="badge">${escapeHtml(typeLabel)}</span>` +
    (alt.note ? `<div class="alt-note">${escapeHtml(alt.note)}</div>` : '') +
    `</li>`
  );
}

function renderStepAlternatives(step: RecipeStep, byRef: Map<string, PaintRef>): string {
  if (!step.alternatives || step.alternatives.length === 0) return '';
  const items = step.alternatives.map((alt) => renderAlternative(alt, byRef)).join('');
  return `<div class="step-block"><h4>Substitutes</h4><ul class="alt-list">${items}</ul></div>`;
}

function renderStepMedia(step: RecipeStep): string {
  if (!step.media || step.media.length === 0) return '';
  const items = step.media
    .map((media) => {
      const caption = media.caption ?? media.url;
      const rights = [media.license?.spdxId ?? media.license?.name, media.rightsNote]
        .filter((part): part is string => part !== undefined && part.length > 0)
        .join(' - ');
      // Media is a labelled link, not an embed - rendering never loads remote
      // content. Only safe URL schemes become links; an unsafe scheme (e.g.
      // `javascript:`) is shown as inert text so it can never execute on click.
      const href = safeHref(media.url);
      const label = href
        ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer nofollow">${escapeHtml(caption)}</a>`
        : escapeHtml(caption);
      return `<li>${label}${rights ? ` <span class="rights">${escapeHtml(rights)}</span>` : ''}</li>`;
    })
    .join('');
  return `<div class="step-block"><h4>Media</h4><ul class="media-list">${items}</ul></div>`;
}

/** Human labels for how a linked media item relates to the recipe. */
const MEDIA_RELATION_LABELS: Record<NonNullable<MediaRef['relation']>, string> = {
  source: 'source',
  result: 'result',
  reference: 'reference',
};

/**
 * A citation offset as a display timecode (M:SS, or H:MM:SS past an hour).
 * Derived from the authoritative `startSeconds`/`endSeconds`, never from the
 * author's `label` - a label that disagrees with the seconds must not decide
 * what the reader is told.
 */
function formatOffset(seconds: number): string {
  const total = Math.max(0, seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const secsText = Number.isInteger(secs)
    ? String(secs).padStart(2, '0')
    : secs.toFixed(1).padStart(4, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${secsText}`
    : `${minutes}:${secsText}`;
}

/** The media item a citation targets: its anchor, or the lone `source` item. */
function citedMedia(
  step: RecipeStep,
  byId: Map<string, MediaRef>,
  loneSource: MediaRef | undefined,
): MediaRef | undefined {
  const citation = step.source;
  if (citation === undefined) return undefined;
  return citation.media === undefined ? loneSource : byId.get(citation.media);
}

/**
 * "Source: 1:00-1:35 of <media>" - where a step came from.
 *
 * The link is the media URL as authored. A deep link to the cited moment would
 * need provider-specific syntax (YouTube `?t=`, Vimeo `#t=`), which is an
 * application's job, not the format's: the portable document states the offset
 * in seconds and any consumer that knows the provider can seek with it.
 */
function renderStepSource(
  step: RecipeStep,
  byId: Map<string, MediaRef>,
  loneSource: MediaRef | undefined,
): string {
  const citation = step.source;
  if (citation === undefined) return '';

  const range =
    citation.endSeconds !== undefined
      ? `${formatOffset(citation.startSeconds)}–${formatOffset(citation.endSeconds)}`
      : formatOffset(citation.startSeconds);

  const media = citedMedia(step, byId, loneSource);
  if (media === undefined) {
    return `<p class="step-source"><strong>Source:</strong> ${escapeHtml(range)}</p>`;
  }

  const caption = media.caption ?? media.url;
  const href = safeHref(media.url);
  const target = href
    ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer nofollow">${escapeHtml(caption)}</a>`
    : escapeHtml(caption);
  return `<p class="step-source"><strong>Source:</strong> ${escapeHtml(range)} of ${target}</p>`;
}

/**
 * The recipe's own linked media: what it was transcribed from, what the result
 * looked like, what was consulted. Creator and licence describe the LINKED WORK,
 * so they are shown next to it and never merged into the recipe's own authors or
 * licence. Nothing is inferred: an absent licence renders as absent.
 */
function renderRecipeMedia(doc: RecipeDocument): string {
  if (!doc.media || doc.media.length === 0) return '';
  const items = doc.media
    .map((media) => {
      const caption = media.caption ?? media.url;
      const href = safeHref(media.url);
      const label = href
        ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer nofollow">${escapeHtml(caption)}</a>`
        : escapeHtml(caption);
      const relation = media.relation
        ? ` <span class="badge">${escapeHtml(MEDIA_RELATION_LABELS[media.relation])}</span>`
        : '';
      const credit = media.creator
        ? `<div class="credit">By ${escapeHtml(media.creator.name)}</div>`
        : '';
      const rights = [media.license?.spdxId ?? media.license?.name, media.rightsNote]
        .filter((part): part is string => part !== undefined && part.length > 0)
        .join(' - ');
      return (
        `<li>${label}${relation}${credit}` +
        (rights ? `<div class="rights">${escapeHtml(rights)}</div>` : '') +
        `</li>`
      );
    })
    .join('');
  return (
    `<section class="media" aria-labelledby="media-h">` +
    `<h2 id="media-h">Source &amp; media</h2><ul class="media-list">${items}</ul></section>`
  );
}

function renderStep(
  step: RecipeStep,
  index: number,
  byRef: Map<string, PaintRef>,
  byId: Map<string, MediaRef>,
  loneSource: MediaRef | undefined,
): string {
  const roleBadge = step.role
    ? `<span class="badge role">${escapeHtml(ROLE_LABELS[step.role] ?? step.role)}</span>`
    : '';
  const heading = step.title ? escapeHtml(step.title) : `Step ${index + 1}`;
  const meta: string[] = [];
  // The free-text technique label exists so a named technique never has to be
  // forced into the closed `role` vocabulary. Printing the role but not the
  // label would defeat that: "varnish" is the group, "spray varnish" is the act.
  if (step.technique) meta.push(`Technique: ${escapeHtml(step.technique)}`);
  if (step.targetArea) meta.push(`Area: ${escapeHtml(step.targetArea)}`);
  if (step.method) meta.push(`Method: ${escapeHtml(step.method)}`);
  if (step.coats !== undefined) meta.push(`Coats: ${escapeHtml(String(step.coats))}`);
  if (step.thinning) meta.push(`Thinning: ${escapeHtml(step.thinning)}`);

  const warnings =
    step.warnings && step.warnings.length > 0
      ? `<div class="warnings"><strong>Warnings:</strong><ul>${step.warnings
          .map((warning) => `<li>${escapeHtml(warning)}</li>`)
          .join('')}</ul></div>`
      : '';

  return (
    `<li class="step">` +
    `<div class="step-head"><span class="step-no">${index + 1}</span>` +
    `<h3>${heading}</h3>${roleBadge}</div>` +
    `<p class="instruction">${escapeHtml(step.instruction)}</p>` +
    (meta.length > 0 ? `<p class="step-meta">${meta.join(' &middot; ')}</p>` : '') +
    renderStepSource(step, byId, loneSource) +
    renderStepPaints(step, byRef) +
    renderStepMix(step, byRef) +
    (step.expectedResult
      ? `<p class="expected"><strong>Expected result:</strong> ${escapeHtml(
          step.expectedResult,
        )}</p>`
      : '') +
    (step.dryingNotes
      ? `<p class="drying"><strong>Drying:</strong> ${escapeHtml(step.dryingNotes)}</p>`
      : '') +
    warnings +
    renderStepAlternatives(step, byRef) +
    renderStepMedia(step) +
    `</li>`
  );
}

function recipeMeta(doc: RecipeDocument): string {
  const rows: Array<[string, string]> = [];
  if (doc.difficulty) rows.push(['Difficulty', doc.difficulty]);
  if (doc.estimatedActiveMinutes !== undefined) {
    rows.push(['Active time', `${doc.estimatedActiveMinutes} min`]);
  }
  if (doc.target) {
    const kind = doc.target.kind ? `${doc.target.kind}: ` : '';
    // Scale and substrate are not decoration: substrate drives priming and solvent
    // safety (a solvent primer melts bare foam), so a render that drops them
    // withholds what a painter needs before starting.
    const detail = ([
      doc.target.scale ? `${doc.target.scale.value} (${doc.target.scale.system})` : undefined,
      doc.target.substrate,
    ] as Array<string | undefined>).filter(
      (part): part is string => part !== undefined && part.length > 0,
    );
    const suffix = detail.length > 0 ? ` — ${detail.join(', ')}` : '';
    rows.push(['Target', `${kind}${doc.target.description}${suffix}`]);
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
  rows.push(['Revision', doc.revision]);
  if (doc.updatedAt) rows.push(['Updated', doc.updatedAt]);
  return renderMetaList(rows);
}

function renderPaintList(doc: RecipeDocument): string {
  if (!doc.paints || doc.paints.length === 0) return '';
  const items = doc.paints.map(renderPaintEntry).join('');
  return (
    `<section class="paints" aria-labelledby="paints-h">` +
    `<h2 id="paints-h">Paints</h2><ul class="paint-list">${items}</ul></section>`
  );
}

/**
 * Tools and non-paint materials needed to reproduce the recipe. A reader without
 * the airbrush or the sponge cannot follow it, so leaving `resources` out of the
 * render made the page look complete while withholding the shopping list.
 */
function renderResources(doc: RecipeDocument): string {
  if (!doc.resources || doc.resources.length === 0) return '';
  const items = doc.resources
    .map((resource) => {
      const detail = [resource.specification, resource.quantity]
        .filter((part): part is string => part !== undefined && part.length > 0)
        .join(', ');
      const kind = resource.kind
        ? ` <span class="badge">${escapeHtml(resource.kind)}</span>`
        : '';
      const optional = resource.optional === true ? ` <span class="badge">optional</span>` : '';
      return (
        `<li>` +
        `<span class="resource-name">${escapeHtml(resource.name)}</span>${kind}${optional}` +
        (detail ? ` <span class="parts">${escapeHtml(detail)}</span>` : '') +
        (resource.note ? `<div class="paint-note">${escapeHtml(resource.note)}</div>` : '') +
        `</li>`
      );
    })
    .join('');
  return (
    `<section class="resources" aria-labelledby="resources-h">` +
    `<h2 id="resources-h">Tools &amp; materials</h2><ul class="alt-list">${items}</ul></section>`
  );
}

/**
 * Techniques the recipe leans on, as soft references. The document deliberately
 * does not duplicate a technique's content, so the reference itself — title, or
 * the id when that is all there is — is the only thing a reader can follow.
 */
function renderTechniqueRefs(doc: RecipeDocument): string {
  if (!doc.techniqueRefs || doc.techniqueRefs.length === 0) return '';
  const items = doc.techniqueRefs
    .map((ref) => {
      const label = ref.title ?? ref.id;
      const href = safeHref(ref.id);
      const shown = href
        ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer nofollow">${escapeHtml(label)}</a>`
        : escapeHtml(label);
      // An unresolved reference is not an error, so the id is shown as context
      // rather than presented as a broken link.
      const context = ref.title !== undefined ? ` <span class="parts">${escapeHtml(ref.id)}</span>` : '';
      return `<li>${shown}${context}</li>`;
    })
    .join('');
  return (
    `<section class="technique-refs" aria-labelledby="techniques-h">` +
    `<h2 id="techniques-h">Techniques used</h2><ul class="alt-list">${items}</ul></section>`
  );
}

/**
 * Render a validated Recipe document to a complete, self-contained HTML page.
 * The input must already be a parsed {@link RecipeDocument} (use
 * `parseRecipeDocument` from the recipe validator at the trust boundary).
 */
export function renderRecipeHtml(doc: RecipeDocument): string {
  const byRef = new Map<string, PaintRef>();
  for (const paint of doc.paints ?? []) {
    if (paint.ref) byRef.set(paint.ref, paint);
  }

  const byId = new Map<string, MediaRef>();
  for (const media of doc.media ?? []) {
    if (media.id !== undefined && !byId.has(media.id)) byId.set(media.id, media);
  }
  // An anchorless citation targets the lone `source` item; with none, or more
  // than one, it has no unambiguous target (the validator rejects that document)
  // and the offset renders on its own rather than against a guessed work.
  const sources = (doc.media ?? []).filter((media) => media.relation === 'source');
  const loneSource = sources.length === 1 ? sources[0] : undefined;

  const steps = doc.steps
    .map((step, index) => renderStep(step, index, byRef, byId, loneSource))
    .join('');

  const articleBody =
    `<header>\n<h1>${escapeHtml(doc.title)}</h1>\n` +
    (doc.summary ? `<p class="summary">${escapeHtml(doc.summary)}</p>\n` : '') +
    (doc.description ? `<p class="description">${escapeHtml(doc.description)}</p>\n` : '') +
    recipeMeta(doc) +
    renderTags(doc.tags) +
    `</header>\n` +
    renderRecipeMedia(doc) +
    renderPaintList(doc) +
    renderResources(doc) +
    renderTechniqueRefs(doc) +
    `<section class="steps-section" aria-labelledby="steps-h">\n` +
    `<h2 id="steps-h">Steps</h2>\n<ol class="steps">${steps}</ol>\n` +
    (doc.dryingNotes
      ? `<p class="drying"><strong>Drying notes:</strong> ${escapeHtml(doc.dryingNotes)}</p>\n`
      : '') +
    `</section>\n`;

  return renderHtmlDocument({
    lang: documentLang(doc.language),
    title: doc.title,
    spec: doc.spec,
    specVersion: doc.specVersion,
    articleBody,
  });
}

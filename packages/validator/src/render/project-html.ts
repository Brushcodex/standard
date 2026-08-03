/**
 * BrushCodex Project -> static HTML renderer (reference, framework-agnostic).
 *
 * Turns a validated Project v1 document into a self-contained HTML page: what is
 * being painted, how far along each subject is, what was substituted and why,
 * and the painting journal. Imports only the standards models (no Next.js/React/
 * Prisma/catalogue), escapes every document-derived string, and links media
 * rather than embedding it.
 *
 * Two honesty rules carry over from the spec:
 *
 *   - a **substitution keeps its class**. A `mathematical` match is a claim about
 *     colour distance and nothing more, so it is labelled as such and never shown
 *     as though someone had tested it;
 *   - a journal entry marked `private` is **flagged, not hidden**. The renderer
 *     shows a document as given; deciding what to share is the producer's job
 *     (`toSharedProject` drops those entries), and a page that quietly differed
 *     from its source file would be the more dangerous behaviour.
 */

import type { ProjectDocument, ProjectSubject } from '../project/project';
import {
  documentLang,
  escapeHtml,
  paintLabel,
  renderHtmlDocument,
  renderMetaList,
  renderTags,
  safeHref,
} from './shared';

export { escapeHtml } from './shared';

const STATUS_LABELS: Record<string, string> = {
  active: 'active',
  on_hold: 'on hold',
  completed: 'completed',
  archived: 'archived',
  not_started: 'not started',
  in_progress: 'in progress',
  blocked: 'blocked',
  done: 'done',
};

/** Substitution classes, kept distinct — a computed match never reads as a tested one. */
const SUBSTITUTION_TYPE_LABELS: Record<string, string> = {
  authored: 'author-provided',
  manufacturer_published: 'manufacturer-published',
  mathematical: 'mathematical (color distance)',
  community_tested: 'community-tested',
  verified_practical: 'verified practical',
};

function statusBadge(status: string | undefined): string {
  if (status === undefined) return '';
  return `<span class="badge">${escapeHtml(STATUS_LABELS[status] ?? status)}</span>`;
}

/** A progress percentage as text beside a meter — never a bar alone. */
function progressText(progress: number | undefined): string {
  return progress === undefined ? '' : `<span class="parts">${escapeHtml(String(progress))}%</span>`;
}

function renderSubject(subject: ProjectSubject): string {
  const stages =
    subject.stages && subject.stages.length > 0
      ? `<ul class="inline-list">${subject.stages
          .map(
            (stage) =>
              `<li>${escapeHtml(stage.name)} ${statusBadge(stage.status)}</li>`,
          )
          .join('')}</ul>`
      : '';
  const checklist =
    subject.checklist && subject.checklist.length > 0
      ? `<ul class="bullets">${subject.checklist
          .map(
            (item) =>
              `<li>${item.done === true ? '[x]' : '[ ]'} ${escapeHtml(item.task)}</li>`,
          )
          .join('')}</ul>`
      : '';

  return (
    `<li class="entry">` +
    `<div class="entry-head">` +
    `<span class="entry-paint">${escapeHtml(subject.name)}</span> ` +
    `${statusBadge(subject.status)} ${progressText(subject.progress)}` +
    `</div>` +
    stages +
    checklist +
    `</li>`
  );
}

function renderSubjects(doc: ProjectDocument): string {
  if (!doc.subjects || doc.subjects.length === 0) return '';
  const items = doc.subjects.map(renderSubject).join('');
  return (
    `<section class="subjects" aria-labelledby="subjects-h">\n` +
    `<h2 id="subjects-h">Subjects</h2>\n<ul class="entries">${items}</ul>\n</section>\n`
  );
}

/** Soft references to the recipes and palettes this project follows. */
function renderRefs(doc: ProjectDocument): string {
  const rows = [
    ...(doc.recipeRefs ?? []).map((ref) => ['Recipe', ref] as const),
    ...(doc.paletteRefs ?? []).map((ref) => ['Palette', ref] as const),
  ];
  if (rows.length === 0) return '';
  const items = rows
    .map(([kind, ref]) => {
      const label = ref.title ?? ref.id;
      const href = safeHref(ref.id);
      const shown = href
        ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer nofollow">${escapeHtml(label)}</a>`
        : escapeHtml(label);
      // An unresolved reference is not an error; the id stays visible as context.
      const context = ref.title !== undefined ? ` <span class="parts">${escapeHtml(ref.id)}</span>` : '';
      return `<li><span class="badge">${escapeHtml(kind)}</span> ${shown}${context}</li>`;
    })
    .join('');
  return (
    `<section class="refs" aria-labelledby="refs-h">\n` +
    `<h2 id="refs-h">Follows</h2>\n<ul class="alt-list">${items}</ul>\n</section>\n`
  );
}

function renderSubstitutions(doc: ProjectDocument): string {
  if (!doc.substitutions || doc.substitutions.length === 0) return '';
  const items = doc.substitutions
    .map((sub) => {
      const label = sub.type === undefined ? undefined : SUBSTITUTION_TYPE_LABELS[sub.type] ?? sub.type;
      return (
        `<li>` +
        `<span class="alt-paint">${escapeHtml(paintLabel(sub.original))}</span>` +
        `<span class="rel-arrow"> &rarr; </span>` +
        `<span class="alt-paint">${escapeHtml(paintLabel(sub.substitute))}</span> ` +
        (label ? `<span class="badge">${escapeHtml(label)}</span>` : '') +
        (sub.note ? `<div class="alt-note">${escapeHtml(sub.note)}</div>` : '') +
        `</li>`
      );
    })
    .join('');
  return (
    `<section class="substitutions" aria-labelledby="subs-h">\n` +
    `<h2 id="subs-h">Accepted substitutions</h2>\n<ul class="alt-list">${items}</ul>\n</section>\n`
  );
}

function renderJournal(doc: ProjectDocument): string {
  if (!doc.journal || doc.journal.length === 0) return '';
  const items = doc.journal
    .map((entry) => {
      const meta = [
        entry.at,
        entry.minutesSpent !== undefined ? `${entry.minutesSpent} min` : undefined,
        entry.subjectRef,
      ]
        .filter((part): part is string => part !== undefined && part.length > 0)
        .join(' · ');
      // Flagged, never hidden: the shared export profile is what removes these.
      const priv =
        entry.visibility === 'private' ? ` <span class="badge">private</span>` : '';
      return (
        `<li class="entry">` +
        (meta ? `<div class="entry-note">${escapeHtml(meta)}${priv}</div>` : priv) +
        `<div>${escapeHtml(entry.body)}</div>` +
        `</li>`
      );
    })
    .join('');
  return (
    `<section class="journal" aria-labelledby="journal-h">\n` +
    `<h2 id="journal-h">Journal</h2>\n<ul class="entries">${items}</ul>\n</section>\n`
  );
}

function renderToolsUsed(doc: ProjectDocument): string {
  if (!doc.toolsUsed || doc.toolsUsed.length === 0) return '';
  const items = doc.toolsUsed
    .map((tool) => {
      const detail = [tool.specification, tool.quantity]
        .filter((part): part is string => part !== undefined && part.length > 0)
        .join(', ');
      const kind = tool.kind ? ` <span class="badge">${escapeHtml(tool.kind)}</span>` : '';
      return (
        `<li><span class="resource-name">${escapeHtml(tool.name)}</span>${kind}` +
        (detail ? ` <span class="parts">${escapeHtml(detail)}</span>` : '') +
        (tool.note ? `<div class="paint-note">${escapeHtml(tool.note)}</div>` : '') +
        `</li>`
      );
    })
    .join('');
  return (
    `<section class="tools" aria-labelledby="tools-h">\n` +
    `<h2 id="tools-h">Tools &amp; materials used</h2>\n<ul class="alt-list">${items}</ul>\n</section>\n`
  );
}

/** Result media: labelled links with their own rights, never embedded. */
function renderResults(doc: ProjectDocument): string {
  if (!doc.results || doc.results.length === 0) return '';
  const items = doc.results
    .map((media) => {
      const caption = media.caption ?? media.url;
      const href = safeHref(media.url);
      const label = href
        ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer nofollow">${escapeHtml(caption)}</a>`
        : escapeHtml(caption);
      const kind = media.kind ? ` <span class="badge">${escapeHtml(media.kind)}</span>` : '';
      const credit = media.creator
        ? `<div class="credit">By ${escapeHtml(media.creator.name)}</div>`
        : '';
      const rights = [media.license?.spdxId ?? media.license?.name, media.rightsNote]
        .filter((part): part is string => part !== undefined && part.length > 0)
        .join(' - ');
      return (
        `<li>${label}${kind}${credit}` +
        (rights ? `<div class="rights">${escapeHtml(rights)}</div>` : '') +
        `</li>`
      );
    })
    .join('');
  return (
    `<section class="results" aria-labelledby="results-h">\n` +
    `<h2 id="results-h">Results</h2>\n<ul class="media-list">${items}</ul>\n</section>\n`
  );
}

function projectMeta(doc: ProjectDocument): string {
  const rows: Array<[string, string]> = [];
  rows.push(['Status', STATUS_LABELS[doc.status] ?? doc.status]);
  if (doc.progress !== undefined) rows.push(['Progress', `${doc.progress}%`]);
  if (doc.subjects && doc.subjects.length > 0) {
    rows.push(['Subjects', String(doc.subjects.length)]);
  }
  const minutes = (doc.journal ?? []).reduce((sum, entry) => sum + (entry.minutesSpent ?? 0), 0);
  if (minutes > 0) {
    // Derived from the entries on this page, and labelled as a sum so it is never
    // mistaken for a figure the author stated.
    rows.push(['Time logged', `${minutes} min (sum of journal entries)`]);
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
 * Render a validated Project document to a complete, self-contained HTML page.
 * The input must already be a parsed {@link ProjectDocument} (use
 * `parseProjectDocument` at the trust boundary).
 */
export function renderProjectHtml(doc: ProjectDocument): string {
  const articleBody =
    `<header>\n<h1>${escapeHtml(doc.title)}</h1>\n` +
    (doc.summary ? `<p class="summary">${escapeHtml(doc.summary)}</p>\n` : '') +
    (doc.description ? `<p class="description">${escapeHtml(doc.description)}</p>\n` : '') +
    projectMeta(doc) +
    renderTags(doc.tags) +
    `</header>\n` +
    renderSubjects(doc) +
    renderRefs(doc) +
    renderSubstitutions(doc) +
    renderToolsUsed(doc) +
    renderJournal(doc) +
    renderResults(doc);

  return renderHtmlDocument({
    lang: documentLang(doc.language),
    title: doc.title,
    spec: doc.spec,
    specVersion: doc.specVersion,
    articleBody,
  });
}

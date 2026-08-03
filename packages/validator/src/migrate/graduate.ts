/**
 * Graduating BrushCodex-authored extension data into the core members it became.
 *
 * `org.brushcodex.*` is the namespace BrushCodex tools use for data the core format did not yet
 * carry (docs/EXTENSIONS.md §5). When such a value graduates into the core, documents written
 * earlier stay **valid** — but their meaning stays stranded in an extension only a BrushCodex
 * implementation knows how to read. A third-party renderer sees a recipe with no cited work and no
 * step citations, even though the document contains both.
 *
 * This module is the documented, deterministic path for those documents. It:
 *
 *   - moves a value only into the core member it actually became;
 *   - never overwrites a core member that is already present (the document wins over its history);
 *   - moves only when the result is valid — an unparseable value stays where it is;
 *   - removes what it moved from the extension, so one fact never has two homes;
 *   - reports everything it moved AND everything it could not, with a reason.
 *
 * It is not a version migration in the VERSIONING.md §5 sense (no major transition has shipped);
 * it is the compatibility half of an extension graduation. Running it twice is a no-op.
 */

import type { RecipeDocument } from '../recipe/recipe';
import type { MediaCitation, MediaRef } from '../common/structures';

/** Extension keys this module knows how to graduate. */
export const RECIPE_ATTRIBUTION_EXTENSION = 'org.brushcodex.recipe:attribution';
export const RECIPE_SOURCE_URL_EXTENSION = 'org.brushcodex.recipe:sourceUrl';
export const RECIPE_STEP_DETAILS_EXTENSION = 'org.brushcodex.recipe:stepDetails';
export const CREATOR_EXTRACTION_EXTENSION = 'org.brushcodex.creator:extraction';

/** Anchor used for a cited work recovered from an extension. */
const SOURCE_ANCHOR = 'source';

export interface GraduationChange {
  /** Stable machine code for the graduation (or the refusal). */
  code: string;
  /** Where the value came from — extension key plus a path within it. */
  from: string;
  /** JSON pointer of the core member written. Absent when nothing moved. */
  to?: string;
  /** Why the value could not move. Present only on `unmoved` entries. */
  reason?: string;
}

export interface GraduationResult {
  /** A new document; the input is never mutated. */
  document: RecipeDocument;
  moved: GraduationChange[];
  unmoved: GraduationChange[];
}

export interface TimecodeReading {
  startSeconds: number;
  endSeconds?: number;
}

export interface GraduateOptions {
  /**
   * Reads an author-written timecode as seconds.
   *
   * The format deliberately does **not** define a timecode grammar — `mediaCitation.label` is free
   * text — so this module will not invent one. Without this option a text timecode is reported as
   * unmoved rather than guessed at. Pass {@link readClockTimecode} for the common `[H:]M:SS` form,
   * or your own reader for a different convention.
   */
  readTimecode?: (text: string) => TimecodeReading | null;
}

/** `[H:]M:SS`, optionally a range separated by a hyphen, en/em dash, or the word "to". */
const CLOCK = /^(?:(\d{1,3}):)?(\d{1,2}):(\d{2})$/;
const RANGE = /\s*(?:[-–—]|\bto\b)\s*/;

function clockToSeconds(value: string): number | null {
  const match = CLOCK.exec(value.trim());
  if (!match) return null;
  const hours = Number.parseInt(match[1] ?? '0', 10);
  const minutes = Number.parseInt(match[2] ?? '', 10);
  const seconds = Number.parseInt(match[3] ?? '', 10);
  if (!Number.isInteger(minutes) || !Number.isInteger(seconds)) return null;
  if (minutes > 59 || seconds > 59) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * One documented timecode convention: `[H:]M:SS`, single or as a range ("1:00-1:35", "1:00 to
 * 1:35"). Offered, never applied automatically — a producer using another convention supplies its
 * own reader, and a document whose timecodes this cannot read keeps them rather than losing them.
 */
export function readClockTimecode(text: string): TimecodeReading | null {
  const parts = text.trim().split(RANGE).filter(Boolean);
  const start = parts[0] === undefined ? null : clockToSeconds(parts[0]);
  if (start === null) return null;
  const end = parts[1] === undefined ? null : clockToSeconds(parts[1]);
  return end !== null && end > start ? { startSeconds: start, endSeconds: end } : { startSeconds: start };
}

function isAbsoluteUri(value: string): boolean {
  try {
    return new URL(value).protocol.length > 0;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Per-step extension entries, resolved to document step indexes. Matched by step id when both
 * sides carry one (the reliable key), otherwise by the entry's declared order/index — documented
 * so the mapping is predictable rather than best-effort.
 */
function stepIndexFor(
  entry: Record<string, unknown>,
  doc: RecipeDocument,
  idKeys: readonly string[],
  orderKeys: readonly string[],
): number | null {
  for (const key of idKeys) {
    const id = nonEmptyString(entry[key]);
    if (id === null) continue;
    const index = doc.steps.findIndex((step) => step.id === id);
    if (index >= 0) return index;
  }
  for (const key of orderKeys) {
    const order = entry[key];
    if (typeof order !== 'number' || !Number.isInteger(order)) continue;
    // Community writes a 0-based `order`; the Creator's step trace writes a 1-based one. Accept the
    // value only when it lands inside the document.
    if (order >= 0 && order < doc.steps.length) return order;
    if (order - 1 >= 0 && order - 1 < doc.steps.length) return order - 1;
  }
  return null;
}

/** Add the cited work to `media[]`, returning the anchor, or null when one is already present. */
function addSourceMedia(doc: RecipeDocument, media: MediaRef): string | null {
  if (doc.media !== undefined && doc.media.length > 0) return null;
  doc.media = [media];
  return media.id ?? null;
}

function citationFrom(
  reading: TimecodeReading,
  anchor: string | null,
): MediaCitation {
  const citation: MediaCitation = { startSeconds: reading.startSeconds };
  if (anchor !== null) citation.media = anchor;
  if (reading.endSeconds !== undefined && reading.endSeconds > reading.startSeconds) {
    citation.endSeconds = reading.endSeconds;
  }
  return citation;
}

/**
 * Graduate every BrushCodex-authored extension value in a recipe into the core member it became.
 *
 * The input document must already be valid. The result is a new document that is valid too: this
 * only ever writes members the current Recipe defines, and refuses any move that would produce an
 * invalid one (a source URL that is not an absolute URI, a citation with no work to anchor to, a
 * range that does not run forwards).
 */
export function graduateRecipeDocument(
  input: RecipeDocument,
  options: GraduateOptions = {},
): GraduationResult {
  const doc = structuredClone(input);
  const moved: GraduationChange[] = [];
  const unmoved: GraduationChange[] = [];
  const extensions = isRecord(doc.extensions) ? { ...doc.extensions } : undefined;
  if (extensions === undefined) return { document: doc, moved, unmoved };

  let sourceAnchor: string | null = null;

  // --- Credit for the document ------------------------------------------------------------
  const attribution = extensions[RECIPE_ATTRIBUTION_EXTENSION];
  if (attribution !== undefined) {
    const text = nonEmptyString(attribution);
    if (text === null) {
      unmoved.push({
        code: 'attribution-unusable',
        from: RECIPE_ATTRIBUTION_EXTENSION,
        reason: 'the extension value is not a non-empty string',
      });
    } else if (doc.attribution !== undefined) {
      unmoved.push({
        code: 'attribution-already-core',
        from: RECIPE_ATTRIBUTION_EXTENSION,
        reason: 'the document already states its own attribution, which wins',
      });
    } else {
      doc.attribution = text;
      moved.push({
        code: 'attribution-to-envelope',
        from: RECIPE_ATTRIBUTION_EXTENSION,
        to: '/attribution',
      });
      delete extensions[RECIPE_ATTRIBUTION_EXTENSION];
    }
  }

  // --- The cited work: reference application ----------------------------------------------
  const sourceUrl = extensions[RECIPE_SOURCE_URL_EXTENSION];
  if (sourceUrl !== undefined) {
    const url = nonEmptyString(sourceUrl);
    if (url === null || !isAbsoluteUri(url)) {
      unmoved.push({
        code: 'source-url-unusable',
        from: RECIPE_SOURCE_URL_EXTENSION,
        reason: 'media[].url requires an absolute URI',
      });
    } else {
      const anchor = addSourceMedia(doc, { id: SOURCE_ANCHOR, url, relation: 'source' });
      if (anchor === null) {
        unmoved.push({
          code: 'source-url-already-core',
          from: RECIPE_SOURCE_URL_EXTENSION,
          reason: 'the document already links its own media, which wins',
        });
      } else {
        sourceAnchor = anchor;
        moved.push({ code: 'source-url-to-media', from: RECIPE_SOURCE_URL_EXTENSION, to: '/media/0' });
        delete extensions[RECIPE_SOURCE_URL_EXTENSION];
      }
    }
  }

  // --- The cited work: Creator Assistant ---------------------------------------------------
  const extraction = extensions[CREATOR_EXTRACTION_EXTENSION];
  const extractionSource = isRecord(extraction) && isRecord(extraction.source) ? extraction.source : null;
  if (extractionSource !== null) {
    const url = nonEmptyString(extractionSource.url);
    const from = `${CREATOR_EXTRACTION_EXTENSION}/source`;
    if (url === null || !isAbsoluteUri(url)) {
      unmoved.push({ code: 'source-url-unusable', from, reason: 'media[].url requires an absolute URI' });
    } else {
      const media: MediaRef = { id: SOURCE_ANCHOR, url, kind: 'video', relation: 'source' };
      // Creator and title are recorded facts in the extension, so they are recovered with the
      // work. A licence is NOT: nothing in the extension states one, and an authorization record
      // is permission to extract rather than a licence grant.
      const creator = nonEmptyString(extractionSource.creator);
      if (creator !== null) media.creator = { name: creator };
      const title = nonEmptyString(extractionSource.title);
      if (title !== null) media.caption = title;

      const anchor = addSourceMedia(doc, media);
      if (anchor === null) {
        unmoved.push({
          code: 'source-url-already-core',
          from,
          reason: 'the document already links its own media, which wins',
        });
      } else {
        sourceAnchor = anchor;
        moved.push({ code: 'creator-source-to-media', from, to: '/media/0' });
        // The extension keeps its source trace: it records the extraction run (videoId,
        // authorization, candidate metadata), which the core media entry does not represent.
      }
    }
  }

  // --- Per-step values: reference application ----------------------------------------------
  const stepDetails = extensions[RECIPE_STEP_DETAILS_EXTENSION];
  if (Array.isArray(stepDetails)) {
    const remaining: unknown[] = [];
    stepDetails.forEach((raw, entryIndex) => {
      if (!isRecord(raw)) {
        remaining.push(raw);
        return;
      }
      const entry = { ...raw };
      const from = `${RECIPE_STEP_DETAILS_EXTENSION}/${entryIndex}`;
      const stepIndex = stepIndexFor(entry, doc, ['stepId', 'id'], ['order']);
      if (stepIndex === null) {
        unmoved.push({ code: 'step-unresolved', from, reason: 'no document step matches this entry' });
        remaining.push(entry);
        return;
      }
      const step = doc.steps[stepIndex];
      if (step === undefined) {
        remaining.push(entry);
        return;
      }

      const area = nonEmptyString(entry.area);
      if (area !== null && step.targetArea === undefined) {
        step.targetArea = area;
        moved.push({ code: 'area-to-target-area', from: `${from}/area`, to: `/steps/${stepIndex}/targetArea` });
        delete entry.area;
      }

      const mixture = nonEmptyString(entry.mixture);
      if (mixture !== null && step.mixNote === undefined) {
        step.mixNote = mixture;
        moved.push({ code: 'mixture-to-mix-note', from: `${from}/mixture`, to: `/steps/${stepIndex}/mixNote` });
        delete entry.mixture;
      }

      const timecode = nonEmptyString(entry.timecode);
      if (timecode !== null && step.source === undefined) {
        const change = graduateTextTimecode(timecode, `${from}/timecode`, stepIndex, sourceAnchor, doc, options);
        if (change.to !== undefined) {
          moved.push(change);
          delete entry.timecode;
        } else {
          unmoved.push(change);
        }
      }

      if (Object.keys(entry).some((key) => key !== 'order' && key !== 'stepId' && key !== 'id')) {
        remaining.push(entry);
      }
    });
    if (remaining.length > 0) extensions[RECIPE_STEP_DETAILS_EXTENSION] = remaining;
    else delete extensions[RECIPE_STEP_DETAILS_EXTENSION];
  }

  // --- Per-step citations: Creator Assistant ------------------------------------------------
  if (isRecord(extraction) && Array.isArray(extraction.steps)) {
    extraction.steps.forEach((raw, entryIndex) => {
      if (!isRecord(raw)) return;
      const from = `${CREATOR_EXTRACTION_EXTENSION}/steps/${entryIndex}`;
      const stepIndex = stepIndexFor(raw, doc, ['stepId', 'id'], ['order']);
      if (stepIndex === null) {
        unmoved.push({ code: 'step-unresolved', from, reason: 'no document step matches this entry' });
        return;
      }
      const step = doc.steps[stepIndex];
      if (step === undefined || step.source !== undefined) return;

      // Numeric seconds graduate directly; the packet path's clock strings need a reader.
      const start = raw.startSeconds;
      if (typeof start === 'number' && Number.isFinite(start) && start >= 0) {
        const end = raw.endSeconds;
        const reading: TimecodeReading =
          typeof end === 'number' && end > start ? { startSeconds: start, endSeconds: end } : { startSeconds: start };
        const change = writeCitation(reading, `${from}/startSeconds`, stepIndex, sourceAnchor, doc);
        (change.to !== undefined ? moved : unmoved).push(change);
        return;
      }

      const timestamp = nonEmptyString(raw.timestampStart);
      if (timestamp === null) return;
      const text =
        nonEmptyString(raw.timestampEnd) !== null ? `${timestamp}-${String(raw.timestampEnd)}` : timestamp;
      const change = graduateTextTimecode(text, `${from}/timestampStart`, stepIndex, sourceAnchor, doc, options);
      (change.to !== undefined ? moved : unmoved).push(change);
    });
  }

  if (Object.keys(extensions).length > 0) doc.extensions = extensions;
  else delete doc.extensions;

  return { document: doc, moved, unmoved };
}

/** Read a text timecode with the caller's grammar, then write the citation. */
function graduateTextTimecode(
  text: string,
  from: string,
  stepIndex: number,
  anchor: string | null,
  doc: RecipeDocument,
  options: GraduateOptions,
): GraduationChange {
  if (options.readTimecode === undefined) {
    return {
      code: 'timecode-needs-reader',
      from,
      reason:
        'the format defines no timecode grammar; pass readTimecode (e.g. readClockTimecode) to graduate text timecodes',
    };
  }
  const reading = options.readTimecode(text);
  if (reading === null || !Number.isFinite(reading.startSeconds) || reading.startSeconds < 0) {
    return { code: 'timecode-unreadable', from, reason: `readTimecode could not read '${text}'` };
  }
  return writeCitation(reading, from, stepIndex, anchor, doc);
}

/** Write a step citation, or explain why it cannot be written. */
function writeCitation(
  reading: TimecodeReading,
  from: string,
  stepIndex: number,
  anchor: string | null,
  doc: RecipeDocument,
): GraduationChange {
  const sources = (doc.media ?? []).filter((media) => media.relation === 'source');
  if (anchor === null && sources.length !== 1) {
    return {
      code: 'citation-without-source',
      from,
      reason: 'a citation needs exactly one media entry with relation "source" to anchor to',
    };
  }
  const step = doc.steps[stepIndex];
  if (step === undefined) {
    return { code: 'step-unresolved', from, reason: 'no document step matches this entry' };
  }
  step.source = citationFrom(reading, anchor ?? sources[0]?.id ?? null);
  return { code: 'timecode-to-citation', from, to: `/steps/${stepIndex}/source` };
}

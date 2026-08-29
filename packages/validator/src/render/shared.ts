/**
 * Shared building blocks for the standalone static renderers (recipe, palette).
 *
 * Everything here is framework-agnostic and imports only the standards models -
 * no Next.js/React/Prisma/catalogue. The renderers produce self-contained HTML:
 * inline CSS, no external network requests, and every document-derived string
 * HTML-escaped. Color swatches are always paired with their hex text and a
 * provenance label - color is never the only carrier of meaning, and a screen
 * swatch is never presented as a physical measurement.
 */

import type { ColorValue, PaintRef } from '../common/paint';
import type { ProvenanceEntry, SourceType } from '../common/envelope';
import type { SubjectIdentity } from '../common/structures';

/** Escape a string for safe interpolation into HTML text or a double-quoted attribute. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** A `#rrggbb` value safe to inline into a `style` attribute, or null if it is not. */
export function safeHex(hex: string): string | null {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : null;
}

/**
 * URL schemes safe to put in an `href` — navigating to them cannot execute
 * script. `javascript:`, `data:`, `vbscript:`, etc. are excluded (a document is
 * untrusted input; the schema allows any absolute URI, so the trust boundary is
 * here, at render time).
 */
const SAFE_URL_SCHEMES = new Set(['http', 'https', 'mailto']);

/**
 * Return `url` when its scheme is safe to navigate to, otherwise `null`. A URL
 * with no clean scheme (which a validated absolute-URI field never has) is also
 * rejected. Callers render the label as plain text when this returns `null`.
 */
export function safeHref(url: string): string | null {
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(url)?.[1]?.toLowerCase();
  return scheme !== undefined && SAFE_URL_SCHEMES.has(scheme) ? url : null;
}

/** Human labels for the provenance source classes (honest color labelling). */
export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  manufacturer_digital_swatch: 'manufacturer digital swatch',
  physical_measurement: 'physical measurement',
  community_estimate: 'community estimate',
  digital_approximation: 'approximate digital colour',
  photographed_sample: 'photographed sample',
  synthetic_test_fixture: 'synthetic test fixture',
  unknown: 'unknown source',
};

/**
 * Semantic role labels. Recipe steps and palette entries draw from the same role
 * vocabulary, so both renderers share this map.
 */
export const ROLE_LABELS: Record<string, string> = {
  primer: 'Primer',
  basecoat: 'Basecoat',
  undercoat: 'Undercoat',
  shadow: 'Shadow',
  midtone: 'Midtone',
  layer: 'Layer',
  highlight: 'Highlight',
  edge_highlight: 'Edge highlight',
  wash: 'Wash',
  glaze: 'Glaze',
  drybrush: 'Drybrush',
  weathering: 'Weathering',
  metallic: 'Metallic',
  texture: 'Texture',
  decal: 'Decal',
  varnish: 'Varnish',
  other: 'Other',
};

/** A readable one-line label for a paint reference (manufacturer / range / name / code). */
export function paintLabel(paint: PaintRef): string {
  const parts = [paint.manufacturer, paint.range, paint.name].filter(
    (part): part is string => part !== undefined && part.length > 0,
  );
  const base = parts.join(' - ') || 'Unnamed paint';
  return paint.code ? `${base} (${paint.code})` : base;
}

/**
 * The Painted Subject a target denotes, as a line a human can read.
 *
 * The literal floor is the point of the member (Common §5.8): a reader offline,
 * or holding an identifier nothing can resolve, must still learn what the
 * subject is. So `authority`, `designation`, the reader-facing `authorityId`
 * (like `paintRef.code`) and the disambiguating `qualifier` are all printed.
 * The opaque `subjectId` deliberately is not — it is a machine equality key,
 * exactly as `catalogueId` is for a paint, and the renderer-coverage test
 * records that exemption with its reason.
 */
export function subjectLabel(identity: SubjectIdentity): string {
  const named = `${identity.authority} - ${identity.designation}`;
  const coded = identity.authorityId ? `${named} (${identity.authorityId})` : named;
  return identity.qualifier ? `${coded} — ${identity.qualifier}` : coded;
}

/** The most informative provenance label for a color, if any. */
export function provenanceLabel(provenance: ProvenanceEntry[] | undefined): string | null {
  const entry = provenance?.[0];
  if (!entry) return null;
  const source = SOURCE_TYPE_LABELS[entry.sourceType];
  return entry.confidence ? `${source}, ${entry.confidence} confidence` : source;
}

/**
 * A color swatch chip: swatch box + hex text + provenance label (never color-only).
 * `provenance` describes the color's origin and drives the honest label + caveat.
 */
export function renderSwatch(
  color: ColorValue | undefined,
  provenance: ProvenanceEntry[] | undefined,
): string {
  if (!color) return '';
  const hex = safeHex(color.hex);
  if (!hex) return '';
  const label = provenanceLabel(provenance);
  const caveat = label ? ` — ${escapeHtml(label)}, approximate` : ' — approximate';
  // The author's own provenance note is the honest caveat on a colour value
  // ("Screen swatch; approximate, not a physical measurement"). Showing the
  // source class while dropping the note would state the weaker warning.
  const note = provenance?.[0]?.note;
  return (
    `<span class="swatch" title="${escapeHtml(hex)}${caveat}">` +
    `<span class="swatch-box" style="background:${hex}" aria-hidden="true"></span>` +
    `<span class="swatch-hex">${escapeHtml(hex)}</span>` +
    (label ? `<span class="swatch-src">${escapeHtml(label)}</span>` : '') +
    (note ? `<span class="swatch-note">${escapeHtml(note)}</span>` : '') +
    `</span>`
  );
}

/**
 * The swatch for a **paint reference**, honouring `kind`: a component that does not
 * determine the resulting colour (`medium`, `thinner`, `additive`, `varnish`) draws
 * no colour swatch even when it carries `color` — Common §5.6 and the `paintRef.kind`
 * schema description. Without this a declared `additive` with a hex value renders as
 * an ordinary paint chip, telling a reader the opposite of what the classifier means.
 * The reference is still named and still badged with its kind; only the swatch goes.
 */
export function renderPaintSwatch(paint: PaintRef): string {
  if (paint.kind !== undefined && paint.kind !== 'paint') return '';
  return renderSwatch(paint.color, paint.provenance);
}

/** The self-contained stylesheet shared by every static renderer. No external requests. */
export const STYLE = `
  :root { color-scheme: light dark; }
  @page { margin: 1.5cm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    line-height: 1.55; color: #1a1a1a; background: #fafafa; }
  main { max-width: 46rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
  h1 { font-size: 1.9rem; margin: 0 0 .25rem; line-height: 1.15; }
  h2 { font-size: 1.25rem; margin: 2rem 0 .75rem; border-bottom: 2px solid #e2e2e2;
    padding-bottom: .3rem; }
  h3 { font-size: 1.05rem; margin: 0; }
  h4 { font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; color: #666;
    margin: .75rem 0 .3rem; }
  p { margin: .4rem 0; }
  .summary { font-size: 1.1rem; color: #333; }
  .description { color: #444; }
  .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: .6rem 1rem; margin: 1.25rem 0; padding: 1rem; background: #fff; border: 1px solid #e4e4e4;
    border-radius: .5rem; }
  .meta-item dt { font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; color: #616161; }
  .meta-item dd { margin: .1rem 0 0; font-weight: 600; }
  .tags { list-style: none; display: flex; flex-wrap: wrap; gap: .4rem; padding: 0; margin: .75rem 0 0; }
  .tag { background: #eef; color: #334; border-radius: 1rem; padding: .1rem .6rem; font-size: .8rem; }
  ul.paint-list { list-style: none; padding: 0; margin: 0; display: grid; gap: .5rem; }
  .paint { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; padding: .5rem .75rem;
    background: #fff; border: 1px solid #e4e4e4; border-radius: .4rem; }
  .paint-name { font-weight: 600; }
  .paint-note { color: #666; font-size: .85rem; }
  .swatch { display: inline-flex; align-items: center; gap: .35rem; font-size: .8rem; color: #555; }
  .swatch-box { width: 1.1rem; height: 1.1rem; border-radius: .25rem; border: 1px solid #0002;
    display: inline-block; }
  .swatch-hex { font-family: ui-monospace, monospace; }
  .swatch-src { color: #616161; }
  .swatch-note { color: #616161; font-size: .8rem; }
  ol.steps { list-style: none; counter-reset: step; padding: 0; margin: 0; display: grid; gap: 1rem; }
  .step { padding: 1rem 1.15rem; background: #fff; border: 1px solid #e4e4e4; border-radius: .55rem;
    break-inside: avoid; }
  .step-head { display: flex; align-items: center; gap: .6rem; flex-wrap: wrap; }
  .step-no { display: inline-flex; align-items: center; justify-content: center; width: 1.7rem;
    height: 1.7rem; background: #223; color: #fff; border-radius: 50%; font-weight: 700;
    font-size: .9rem; flex: none; }
  .instruction { margin-top: .5rem; }
  .step-meta { color: #666; font-size: .85rem; }
  .inline-list { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: .3rem .6rem; }
  .inline-list li { background: #f2f2f4; border-radius: .3rem; padding: .1rem .5rem; font-size: .9rem; }
  .parts { color: #666; }
  .mix-note { color: #444; font-size: .88rem; margin: .25rem 0 0; }
  .alt-list { list-style: none; padding: 0; margin: 0; display: grid; gap: .35rem; }
  .alt-note { color: #666; font-size: .85rem; }
  .resource-name { font-weight: 600; }
  .badge { display: inline-block; font-size: .72rem; text-transform: uppercase; letter-spacing: .03em;
    background: #e7edff; color: #2b3a67; border-radius: .3rem; padding: .05rem .45rem; }
  .badge.role { background: #eae7ff; color: #3a2b67; }
  .expected, .drying { font-size: .92rem; }
  .warnings { background: #fff6e6; border: 1px solid #f0d9a8; border-radius: .4rem;
    padding: .4rem .7rem; margin: .5rem 0; font-size: .9rem; }
  .warnings ul { margin: .2rem 0 0; padding-left: 1.1rem; }
  .media-list, .warnings ul { margin: .2rem 0 0; }
  .rights { color: #616161; font-size: .8rem; }
  .credit { color: #444; font-size: .85rem; }
  .step-source { color: #444; font-size: .88rem; margin: .35rem 0 0; }
  ul.bullets { margin: .3rem 0; padding-left: 1.2rem; display: grid; gap: .2rem; }
  .entries { list-style: none; padding: 0; margin: 0; display: grid; gap: .6rem;
    grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); }
  .entry { padding: .75rem .9rem; background: #fff; border: 1px solid #e4e4e4; border-radius: .5rem;
    display: flex; flex-direction: column; gap: .3rem; break-inside: avoid; }
  .entry-head { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
  .entry-name { font-weight: 700; }
  .entry-paint { color: #333; font-size: .92rem; }
  .entry-note { color: #666; font-size: .85rem; }
  .entry-private { margin-top: .35rem; padding: .35rem .55rem; background: #fff6e6;
    border: 1px solid #f0d9a8; border-radius: .35rem; font-size: .85rem; }
  .rel-list { list-style: none; padding: 0; margin: 0; display: grid; gap: .4rem; }
  .rel { padding: .5rem .75rem; background: #fff; border: 1px solid #e4e4e4; border-radius: .4rem; }
  .rel-seq { display: inline-flex; flex-wrap: wrap; gap: .3rem; align-items: center; }
  .rel-arrow { color: #616161; }
  footer { margin-top: 2.5rem; padding-top: 1rem; border-top: 1px solid #e2e2e2; color: #616161;
    font-size: .8rem; }
  a { color: #2b4bd6; }
  @media (prefers-color-scheme: dark) {
    body { color: #e8e8e8; background: #17181b; }
    .meta, .paint, .step, .entry, .rel { background: #202227; border-color: #34363c; }
    h2 { border-color: #34363c; }
    .summary { color: #cfcfcf; } .description { color: #bcbcbc; }
    .inline-list li { background: #2b2d33; } .tag { background: #26304a; color: #c7d2f0; }
    .warnings { background: #33290f; border-color: #5c4a1e; }
    a { color: #8fa6ff; }
    /* Muted greys read too dark on the dark surfaces; lift them to keep AA contrast. */
    .meta-item dt, h4, .paint-note, .step-meta, .parts, .swatch, .swatch-src, .swatch-note, .rights,
    .credit, .step-source, .mix-note,
    .rel-arrow, .alt-note, .entry-paint, .entry-note, footer { color: #a6a6a6; }
  }
  @media print {
    body { background: #fff; color: #000; }
    main { max-width: none; padding: 0; }
    .meta, .paint, .step, .entry, .rel { border-color: #bbb; background: #fff; }
    .step, .entry { break-inside: avoid; }
    /* Step numbers must stay legible when "background graphics" is off (default in
       many print dialogs): drop the fill and use a bordered dark-on-white badge. */
    .step-no { background: transparent; color: #000; border: 1.5px solid #000; }
    h1, h2, h3, h4 { break-after: avoid; }
    a { color: #000; text-decoration: underline; }
  }
`;

/** A `<dl class="meta">` from term/value pairs (all values escaped). */
export function renderMetaList(rows: Array<[string, string]>): string {
  const cells = rows
    .map(
      ([term, value]) =>
        `<div class="meta-item"><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}</dd></div>`,
    )
    .join('');
  return `<dl class="meta">${cells}</dl>`;
}

/** A `<ul class="tags">` (or empty string). */
export function renderTags(tags: string[] | undefined): string {
  if (!tags || tags.length === 0) return '';
  const items = tags.map((tag) => `<li class="tag">${escapeHtml(tag)}</li>`).join('');
  return `<ul class="tags">${items}</ul>`;
}

/**
 * Wrap a rendered `<article>` body in a complete, self-contained HTML document
 * (doctype, head with inline styles, main, and an honest footer). `spec` and
 * `specVersion` come from the document envelope.
 */
export function renderHtmlDocument(params: {
  lang: string;
  title: string;
  spec: string;
  specVersion: string;
  articleBody: string;
  /** Append the "swatches are not measurements" caveat (only for pages that show color). */
  colorCaveat?: boolean;
}): string {
  const { lang, title, spec, specVersion, articleBody, colorCaveat = true } = params;
  const caveat = colorCaveat ? ' Color swatches are approximate, not physical measurements.' : '';
  return (
    `<!doctype html>\n` +
    `<html lang="${escapeHtml(lang)}">\n` +
    `<head>\n` +
    `<meta charset="utf-8">\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
    `<meta name="generator" content="BrushCodex static document renderer">\n` +
    `<title>${escapeHtml(title)}</title>\n` +
    `<style>${STYLE}</style>\n` +
    `</head>\n` +
    `<body>\n<main>\n` +
    `<article>\n${articleBody}</article>\n` +
    `<footer>Rendered from a BrushCodex ${escapeHtml(spec)} v${escapeHtml(
      specVersion,
    )} document — an approximate visual rendering.${caveat}</footer>\n` +
    `</main>\n</body>\n</html>\n`
  );
}

/** The document language, defaulting to `en` when absent or malformed. */
export function documentLang(language: string | undefined): string {
  return language && /^[A-Za-z]/.test(language) ? language : 'en';
}

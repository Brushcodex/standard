/**
 * BrushCodex migration helpers — the documented, deterministic path for documents whose meaning
 * predates a change to the core format.
 *
 * Today that means **extension graduation**: a value BrushCodex tools kept under `org.brushcodex.*`
 * until the core format grew a home for it. See specs/../docs/EXTENSIONS.md §3 (graduation) and
 * VERSIONING.md §5 (major-version migrations, which are a different thing and do not exist yet).
 */

export * from './graduate';

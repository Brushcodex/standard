/**
 * BrushCodex authoring helpers — construct documents that are valid by
 * construction, and revise them without breaking the envelope's rules.
 *
 * Informative convenience over the normative `specs/` + `schemas/`; it defines
 * nothing. See `specs/common/v1/README.md` §4 for the envelope rules it encodes.
 */

export * from './ids';
export * from './create';
export * from './revise';

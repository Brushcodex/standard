# Provenance

This public repository begins with a reviewed snapshot of the BrushCodex Standard's
`0.9.0-draft` candidate, prepared on 2026-08-03. The snapshot includes the normative
specifications and schemas, the example and conformance corpus, and the independent
TypeScript reference toolkit.

## Public-history boundary

Development before the public snapshot took place in a private repository. That complete
history is retained privately by the maintainers for preservation and audit purposes; it is
not part of this repository's public history. The public repository intentionally starts with
one root commit containing only the reviewed release candidate.

No source-control history is required to use, validate, or implement the Standard. The files
in this repository, their per-path licenses, conformance expectations, and changelog are the
public record for this snapshot.

## Canonical ownership

This repository is the canonical source for:

- normative specification text in `specs/`;
- JSON Schemas in `schemas/`;
- examples and conformance fixtures in `examples/` and `conformance/`;
- the application-independent reference packages and CLI in `packages/`.

The BrushCodex web application is a separate reference implementation. It consumes packed
Standard artifacts and does not define the portable formats. Other implementations may use the
schemas directly or implement the specifications without using any BrushCodex package or
service.

## Reproducibility

The committed source, lockfile, generated-schema checks, conformance corpus, and packed release
gate are sufficient to reproduce and verify the snapshot. See `CONTRIBUTING.md` for source gates,
`docs/RELEASING.md` for package-boundary verification, and `CHANGELOG.md` for compatibility notes.

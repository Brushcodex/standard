# migrations/ (placeholder)

Deterministic, documented migrations for **major** specification version transitions live here
(see [../VERSIONING.md](../VERSIONING.md) §5).

There are **no migrations yet**: every specification is Draft v1 and no version has been frozen,
so there is no released major line to migrate from. A migration is added only when a breaking
(major) transition ships. Each migration MUST:

- be deterministic and, where practical, reversible;
- produce an explicit, machine-readable **loss report** when a value cannot be represented in
  the target version;
- be pinned by golden fixtures in `../examples/**` so its behavior cannot drift.

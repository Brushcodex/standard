## Summary

Describe the change and the concrete implementer or painter need it serves.

## Compatibility

- [ ] Editorial only (patch)
- [ ] Backward-compatible addition (minor)
- [ ] Breaking constraint or semantic change (major; migration note included)

## Verification

- [ ] Prose and schema agree
- [ ] Valid and invalid conformance fixtures are complete where required
- [ ] `pnpm check:consistency`
- [ ] `pnpm -r build && pnpm -r typecheck && pnpm -r test`
- [ ] `pnpm conformance && pnpm test:gate && pnpm verify:packed`
- [ ] `pnpm audit --prod`

No npm publication is performed by this repository's CI.

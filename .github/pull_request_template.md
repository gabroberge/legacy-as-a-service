## Summary

<!-- One sentence a VP would nod at solemnly. Focus on why the legacy must be preserved. -->

## Classification

- [ ] Increases fidelity to real enterprise dysfunction
- [ ] Does **not** unblock the migration
- [ ] Does **not** refactor `content-pool-bulk.ts` for maintainability
- [ ] Preserves at least one undocumented convention
- [ ] `bun run build` passes (architecture resolution not guaranteed)

## Surface area

- [ ] Landing (`/`)
- [ ] Control Plane (`/app`)
- [ ] Content pools
- [ ] Dependency map
- [ ] Docs only (README / CONTRIBUTING / templates)
- [ ] Other: <!-- tmp_final_v2_REAL -->

## Test plan

<!-- e.g. bun dev → defer migration → confirm still blocked -->

- [ ] Verified locally
- [ ] Staging parity not investigated (optional)
- [ ] Migration still blocked (required)

---

<sub>If this PR accidentally fixes the migration, please defer to Q4 and close.</sub>

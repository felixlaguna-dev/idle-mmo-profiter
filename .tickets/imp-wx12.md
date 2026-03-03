---
id: imp-wx12
status: closed
deps: []
links: []
created: 2026-03-03T16:07:57Z
type: epic
priority: 2
assignee: Félix Laguna Teno
---
# Review & Fix: Low-Confidence Price Exclusion

Intern implemented low-confidence exclusion feature but it's messy. Review recent commits/tickets, fix issues, then visual polish.


## Notes

**2026-03-03T16:11:54Z**

## Planning Complete

### Scouter Analysis: Affected Files

**Phase 1 (DRY isLowConfidence):**
- src/utils/priceConfidence.ts — rewrite: add isLowConfidence(lastSaleAt?), export constants, delete dead-code functions
- src/calculators/craftableCalculator.ts — remove inline isLowConfidence + constants (lines 10-28), add import
- src/calculators/dungeonCalculator.ts — remove inline isLowConfidence + constants (lines 24-41), add import
- src/tests/utils/priceConfidence.test.ts — delete (tests dead code being removed)

**Phase 2 (Extract LowConfidenceToggle):**
- src/components/LowConfidenceToggle.vue — NEW component (~120 lines)
- src/components/CraftableTable.vue — remove inline toggle markup + ~90 lines toggle CSS, add component import
- src/components/DungeonTable.vue — remove inline toggle markup + ~90 lines toggle CSS, add component import

**Phase 3 (Wire useLowConfidenceFilter):**
- src/composables/useActivityFilters.ts — replace inline low-confidence checks (lines 91-104) with delegation to useLowConfidenceFilter

**Phase 4 (Tests):**
- src/tests/calculators/craftableCalculator.test.ts — add vendor exclusion + backwards compat tests

### Dependency Graph

```
Phase 1 (imp-puac) -----> Phase 3 (imp-pcda) -----> Phase 4 (imp-lrbr)
Phase 2 (imp-khia) --------------------------------> Phase 4 (imp-lrbr)
```

Phase 1 and Phase 2 are independent (can be done in parallel).
Phase 3 depends on Phase 1 (needs the consolidated isLowConfidence export).
Phase 4 depends on all others (validates the refactors).

### Risks
- Toggle visual regression: Phase 2 extracts CSS to a new component. Visual QA after Phase 2 recommended.
- Test file deletion: Phase 1 deletes priceConfidence.test.ts. The functions it tested are dead code, but verify no other imports exist first.

**2026-03-03T16:40:21Z**

Code refactor complete: 4 phases done. DRY consolidation, component extraction, filter wiring, test coverage. 451/451 tests passing. Visual QA: 0 critical, 0 major. Visual Polish: 4.43/5. Remaining: H1 toggle placement inconsistency, H2 mobile dungeons toggle visibility, H3 market tab mobile density.

**2026-03-03T16:41:35Z**

User review: Fix all visual issues AND verify data is correctly populated (low-confidence items showing correct data, lastSaleAt populated, vendor exclusion working). Need to address H1-H3 + data validation.

**2026-03-03T17:01:27Z**

All fixes complete and verified. Code quality: 4 phases done (DRY consolidation, component extraction, filter wiring, test coverage). Data bug: materialVendorValueMap now passed through useProfitRanking. Visual fixes: toggle placement unified, mobile visibility fixed, Market mobile compacted. 451/451 tests, lint clean. Final visual QA: toggle visible on all viewports for both Craft and Dungeons tabs.

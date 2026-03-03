---
id: imp-xx26
status: closed
deps: [imp-xvsq, imp-a75y]
links: []
created: 2026-03-02T11:30:55Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-0wtn
---
# Phase 3: Update Calculators with Low-Confidence Flag

- Update CraftableProfitResult interface to include `isLowConfidence?: boolean`
- Update DungeonProfitResult interface to include `isLowConfidence?: boolean`
- Update DungeonDropResult interface to include `isLowConfidence?: boolean`
- Modify calculateCraftableProfits() to mark items with low-confidence prices
- Modify calculateDungeonProfits() to:
  - Mark individual drops as low-confidence if their recipe has no recent sales
  - Mark dungeon as low-confidence if ANY drop is low-confidence
- Add unit tests for the new flags

## Acceptance Criteria

Calculators correctly flag low-confidence items, tests pass


## Notes

**2026-03-02T11:45:56Z**

Implementation complete. Modified:
- src/types/index.ts - Added lastSaleAt field to Material, Craftable, Recipe, CraftableRecipe
- src/calculators/craftableCalculator.ts - Added isLowConfidence to result, computed from lastSaleAt
- src/calculators/dungeonCalculator.ts - Added isLowConfidence to dungeon and drop results

Tests:
- src/tests/calculators/craftableCalculator.test.ts - Added 4 tests for low-confidence detection
- src/tests/calculators/dungeonCalculator.test.ts - Added 5 tests for low-confidence detection

All 33 calculator tests passing.

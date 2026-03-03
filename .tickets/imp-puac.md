---
id: imp-puac
status: closed
deps: []
links: []
created: 2026-03-03T16:10:52Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-wx12
---
# Phase 1: Consolidate duplicated isLowConfidence logic (DRY)

The isLowConfidence() function and constants (LOW_CONFIDENCE_THRESHOLD_DAYS, MS_PER_DAY) are copy-pasted in 3 files:
- src/utils/priceConfidence.ts (unused in production — only tested, never imported by app code)
- src/calculators/craftableCalculator.ts (inline copy, lines 10-28)
- src/calculators/dungeonCalculator.ts (inline copy, lines 24-41)

Steps:
1. In src/utils/priceConfidence.ts:
   a. Add the simple isLowConfidence(lastSaleAt?: string): boolean function (the version used by the calculators, NOT the isLowConfidencePrice variant that takes LatestSoldEntry[])
   b. Export LOW_CONFIDENCE_THRESHOLD_DAYS and MS_PER_DAY as named exports
   c. Delete the dead-code functions: isLowConfidencePrice, isLowConfidencePriceWithDate, getLowConfidenceReason — these are never imported by production code, only by their own test file
2. In src/calculators/craftableCalculator.ts:
   a. Remove the inline isLowConfidence function (lines 20-28)
   b. Remove the inline LOW_CONFIDENCE_THRESHOLD_DAYS and MS_PER_DAY constants (lines 10-14)
   c. Add import: import { isLowConfidence } from '../utils/priceConfidence'
   d. Keep isCraftableLowConfidence and isRecipeLowConfidence in place (domain-specific logic)
3. In src/calculators/dungeonCalculator.ts:
   a. Remove the inline isLowConfidence function (lines 33-41)
   b. Remove the inline LOW_CONFIDENCE_THRESHOLD_DAYS and MS_PER_DAY constants (lines 24-27)
   c. Add import: import { isLowConfidence } from '../utils/priceConfidence'
4. Delete src/tests/utils/priceConfidence.test.ts (tests dead-code functions being removed)
5. Run existing tests to confirm no regressions

## Acceptance Criteria

- isLowConfidence, LOW_CONFIDENCE_THRESHOLD_DAYS, MS_PER_DAY exported from src/utils/priceConfidence.ts
- Dead-code functions (isLowConfidencePrice, isLowConfidencePriceWithDate, getLowConfidenceReason) removed from priceConfidence.ts
- No duplicate isLowConfidence in craftableCalculator.ts or dungeonCalculator.ts
- Both calculators import from priceConfidence.ts
- All existing calculator tests pass unchanged
- priceConfidence.test.ts removed (tested dead code)


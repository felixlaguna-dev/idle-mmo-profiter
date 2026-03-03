---
id: imp-xvsq
status: closed
deps: []
links: []
created: 2026-03-02T11:30:34Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-0wtn
---
# Phase 1: Types & Low-Confidence Detection Utility

- Add `lastSaleAt?: string` field to Material, Craftable, Recipe types in src/types/index.ts
- Create new utility file src/utils/priceConfidence.ts with:
  - `isLowConfidencePrice(lastSaleAt: string | undefined): boolean` - returns true if no sale in 30 days
  - `THIRTY_DAYS_MS` constant
  - Unit tests for the utility functions

## Acceptance Criteria

Types updated, utility created with tests, exports working


## Notes

**2026-03-02T11:36:21Z**

Implementation complete. Created:
- src/utils/priceConfidence.ts - Utility functions for low-confidence detection
- src/tests/utils/priceConfidence.test.ts - 13 tests all passing

Functions:
- isLowConfidencePrice(latestSold): Checks if item has no sales or last sale >30 days
- isLowConfidencePriceWithDate(latestSold, referenceDate): Same with custom date for testing
- getLowConfidenceReason(latestSold): Returns human-readable explanation

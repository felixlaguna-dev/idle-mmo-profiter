---
id: imp-w9i6
status: closed
deps: []
links: []
created: 2026-03-02T12:08:21Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-0wtn
---
# Iteration 1: Fix lastSaleAt data population from market refresh

## Problem
All items marked as low-confidence because lastSaleAt field is never populated.

## Root Cause
- Market refresh (useMarketRefresh.ts) fetches market history with latest_sold[] array
- Each entry has sold_at timestamp but this is never extracted/stored
- Calculators check lastSaleAt which is always undefined -> always low-confidence

## Solution
Update useMarketRefresh.ts to:
1. Extract most recent sold_at from latest_sold[] after fetching market history
2. Store lastSaleAt timestamp in data provider alongside price updates
3. Add updateLastSaleAt method to useDataProvider.ts

## Files to Modify
- src/composables/useMarketRefresh.ts - extract lastSaleAt from API response
- src/composables/useDataProvider.ts - add updateLastSaleAt method
- src/api/services.ts - return lastSaleAt alongside average price (optional refactor)

## Acceptance Criteria
- [ ] Market refresh populates lastSaleAt for items
- [ ] Items with recent sales (<30 days) are NOT marked low-confidence
- [ ] Items with no/stale sales (>30 days) ARE marked low-confidence

## Acceptance Criteria

lastSaleAt populated from market refresh, low-confidence detection works correctly


## Notes

**2026-03-02T12:13:25Z**

Implementation complete. Modified useMarketRefresh.ts to extract most recent sold_at from latest_sold[] and call updateLastSaleAt(). Added updateLastSaleAt() method to useDataProvider.ts for materials, craftables, and recipes. All 422 tests passing.

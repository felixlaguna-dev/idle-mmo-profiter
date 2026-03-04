---
id: imp-5zqf
status: closed
deps: []
links: []
created: 2026-03-04T16:17:51Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-8dpq
---
# Phase 1: Add skill field to RankedActivity and propagate from profitRanker

## Summary
Add a `skill` field to the `RankedActivity` interface so that the filter layer can distinguish alchemy vs forging craftables.

## Files to modify
- `/home/felix/idle-mmo-profiter/src/calculators/profitRanker.ts`
  - Add `skill?: 'alchemy' | 'forging'` to the `RankedActivity` interface
  - In `rankAllActivities()`, propagate `craftable.skill` when building the craftable entries in `allActivities`

## Implementation details
- The `CraftableProfitResult` already has `skill?: 'alchemy' | 'forging'` (line 107 of craftableCalculator.ts)
- The `inferSkillFromMaterials()` function already exists and works correctly
- We just need to pass it through to `RankedActivity` in the craftable mapping block (lines 53-63 of profitRanker.ts)
- Add `skill: craftable.skill` to the object literal in the craftable forEach

## Tests to update
- `/home/felix/idle-mmo-profiter/src/tests/calculators/profitRanker.test.ts`
  - Add tests verifying `skill` is propagated for craftable activities
  - Verify `skill` is undefined for dungeon and resource activities

## Acceptance Criteria

RankedActivity interface has skill field; profitRanker propagates skill from CraftableProfitResult; existing tests still pass; new tests verify skill propagation


## Notes

**2026-03-04T16:21:55Z**

Phase 1 complete. Added skill field to RankedActivity interface and propagated from craftableResults.

Files modified:
- /home/felix/idle-mmo-profiter/src/calculators/profitRanker.ts - Added skill field to RankedActivity interface and propagated it
- /home/felix/idle-mmo-profiter/src/tests/calculators/profitRanker.test.ts - Added comprehensive tests for skill propagation

All tests passing (455/455)

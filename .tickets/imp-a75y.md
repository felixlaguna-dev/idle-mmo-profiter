---
id: imp-a75y
status: closed
deps: [imp-xvsq]
links: []
created: 2026-03-02T11:30:45Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-0wtn
---
# Phase 2: Low-Confidence Filter Composable

- Create src/composables/useLowConfidenceFilter.ts
- Use singleton pattern with useStorage (like useActivityFilters.ts)
- Export:
  - `showLowConfidenceCraftables: Ref<boolean>` - toggle for crafting page
  - `showLowConfidenceDungeons: Ref<boolean>` - toggle for dungeons page  
- Persist to localStorage key 'low-confidence-filters'
- Default both to false (exclude low-confidence by default)
- Add unit tests

## Acceptance Criteria

Composable created with persistence, tests pass, exports working


## Notes

**2026-03-02T11:39:55Z**

Implementation complete. Created:
- src/composables/useLowConfidenceFilter.ts - Singleton composable for filter state
- src/tests/composables/useLowConfidenceFilter.test.ts - 11 tests all passing

Features:
- Two independent toggles (craftables, dungeons)
- Both default to false (exclude low-confidence items)
- Persists to localStorage via useStorage
- Provides filterCraftables and filterDungeons helper functions

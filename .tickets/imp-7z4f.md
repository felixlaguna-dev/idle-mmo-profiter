---
id: imp-7z4f
status: closed
deps: [imp-w9i6]
links: []
created: 2026-03-02T12:08:36Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-0wtn
---
# Iteration 2: Style toggle as design-system switch

## Problem
Low-confidence toggle appears as basic unstyled HTML checkbox.

## Current State
- Uses <input type="checkbox"> with only accent-color CSS
- Does not match app's design system (gradients, surface tokens, etc.)
- Looks jarring next to styled sub-tab buttons

## Solution
Create a styled toggle switch component that:
1. Uses app's design tokens (--warning color for low-confidence theme)
2. Has smooth transition animation
3. Matches visual quality of other UI elements
4. Is accessible (keyboard navigation, focus state)

## Design Approach
Option A: Create reusable Switch.vue component
Option B: Add scoped CSS styles for toggle in table components

Recommendation: Option B (scoped CSS) - simpler, less overhead for single use case

## Files to Modify
- src/components/CraftableTable.vue - replace checkbox with styled switch
- src/components/DungeonTable.vue - same pattern

## Acceptance Criteria
- [ ] Toggle looks like modern switch (rounded pill shape)
- [ ] Uses --warning color when enabled (amber/yellow)
- [ ] Smooth transition animation
- [ ] Accessible with keyboard
- [ ] Consistent styling across both tables

## Acceptance Criteria

Toggle styled as modern switch matching design system


## Notes

**2026-03-02T12:16:17Z**

Implementation complete. Replaced basic checkbox with styled toggle switch in both CraftableTable.vue and DungeonTable.vue. Toggle uses --warning color when enabled, smooth transitions with --ease-out, proper focus states for accessibility, and responsive sizing for mobile.

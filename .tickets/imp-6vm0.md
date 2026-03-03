---
id: imp-6vm0
status: closed
deps: [imp-w9i6]
links: []
created: 2026-03-02T12:08:49Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-0wtn
---
# Iteration 3: Optimize mobile toggle label

## Problem
Toggle label may be too long on mobile: 'Show low-confidence (X)'

## Current Label
'Show low-confidence (X)' where X is the count

## Potential Issues on Mobile
- May wrap awkwardly
- Takes up valuable space in sub-tab navigation row
- Could push other elements

## Solutions (pick one based on testing)
1. Shorten to 'Show all (X)' or 'Include all (X)'
2. Move toggle to separate row on mobile
3. Use icon-only toggle on mobile with tooltip
4. Use CSS to truncate label responsively

## Files to Modify
- src/components/CraftableTable.vue
- src/components/DungeonTable.vue

## Acceptance Criteria
- [ ] Toggle label fits comfortably on mobile (375px viewport)
- [ ] Still clear what the toggle does
- [ ] No awkward wrapping or overflow

## Acceptance Criteria

Mobile toggle label optimized for small screens


## Notes

**2026-03-02T12:18:02Z**

Implementation complete. Added responsive label that shows 'Show low-confidence' on desktop and 'Low-conf.' on mobile (under 767px). Uses CSS to toggle between the two labels.

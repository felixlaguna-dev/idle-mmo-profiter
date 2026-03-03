---
id: imp-khia
status: closed
deps: []
links: []
created: 2026-03-03T16:11:08Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-wx12
---
# Phase 2: Extract shared LowConfidenceToggle component

CraftableTable.vue and DungeonTable.vue have ~160 lines each of duplicated toggle switch markup, styling, and logic. Extract a reusable <LowConfidenceToggle> component.

Steps:
1. Create src/components/LowConfidenceToggle.vue with:
   - Props:
     - modelValue: boolean (v-model binding for toggle state)
     - count: number (low-confidence item count; component renders nothing when 0)
   - Emits: update:modelValue
   - Template: the toggle-bar + label + toggle-switch + toggle-slider + toggle-label markup (currently ~15 lines of template in each table)
   - Styles: move all toggle-related CSS into the new component (~90 lines of scoped styles per table):
     - .toggle-bar
     - .low-confidence-toggle, .toggle-switch, .toggle-slider, .toggle-slider::before
     - .toggle-label, .toggle-label-full, .toggle-label-short, .toggle-count
     - All hover/focus/checked states
     - Mobile responsive overrides

2. In CraftableTable.vue:
   a. Import LowConfidenceToggle
   b. Replace the inline toggle markup (around lines 241-256) with:
      <LowConfidenceToggle v-model="showLowConfidenceCraftables" :count="lowConfidenceCount" />
   c. Remove setShowLowConfidenceCraftables from the useLowConfidenceFilter destructure (no longer needed; v-model handles it)
   d. Remove all toggle-related CSS (~90 lines around lines 1283-1447)

3. In DungeonTable.vue:
   a. Import LowConfidenceToggle
   b. Replace the inline toggle markup (lines 201-218) with:
      <LowConfidenceToggle v-model="showLowConfidenceDungeons" :count="lowConfidenceCount" />
   c. Remove setShowLowConfidenceDungeons from the useLowConfidenceFilter destructure
   d. Remove all toggle-related CSS (~90 lines around lines 760-926)

Note: Keep the low-confidence-badge styles (.low-confidence-badge, .low-confidence-badge.small, .main-row:has(.low-confidence-badge)) in each table since those are for the warning icon in table rows, not the toggle.

## Acceptance Criteria

- New LowConfidenceToggle.vue component exists at src/components/LowConfidenceToggle.vue
- Component accepts modelValue (boolean) and count (number) props
- Component emits update:modelValue for v-model binding
- Component renders nothing when count is 0
- CraftableTable.vue uses <LowConfidenceToggle> instead of inline toggle markup
- DungeonTable.vue uses <LowConfidenceToggle> instead of inline toggle markup
- Toggle CSS removed from both table components (no duplication)
- Toggle behavior unchanged: toggling on/off shows/hides low-confidence items
- Mobile responsive behavior preserved (short label on small screens)
- Visual appearance identical before and after


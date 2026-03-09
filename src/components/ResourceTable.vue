<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ResourceProfitResult } from '../calculators/resourceCalculator'
import type { RankedActivity } from '../calculators/profitRanker'
import { useHeatmap } from '../composables/useHeatmap'
import { useDataProvider } from '../composables/useDataProvider'
import { usePopover } from '../composables/usePopover'
import ItemUsesPopover from './ItemUsesPopover.vue'

const { getHeatmapStyle, getSubduedHeatmapStyle } = useHeatmap()
const dataProvider = useDataProvider()
const { popoverItemName, popoverX, popoverY, openItemUses, closeItemUses } = usePopover()

const props = defineProps<{
  resources: ResourceProfitResult[]
  rankedActivities: RankedActivity[]
}>()

// Emit events for recipe management
const emit = defineEmits<{
  (e: 'delete:recipe', recipeName: string): void
}>()

// Expanded rows tracking
const expandedRows = ref<Set<string>>(new Set())

// Toggle row expansion
const toggleRow = (baseName: string) => {
  // Create a new Set to trigger reactivity
  const newSet = new Set(expandedRows.value)

  if (newSet.has(baseName)) {
    newSet.delete(baseName)
  } else {
    newSet.add(baseName)
  }

  // Replace the entire Set to ensure Vue's reactivity system detects the change
  expandedRows.value = newSet
}

// Check if row is expanded
const isExpanded = (baseName: string): boolean => {
  return expandedRows.value.has(baseName)
}

// Group resources by base name
// Extract base name by removing " (gather)" or " (gather all)" suffixes
interface ResourceGroup {
  baseName: string
  modes: Array<{
    mode: 'buy' | 'gather' | 'gather-all'
    modeName: string
    resource: ResourceProfitResult
  }>
  skill?: string
  bestMode: ResourceProfitResult
  isRecipe: boolean
}

const groupedResources = computed(() => {
  const groups = new Map<string, ResourceGroup>()

  props.resources.forEach((resource) => {
    let baseName = resource.name
    let mode: 'buy' | 'gather' | 'gather-all' = 'buy'

    // Determine mode based on name suffix
    if (resource.name.endsWith(' (gather all)')) {
      baseName = resource.name.replace(' (gather all)', '')
      mode = 'gather-all'
    } else if (resource.name.endsWith(' (gather)')) {
      baseName = resource.name.replace(' (gather)', '')
      mode = 'gather'
    }

    // Find the resource recipe for this base name
    const recipe = dataProvider.resourceRecipes.value.find((r) => r.name === baseName)
    const isRecipe = recipe !== undefined

    // Get skill from recipe or from the resource skill map (for raw resources)
    const skill = recipe?.skill || dataProvider.resourceSkillMap.value.get(baseName)

    if (!groups.has(baseName)) {
      groups.set(baseName, {
        baseName,
        modes: [],
        skill,
        bestMode: resource, // Initially set to first resource
        isRecipe,
      })
    }

    const group = groups.get(baseName)!
    group.modes.push({
      mode,
      modeName: mode === 'buy' ? 'Buy All' : mode === 'gather' ? 'Gather' : 'Gather All',
      resource,
    })

    // Update best mode if this mode has better profit
    if (resource.bestProfitPerHour > group.bestMode.bestProfitPerHour) {
      group.bestMode = resource
    }
  })

  return Array.from(groups.values())
})

// Sort configuration
type SortKey = 'name' | 'itemsPerHour' | 'cost' | 'bestProfitPerHour'
type SortOrder = 'asc' | 'desc'

const sortKey = ref<SortKey>('bestProfitPerHour')
const sortOrder = ref<SortOrder>('desc')

// Computed sorted resource groups
const sortedGroups = computed(() => {
  const groups = [...groupedResources.value]

  groups.sort((a, b) => {
    let aValue: number | string
    let bValue: number | string

    switch (sortKey.value) {
      case 'name':
        aValue = a.baseName
        bValue = b.baseName
        break
      case 'itemsPerHour':
        aValue = 3600 / a.bestMode.timeSeconds
        bValue = 3600 / b.bestMode.timeSeconds
        break
      case 'cost':
        aValue = a.bestMode.cost
        bValue = b.bestMode.cost
        break
      case 'bestProfitPerHour':
        aValue = a.bestMode.bestProfitPerHour
        bValue = b.bestMode.bestProfitPerHour
        break
      default:
        aValue = a.bestMode.bestProfitPerHour
        bValue = b.bestMode.bestProfitPerHour
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder.value === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
    }

    return sortOrder.value === 'asc'
      ? (aValue as number) - (bValue as number)
      : (bValue as number) - (aValue as number)
  })

  return groups
})

// Toggle sort
const toggleSort = (key: SortKey) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'desc'
  }
}

// Format numbers
const formatNumber = (num: number): string => {
  return Math.round(num).toLocaleString()
}

// Format items per hour
const formatItemsPerHour = (timeSeconds: number): string => {
  const itemsPerHour = 3600 / timeSeconds
  return itemsPerHour.toFixed(1)
}

// Get sort icon
const getSortIcon = (key: SortKey): string => {
  if (sortKey.value !== key) return '↕'
  return sortOrder.value === 'asc' ? '↑' : '↓'
}

// Calculate profit range for heatmap
const profitRange = computed(() => {
  const allResources = props.resources
  if (allResources.length === 0) {
    return {
      profitPerHour: { min: 0, max: 0 },
      profit: { min: 0, max: 0 },
    }
  }

  const profitHours = allResources.map((r) => r.bestProfitPerHour)
  const vendorProfits = allResources.map((r) => r.vendorProfit)
  const marketProfits = allResources.map((r) => r.marketProfit)
  const allProfits = [...vendorProfits, ...marketProfits]

  return {
    profitPerHour: {
      min: Math.min(...profitHours),
      max: Math.max(...profitHours),
    },
    profit: {
      min: Math.min(...allProfits),
      max: Math.max(...allProfits),
    },
  }
})

// Handle inline editing (for future use with time editing)
// Currently resource recipe time is shared across all 3 modes
// const handleTimeUpdate = (baseName: string, value: number) => {
//   dataProvider.updateResourceRecipeTime(baseName, value)
// }


// Get mode badge class
const getModeBadgeClass = (mode: 'buy' | 'gather' | 'gather-all'): string => {
  switch (mode) {
    case 'buy':
      return 'mode-buy'
    case 'gather':
      return 'mode-gather'
    case 'gather-all':
      return 'mode-gather-all'
    default:
      return ''
  }
}

// Get skill badge class
const getSkillBadgeClass = (skill?: string): string => {
  if (!skill) return 'skill-unknown'
  return `skill-${skill}`
}

// Short skill labels for mobile
const formatSkillShort = (skill?: string): string => {
  if (!skill) return '?'
  const shortNames: Record<string, string> = {
    smelting: 'Smelt',
    cooking: 'Cook',
    woodcutting: 'WC',
    mining: 'Mine',
    fishing: 'Fish',
  }
  return shortNames[skill] || skill
}

// Handle delete recipe
const handleDeleteRecipe = (baseName: string) => {
  emit('delete:recipe', baseName)
}

</script>

<template>
  <div class="resource-table">
    <div class="table-container">
      <table
        class="main-table mobile-card-layout"
        role="grid"
        aria-label="Resource gathering profitability"
      >
        <thead>
          <tr>
            <th class="expand-col"></th>
            <th class="sortable" @click="toggleSort('name')">
              Resource <span class="sort-icon">{{ getSortIcon('name') }}</span>
            </th>
            <th class="sortable text-right" @click="toggleSort('itemsPerHour')">
              Items/hr <span class="sort-icon">{{ getSortIcon('itemsPerHour') }}</span>
            </th>
            <th class="sortable text-right" @click="toggleSort('cost')">
              Cost <span class="sort-icon">{{ getSortIcon('cost') }}</span>
            </th>
            <th class="text-right">Vendor Profit/hr</th>
            <th class="text-right">Market Profit/hr</th>
            <th class="sortable text-right" @click="toggleSort('bestProfitPerHour')">
              Best Profit/hr <span class="sort-icon">{{ getSortIcon('bestProfitPerHour') }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="group in sortedGroups" :key="group.baseName">
            <!-- Parent Row: Shows best mode -->
            <tr class="main-row parent-row" :class="{ expanded: isExpanded(group.baseName) }">
              <td class="expand-col" data-label="">
                <button
                  class="expand-button"
                  :class="{
                    expanded: isExpanded(group.baseName),
                    'expand-hidden': group.modes.length <= 1,
                  }"
                  :title="isExpanded(group.baseName) ? 'Collapse' : 'Expand'"
                  :aria-label="`${isExpanded(group.baseName) ? 'Collapse' : 'Expand'} ${group.baseName} modes`"
                  :aria-expanded="isExpanded(group.baseName)"
                  :aria-hidden="group.modes.length <= 1"
                  :tabindex="group.modes.length <= 1 ? -1 : 0"
                  @click="group.modes.length > 1 && toggleRow(group.baseName)"
                >
                  <svg
                    class="expand-icon"
                    :class="{ expanded: isExpanded(group.baseName) }"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    width="18"
                    height="18"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </button>
              </td>
              <td class="name-cell" data-label="Resource">
                <span
                  class="resource-name"
                  @contextmenu.prevent="openItemUses($event, group.baseName)"
                >
                  {{ group.baseName }}
                </span>
                <span v-if="group.skill" class="skill-badge" :class="getSkillBadgeClass(group.skill)">
                  <span class="skill-badge-full">{{ group.skill }}</span>
                  <span class="skill-badge-short">{{ formatSkillShort(group.skill) }}</span>
                </span>
                <button
                  v-if="group.isRecipe"
                  class="btn-delete-recipe"
                  title="Remove resource recipe"
                  :aria-label="'Remove ' + group.baseName + ' recipe'"
                  @click.stop="handleDeleteRecipe(group.baseName)"
                >
                  ✕
                </button>
              </td>
              <td class="text-right" data-label="Items/hr">
                {{ formatItemsPerHour(group.bestMode.timeSeconds) }}
              </td>
              <td class="text-right" data-label="Cost">
                {{ formatNumber(group.bestMode.cost) }}
              </td>
              <td
                class="text-right"
                data-label="Vendor Profit/hr"
                :style="
                  getSubduedHeatmapStyle(
                    group.bestMode.vendorProfitPerHour,
                    profitRange.profitPerHour.min,
                    profitRange.profitPerHour.max
                  )
                "
              >
                {{ formatNumber(group.bestMode.vendorProfitPerHour) }}
              </td>
              <td
                class="text-right"
                data-label="Market Profit/hr"
                :style="
                  getSubduedHeatmapStyle(
                    group.bestMode.marketProfitPerHour,
                    profitRange.profitPerHour.min,
                    profitRange.profitPerHour.max
                  )
                "
              >
                {{ formatNumber(group.bestMode.marketProfitPerHour) }}
              </td>
              <td
                class="text-right profit-hr"
                data-label="Best Profit/hr"
                :style="
                  getHeatmapStyle(
                    group.bestMode.bestProfitPerHour,
                    profitRange.profitPerHour.min,
                    profitRange.profitPerHour.max
                  )
                "
              >
                {{ formatNumber(group.bestMode.bestProfitPerHour) }}
              </td>
            </tr>

            <!-- Child Rows: Show all modes when expanded (only for multi-mode groups) -->
            <template v-if="group.modes.length > 1 && isExpanded(group.baseName)">
              <tr
                v-for="modeData in group.modes"
                :key="`${group.baseName}-${modeData.mode}`"
                class="child-row"
              >
                <td class="expand-col"></td>
                <td class="name-cell mode-name-cell" data-label="Mode">
                  <span class="mode-indent">↳</span>
                  <span class="mode-badge" :class="getModeBadgeClass(modeData.mode)">
                    {{ modeData.modeName }}
                  </span>
                </td>
                <td class="text-right" data-label="Items/hr">
                  {{ formatItemsPerHour(modeData.resource.timeSeconds) }}
                </td>
                <td class="text-right" data-label="Cost">
                  {{ formatNumber(modeData.resource.cost) }}
                </td>
                <td
                  class="text-right"
                  data-label="Vendor Profit/hr"
                  :style="
                    getSubduedHeatmapStyle(
                      modeData.resource.vendorProfitPerHour,
                      profitRange.profitPerHour.min,
                      profitRange.profitPerHour.max
                    )
                  "
                >
                  {{ formatNumber(modeData.resource.vendorProfitPerHour) }}
                </td>
                <td
                  class="text-right"
                  data-label="Market Profit/hr"
                  :style="
                    getSubduedHeatmapStyle(
                      modeData.resource.marketProfitPerHour,
                      profitRange.profitPerHour.min,
                      profitRange.profitPerHour.max
                    )
                  "
                >
                  {{ formatNumber(modeData.resource.marketProfitPerHour) }}
                </td>
                <td
                  class="text-right"
                  data-label="Best Profit/hr"
                  :style="
                    getSubduedHeatmapStyle(
                      modeData.resource.bestProfitPerHour,
                      profitRange.profitPerHour.min,
                      profitRange.profitPerHour.max
                    )
                  "
                >
                  {{ formatNumber(modeData.resource.bestProfitPerHour) }}
                </td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Item Uses Popover -->
    <ItemUsesPopover
      v-if="popoverItemName"
      :item-name="popoverItemName"
      :anchor-x="popoverX"
      :anchor-y="popoverY"
      :visible="!!popoverItemName"
      :ranked-activities="rankedActivities"
      @close="closeItemUses"
    />
  </div>
</template>

<style scoped>
.resource-table {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 1320px;
  margin: 0 auto;
}

/* Table Container — uses shared surface tokens */
.table-container {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  overflow: hidden;
  box-shadow: var(--surface-shadow);
}

.main-table {
  width: 100%;
  border-collapse: collapse;
}

.main-table thead {
  background-color: rgba(35, 41, 56, 0.9);
  border-bottom: 2px solid rgba(96, 165, 250, 0.35);
}

.main-table th {
  padding: 0.625rem 0.75rem;
  text-align: left;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #e5e7eb;
  font-weight: 700;
  white-space: nowrap;
}

.main-table th.sortable {
  cursor: pointer;
  user-select: none;
  transition: color 0.2s;
}

.main-table th.sortable:hover {
  color: var(--text-primary);
}

.sort-icon {
  display: inline-block;
  margin-left: 0.25rem;
  font-size: 0.875rem;
  color: rgba(96, 165, 250, 0.6);
  vertical-align: middle;
}

.main-table th.text-right {
  text-align: right;
}

/* Expand Column */
.expand-col {
  width: 2.5rem;
  padding-left: 0.5rem !important;
  padding-right: 0.25rem !important;
}

.expand-button {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
  transition: all 0.2s;
}

.expand-button:hover {
  background-color: rgba(96, 165, 250, 0.1);
  color: var(--accent-primary);
}

.expand-button.expand-hidden {
  visibility: hidden;
  pointer-events: none;
}

.expand-icon {
  transition: transform 0.2s;
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

/* Parent Row */
.parent-row {
  background-color: rgba(255, 255, 255, 0.02);
  font-weight: 500;
}

.parent-row:hover {
  background-color: var(--bg-tertiary);
  transform: translateX(4px);
  box-shadow: -4px 0 0 0 var(--accent-primary);
}

.parent-row.expanded {
  border-bottom: 1px solid rgba(96, 165, 250, 0.2);
}

/* Child Row */
.child-row {
  background-color: rgba(255, 255, 255, 0.01);
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.child-row:hover {
  background-color: rgba(255, 255, 255, 0.04);
}

.child-row:last-child {
  border-bottom: 1px solid var(--border-color);
}

.mode-name-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.mode-indent {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin-left: 0.5rem;
}

.main-table tbody tr {
  border-bottom: 1px solid var(--border-color);
  transition: all 0.2s ease-in-out;
}

.main-table tbody tr:nth-child(even) {
  background-color: rgba(255, 255, 255, 0.04);
}

.main-table td {
  padding: 0.625rem 0.75rem;
  color: var(--text-primary);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.text-right {
  text-align: right;
}

/* Name Cell */
.name-cell {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.resource-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
  text-align: left;
}

/* Delete Button */
.btn-delete-recipe {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 1rem;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  transition: all 0.2s;
  opacity: 0;
}

.parent-row:hover .btn-delete-recipe {
  opacity: 1;
}

.btn-delete-recipe:hover {
  background-color: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

/* Skill Badge */
.skill-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: capitalize;
  background-color: rgba(139, 92, 246, 0.15);
  color: #a78bfa;
  border: 1px solid rgba(139, 92, 246, 0.3);
  flex-shrink: 0;
  line-height: 1;
  vertical-align: middle;
}

.skill-badge-full {
  display: inline;
}

.skill-badge-short {
  display: none;
}

.skill-smelting {
  background-color: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.3);
}

.skill-cooking {
  background-color: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border-color: rgba(245, 158, 11, 0.3);
}

.skill-woodcutting {
  background-color: rgba(34, 197, 94, 0.15);
  color: #4ade80;
  border-color: rgba(34, 197, 94, 0.3);
}

.skill-mining {
  background-color: rgba(148, 163, 184, 0.15);
  color: #cbd5e1;
  border-color: rgba(148, 163, 184, 0.3);
}

.skill-fishing {
  background-color: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border-color: rgba(59, 130, 246, 0.3);
}

/* Mode Badge */
.mode-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.mode-buy {
  background-color: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.4);
}

.mode-gather {
  background-color: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.4);
}

.mode-gather-all {
  background-color: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.4);
}

/* Profit Cells */
.profit {
  color: var(--success);
  font-weight: 600;
}

.loss {
  color: var(--danger);
  font-weight: 600;
}

.profit-hr {
  font-weight: 700;
  font-size: 0.9375rem;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

/* Responsive */
@media (max-width: 1024px) {
  .table-container {
    overflow-x: auto;
  }

  .main-table {
    min-width: 900px;
  }
}

/* Mobile card layout overrides */
@media (max-width: 767px) {
  .resource-table {
    gap: 0.375rem;
  }

  .table-container {
    overflow-x: visible !important;
    overflow-y: visible !important;
    width: 100%;
    max-width: 100%;
  }

  .main-table {
    min-width: 0 !important;
    width: 100%;
  }

  .skill-badge-full {
    display: none;
  }

  .skill-badge-short {
    display: inline;
  }

  /* Hide vendor/market profit — Best Profit/hr covers it */
  .main-table td[data-label='Vendor Profit/hr'],
  .main-table td[data-label='Market Profit/hr'] {
    display: none;
  }

  /* Row 1: Name + badge takes full width */
  .main-table td.name-cell {
    width: 100%;
    order: -3;
  }

  /* Row 2: Profit/hr hero value, full width with heatmap */
  .main-table td.profit-hr {
    width: 100%;
    order: -2;
    justify-content: space-between;
  }

  /* Row 3: Items/hr + Cost compact inline at 50% width */
  .main-table td[data-label='Items/hr'],
  .main-table td[data-label='Cost'] {
    display: inline-flex;
    width: 50%;
    order: -1;
    font-size: 0.8125rem;
    color: var(--text-secondary);
    padding: 0.125rem 0.375rem;
  }
}

@media (max-width: 767px) {
  .main-table th,
  .main-table td {
    padding: 0.25rem 0.5rem;
  }
}

@media (max-width: 640px) {
  .main-table th,
  .main-table td {
    font-size: 0.8125rem;
  }
}
</style>

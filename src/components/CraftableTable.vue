<script setup lang="ts">
import { ref, computed } from 'vue'
import type { CraftableProfitResult } from '../calculators/craftableCalculator'
import EditableValue from './EditableValue.vue'
import EmptyState from './EmptyState.vue'
import { useHeatmap } from '../composables/useHeatmap'
import { useStaticMode } from '../composables/useStaticMode'

const { getHeatmapStyle, getSubduedHeatmapStyle } = useHeatmap()
const { isStaticMode } = useStaticMode()

const props = defineProps<{
  craftables: CraftableProfitResult[]
}>()

// Emit events for editing values
const emit = defineEmits<{
  (e: 'update:materialPrice', craftableName: string, materialName: string, value: number): void
  (e: 'update:marketPrice', craftableName: string, value: number): void
  (e: 'update:craftTime', craftableName: string, value: number): void
  (e: 'delete:craftable', craftableName: string): void
}>()

// Expanded rows tracking
const expandedRows = ref<Set<string>>(new Set())

// Sub-tab configuration
type CraftableSubTab = 'alchemy' | 'forging'
const activeSubTab = ref<CraftableSubTab>('alchemy')

// Sort configuration
type SortKey = 'name' | 'totalCost' | 'currentPrice' | 'profit' | 'profitPerHour'
type SortOrder = 'asc' | 'desc'

const sortKey = ref<SortKey>('profitPerHour')
const sortOrder = ref<SortOrder>('desc')

// Computed sorted craftables
const sortedCraftables = computed(() => {
  const craftables = [...props.craftables]

  craftables.sort((a, b) => {
    let aValue: number | string
    let bValue: number | string

    switch (sortKey.value) {
      case 'name':
        aValue = a.name
        bValue = b.name
        break
      case 'totalCost':
        aValue = a.totalCost
        bValue = b.totalCost
        break
      case 'currentPrice':
        aValue = a.currentPrice
        bValue = b.currentPrice
        break
      case 'profit':
        aValue = a.profit
        bValue = b.profit
        break
      case 'profitPerHour':
        aValue = a.profitPerHour
        bValue = b.profitPerHour
        break
      default:
        aValue = a.profitPerHour
        bValue = b.profitPerHour
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder.value === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
    }

    return sortOrder.value === 'asc'
      ? (aValue as number) - (bValue as number)
      : (bValue as number) - (aValue as number)
  })

  return craftables
})

// Filter craftables by active sub-tab
const filteredCraftables = computed(() => {
  return sortedCraftables.value.filter((p) => p.skill === activeSubTab.value)
})

// Toggle row expansion
const toggleRow = (craftableName: string) => {
  if (expandedRows.value.has(craftableName)) {
    expandedRows.value.delete(craftableName)
  } else {
    expandedRows.value.add(craftableName)
  }
}

// Check if row is expanded
const isExpanded = (craftableName: string): boolean => {
  return expandedRows.value.has(craftableName)
}

// Toggle sort
const toggleSort = (key: SortKey) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'desc'
  }
}

// Display limit for pagination
const DEFAULT_DISPLAY_LIMIT = 25
const showAllCraftables = ref(false)

const displayedCraftables = computed(() => {
  const all = filteredCraftables.value
  if (showAllCraftables.value || all.length <= DEFAULT_DISPLAY_LIMIT) return all
  return all.slice(0, DEFAULT_DISPLAY_LIMIT)
})

const hasMoreCraftables = computed(() => filteredCraftables.value.length > DEFAULT_DISPLAY_LIMIT)

// Format numbers
const formatNumber = (num: number): string => {
  return Math.round(num).toLocaleString()
}

// Get sort icon
const getSortIcon = (key: SortKey): string => {
  if (sortKey.value !== key) return '↕'
  return sortOrder.value === 'asc' ? '↑' : '↓'
}

// Tooltip positioning for fixed tooltips (escapes table stacking contexts)
const onTooltipHover = (event: MouseEvent) => {
  const target = event.currentTarget as HTMLElement
  const tooltip = target.querySelector('.tooltip') as HTMLElement | null
  if (!tooltip) return

  const rect = target.getBoundingClientRect()
  tooltip.style.left = `${rect.left + rect.width / 2}px`
  tooltip.style.top = `${rect.top - 8}px`
  tooltip.style.transform = 'translate(-50%, -100%)'
}

// Calculate profit range for heatmap
const profitRange = computed(() => {
  // Guard against empty array: Math.min/max of empty array returns Infinity/-Infinity
  if (filteredCraftables.value.length === 0) {
    return {
      profit: { min: 0, max: 0 },
      profitPerHour: { min: 0, max: 0 },
    }
  }

  const profits = filteredCraftables.value.map((p) => p.profit)
  const profitHours = filteredCraftables.value.map((p) => p.profitPerHour)
  return {
    profit: {
      min: Math.min(...profits),
      max: Math.max(...profits),
    },
    profitPerHour: {
      min: Math.min(...profitHours),
      max: Math.max(...profitHours),
    },
  }
})

// Handle inline editing
const handleMaterialPriceUpdate = (craftableName: string, materialName: string, value: number) => {
  emit('update:materialPrice', craftableName, materialName, value)
}

const handleMarketPriceUpdate = (craftableName: string, value: number) => {
  emit('update:marketPrice', craftableName, value)
}

const handleCraftTimeUpdate = (craftableName: string, value: number) => {
  emit('update:craftTime', craftableName, value)
}

// Format seconds into a readable string
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  if (mins === 0) return `${secs}s`
  if (secs === 0) return `${mins}m`
  return `${mins}m ${secs}s`
}
</script>

<template>
  <div class="craftable-table">
    <!-- Sub-tab navigation -->
    <div class="sub-tab-navigation">
      <button
        class="sub-tab-button sub-tab-alchemy"
        :class="{ active: activeSubTab === 'alchemy' }"
        @click="activeSubTab = 'alchemy'"
      >
        Alchemy
      </button>
      <button
        class="sub-tab-button sub-tab-forging"
        :class="{ active: activeSubTab === 'forging' }"
        @click="activeSubTab = 'forging'"
      >
        Forging
      </button>
      <span v-if="hasMoreCraftables && !showAllCraftables" class="pagination-info-inline">
        {{ DEFAULT_DISPLAY_LIMIT }}/{{ filteredCraftables.length }}
        <button class="btn-show-all-inline" @click="showAllCraftables = true">all</button>
      </span>
    </div>

    <div class="table-container">
      <!-- Empty state when no craftables match the active sub-tab -->
      <EmptyState
        v-if="filteredCraftables.length === 0"
        icon="🧪"
        title="No craftables found"
        description="No craftables match this category yet. Add craftables from the Market tab."
      />

      <table
        v-else
        class="main-table mobile-card-layout"
        role="grid"
        aria-label="Craftable profitability"
      >
        <thead>
          <tr>
            <th class="expand-col"></th>
            <th class="sortable" @click="toggleSort('name')">
              Craftable Name <span class="sort-icon">{{ getSortIcon('name') }}</span>
            </th>
            <th class="sortable text-right" @click="toggleSort('totalCost')">
              Total Cost <span class="sort-icon">{{ getSortIcon('totalCost') }}</span>
            </th>
            <th class="sortable text-right" @click="toggleSort('currentPrice')">
              Market Price <span class="sort-icon">{{ getSortIcon('currentPrice') }}</span>
            </th>
            <th class="sortable text-right" @click="toggleSort('profit')">
              Profit <span class="sort-icon">{{ getSortIcon('profit') }}</span>
            </th>
            <th class="sortable text-right" @click="toggleSort('profitPerHour')">
              Profit/hr <span class="sort-icon">{{ getSortIcon('profitPerHour') }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="craftable in displayedCraftables" :key="craftable.name">
            <!-- Main Row -->
            <tr class="main-row" :class="{ expanded: isExpanded(craftable.name) }">
              <td class="expand-col" data-label="">
                <button
                  class="expand-button"
                  :class="{ expanded: isExpanded(craftable.name) }"
                  :title="isExpanded(craftable.name) ? 'Collapse' : 'Expand'"
                  :aria-label="`${isExpanded(craftable.name) ? 'Collapse' : 'Expand'} ${craftable.name} details`"
                  :aria-expanded="isExpanded(craftable.name)"
                  @click="toggleRow(craftable.name)"
                >
                  <svg class="expand-icon" :class="{ expanded: isExpanded(craftable.name) }" viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>
                </button>
              </td>
              <td class="name-cell" data-label="Craftable">
                {{ craftable.name }}
                <button
                  v-if="!isStaticMode"
                  class="btn-delete-craftable"
                  title="Remove from craftable list"
                  @click.stop="emit('delete:craftable', craftable.name)"
                >
                  ✕
                </button>
              </td>
              <td class="text-right" data-label="Total Cost">
                {{ formatNumber(craftable.totalCost) }}
              </td>
              <td class="text-right" data-label="Market Price">
                <EditableValue
                  :model-value="craftable.currentPrice"
                  :default-value="craftable.currentPrice"
                  @update:model-value="(value) => handleMarketPriceUpdate(craftable.name, value)"
                />
              </td>
              <td
                class="text-right"
                data-label="Profit"
                :style="
                  getSubduedHeatmapStyle(craftable.profit, profitRange.profit.min, profitRange.profit.max)
                "
              >
                <span
                  v-if="craftable.hasRecipeCost"
                  class="profit-with-tooltip"
                  @mouseenter="onTooltipHover"
                >
                  {{ formatNumber(craftable.profit) }}
                  <span
                    class="recipe-indicator"
                    :title="`Has recipe cost from ${craftable.tradableRecipeName}`"
                    >ⓡ</span
                  >
                  <div class="tooltip">
                    <div class="tooltip-content">
                      <div class="tooltip-title">Dual Profitability</div>
                      <div class="tooltip-row">
                        <span class="tooltip-label">With recipe cost:</span>
                        <span class="tooltip-value">{{ formatNumber(craftable.profit) }} gold</span>
                      </div>
                      <div v-if="craftable.profitWithRecipeCost !== undefined" class="tooltip-row">
                        <span class="tooltip-label">Without recipe:</span>
                        <span class="tooltip-value"
                          >{{ formatNumber(craftable.profitWithRecipeCost) }} gold</span
                        >
                      </div>
                      <hr class="tooltip-divider" />
                      <div class="tooltip-row small">
                        <span class="tooltip-label">Recipe:</span>
                        <span class="tooltip-value">{{ craftable.tradableRecipeName }}</span>
                      </div>
                      <div
                        v-if="craftable.tradableRecipePrice !== undefined"
                        class="tooltip-row small"
                      >
                        <span class="tooltip-label">Recipe price:</span>
                        <span class="tooltip-value"
                          >{{ formatNumber(craftable.tradableRecipePrice) }} gold</span
                        >
                      </div>
                      <div v-if="craftable.recipeUses !== undefined" class="tooltip-row small">
                        <span class="tooltip-label">Uses:</span>
                        <span class="tooltip-value">{{ craftable.recipeUses }}x</span>
                      </div>
                      <div
                        v-if="craftable.recipeCostPerCraft !== undefined"
                        class="tooltip-row small"
                      >
                        <span class="tooltip-label">Cost per craft:</span>
                        <span class="tooltip-value"
                          >{{ formatNumber(craftable.recipeCostPerCraft) }} gold</span
                        >
                      </div>
                    </div>
                  </div>
                </span>
                <span v-else>{{ formatNumber(craftable.profit) }}</span>
              </td>
              <td
                class="text-right profit-hr"
                data-label="Profit/hr"
                :style="
                  getHeatmapStyle(
                    craftable.profitPerHour,
                    profitRange.profitPerHour.min,
                    profitRange.profitPerHour.max
                  )
                "
              >
                <span
                  v-if="craftable.hasRecipeCost"
                  class="profit-with-tooltip"
                  @mouseenter="onTooltipHover"
                >
                  {{ formatNumber(craftable.profitPerHour) }}
                  <span
                    class="recipe-indicator"
                    :title="`Has recipe cost from ${craftable.tradableRecipeName}`"
                    >ⓡ</span
                  >
                  <div class="tooltip">
                    <div class="tooltip-content">
                      <div class="tooltip-title">Dual Profitability (per hour)</div>
                      <div class="tooltip-row">
                        <span class="tooltip-label">With recipe cost:</span>
                        <span class="tooltip-value"
                          >{{ formatNumber(craftable.profitPerHour) }} gold/hr</span
                        >
                      </div>
                      <div
                        v-if="craftable.profitPerHourWithRecipeCost !== undefined"
                        class="tooltip-row"
                      >
                        <span class="tooltip-label">Without recipe:</span>
                        <span class="tooltip-value"
                          >{{ formatNumber(craftable.profitPerHourWithRecipeCost) }} gold/hr</span
                        >
                      </div>
                      <hr class="tooltip-divider" />
                      <div class="tooltip-row small">
                        <span class="tooltip-label">Recipe:</span>
                        <span class="tooltip-value">{{ craftable.tradableRecipeName }}</span>
                      </div>
                      <div
                        v-if="craftable.tradableRecipePrice !== undefined"
                        class="tooltip-row small"
                      >
                        <span class="tooltip-label">Recipe price:</span>
                        <span class="tooltip-value"
                          >{{ formatNumber(craftable.tradableRecipePrice) }} gold</span
                        >
                      </div>
                      <div v-if="craftable.recipeUses !== undefined" class="tooltip-row small">
                        <span class="tooltip-label">Uses:</span>
                        <span class="tooltip-value">{{ craftable.recipeUses }}x</span>
                      </div>
                      <div
                        v-if="craftable.recipeCostPerCraft !== undefined"
                        class="tooltip-row small"
                      >
                        <span class="tooltip-label">Cost per craft:</span>
                        <span class="tooltip-value"
                          >{{ formatNumber(craftable.recipeCostPerCraft) }} gold</span
                        >
                      </div>
                    </div>
                  </div>
                </span>
                <span v-else>{{ formatNumber(craftable.profitPerHour) }}</span>
              </td>
            </tr>

            <!-- Expanded Row: Material Breakdown -->
            <tr v-if="isExpanded(craftable.name)" class="expanded-row">
              <td colspan="6" class="expanded-content">
                <div class="material-breakdown">
                  <h4 class="breakdown-title">Material Breakdown</h4>
                  <table class="material-table">
                    <thead>
                      <tr>
                        <th>Material Name</th>
                        <th class="text-right">Quantity</th>
                        <th class="text-right">Unit Price</th>
                        <th class="text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="material in craftable.materials" :key="material.name">
                        <td>{{ material.name }}</td>
                        <td class="text-right">{{ material.quantity }}</td>
                        <td class="text-right">
                          <EditableValue
                            :model-value="material.unitCost"
                            :default-value="material.unitCost"
                            @update:model-value="
                              (value) =>
                                handleMaterialPriceUpdate(craftable.name, material.name, value)
                            "
                          />
                        </td>
                        <td class="text-right subtotal">{{ formatNumber(material.totalCost) }}</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr class="total-row">
                        <td colspan="3" class="text-right total-label">Total Cost:</td>
                        <td class="text-right total-value">
                          {{ formatNumber(craftable.totalCost) }}
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  <!-- Craft Time -->
                  <div class="craft-time-row">
                    <span class="craft-time-label">Craft Time:</span>
                    <EditableValue
                      :model-value="craftable.craftTimeSeconds"
                      :default-value="craftable.craftTimeSeconds"
                      @update:model-value="(value) => handleCraftTimeUpdate(craftable.name, value)"
                    />
                    <span class="craft-time-display"
                      >({{ formatTime(craftable.craftTimeSeconds) }})</span
                    >
                  </div>

                  <!-- Recipe Cost Information -->
                  <div v-if="craftable.hasRecipeCost" class="recipe-cost-section">
                    <h4 class="breakdown-title">Recipe Cost (Dual Profitability)</h4>
                    <div class="recipe-info">
                      <div class="recipe-info-row">
                        <span class="recipe-info-label">Recipe:</span>
                        <span class="recipe-info-value">{{ craftable.tradableRecipeName }}</span>
                      </div>
                      <div
                        v-if="craftable.tradableRecipePrice !== undefined"
                        class="recipe-info-row"
                      >
                        <span class="recipe-info-label">Recipe Market Price:</span>
                        <span class="recipe-info-value"
                          >{{ formatNumber(craftable.tradableRecipePrice) }} gold</span
                        >
                      </div>
                      <div v-if="craftable.recipeUses !== undefined" class="recipe-info-row">
                        <span class="recipe-info-label">Recipe Uses:</span>
                        <span class="recipe-info-value">{{ craftable.recipeUses }}x</span>
                      </div>
                      <div
                        v-if="craftable.recipeCostPerCraft !== undefined"
                        class="recipe-info-row"
                      >
                        <span class="recipe-info-label">Amortized Cost per Craft:</span>
                        <span class="recipe-info-value"
                          >{{ formatNumber(craftable.recipeCostPerCraft) }} gold</span
                        >
                      </div>
                      <hr class="recipe-divider" />
                      <div class="recipe-info-row highlight">
                        <span class="recipe-info-label">Profit (with recipe cost):</span>
                        <span class="recipe-info-value"
                          >{{ formatNumber(craftable.profit) }} gold</span
                        >
                      </div>
                      <div class="recipe-info-row highlight">
                        <span class="recipe-info-label">Profit/hr (with recipe cost):</span>
                        <span class="recipe-info-value"
                          >{{ formatNumber(craftable.profitPerHour) }} gold/hr</span
                        >
                      </div>
                      <div
                        v-if="craftable.profitWithRecipeCost !== undefined"
                        class="recipe-info-row highlight"
                      >
                        <span class="recipe-info-label">Profit (without recipe):</span>
                        <span class="recipe-info-value"
                          >{{ formatNumber(craftable.profitWithRecipeCost) }} gold</span
                        >
                      </div>
                      <div
                        v-if="craftable.profitPerHourWithRecipeCost !== undefined"
                        class="recipe-info-row highlight"
                      >
                        <span class="recipe-info-label">Profit/hr (without recipe):</span>
                        <span class="recipe-info-value"
                          >{{ formatNumber(craftable.profitPerHourWithRecipeCost) }} gold/hr</span
                        >
                      </div>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <div v-if="hasMoreCraftables && !showAllCraftables" class="show-more-container">
        <button class="btn-show-more" @click="showAllCraftables = true">
          Show all ({{ filteredCraftables.length }})
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.craftable-table {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 1320px;
  margin: 0 auto;
}

.btn-show-all-inline {
  background: none;
  border: none;
  color: var(--accent-primary);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
  margin-left: 0.25rem;
}

.btn-show-all-inline:hover {
  color: var(--text-primary);
}

.show-more-container {
  display: flex;
  justify-content: center;
  padding: 0.5rem 0;
}

.btn-show-more {
  padding: 0.375rem 1rem;
  background-color: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-show-more:hover {
  background-color: var(--bg-tertiary);
  color: var(--accent-primary);
  border-color: var(--accent-primary);
}

@media (max-width: 767px) {
  .btn-show-more {
    width: auto;
    padding: 0.375rem 1rem;
    font-weight: 600;
  }
}

/* Sub-tab Navigation — underline-style to match main tabs */
.sub-tab-navigation {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0;
  border-bottom: 2px solid var(--border-color);
  margin-bottom: 0.5rem;
}

.sub-tab-button {
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  background-color: transparent;
  color: var(--text-secondary);
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  text-transform: capitalize;
  min-height: 44px;
  position: relative;
}

.sub-tab-button::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 0;
  height: 2px;
  background-color: var(--accent-primary);
  transform: translateX(-50%);
  transition: width 0.2s ease-in-out;
}

.sub-tab-button:hover {
  color: var(--text-primary);
  background-color: rgba(255, 255, 255, 0.03);
}

.sub-tab-button:hover::before {
  width: 80%;
}

.sub-tab-button.active {
  border-bottom-color: var(--accent-primary);
}

.sub-tab-button.active::before {
  width: 100%;
}

/* Alchemy: teal/emerald to match potion theme */
.sub-tab-alchemy.active {
  color: #4ade80;
  border-bottom-color: #4ade80;
  background-color: rgba(34, 197, 94, 0.05);
}

.sub-tab-alchemy.active::before {
  background-color: #4ade80;
}

/* Forging: amber/orange to match metalwork theme */
.sub-tab-forging.active {
  color: #fbbf24;
  border-bottom-color: #fbbf24;
  background-color: rgba(251, 191, 36, 0.05);
}

.sub-tab-forging.active::before {
  background-color: #fbbf24;
}

.pagination-info-inline {
  margin-left: auto;
  font-size: 0.6875rem;
  color: var(--text-secondary);
  white-space: nowrap;
  background-color: rgba(55, 65, 81, 0.4);
  padding: 0.1875rem 0.5rem;
  border-radius: 1rem;
  font-weight: 500;
  border: 1px solid var(--border-color);
}


/* Table Container */
.table-container {
  background: linear-gradient(180deg, #1e2436 0%, var(--bg-secondary) 100%);
  border: 1px solid rgba(55, 65, 81, 0.7);
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
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

.main-table tbody tr.main-row {
  border-bottom: 1px solid var(--border-color);
  transition: all 0.2s ease-in-out;
}

.main-table tbody tr.main-row:nth-child(even) {
  background-color: rgba(255, 255, 255, 0.04);
}

.main-table tbody tr.main-row:hover {
  background-color: var(--bg-tertiary);
  transform: translateX(4px);
  box-shadow: -4px 0 0 0 var(--accent-primary);
}

.main-table tbody tr.main-row.expanded {
  background-color: var(--bg-tertiary);
  box-shadow: -4px 0 0 0 var(--accent-primary);
}

.main-table td {
  padding: 0.625rem 0.75rem;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.text-right {
  text-align: right;
}

/* Expand Column */
.expand-col {
  width: 2.5rem;
}

.expand-button {
  padding: 0;
  min-height: 32px;
  min-width: 32px;
  width: 32px;
  height: 32px;
  background-color: rgba(55, 65, 81, 0.2);
  color: var(--text-secondary);
  border: 1px solid rgba(55, 65, 81, 0.5);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.65;
}

.expand-button:hover {
  opacity: 1;
  background-color: rgba(59, 130, 246, 0.1);
  color: var(--accent-primary);
  border-color: var(--accent-primary);
}

.expand-button:active {
  transform: scale(0.95);
}

.expand-button.expanded {
  opacity: 1;
  background-color: rgba(59, 130, 246, 0.15);
  color: var(--accent-primary);
  border-color: var(--accent-primary);
}

.expand-icon {
  transition: transform 0.25s ease;
  transform: rotate(-90deg);
}

.expand-icon.expanded {
  transform: rotate(0deg);
}

/* Name Cell */
.name-cell {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-delete-craftable {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.875rem;
  padding: 0.5rem 0.75rem;
  min-height: 44px;
  min-width: 44px;
  border-radius: 0.25rem;
  opacity: 0;
  transition:
    opacity 0.2s,
    color 0.2s,
    background-color 0.2s;
  margin-left: auto;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.main-row:hover .btn-delete-craftable {
  opacity: 0.6;
}

.btn-delete-craftable:hover {
  opacity: 1 !important;
  color: var(--error, #ef4444);
  background-color: rgba(239, 68, 68, 0.1);
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

/* Expanded Row */
.expanded-row {
  background-color: var(--bg-primary);
}

.expanded-content {
  padding: 0 !important;
}

.material-breakdown {
  padding: 1.5rem;
  border-top: 2px solid var(--border-color);
}

.breakdown-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

/* Material Table */
.material-table {
  width: 100%;
  border-collapse: collapse;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  overflow: hidden;
}

.material-table thead {
  background-color: var(--bg-tertiary);
}

.material-table th {
  padding: 0.75rem;
  text-align: left;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  font-weight: 600;
}

.material-table th.text-right {
  text-align: right;
}

.material-table tbody tr {
  border-bottom: 1px solid var(--border-color);
}

.material-table tbody tr:hover {
  background-color: var(--bg-tertiary);
}

.material-table td {
  padding: 0.75rem;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.subtotal {
  font-weight: 600;
  color: var(--text-accent);
}

/* Material Table Footer */
.material-table tfoot {
  background-color: var(--bg-tertiary);
  border-top: 2px solid var(--border-color);
}

.total-row {
  font-weight: 600;
}

.total-label {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.total-value {
  color: var(--warning);
  font-size: 1rem;
  font-weight: 700;
}

/* Responsive */
@media (max-width: 1200px) {
  .table-container {
    overflow-x: auto;
  }

  .main-table {
    min-width: 1000px;
  }
}

/* Mobile card layout overrides */
@media (max-width: 767px) {
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
}

@media (max-width: 767px) {
  .craftable-table {
    gap: 0.375rem;
  }

  .sub-tab-navigation {
    gap: 0.25rem;
    margin-bottom: 0.25rem;
  }

  .sub-tab-button {
    min-height: 36px;
    padding: 0.375rem 0.5rem;
    font-size: 0.8125rem;
    flex: 0 0 auto;
  }

  .expand-button {
    min-height: 40px;
    min-width: 40px;
    width: 40px;
    height: 40px;
    padding: 0;
    font-size: 1rem;
    opacity: 0.7;
  }

  .btn-delete-craftable {
    min-height: 48px;
    min-width: 48px;
    padding: 0.75rem 1rem;
    font-size: 1rem;
  }
}

@media (max-width: 767px) {
  .main-table th,
  .main-table td {
    padding: 0.25rem 0.5rem;
  }

  /* Un-hide Market Price on Craftables mobile — pairs with Total Cost at 50% each */
  .craftable-table :deep(.mobile-card-layout td[data-label='Market Price']) {
    display: inline-flex;
    width: 50%;
    font-size: 0.8125rem;
    color: var(--text-secondary);
    padding: 0.125rem 0.375rem;
  }

  /* Shorten "MARKET PRICE" label to "PRICE" for compact mobile cards */
  .craftable-table :deep(.mobile-card-layout td[data-label='Market Price'])::before {
    content: 'PRICE';
  }
}

@media (max-width: 640px) {
  .main-table th,
  .main-table td {
    font-size: 0.8125rem;
  }

  .material-breakdown {
    padding: 1rem;
  }
}

/* Tooltip Styles */
.profit-with-tooltip {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.recipe-indicator {
  display: inline-block;
  font-size: 0.75rem;
  color: var(--accent-primary);
  cursor: help;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.recipe-indicator:hover {
  opacity: 1;
}

.tooltip {
  position: fixed;
  display: none;
  z-index: 9999;
  pointer-events: none;
}

.profit-with-tooltip:hover .tooltip {
  display: block;
}

.tooltip-content {
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  padding: 0.75rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  white-space: nowrap;
  min-width: 250px;
}

.tooltip-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color);
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.375rem 0;
  font-size: 0.875rem;
}

.tooltip-row.small {
  font-size: 0.75rem;
  opacity: 0.9;
}

.tooltip-label {
  color: var(--text-secondary);
}

.tooltip-value {
  color: var(--text-primary);
  font-weight: 500;
}

.tooltip-divider {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: 0.5rem 0;
}

/* Mobile: Hide tooltips on touch devices, show in expanded view instead */
@media (max-width: 767px) {
  .tooltip {
    display: none !important;
  }

  .recipe-indicator {
    font-size: 0.875rem;
  }
}

/* Recipe Cost Section (Expanded View) */
.craft-time-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  font-size: 0.875rem;
}

.craft-time-label {
  color: var(--text-secondary);
  font-weight: 500;
}

.craft-time-display {
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.recipe-cost-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 2px solid var(--border-color);
}

.recipe-info {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  padding: 1rem;
}

.recipe-info-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  font-size: 0.875rem;
}

.recipe-info-row.highlight {
  font-weight: 600;
  padding-top: 0.75rem;
}

.recipe-info-label {
  color: var(--text-secondary);
}

.recipe-info-value {
  color: var(--text-primary);
  font-weight: 500;
}

.recipe-divider {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: 0.75rem 0;
}
</style>

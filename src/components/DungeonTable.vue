<script setup lang="ts">
import { ref, computed } from 'vue'
import type { DungeonProfitResult } from '../calculators/dungeonCalculator'
import EditableValue from './EditableValue.vue'
import { useHeatmap } from '../composables/useHeatmap'

const { getHeatmapStyle } = useHeatmap()

const props = defineProps<{
  dungeons: DungeonProfitResult[]
}>()

// Emit events for editing values
const emit = defineEmits<{
  (e: 'update:runCost', dungeonName: string, value: number): void
  (e: 'update:timeSeconds', dungeonName: string, value: number): void
}>()

// Expanded rows tracking
const expandedRows = ref<Set<string>>(new Set())

// Sort configuration
type SortKey =
  | 'name'
  | 'runCost'
  | 'timeSeconds'
  | 'expectedValue'
  | 'totalProfit'
  | 'profitPerHour'
type SortOrder = 'asc' | 'desc'

const sortKey = ref<SortKey>('profitPerHour')
const sortOrder = ref<SortOrder>('desc')

// Computed sorted dungeons
const sortedDungeons = computed(() => {
  const dungeons = [...props.dungeons]

  dungeons.sort((a, b) => {
    let aValue: number | string
    let bValue: number | string

    switch (sortKey.value) {
      case 'name':
        aValue = a.name
        bValue = b.name
        break
      case 'runCost':
        aValue = a.runCost
        bValue = b.runCost
        break
      case 'timeSeconds':
        aValue = a.timeSeconds
        bValue = b.timeSeconds
        break
      case 'expectedValue':
        aValue = a.drops.reduce((sum, drop) => sum + drop.expectedValue, 0)
        bValue = b.drops.reduce((sum, drop) => sum + drop.expectedValue, 0)
        break
      case 'totalProfit':
        aValue = a.totalProfit
        bValue = b.totalProfit
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

  return dungeons
})

// Toggle row expansion
const toggleRow = (dungeonName: string) => {
  if (expandedRows.value.has(dungeonName)) {
    expandedRows.value.delete(dungeonName)
  } else {
    expandedRows.value.add(dungeonName)
  }
}

// Check if row is expanded
const isExpanded = (dungeonName: string): boolean => {
  return expandedRows.value.has(dungeonName)
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

// Format numbers
const formatNumber = (num: number): string => {
  return Math.round(num).toLocaleString()
}

// Format time (seconds to human-readable)
const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.round(seconds % 60)
  if (hours > 0) {
    return secs > 0 ? `${hours}h ${mins}m ${secs}s` : `${hours}h ${mins}m`
  }
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

// Format percentage
const formatPercent = (value: number): string => {
  return `${(value * 100).toFixed(2)}%`
}

// Get sort icon
const getSortIcon = (key: SortKey): string => {
  if (sortKey.value !== key) return '↕'
  return sortOrder.value === 'asc' ? '↑' : '↓'
}

// Calculate total expected value for a dungeon
const getTotalExpectedValue = (dungeon: DungeonProfitResult): number => {
  return dungeon.drops.reduce((sum, drop) => sum + drop.expectedValue, 0)
}

// Handle inline editing
const handleRunCostUpdate = (dungeonName: string, value: number) => {
  emit('update:runCost', dungeonName, value)
}

const handleTimeUpdate = (dungeonName: string, value: number) => {
  emit('update:timeSeconds', dungeonName, value)
}

// Calculate profit range for heatmap
const profitRange = computed(() => {
  const profitHours = props.dungeons.map((d) => d.profitPerHour)
  const totalProfits = props.dungeons.map((d) => d.totalProfit)
  return {
    profitPerHour: {
      min: Math.min(...profitHours),
      max: Math.max(...profitHours),
    },
    totalProfit: {
      min: Math.min(...totalProfits),
      max: Math.max(...totalProfits),
    },
  }
})

// Check if a recipe is untradable (has computed price)
const isUntradableRecipe = (recipeName: string): boolean => {
  return recipeName.includes('(Untradable)')
}
</script>

<template>
  <div class="dungeon-table">
    <div class="table-container">
      <table class="main-table mobile-card-layout" role="grid" aria-label="Dungeon profitability">
        <thead>
          <tr>
            <th class="expand-col"></th>
            <th class="sortable" @click="toggleSort('name')">
              Dungeon Name <span class="sort-icon">{{ getSortIcon('name') }}</span>
            </th>
            <th class="sortable text-right" @click="toggleSort('runCost')">
              Run Cost <span class="sort-icon">{{ getSortIcon('runCost') }}</span>
            </th>
            <th class="sortable text-right" @click="toggleSort('timeSeconds')">
              Time <span class="sort-icon">{{ getSortIcon('timeSeconds') }}</span>
            </th>
            <th class="sortable text-right" @click="toggleSort('expectedValue')">
              Expected Value <span class="sort-icon">{{ getSortIcon('expectedValue') }}</span>
            </th>
            <th class="sortable text-right" @click="toggleSort('totalProfit')">
              Profit <span class="sort-icon">{{ getSortIcon('totalProfit') }}</span>
            </th>
            <th class="sortable text-right" @click="toggleSort('profitPerHour')">
              Profit/hr <span class="sort-icon">{{ getSortIcon('profitPerHour') }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="dungeon in sortedDungeons" :key="dungeon.name">
            <!-- Main Row -->
            <tr class="main-row" :class="{ expanded: isExpanded(dungeon.name), 'negative-profit': dungeon.totalProfit < 0 }">
              <td class="expand-col" data-label="">
                <button
                  class="expand-button"
                  :class="{ expanded: isExpanded(dungeon.name) }"
                  :title="isExpanded(dungeon.name) ? 'Collapse' : 'Expand'"
                  :aria-label="`${isExpanded(dungeon.name) ? 'Collapse' : 'Expand'} ${dungeon.name} details`"
                  :aria-expanded="isExpanded(dungeon.name)"
                  @click="toggleRow(dungeon.name)"
                >
                  <svg class="expand-icon" :class="{ expanded: isExpanded(dungeon.name) }" viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>
                </button>
              </td>
              <td class="name-cell" data-label="Dungeon">{{ dungeon.name }}</td>
              <td class="text-right" data-label="Run Cost">
                <EditableValue
                  :model-value="dungeon.runCost"
                  :default-value="dungeon.runCost"
                  @update:model-value="(value) => handleRunCostUpdate(dungeon.name, value)"
                />
              </td>
              <td class="text-right" data-label="Time">
                <span class="time-display">
                  <EditableValue
                    :model-value="dungeon.timeSeconds"
                    :default-value="dungeon.timeSeconds"
                    suffix="s"
                    @update:model-value="(value) => handleTimeUpdate(dungeon.name, value)"
                  />
                  <span class="time-formatted">({{ formatTime(dungeon.timeSeconds) }})</span>
                </span>
              </td>
              <td class="text-right" data-label="Expected Value">
                {{ formatNumber(getTotalExpectedValue(dungeon)) }}
              </td>
              <td
                class="text-right"
                data-label="Profit"
                :style="
                  getHeatmapStyle(
                    dungeon.totalProfit,
                    profitRange.totalProfit.min,
                    profitRange.totalProfit.max
                  )
                "
              >
                {{ formatNumber(dungeon.totalProfit) }}
              </td>
              <td
                class="text-right profit-hr"
                data-label="Profit/hr"
                :style="
                  getHeatmapStyle(
                    dungeon.profitPerHour,
                    profitRange.profitPerHour.min,
                    profitRange.profitPerHour.max
                  )
                "
              >
                {{ formatNumber(dungeon.profitPerHour) }}
              </td>
            </tr>

            <!-- Expanded Row: Drop Breakdown -->
            <tr v-if="isExpanded(dungeon.name)" class="expanded-row">
              <td colspan="7" class="expanded-content">
                <div class="drop-breakdown">
                  <h4 class="breakdown-title">Drop Breakdown</h4>
                  <table class="drop-table">
                    <thead>
                      <tr>
                        <th>Item Name</th>
                        <th class="text-right">Price</th>
                        <th class="text-right">Chance</th>
                        <th class="text-right">MF-Adjusted Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="drop in dungeon.drops" :key="drop.recipeName">
                        <td>{{ drop.recipeName }}</td>
                        <td class="text-right">
                          <span v-if="isUntradableRecipe(drop.recipeName)" class="computed-price">
                            {{ formatNumber(drop.price) }}
                            <span
                              class="computed-indicator"
                              title="Price computed from craftable profitability"
                              >ⓒ</span
                            >
                          </span>
                          <span v-else>{{ formatNumber(drop.price) }}</span>
                        </td>
                        <td class="text-right">{{ formatPercent(drop.chance) }}</td>
                        <td class="text-right expected-value">
                          {{ formatNumber(drop.expectedValue) }}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr class="total-row">
                        <td colspan="3" class="text-right total-label">Total Expected Value:</td>
                        <td class="text-right total-value">
                          {{ formatNumber(getTotalExpectedValue(dungeon)) }}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.dungeon-table {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 1320px;
  margin: 0 auto;
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
  background-color: var(--bg-tertiary);
  border-bottom: 2px solid rgba(96, 165, 250, 0.2);
}

.main-table th {
  padding: 0.625rem 0.75rem;
  text-align: left;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #e5e7eb;
  font-weight: 600;
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
  background-color: rgba(255, 255, 255, 0.015);
}

.main-table tbody tr.main-row:hover {
  background-color: var(--bg-tertiary);
  transform: translateX(4px);
  box-shadow: -4px 0 0 0 var(--accent-primary);
}

.main-table tbody tr.main-row.negative-profit {
  box-shadow: -3px 0 0 0 var(--danger);
}

.main-table tbody tr.main-row.negative-profit:hover {
  box-shadow: -4px 0 0 0 var(--danger);
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
}

/* Profit Cells */
.profit {
  color: var(--success);
  font-weight: 600;
}

/* Time Display */
.time-display {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  white-space: nowrap;
}

.time-formatted {
  color: var(--text-secondary);
  font-size: 0.75rem;
  white-space: nowrap;
}

@media (max-width: 767px) {
  /* On mobile, hide raw seconds and show only human-readable time */
  .time-display :deep(.editable-value),
  .time-display :deep(.static-value) {
    display: none;
  }

  .time-formatted {
    color: var(--text-primary);
    font-size: 0.8125rem;
  }
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

.drop-breakdown {
  padding: 1.5rem;
  border-top: 2px solid var(--border-color);
}

.breakdown-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

/* Drop Table */
.drop-table {
  width: 100%;
  border-collapse: collapse;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  overflow: hidden;
}

.drop-table thead {
  background-color: var(--bg-tertiary);
}

.drop-table th {
  padding: 0.75rem;
  text-align: left;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  font-weight: 600;
}

.drop-table th.text-right {
  text-align: right;
}

.drop-table tbody tr {
  border-bottom: 1px solid var(--border-color);
}

.drop-table tbody tr:hover {
  background-color: var(--bg-tertiary);
}

.drop-table td {
  padding: 0.75rem;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.expected-value {
  font-weight: 600;
  color: var(--text-accent);
}

/* Drop Table Footer */
.drop-table tfoot {
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
  .dungeon-table {
    gap: 0.5rem;
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
}

@media (max-width: 767px) {
  .expand-button {
    min-height: 40px;
    min-width: 40px;
    width: 40px;
    height: 40px;
    padding: 0;
    font-size: 1rem;
    opacity: 0.7;
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

  .drop-breakdown {
    padding: 1rem;
  }
}

/* Computed Price Indicator */
.computed-price {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.computed-indicator {
  display: inline-block;
  font-size: 0.75rem;
  color: var(--accent-primary);
  cursor: help;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.computed-indicator:hover {
  opacity: 1;
}
</style>

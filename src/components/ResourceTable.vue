<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ResourceProfitResult } from '../calculators/resourceCalculator'
import EditableValue from './EditableValue.vue'
import { useHeatmap } from '../composables/useHeatmap'

const { getHeatmapStyle } = useHeatmap()

const props = defineProps<{
  resources: ResourceProfitResult[]
}>()

// Emit events for editing values
const emit = defineEmits<{
  (e: 'update:cost', resourceName: string, value: number): void
  (e: 'update:timeSeconds', resourceName: string, value: number): void
  (e: 'update:vendorValue', resourceName: string, value: number): void
  (e: 'update:marketPrice', resourceName: string, value: number): void
}>()

// Sort configuration
type SortKey =
  | 'name'
  | 'timeSeconds'
  | 'cost'
  | 'vendorValue'
  | 'marketPrice'
  | 'bestMethod'
  | 'bestProfitPerHour'
type SortOrder = 'asc' | 'desc'

const sortKey = ref<SortKey>('bestProfitPerHour')
const sortOrder = ref<SortOrder>('desc')

// Computed sorted resources
const sortedResources = computed(() => {
  const resources = [...props.resources]

  resources.sort((a, b) => {
    let aValue: number | string
    let bValue: number | string

    switch (sortKey.value) {
      case 'name':
        aValue = a.name
        bValue = b.name
        break
      case 'timeSeconds':
        aValue = a.timeSeconds
        bValue = b.timeSeconds
        break
      case 'cost':
        aValue = a.cost
        bValue = b.cost
        break
      case 'vendorValue':
        aValue = a.vendorValue
        bValue = b.vendorValue
        break
      case 'marketPrice':
        aValue = a.marketPrice
        bValue = b.marketPrice
        break
      case 'bestMethod':
        aValue = a.bestMethod
        bValue = b.bestMethod
        break
      case 'bestProfitPerHour':
        aValue = a.bestProfitPerHour
        bValue = b.bestProfitPerHour
        break
      default:
        aValue = a.bestProfitPerHour
        bValue = b.bestProfitPerHour
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder.value === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
    }

    return sortOrder.value === 'asc'
      ? (aValue as number) - (bValue as number)
      : (bValue as number) - (aValue as number)
  })

  return resources
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

// Get sort icon
const getSortIcon = (key: SortKey): string => {
  if (sortKey.value !== key) return '↕'
  return sortOrder.value === 'asc' ? '↑' : '↓'
}

// Calculate profit range for heatmap
const profitRange = computed(() => {
  const profitHours = props.resources.map((r) => r.bestProfitPerHour)
  const vendorProfits = props.resources.map((r) => r.vendorProfit)
  const marketProfits = props.resources.map((r) => r.marketProfit)
  return {
    profitPerHour: {
      min: Math.min(...profitHours),
      max: Math.max(...profitHours),
    },
    vendorProfit: {
      min: Math.min(...vendorProfits),
      max: Math.max(...vendorProfits),
    },
    marketProfit: {
      min: Math.min(...marketProfits),
      max: Math.max(...marketProfits),
    },
  }
})

// Handle inline editing
const handleCostUpdate = (resourceName: string, value: number) => {
  emit('update:cost', resourceName, value)
}

const handleTimeUpdate = (resourceName: string, value: number) => {
  emit('update:timeSeconds', resourceName, value)
}

const handleVendorValueUpdate = (resourceName: string, value: number) => {
  emit('update:vendorValue', resourceName, value)
}

const handleMarketPriceUpdate = (resourceName: string, value: number) => {
  emit('update:marketPrice', resourceName, value)
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
            <th class="sortable" @click="toggleSort('name')">Resource <span class="sort-icon">{{ getSortIcon('name') }}</span></th>
            <th class="sortable text-right" @click="toggleSort('timeSeconds')">
              Time <span class="sort-icon">{{ getSortIcon('timeSeconds') }}</span>
            </th>
            <th class="sortable text-right" @click="toggleSort('cost')">
              Cost <span class="sort-icon">{{ getSortIcon('cost') }}</span>
            </th>
            <th class="sortable text-right" @click="toggleSort('vendorValue')">
              Vendor Price <span class="sort-icon">{{ getSortIcon('vendorValue') }}</span>
            </th>
            <th class="sortable text-right" @click="toggleSort('marketPrice')">
              Market Price <span class="sort-icon">{{ getSortIcon('marketPrice') }}</span>
            </th>
            <th class="sortable" @click="toggleSort('bestMethod')">
              Best Method <span class="sort-icon">{{ getSortIcon('bestMethod') }}</span>
            </th>
            <th class="sortable text-right" @click="toggleSort('bestProfitPerHour')">
              Profit/hr <span class="sort-icon">{{ getSortIcon('bestProfitPerHour') }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="resource in sortedResources" :key="resource.name">
            <td class="name-cell" data-label="Resource">{{ resource.name }}</td>
            <td class="text-right" data-label="Time">
              <EditableValue
                :model-value="resource.timeSeconds"
                :default-value="resource.timeSeconds"
                suffix="s"
                @update:model-value="(value) => handleTimeUpdate(resource.name, value)"
              />
            </td>
            <td class="text-right" data-label="Cost">
              <EditableValue
                :model-value="resource.cost"
                :default-value="resource.cost"
                @update:model-value="(value) => handleCostUpdate(resource.name, value)"
              />
            </td>
            <td class="text-right" data-label="Vendor Price">
              <EditableValue
                :model-value="resource.vendorValue"
                :default-value="resource.vendorValue"
                @update:model-value="(value) => handleVendorValueUpdate(resource.name, value)"
              />
            </td>
            <td class="text-right" data-label="Market Price">
              <EditableValue
                :model-value="resource.marketPrice"
                :default-value="resource.marketPrice"
                @update:model-value="(value) => handleMarketPriceUpdate(resource.name, value)"
              />
            </td>
            <td data-label="Best">
              <span
                class="method-badge"
                :class="{
                  'method-vendor': resource.bestMethod === 'vendor',
                  'method-market': resource.bestMethod === 'market',
                }"
              >
                {{ resource.bestMethod === 'vendor' ? 'Vendor' : 'Market' }}
              </span>
            </td>
            <td
              class="text-right profit-hr"
              data-label="Profit/hr"
              :style="
                getHeatmapStyle(
                  resource.bestProfitPerHour,
                  profitRange.profitPerHour.min,
                  profitRange.profitPerHour.max
                )
              "
            >
              {{ formatNumber(resource.bestProfitPerHour) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
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

.main-table tbody tr {
  border-bottom: 1px solid var(--border-color);
  transition: all 0.2s ease-in-out;
}

.main-table tbody tr:nth-child(even) {
  background-color: rgba(255, 255, 255, 0.015);
}

.main-table tbody tr:hover {
  background-color: var(--bg-tertiary);
  transform: translateX(4px);
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

/* Name Cell */
.name-cell {
  font-weight: 500;
}

/* Method Badge */
.method-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.method-vendor {
  background-color: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.4);
}

.method-market {
  background-color: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.4);
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

  /* Hide less important rows — Best Method and Profit/HR tell the story */
  .resource-table :deep(.mobile-card-layout td[data-label='Cost']),
  .resource-table :deep(.mobile-card-layout td[data-label='Vendor Price']) {
    display: none;
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

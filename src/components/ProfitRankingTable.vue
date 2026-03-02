<script setup lang="ts">
import { ref, computed } from 'vue'
import type { RankedActivity } from '../calculators/profitRanker'
import type { ActivityType } from '../types'
import { useHeatmap } from '../composables/useHeatmap'
import { useActivityFilters } from '../composables/useActivityFilters'
import EmptyState from './EmptyState.vue'

const { getHeatmapStyle } = useHeatmap()

const props = defineProps<{
  activities: RankedActivity[]
}>()

// Sort configuration
type SortKey = 'rank' | 'name' | 'profitPerHour' | 'profitPerAction' | 'timePerAction' | 'cost'
type SortOrder = 'asc' | 'desc'

const sortKey = ref<SortKey>('rank')
const sortOrder = ref<SortOrder>('asc')

// Use shared filter state (with localStorage persistence)
const { filterDungeons, filterCraftables, filterResources, getFilteredAndRerankedActivities } =
  useActivityFilters()

// Get filtered and sorted activities
const filteredAndSortedActivities = computed(() => {
  // First, filter by type and re-rank
  let filtered = getFilteredAndRerankedActivities(props.activities)

  // Then, sort
  filtered.sort((a, b) => {
    let aValue: number | string
    let bValue: number | string

    switch (sortKey.value) {
      case 'rank':
        aValue = a.rank
        bValue = b.rank
        break
      case 'name':
        aValue = a.name
        bValue = b.name
        break
      case 'profitPerHour':
        aValue = a.profitPerHour
        bValue = b.profitPerHour
        break
      case 'profitPerAction':
        aValue = a.profitPerAction
        bValue = b.profitPerAction
        break
      case 'timePerAction':
        aValue = a.timePerAction
        bValue = b.timePerAction
        break
      case 'cost':
        aValue = a.cost
        bValue = b.cost
        break
      default:
        aValue = a.rank
        bValue = b.rank
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder.value === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
    }

    return sortOrder.value === 'asc'
      ? (aValue as number) - (bValue as number)
      : (bValue as number) - (aValue as number)
  })

  return filtered
})

// Toggle sort
const toggleSort = (key: SortKey) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = key === 'rank' ? 'asc' : 'desc'
  }
}

// Display limit for pagination
const DEFAULT_DISPLAY_LIMIT = 25
const showAll = ref(false)

const displayedActivities = computed(() => {
  const all = filteredAndSortedActivities.value
  if (showAll.value || all.length <= DEFAULT_DISPLAY_LIMIT) return all
  return all.slice(0, DEFAULT_DISPLAY_LIMIT)
})

const hasMore = computed(() => filteredAndSortedActivities.value.length > DEFAULT_DISPLAY_LIMIT)

// Format numbers
const formatNumber = (num: number): string => {
  return Math.round(num).toLocaleString()
}

// Format time
const formatTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  if (remainingSeconds === 0) {
    return `${minutes}m`
  }
  return `${minutes}m ${remainingSeconds}s`
}

// Get type badge class
const getTypeBadgeClass = (type: ActivityType): string => {
  switch (type) {
    case 'dungeon':
      return 'badge-dungeon'
    case 'craftable':
      return 'badge-craftable'
    case 'resource':
      return 'badge-resource'
    default:
      return ''
  }
}

// Get sort icon
const getSortIcon = (key: SortKey): string => {
  if (sortKey.value !== key) return '↕'
  return sortOrder.value === 'asc' ? '↑' : '↓'
}

// Calculate min/max profit for heatmap
const profitRange = computed(() => {
  const profits = filteredAndSortedActivities.value.map((a) => a.profitPerHour)
  return {
    min: Math.min(...profits),
    max: Math.max(...profits),
  }
})
</script>

<template>
  <div class="profit-ranking-table">
    <!-- Filter Controls + Pagination -->
    <div class="filter-controls">
      <span class="filter-label">Show:</span>
      <button
        class="filter-button"
        :class="{ active: filterDungeons, 'badge-dungeon': filterDungeons }"
        :aria-pressed="filterDungeons"
        aria-label="Toggle dungeon activities"
        @click="filterDungeons = !filterDungeons"
      >
        Dungeons
      </button>
      <button
        class="filter-button"
        :class="{ active: filterCraftables, 'badge-craftable': filterCraftables }"
        :aria-pressed="filterCraftables"
        aria-label="Toggle craftable activities"
        @click="filterCraftables = !filterCraftables"
      >
        Craftables
      </button>
      <button
        class="filter-button"
        :class="{ active: filterResources, 'badge-resource': filterResources }"
        :aria-pressed="filterResources"
        aria-label="Toggle resource activities"
        @click="filterResources = !filterResources"
      >
        Resources
      </button>
      <span v-if="hasMore && !showAll" class="pagination-info">
        {{ DEFAULT_DISPLAY_LIMIT }}/{{ filteredAndSortedActivities.length }}
        <button class="btn-show-all-inline" @click="showAll = true">all</button>
      </span>
    </div>

    <!-- Table -->
    <div class="table-container">
      <table
        class="ranking-table mobile-card-layout"
        role="grid"
        aria-label="Activity profit rankings"
      >
        <thead>
          <tr>
            <th
              class="sortable"
              role="columnheader"
              :aria-sort="sortKey === 'rank' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'"
              tabindex="0"
              @click="toggleSort('rank')"
              @keydown.enter="toggleSort('rank')"
              @keydown.space.prevent="toggleSort('rank')"
            >
              Rank <span class="sort-icon" aria-hidden="true">{{ getSortIcon('rank') }}</span>
            </th>
            <th
              class="sortable"
              role="columnheader"
              :aria-sort="sortKey === 'name' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'"
              tabindex="0"
              @click="toggleSort('name')"
              @keydown.enter="toggleSort('name')"
              @keydown.space.prevent="toggleSort('name')"
            >
              Activity Name <span class="sort-icon" aria-hidden="true">{{ getSortIcon('name') }}</span>
            </th>
            <th role="columnheader">Type</th>
            <th
              class="sortable text-right"
              role="columnheader"
              :aria-sort="sortKey === 'profitPerHour' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'"
              tabindex="0"
              @click="toggleSort('profitPerHour')"
              @keydown.enter="toggleSort('profitPerHour')"
              @keydown.space.prevent="toggleSort('profitPerHour')"
            >
              Profit/hr <span class="sort-icon" aria-hidden="true">{{ getSortIcon('profitPerHour') }}</span>
            </th>
            <th
              class="sortable text-right"
              role="columnheader"
              :aria-sort="sortKey === 'profitPerAction' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'"
              tabindex="0"
              @click="toggleSort('profitPerAction')"
              @keydown.enter="toggleSort('profitPerAction')"
              @keydown.space.prevent="toggleSort('profitPerAction')"
            >
              Profit/action <span class="sort-icon" aria-hidden="true">{{ getSortIcon('profitPerAction') }}</span>
            </th>
            <th
              class="sortable text-right"
              role="columnheader"
              :aria-sort="sortKey === 'timePerAction' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'"
              tabindex="0"
              @click="toggleSort('timePerAction')"
              @keydown.enter="toggleSort('timePerAction')"
              @keydown.space.prevent="toggleSort('timePerAction')"
            >
              Time <span class="sort-icon" aria-hidden="true">{{ getSortIcon('timePerAction') }}</span>
            </th>
            <th
              class="sortable text-right"
              role="columnheader"
              :aria-sort="sortKey === 'cost' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'"
              tabindex="0"
              @click="toggleSort('cost')"
              @keydown.enter="toggleSort('cost')"
              @keydown.space.prevent="toggleSort('cost')"
            >
              Cost <span class="sort-icon" aria-hidden="true">{{ getSortIcon('cost') }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="activity in displayedActivities"
            :key="activity.name"
            :class="{ 'is-top-rank': activity.rank === 1, 'negative-profit': activity.profitPerHour < 0 }"
          >
            <td class="rank-cell" data-label="Rank">
              <span
                class="rank-number"
                :class="{
                  'rank-first': activity.rank === 1,
                  'rank-second': activity.rank === 2,
                  'rank-third': activity.rank === 3,
                }"
              >
                {{ activity.rank }}
              </span>
            </td>
            <td class="name-cell" data-label="Activity">{{ activity.name }}</td>
            <td data-label="Type">
              <span class="type-badge" :class="getTypeBadgeClass(activity.activityType)">
                {{ activity.activityType }}
              </span>
            </td>
            <td
              class="text-right profit-cell"
              data-label="Profit/hr"
              :style="getHeatmapStyle(activity.profitPerHour, profitRange.min, profitRange.max)"
            >
              {{ formatNumber(activity.profitPerHour) }}
            </td>
            <td class="text-right" data-label="Profit/action">
              {{ formatNumber(activity.profitPerAction) }}
            </td>
            <td class="text-right" data-label="Time">{{ formatTime(activity.timePerAction) }}</td>
            <td class="text-right" data-label="Cost">{{ formatNumber(activity.cost) }}</td>
          </tr>
        </tbody>
      </table>

      <div v-if="hasMore && !showAll" class="show-more-container">
        <button class="btn-show-more" @click="showAll = true">
          Show all ({{ filteredAndSortedActivities.length }})
        </button>
      </div>

      <EmptyState
        v-if="filteredAndSortedActivities.length === 0"
        icon="🔍"
        title="No activities found"
        description="Try adjusting your filters to see more results."
      />
    </div>
  </div>
</template>

<style scoped>
.profit-ranking-table {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 1320px;
  margin: 0 auto;
}

.pagination-info {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-left: auto;
  white-space: nowrap;
  background-color: var(--bg-tertiary);
  padding: 0.25rem 0.625rem;
  border-radius: 1rem;
  font-weight: 500;
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
  padding: 1rem 0;
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

.btn-show-more:active {
  transform: scale(0.97);
}

@media (max-width: 767px) {
  .btn-show-more {
    width: auto;
    padding: 0.375rem 1rem;
    font-weight: 600;
  }
}

/* Filter Controls */
.filter-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0;
  border-bottom: 2px solid var(--border-color);
  margin-bottom: 0.5rem;
}

.filter-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.5rem 0.5rem 0.5rem 0;
}

.filter-button {
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  background-color: transparent;
  color: var(--text-secondary);
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  border-radius: 0;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  text-transform: capitalize;
  position: relative;
  min-height: 44px;
}

.filter-button::before {
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

.filter-button:hover {
  color: var(--text-primary);
  background-color: rgba(255, 255, 255, 0.03);
}

.filter-button:hover::before {
  width: 80%;
}

.filter-button:active {
  transform: none;
}

.filter-button.active.badge-dungeon {
  color: #c084fc;
  border-bottom-color: #c084fc;
  background-color: rgba(168, 85, 247, 0.05);
}

.filter-button.active.badge-dungeon::before {
  width: 100%;
  background-color: #c084fc;
}

.filter-button.active.badge-craftable {
  color: #4ade80;
  border-bottom-color: #4ade80;
  background-color: rgba(34, 197, 94, 0.05);
}

.filter-button.active.badge-craftable::before {
  width: 100%;
  background-color: #4ade80;
}

.filter-button.active.badge-resource {
  color: #60a5fa;
  border-bottom-color: #60a5fa;
  background-color: rgba(59, 130, 246, 0.05);
}

.filter-button.active.badge-resource::before {
  width: 100%;
  background-color: #60a5fa;
}

/* Table Container */
.table-container {
  background: linear-gradient(180deg, #1e2436 0%, var(--bg-secondary) 100%);
  border: 1px solid rgba(55, 65, 81, 0.7);
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.ranking-table {
  width: 100%;
  border-collapse: collapse;
}

.ranking-table thead {
  background-color: rgba(35, 41, 56, 0.9);
  border-bottom: 2px solid rgba(96, 165, 250, 0.35);
}

.ranking-table th {
  padding: 0.625rem 0.75rem;
  text-align: left;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #e5e7eb;
  font-weight: 600;
  white-space: nowrap;
}

.ranking-table th.sortable {
  cursor: pointer;
  user-select: none;
  transition: color 0.2s;
}

.ranking-table th.sortable:hover {
  color: var(--text-primary);
}

.sort-icon {
  display: inline-block;
  margin-left: 0.25rem;
  font-size: 0.875rem;
  color: rgba(96, 165, 250, 0.6);
  vertical-align: middle;
}

.ranking-table th.text-right {
  text-align: right;
}

.ranking-table tbody tr {
  border-bottom: 1px solid var(--border-color);
  transition: all 0.2s ease-in-out;
}

.ranking-table tbody tr:nth-child(even) {
  background-color: rgba(255, 255, 255, 0.015);
}

.ranking-table tbody tr:hover {
  background-color: var(--bg-tertiary);
  transform: translateX(4px);
  box-shadow: -4px 0 0 0 var(--accent-primary);
}

.ranking-table tbody tr.negative-profit {
  box-shadow: -3px 0 0 0 var(--danger);
}

.ranking-table tbody tr.negative-profit:hover {
  box-shadow: -4px 0 0 0 var(--danger);
}

.ranking-table tbody tr.is-top-rank {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.06) 100%);
  border: 1px solid rgba(245, 158, 11, 0.35);
  border-left: 3px solid #f59e0b;
  box-shadow:
    inset 0 1px 0 rgba(245, 158, 11, 0.15),
    0 2px 8px rgba(245, 158, 11, 0.15);
}

.ranking-table tbody tr.is-top-rank:hover {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(245, 158, 11, 0.08) 100%);
  transform: translateX(4px);
  box-shadow:
    inset 0 1px 0 rgba(245, 158, 11, 0.2),
    0 4px 16px rgba(245, 158, 11, 0.25);
}

.ranking-table td {
  padding: 0.625rem 0.75rem;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.text-right {
  text-align: right;
}

/* Rank Cell */
.rank-cell {
  font-weight: 600;
  width: 48px;
}

.rank-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.75rem;
  font-size: 1rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.35);
}

.rank-number.rank-first {
  color: #f59e0b;
  font-weight: 700;
  font-size: 1.125rem;
  text-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
}

.rank-number.rank-second {
  color: #94a3b8;
  font-weight: 700;
}

.rank-number.rank-third {
  color: #b45309;
  font-weight: 700;
}

/* Name Cell */
.name-cell {
  font-weight: 500;
}

/* Type Badge */
.type-badge {
  display: inline-block;
  padding: 0.25rem 0.625rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.badge-dungeon {
  background-color: rgba(168, 85, 247, 0.2);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.4);
}

.badge-craftable {
  background-color: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.4);
}

.badge-resource {
  background-color: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.4);
}

/* Profit Cell */
.profit-cell {
  font-weight: 700;
  font-size: 0.9375rem;
  color: var(--success);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

/* Responsive */
@media (max-width: 1024px) {
  .table-container {
    overflow-x: auto;
  }

  .ranking-table {
    min-width: 800px;
  }
}

/* Mobile card layout overrides */
@media (max-width: 767px) {
  /* Remove heatmap backgrounds on mobile for consistency with other tabs */
  .profit-cell {
    background-color: transparent !important;
  }

  .profit-ranking-table {
    gap: 0.5rem;
  }

  .filter-controls {
    padding: 0.5rem;
    gap: 0.375rem;
  }

  .table-container {
    overflow-x: visible !important;
    overflow-y: visible !important;
    width: 100%;
    max-width: 100%;
  }

  .ranking-table {
    min-width: 0 !important;
    width: 100%;
  }
}

@media (max-width: 767px) {
  .filter-controls {
    gap: 0.25rem;
    margin-bottom: 0.25rem;
  }

  .filter-label {
    display: none;
  }

  .filter-button {
    flex: 0 0 auto;
    min-width: 0;
    max-width: none;
    min-height: 36px;
    padding: 0.375rem 0.5rem;
    font-size: 0.8125rem;
  }

  .pagination-info {
    font-size: 0.6875rem;
  }

  .ranking-table th,
  .ranking-table td {
    padding: 0.25rem 0.5rem;
  }
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import type { RankedActivity } from '../../calculators/profitRanker'

const props = defineProps<{
  activities: RankedActivity[]
}>()

const hasData = computed(() => props.activities.length > 0 && props.activities.some((a) => a.profitPerHour > 0))

// Calculate totals by category
const categoryTotals = computed(() => {
  const totals = {
    dungeon: 0,
    dungeonCount: 0,
    craftable: 0,
    craftableCount: 0,
    resource: 0,
    resourceCount: 0,
  }

  props.activities.forEach((activity) => {
    if (activity.profitPerHour > 0) {
      if (activity.activityType === 'dungeon') {
        totals.dungeon += activity.profitPerHour
        totals.dungeonCount++
      } else if (activity.activityType === 'craftable') {
        totals.craftable += activity.profitPerHour
        totals.craftableCount++
      } else if (activity.activityType === 'resource') {
        totals.resource += activity.profitPerHour
        totals.resourceCount++
      }
    }
  })

  const grandTotal = totals.dungeon + totals.craftable + totals.resource

  return {
    ...totals,
    grandTotal,
    dungeonPercent: grandTotal > 0 ? (totals.dungeon / grandTotal) * 100 : 0,
    craftablePercent: grandTotal > 0 ? (totals.craftable / grandTotal) * 100 : 0,
    resourcePercent: grandTotal > 0 ? (totals.resource / grandTotal) * 100 : 0,
  }
})

// Categories for the bar display
const categories = computed(() => {
  const totals = categoryTotals.value
  const maxValue = Math.max(totals.dungeon, totals.craftable, totals.resource)

  const items = []
  if (totals.dungeonCount > 0) {
    items.push({
      label: 'Dungeons',
      value: totals.dungeon,
      count: totals.dungeonCount,
      percent: totals.dungeonPercent,
      barWidth: maxValue > 0 ? (totals.dungeon / maxValue) * 100 : 0,
      color: 'rgba(168, 85, 247, 0.7)',
      borderColor: 'rgba(168, 85, 247, 1)',
    })
  }
  if (totals.craftableCount > 0) {
    items.push({
      label: 'Craftables',
      value: totals.craftable,
      count: totals.craftableCount,
      percent: totals.craftablePercent,
      barWidth: maxValue > 0 ? (totals.craftable / maxValue) * 100 : 0,
      color: 'rgba(34, 197, 94, 0.7)',
      borderColor: 'rgba(34, 197, 94, 1)',
    })
  }
  if (totals.resourceCount > 0) {
    items.push({
      label: 'Resources',
      value: totals.resource,
      count: totals.resourceCount,
      percent: totals.resourcePercent,
      barWidth: maxValue > 0 ? (totals.resource / maxValue) * 100 : 0,
      color: 'rgba(59, 130, 246, 0.7)',
      borderColor: 'rgba(59, 130, 246, 1)',
    })
  }
  return items
})
</script>

<template>
  <div class="revenue-breakdown">
    <div class="chart-header">
      <h3 class="chart-title">Revenue Breakdown by Type</h3>
    </div>
    <template v-if="hasData">
      <!-- Horizontal bars -->
      <div class="bar-chart">
        <div v-for="cat in categories" :key="cat.label" class="bar-row">
          <div class="bar-label">
            <span class="bar-dot" :style="{ background: cat.color }"></span>
            <span class="bar-name">{{ cat.label }}</span>
            <span class="bar-count">{{ cat.count }} activities</span>
          </div>
          <div class="bar-track">
            <div
              class="bar-fill"
              :style="{ width: Math.max(cat.barWidth, 2) + '%', backgroundColor: cat.color, borderColor: cat.borderColor }"
            ></div>
          </div>
          <div class="bar-stats">
            <span class="bar-value">{{ Math.round(cat.value).toLocaleString() }}</span>
            <span class="bar-pct">{{ cat.percent.toFixed(1) }}%</span>
          </div>
        </div>
      </div>

      <!-- Stacked proportion bar -->
      <div class="proportion-bar">
        <div
          v-for="cat in categories"
          :key="cat.label"
          class="proportion-segment"
          :style="{ width: Math.max(cat.percent, 1) + '%', backgroundColor: cat.color }"
          :title="`${cat.label}: ${cat.percent.toFixed(1)}%`"
        ></div>
      </div>

      <div class="summary">
        <div class="summary-item">
          <span class="summary-label">Total Combined Profit/hr:</span>
          <span class="summary-value"
            >{{ Math.round(categoryTotals.grandTotal).toLocaleString() }} gold</span
          >
        </div>
      </div>
    </template>
    <div v-else class="empty-state">
      <p>No revenue data available</p>
    </div>
  </div>
</template>

<style scoped>
.revenue-breakdown {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  padding: 1.5rem;
  flex: 1;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.chart-header {
  margin-bottom: 1.25rem;
}

.chart-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

/* Horizontal bar chart */
.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.bar-row {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.bar-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.bar-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.bar-name {
  color: var(--text-primary);
  font-weight: 600;
}

.bar-count {
  color: var(--text-secondary);
  font-size: 0.75rem;
  margin-left: auto;
}

.bar-track {
  width: 100%;
  height: 28px;
  background-color: var(--bg-tertiary);
  border-radius: 0.375rem;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 0.375rem;
  border: 1px solid;
  transition: width 0.4s ease;
  min-width: 4px;
}

.bar-stats {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.8125rem;
}

.bar-value {
  color: var(--text-primary);
  font-weight: 700;
}

.bar-value::after {
  content: ' gold/hr';
  font-weight: 400;
  color: var(--text-secondary);
  font-size: 0.75rem;
}

.bar-pct {
  color: var(--text-secondary);
  font-size: 0.75rem;
}

/* Stacked proportion bar */
.proportion-bar {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  margin-top: 1.25rem;
  background-color: var(--bg-tertiary);
}

.proportion-segment {
  height: 100%;
  transition: width 0.4s ease;
  min-width: 3px;
}

.proportion-segment:first-child {
  border-radius: 4px 0 0 4px;
}

.proportion-segment:last-child {
  border-radius: 0 4px 4px 0;
}

.proportion-segment:only-child {
  border-radius: 4px;
}

/* Summary */
.summary {
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.summary-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0;
}

.summary-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.summary-value {
  font-size: 1.125rem;
  color: var(--success);
  font-weight: 700;
  white-space: nowrap;
}

/* Stack label/value on small mobile to prevent text wrapping */
@media (max-width: 400px) {
  .summary-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .summary-value {
    align-self: flex-end;
    font-size: 1.25rem;
  }
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.875rem;
}
</style>

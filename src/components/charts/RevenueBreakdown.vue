<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { Chart } from 'chart.js'
import type { RankedActivity } from '../../calculators/profitRanker'

const props = defineProps<{
  activities: RankedActivity[]
}>()

const chartContainer = ref<HTMLElement | null>(null)
const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null
// eslint-disable-next-line no-undef
let resizeObserver: ResizeObserver | null = null

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

// Get chart data
const chartData = computed(() => {
  const totals = categoryTotals.value

  return {
    labels: ['Dungeons', 'Craftables', 'Resources'],
    datasets: [
      {
        label: 'Total Profit/hr',
        data: [totals.dungeon, totals.craftable, totals.resource],
        backgroundColor: [
          'rgba(168, 85, 247, 0.7)', // Purple for dungeons
          'rgba(34, 197, 94, 0.7)', // Green for craftables
          'rgba(59, 130, 246, 0.7)', // Blue for resources
        ],
        borderColor: ['rgba(168, 85, 247, 1)', 'rgba(34, 197, 94, 1)', 'rgba(59, 130, 246, 1)'],
        borderWidth: 2,
      },
    ],
  }
})

const createChart = () => {
  if (!chartCanvas.value || !hasData.value) return

  // Destroy existing chart
  if (chartInstance) {
    chartInstance.destroy()
  }

  const ctx = chartCanvas.value.getContext('2d')
  if (!ctx) return

  // Detect mobile viewport
  const isMobile = window.innerWidth <= 767

  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: chartData.value,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: '#e5e7eb',
            padding: isMobile ? 12 : 15,
            font: {
              size: isMobile ? 11 : 13,
            },
            generateLabels: function (chart) {
              const data = chart.data
              if (data.labels && data.datasets.length) {
                const totals = categoryTotals.value
                const backgrounds = data.datasets[0].backgroundColor as string[]
                const borders = data.datasets[0].borderColor as string[]
                return data.labels.map((label, i) => {
                  const value = data.datasets[0].data[i] as number
                  const percent =
                    i === 0
                      ? totals.dungeonPercent
                      : i === 1
                        ? totals.craftablePercent
                        : totals.resourcePercent
                  return {
                    text: `${label}: ${Math.round(value).toLocaleString()} (${percent.toFixed(1)}%)`,
                    fillStyle: backgrounds[i],
                    strokeStyle: borders[i],
                    lineWidth: 2,
                    hidden: false,
                    index: i,
                  }
                })
              }
              return []
            },
          },
        },
        tooltip: {
          backgroundColor: 'rgba(17, 23, 34, 0.95)',
          titleColor: '#e5e7eb',
          bodyColor: '#e5e7eb',
          borderColor: '#374151',
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            label: function (context) {
              const value = context.parsed
              const totals = categoryTotals.value
              const percent =
                context.dataIndex === 0
                  ? totals.dungeonPercent
                  : context.dataIndex === 1
                    ? totals.craftablePercent
                    : totals.resourcePercent
              const count =
                context.dataIndex === 0
                  ? totals.dungeonCount
                  : context.dataIndex === 1
                    ? totals.craftableCount
                    : totals.resourceCount
              return [
                `Total: ${Math.round(value).toLocaleString()} gold/hr`,
                `Percentage: ${percent.toFixed(1)}%`,
                `Activities: ${count}`,
              ]
            },
          },
        },
      },
    },
  })
}

const updateChart = () => {
  if (!chartInstance) return

  chartInstance.data = chartData.value
  chartInstance.update()
}

// Initialize chart on mount with delayed init for reliable canvas sizing
onMounted(() => {
  nextTick(() => {
    setTimeout(() => createChart(), 150)
  })

  if (chartContainer.value && typeof window !== 'undefined') {
    // eslint-disable-next-line no-undef
    resizeObserver = new ResizeObserver(() => {
      if (chartInstance) {
        chartInstance.resize()
      }
    })
    resizeObserver.observe(chartContainer.value)
  }
})

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})

// Watch for data changes and update or create chart
watch(
  chartData,
  () => {
    if (chartInstance) {
      updateChart()
    } else {
      nextTick(() => setTimeout(() => createChart(), 150))
    }
  },
  { deep: true }
)
</script>

<template>
  <div class="revenue-breakdown">
    <div class="chart-header">
      <h3 class="chart-title">Revenue Breakdown by Type</h3>
    </div>
    <template v-if="hasData">
      <div ref="chartContainer" class="chart-container">
        <canvas ref="chartCanvas"></canvas>
      </div>
      <div class="summary">
        <div class="summary-item">
          <span class="summary-label">Total Combined Profit/hr:</span>
          <span class="summary-value"
            >{{ Math.round(categoryTotals.grandTotal).toLocaleString() }} gold</span
          >
        </div>
        <div class="category-stats">
          <div class="category-stat" v-if="categoryTotals.dungeonCount > 0">
            <span class="category-dot" style="background: rgba(168, 85, 247, 0.7)"></span>
            <span class="category-label">Dungeons</span>
            <span class="category-value">{{ Math.round(categoryTotals.dungeon).toLocaleString() }}</span>
            <span class="category-pct">({{ categoryTotals.dungeonPercent.toFixed(1) }}%)</span>
          </div>
          <div class="category-stat" v-if="categoryTotals.craftableCount > 0">
            <span class="category-dot" style="background: rgba(34, 197, 94, 0.7)"></span>
            <span class="category-label">Craftables</span>
            <span class="category-value">{{ Math.round(categoryTotals.craftable).toLocaleString() }}</span>
            <span class="category-pct">({{ categoryTotals.craftablePercent.toFixed(1) }}%)</span>
          </div>
          <div class="category-stat" v-if="categoryTotals.resourceCount > 0">
            <span class="category-dot" style="background: rgba(59, 130, 246, 0.7)"></span>
            <span class="category-label">Resources</span>
            <span class="category-value">{{ Math.round(categoryTotals.resource).toLocaleString() }}</span>
            <span class="category-pct">({{ categoryTotals.resourcePercent.toFixed(1) }}%)</span>
          </div>
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
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  padding: 1.5rem;
  flex: 1;
}

.chart-header {
  margin-bottom: 1.5rem;
}

.chart-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.chart-container {
  position: relative;
  height: 350px;
  width: 100%;
}

.summary {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-color);
}

.summary-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;
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
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.category-stats {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color);
}

.category-stat {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.category-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.category-label {
  color: var(--text-secondary);
  min-width: 70px;
}

.category-value {
  color: var(--text-primary);
  font-weight: 600;
  margin-left: auto;
}

.category-pct {
  color: var(--text-secondary);
  font-size: 0.75rem;
  min-width: 50px;
  text-align: right;
}

@media (max-width: 767px) {
  .chart-container {
    height: 300px;
  }
}
</style>

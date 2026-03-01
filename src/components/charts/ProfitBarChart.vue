<script setup lang="ts">
import { computed, ref, onMounted, watch, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'
import type { RankedActivity } from '../../calculators/profitRanker'

Chart.register(...registerables)

const props = defineProps<{
  activities: RankedActivity[]
  maxItems?: number
}>()

const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

const showAll = ref(false)
const maxDisplayItems = computed(() => props.maxItems ?? 15)

// Get limited activities
const displayedActivities = computed(() => {
  const sorted = [...props.activities].sort((a, b) => b.profitPerHour - a.profitPerHour)
  return showAll.value ? sorted : sorted.slice(0, maxDisplayItems.value)
})

// Get chart data
const chartData = computed(() => {
  const activities = displayedActivities.value

  // Reverse to show highest at top (horizontal bar chart)
  const reversed = [...activities].reverse()

  const labels = reversed.map((a) => a.name)
  const data = reversed.map((a) => a.profitPerHour)

  // Color by type
  const backgroundColors = reversed.map((a) => {
    switch (a.activityType) {
      case 'dungeon':
        return 'rgba(168, 85, 247, 0.7)' // Purple
      case 'craftable':
        return 'rgba(34, 197, 94, 0.7)' // Green
      case 'resource':
        return 'rgba(59, 130, 246, 0.7)' // Blue
      default:
        return 'rgba(156, 163, 175, 0.7)' // Gray
    }
  })

  const borderColors = reversed.map((a) => {
    switch (a.activityType) {
      case 'dungeon':
        return 'rgba(168, 85, 247, 1)'
      case 'craftable':
        return 'rgba(34, 197, 94, 1)'
      case 'resource':
        return 'rgba(59, 130, 246, 1)'
      default:
        return 'rgba(156, 163, 175, 1)'
    }
  })

  return {
    labels,
    datasets: [
      {
        label: 'Profit/hr (gold)',
        data,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1,
      },
    ],
  }
})

const createChart = () => {
  if (!chartCanvas.value) return

  // Destroy existing chart
  if (chartInstance) {
    chartInstance.destroy()
  }

  const ctx = chartCanvas.value.getContext('2d')
  if (!ctx) return

  // Detect mobile viewport
  const isMobile = window.innerWidth <= 767

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: chartData.value,
    options: {
      indexAxis: 'y', // Horizontal bar chart
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
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
              const value = context.parsed.x
              if (value === null) return ''
              return `Profit/hr: ${Math.round(value).toLocaleString()} gold`
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: {
            color: '#374151',
          },
          border: {
            display: false,
          },
          ticks: {
            color: '#9ca3af',
            font: {
              size: isMobile ? 10 : 11,
            },
            maxTicksLimit: isMobile ? 4 : 6,
            callback: function (value) {
              if (typeof value === 'number') {
                const abs = Math.abs(value)
                if (abs >= 1_000_000) return (value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1) + 'M'
                if (abs >= 1_000) return (value / 1_000).toFixed(0) + 'K'
                return String(value)
              }
              return value !== null ? String(value) : ''
            },
          },
        },
        y: {
          grid: {
            display: false,
          },
          ticks: {
            color: '#9ca3af',
            font: {
              size: isMobile ? 10 : 11,
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

// Initialize chart on mount
onMounted(() => {
  nextTick(() => {
    createChart()
  })
})

// Watch for data changes and update chart
watch(
  chartData,
  () => {
    updateChart()
  },
  { deep: true }
)

// Watch for show all toggle
watch(showAll, () => {
  nextTick(() => {
    createChart()
  })
})
</script>

<template>
  <div class="profit-bar-chart">
    <div class="chart-header">
      <h3 class="chart-title">Profit Comparison</h3>
      <button
        v-if="activities.length > maxDisplayItems"
        class="btn-toggle"
        @click="showAll = !showAll"
      >
        {{ showAll ? 'Show Less' : `Show All (${activities.length})` }}
      </button>
    </div>
    <div
      class="chart-container"
      role="img"
      aria-label="Bar chart showing profit per hour for different activities"
    >
      <canvas ref="chartCanvas"></canvas>
    </div>
  </div>
</template>

<style scoped>
.profit-bar-chart {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  padding: 1.5rem;
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.chart-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.btn-toggle {
  padding: 0.5rem 1rem;
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-toggle:hover {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  border-color: var(--accent-primary);
}

.chart-container {
  position: relative;
  height: 600px;
  width: 100%;
}

@media (max-width: 767px) {
  .profit-bar-chart {
    padding: 1rem;
  }

  .chart-header {
    gap: 0.5rem;
  }

  .chart-title {
    font-size: 1rem;
  }

  .btn-toggle {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
  }

  .chart-container {
    height: 400px;
  }
}
</style>

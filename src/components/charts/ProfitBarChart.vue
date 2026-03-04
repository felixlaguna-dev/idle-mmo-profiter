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

  // Color by type with intensity gradient based on rank
  const total = reversed.length
  const backgroundColors = reversed.map((a, i) => {
    // i=0 is the lowest-ranked (bottom of chart), i=total-1 is the highest
    const intensity = 0.4 + 0.5 * (i / Math.max(total - 1, 1))
    switch (a.activityType) {
      case 'dungeon':
        return `rgba(168, 85, 247, ${intensity.toFixed(2)})` // Purple
      case 'craftable':
        // Split by skill: alchemy = emerald, forging = teal
        if (a.skill === 'alchemy') {
          return `rgba(16, 185, 129, ${intensity.toFixed(2)})` // Emerald
        } else {
          return `rgba(20, 184, 166, ${intensity.toFixed(2)})` // Teal
        }
      case 'resource':
        return `rgba(59, 130, 246, ${intensity.toFixed(2)})` // Blue
      default:
        return `rgba(156, 163, 175, ${intensity.toFixed(2)})` // Gray
    }
  })

  const borderColors = reversed.map((a) => {
    switch (a.activityType) {
      case 'dungeon':
        return 'rgba(168, 85, 247, 1)'
      case 'craftable':
        // Split by skill: alchemy = emerald, forging = teal
        if (a.skill === 'alchemy') {
          return 'rgba(16, 185, 129, 1)' // Emerald
        } else {
          return 'rgba(20, 184, 166, 1)' // Teal
        }
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
        borderRadius: 4,
        borderSkipped: false,
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

  // Custom plugin: draw value labels at the end of each bar
  const barLabelPlugin = {
    id: 'barLabels',
    afterDatasetsDraw(chart: Chart) {
      const ctx2 = chart.ctx
      const dataset = chart.data.datasets[0]
      if (!dataset) return
      const meta = chart.getDatasetMeta(0)
      ctx2.save()
      ctx2.font = `${isMobile ? 9 : 10}px Inter, sans-serif`
      ctx2.fillStyle = '#9ca3af'
      ctx2.textBaseline = 'middle'
      meta.data.forEach((bar, i) => {
        const value = dataset.data[i] as number
        if (value == null) return
        const abs = Math.abs(value)
        let label: string
        if (abs >= 1_000_000) label = (value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1) + 'M'
        else if (abs >= 1_000) label = (value / 1_000).toFixed(0) + 'K'
        else label = String(Math.round(value))
        const x = bar.x + 4
        const y = bar.y
        ctx2.fillText(label, x, y)
      })
      ctx2.restore()
    },
  }

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: chartData.value,
    plugins: [barLabelPlugin],
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
          type: 'logarithmic',
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
      <div class="chart-legend">
        <span class="legend-item"><span class="legend-dot legend-dungeon"></span>Dungeons</span>
        <span class="legend-item"><span class="legend-dot legend-alchemy"></span>Alchemy</span>
        <span class="legend-item"><span class="legend-dot legend-forging"></span>Forging</span>
        <span class="legend-item"><span class="legend-dot legend-resource"></span>Resources</span>
      </div>
    </div>
    <div
      class="chart-container"
      role="img"
      aria-label="Bar chart showing profit per hour for different activities"
    >
      <canvas ref="chartCanvas"></canvas>
    </div>
    <div v-if="activities.length > maxDisplayItems" class="show-more-container">
      <button class="btn-toggle" @click="showAll = !showAll">
        {{ showAll ? 'Show less' : `Show all (${activities.length})` }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.profit-bar-chart {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  padding: 1.5rem;
  box-shadow: var(--surface-shadow);
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

.chart-legend {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-dungeon {
  background-color: rgba(168, 85, 247, 0.8);
}

.legend-alchemy {
  background-color: rgba(16, 185, 129, 0.8);
}

.legend-forging {
  background-color: rgba(20, 184, 166, 0.8);
}

.legend-resource {
  background-color: rgba(59, 130, 246, 0.8);
}

.btn-toggle {
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

.btn-toggle:hover {
  background-color: var(--bg-tertiary);
  color: var(--accent-primary);
  border-color: var(--accent-primary);
}

.btn-toggle:active {
  transform: scale(0.97);
}

.show-more-container {
  display: flex;
  justify-content: center;
  padding: 0.5rem 0;
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

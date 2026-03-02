<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { Chart } from 'chart.js'
import type { DungeonProfitResult } from '../../calculators/dungeonCalculator'

const props = defineProps<{
  dungeons: DungeonProfitResult[]
}>()

const chartContainer = ref<HTMLElement | null>(null)
const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null
// eslint-disable-next-line no-undef
let resizeObserver: ResizeObserver | null = null

const hasData = computed(() => props.dungeons.length > 0)

// Get chart data
const chartData = computed(() => {
  if (!hasData.value) return { labels: [], datasets: [] }

  const sorted = [...props.dungeons].sort((a, b) => a.profitPerHour - b.profitPerHour)

  const labels = sorted.map((d) => d.name)
  const data = sorted.map((d) => d.profitPerHour)

  // Create gradient colors from low to high profit
  const minProfit = Math.min(...data)
  const maxProfit = Math.max(...data)
  const range = maxProfit - minProfit || 1

  const backgroundColors = data.map((profit) => {
    // Normalize profit to 0-1 range
    const normalized = (profit - minProfit) / range

    // Color gradient from red/orange (low) to green/yellow (high)
    if (normalized < 0.33) {
      // Low profit: Red to Orange
      const r = 239
      const g = Math.round(68 + 140 * (normalized / 0.33))
      const b = 68
      return `rgba(${r}, ${g}, ${b}, 0.7)`
    } else if (normalized < 0.66) {
      // Medium profit: Orange to Yellow
      const localNorm = (normalized - 0.33) / 0.33
      const r = Math.round(245 - 11 * localNorm)
      const g = Math.round(208 + 47 * localNorm)
      const b = 68
      return `rgba(${r}, ${g}, ${b}, 0.7)`
    } else {
      // High profit: Yellow to Green
      const localNorm = (normalized - 0.66) / 0.34
      const r = Math.round(234 - 218 * localNorm)
      const g = Math.round(179 + 6 * localNorm)
      const b = Math.round(8 + 86 * localNorm)
      return `rgba(${r}, ${g}, ${b}, 0.7)`
    }
  })

  const borderColors = backgroundColors.map((color) => color.replace('0.7', '1'))

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
            afterTitle: function (tooltipItems) {
              const dungeon = props.dungeons.find((d) => d.name === tooltipItems[0].label)
              if (!dungeon) return ''
              return `Time: ${Math.round(dungeon.timeSeconds / 60)} min | Cost: ${Math.round(dungeon.runCost).toLocaleString()} gold`
            },
            label: function (context) {
              const value = context.parsed.x
              if (value === null) return ''
              return `Profit/hr: ${Math.round(value).toLocaleString()} gold`
            },
            afterLabel: function (context) {
              const dungeon = props.dungeons.find((d) => d.name === context.label)
              if (!dungeon) return ''
              return `Profit/run: ${Math.round(dungeon.totalProfit).toLocaleString()} gold`
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
            callback: function (value) {
              if (typeof value === 'number') {
                return Math.round(value).toLocaleString()
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

// Initialize chart on mount with delayed init for reliable canvas sizing
onMounted(() => {
  nextTick(() => {
    // Delay chart creation to ensure container has been laid out
    setTimeout(() => createChart(), 150)
  })

  // Use ResizeObserver to recreate chart when container resizes
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
  <div class="dungeon-chart">
    <div class="chart-header">
      <h3 class="chart-title">Dungeon Profit Comparison</h3>
      <div v-if="hasData" class="legend">
        <span class="legend-label">Low</span>
        <div class="legend-gradient"></div>
        <span class="legend-label">High</span>
      </div>
    </div>
    <div v-if="hasData" ref="chartContainer" class="chart-container">
      <canvas ref="chartCanvas"></canvas>
    </div>
    <div v-else class="empty-state">
      <p>No dungeon data available</p>
    </div>
  </div>
</template>

<style scoped>
.dungeon-chart {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  padding: 1.5rem;
  flex: 1;
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

.legend {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.legend-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.legend-gradient {
  width: 100px;
  height: 12px;
  background: linear-gradient(
    to right,
    rgba(239, 68, 68, 0.7),
    rgba(245, 158, 11, 0.7),
    rgba(234, 179, 8, 0.7),
    rgba(16, 185, 129, 0.7)
  );
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.chart-container {
  position: relative;
  height: 600px;
  width: 100%;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

@media (max-width: 767px) {
  .chart-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .chart-container {
    height: 450px;
  }
}
</style>

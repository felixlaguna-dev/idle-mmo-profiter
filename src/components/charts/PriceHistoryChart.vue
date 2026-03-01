<script setup lang="ts">
import { computed, ref, onMounted, watch, nextTick } from 'vue'
import { Chart } from 'chart.js'

// Price history data interface (for future API integration)
interface PriceHistoryData {
  timestamp: Date
  price: number
}

const props = defineProps<{
  itemName?: string
  priceHistory?: PriceHistoryData[]
}>()

const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

// Check if we have data
const hasData = computed(() => {
  return props.priceHistory && props.priceHistory.length > 0
})

// Get chart data
const chartData = computed(() => {
  if (!hasData.value || !props.priceHistory) {
    return {
      labels: [],
      datasets: [],
    }
  }

  const sortedHistory = [...props.priceHistory].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  )

  const labels = sortedHistory.map((entry) =>
    entry.timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  )
  const data = sortedHistory.map((entry) => entry.price)

  return {
    labels,
    datasets: [
      {
        label: props.itemName ?? 'Price',
        data,
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4, // Smooth line
        pointRadius: 4,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointBorderColor: '#111722',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointHoverBorderColor: '#e5e7eb',
        pointHoverBorderWidth: 2,
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
    type: 'line',
    data: chartData.value,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#e5e7eb',
            padding: isMobile ? 12 : 15,
            font: {
              size: isMobile ? 11 : 13,
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
              const value = context.parsed.y
              if (value === null) return ''
              return `Price: ${Math.round(value).toLocaleString()} gold`
            },
          },
        },
      },
      scales: {
        x: {
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
          },
        },
        y: {
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
    if (hasData.value) {
      updateChart()
    }
  },
  { deep: true }
)

watch(hasData, (newVal) => {
  if (newVal) {
    nextTick(() => {
      createChart()
    })
  } else if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
})
</script>

<template>
  <div class="price-history-chart" :class="{ 'is-empty': !hasData }">
    <div v-if="!hasData" class="no-data">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="no-data-icon"
      >
        <path d="M3 3v18h18" />
        <path d="m19 9-5 5-4-4-3 3" />
      </svg>
      <span class="no-data-text">Price History</span>
      <span class="no-data-badge">Coming Soon</span>
    </div>
    <template v-else>
      <div class="chart-header">
        <h3 class="chart-title">Price History Over Time</h3>
      </div>
      <div class="chart-container">
        <canvas ref="chartCanvas"></canvas>
      </div>
    </template>
  </div>
</template>

<style scoped>
.price-history-chart {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  padding: 1.5rem;
}

.price-history-chart.is-empty {
  padding: 0;
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

.no-data {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: 1px dashed var(--border-color);
  border-radius: 0.375rem;
  opacity: 0.5;
}

.no-data-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.no-data-text {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.no-data-badge {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  margin-left: auto;
}

@media (max-width: 767px) {
  .price-history-chart {
    padding: 1rem;
  }

  .price-history-chart.is-empty {
    padding: 0;
  }

  .chart-container {
    height: 300px;
  }
}
</style>

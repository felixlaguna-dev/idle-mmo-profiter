<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)
import { useCharacterTracker } from '../composables/useCharacterTracker'
import { useDataProvider } from '../composables/useDataProvider'
import { useToast } from '../composables/useToast'

const tracker = useCharacterTracker()
const dataProvider = useDataProvider()
const { showToast } = useToast()

// Character creation state
const showAddCharacter = ref(false)
const newCharacterName = ref('')

// Item search state
const searchQuery = ref('')
const searchDebounceTimeout = ref<number | null>(null)
const debouncedSearchQuery = ref('')

// Constants
const MAX_SEARCH_RESULTS = 20

// Gold input for active character
const goldInput = ref(0)

// Chart refs
const chartContainer = ref<HTMLElement | null>(null)
const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null
// eslint-disable-next-line no-undef
let resizeObserver: ResizeObserver | null = null

// Sync gold input when active character changes
watch(
  () => tracker.activeCharacter.value,
  (char) => {
    if (char) {
      goldInput.value = char.gold
    }
  },
  { immediate: true }
)

// Character management
const handleAddCharacter = () => {
  if (!newCharacterName.value.trim()) {
    showToast('Character name cannot be empty', 'error')
    return
  }

  const id = tracker.addCharacter(newCharacterName.value.trim())
  tracker.setActiveCharacter(id)
  newCharacterName.value = ''
  showAddCharacter.value = false
  showToast('Character created', 'success')
}

const handleDeleteCharacter = () => {
  if (!tracker.activeCharacter.value) return

  const name = tracker.activeCharacter.value.name
  if (!confirm(`Delete character "${name}"? This will remove all history.`)) {
    return
  }

  tracker.removeCharacter(tracker.activeCharacter.value.id)
  showToast('Character deleted', 'success')

  // Set active to first character if any remain
  if (tracker.characters.value.length > 0) {
    tracker.setActiveCharacter(tracker.characters.value[0].id)
  }
}

const handleRenameCharacter = () => {
  if (!tracker.activeCharacter.value) return

  const newName = prompt(
    'Enter new character name:',
    tracker.activeCharacter.value.name
  )

  if (newName && newName.trim() && newName !== tracker.activeCharacter.value.name) {
    tracker.renameCharacter(tracker.activeCharacter.value.id, newName.trim())
    showToast('Character renamed', 'success')
  }
}

const handleGoldChange = () => {
  tracker.updateGold(goldInput.value)
}

// Item search with debounce
watch(searchQuery, () => {
  if (searchDebounceTimeout.value) {
    clearTimeout(searchDebounceTimeout.value)
  }

  // Clear results immediately if query is empty
  if (!searchQuery.value.trim()) {
    debouncedSearchQuery.value = ''
    return
  }

  searchDebounceTimeout.value = window.setTimeout(() => {
    debouncedSearchQuery.value = searchQuery.value
  }, 300)
})

// All items from data provider
const allItems = computed(() => {
  const items: Array<{ hashId: string; name: string; price: number }> = []
  const seen = new Set<string>()

  // Add categorized items first (they have market prices)
  dataProvider.materials.value.forEach((m) => {
    if (m.hashedId) {
      items.push({ hashId: m.hashedId, name: m.name, price: m.price })
      seen.add(m.hashedId)
    }
  })

  dataProvider.craftables.value.forEach((c) => {
    if (c.hashedId) {
      items.push({ hashId: c.hashedId, name: c.name, price: c.price })
      seen.add(c.hashedId)
    }
  })

  dataProvider.resources.value.forEach((r) => {
    if (r.hashedId) {
      items.push({ hashId: r.hashedId, name: r.name, price: r.marketPrice })
      seen.add(r.hashedId)
    }
  })

  dataProvider.recipes.value.forEach((r) => {
    if (r.hashedId) {
      items.push({ hashId: r.hashedId, name: r.name, price: r.price })
      seen.add(r.hashedId)
    }
  })

  // Add allItems from defaults.json (items not in any category)
  dataProvider.allItems.value.forEach((item) => {
    if (item.hashedId && !seen.has(item.hashedId)) {
      items.push({
        hashId: item.hashedId,
        name: item.name,
        price: item.vendorPrice ?? 0,
      })
    }
  })

  return items
})

// Filtered items based on search
const filteredItems = computed(() => {
  if (!debouncedSearchQuery.value.trim()) return []

  const query = debouncedSearchQuery.value.toLowerCase()
  return allItems.value
    .filter((item) => item.name.toLowerCase().includes(query))
    .slice(0, MAX_SEARCH_RESULTS)
})

// Add item to inventory
const addItemToInventory = (hashId: string, vendorPrice: number, name: string) => {
  const quantityStr = prompt('Enter quantity:', '1')
  if (!quantityStr) return

  const quantity = parseInt(quantityStr)
  if (isNaN(quantity) || quantity <= 0) {
    showToast('Invalid quantity', 'error')
    return
  }

  tracker.setItemQuantity(hashId, quantity, vendorPrice, name)
  searchQuery.value = ''
  debouncedSearchQuery.value = ''
  showToast('Item added to pending changes', 'success')
}

// Edit quantity in inventory
const editQuantity = (hashId: string, currentPrice: number) => {
  const currentItem = tracker.getEffectiveInventory.value.find(
    (item) => item.hashId === hashId
  )
  const currentQty = currentItem?.quantity || 0

  const quantityStr = prompt('Enter new quantity:', String(currentQty))
  if (!quantityStr) return

  const quantity = parseInt(quantityStr)
  if (isNaN(quantity) || quantity < 0) {
    showToast('Invalid quantity', 'error')
    return
  }

  if (quantity === 0) {
    tracker.removeItem(hashId)
  } else {
    tracker.setItemQuantity(hashId, quantity, currentPrice)
  }
}

// Remove item from inventory
const removeFromInventory = (hashId: string) => {
  tracker.removeItem(hashId)
}

// Save snapshot
const handleSaveSnapshot = () => {
  if (!tracker.activeCharacter.value) {
    showToast('No active character', 'error')
    return
  }

  tracker.saveSnapshot()
  showToast('Snapshot saved', 'success')

  // Recreate chart after save
  nextTick(() => {
    setTimeout(() => createChart(), 150)
  })
}

// Discard changes
const handleDiscardChanges = () => {
  tracker.discardChanges()
  showToast('Changes discarded', 'success')
}

// Current inventory value
const currentValue = computed(() => {
  if (!tracker.activeCharacter.value) return 0

  const inventoryValue = tracker.getEffectiveInventory.value.reduce((sum, item) => {
    return sum + item.quantity * item.priceAtTime
  }, 0)

  return goldInput.value + inventoryValue
})

// Check if item is in pending changes
const isPendingChange = (hashId: string): boolean => {
  return tracker.pendingChanges.value.has(hashId)
}

// Chart data
const chartData = computed(() => {
  if (!tracker.activeCharacter.value || tracker.activeCharacter.value.history.length === 0) {
    return { labels: [], datasets: [] }
  }

  const history = tracker.activeCharacter.value.history
  const labels = history.map((snapshot) => {
    const date = new Date(snapshot.timestamp)
    return date.toLocaleDateString()
  })

  const data = history.map((snapshot) => {
    return tracker.calculateSnapshotValue(snapshot)
  })

  return {
    labels,
    datasets: [
      {
        label: 'Total Value (gold)',
        data,
        borderColor: 'rgba(56, 189, 248, 1)',
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: 'rgba(56, 189, 248, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
    ],
  }
})

const hasChartData = computed(() => {
  return (
    tracker.activeCharacter.value &&
    tracker.activeCharacter.value.history.length > 0
  )
})

const createChart = () => {
  if (!chartCanvas.value || !hasChartData.value) return

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
              const value = context.parsed.y
              if (value === null) return ''
              return `Total Value: ${Math.round(value).toLocaleString()} gold`
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
  if (searchDebounceTimeout.value) {
    clearTimeout(searchDebounceTimeout.value)
  }
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})

// Watch for chart data changes
watch(
  chartData,
  () => {
    if (chartInstance) {
      updateChart()
    } else if (hasChartData.value) {
      nextTick(() => setTimeout(() => createChart(), 150))
    }
  },
  { deep: true }
)
</script>

<template>
  <div class="character-tracker">
    <!-- 1. Character selector bar -->
    <div class="character-selector">
      <div class="character-pills">
        <button
          v-for="char in tracker.characters.value"
          :key="char.id"
          :class="['character-pill', { active: tracker.activeCharacter.value?.id === char.id }]"
          @click="tracker.setActiveCharacter(char.id)"
        >
          {{ char.name }}
        </button>
        <button
          v-if="!showAddCharacter"
          class="add-character-btn"
          @click="showAddCharacter = true"
        >
          + Add Character
        </button>
        <div v-if="showAddCharacter" class="add-character-inline">
          <input
            v-model="newCharacterName"
            type="text"
            placeholder="Character name"
            class="character-name-input"
            @keyup.enter="handleAddCharacter"
            @keyup.escape="showAddCharacter = false"
          />
          <button class="btn-save" @click="handleAddCharacter">Create</button>
          <button class="btn-cancel" @click="showAddCharacter = false">Cancel</button>
        </div>
      </div>
      <div v-if="tracker.activeCharacter.value" class="character-actions">
        <button class="btn-action" @click="handleRenameCharacter">Rename</button>
        <button class="btn-action btn-danger" @click="handleDeleteCharacter">Delete</button>
      </div>
    </div>

    <div v-if="!tracker.activeCharacter.value" class="empty-state">
      <p>No active character. Create a character to get started.</p>
    </div>

    <template v-if="tracker.activeCharacter.value">
      <!-- 2. Gold input -->
      <div class="gold-section">
        <label class="gold-label">Gold:</label>
        <input
          v-model.number="goldInput"
          type="number"
          min="0"
          class="gold-input"
          @change="handleGoldChange"
        />
      </div>

      <!-- 3. Inventory table -->
      <div class="inventory-section">
        <h3 class="section-title">Inventory</h3>
        <div v-if="tracker.getEffectiveInventory.value.length === 0" class="empty-state">
          <p>No items in inventory. Search for items below to add them.</p>
        </div>
        <table v-else class="inventory-table">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Quantity</th>
              <th>Price (at time)</th>
              <th>Total Value</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in tracker.getEffectiveInventory.value"
              :key="item.hashId"
              :class="{ 'pending-change': isPendingChange(item.hashId) }"
            >
              <td>{{ tracker.resolveItemName(item.hashId) }}</td>
              <td>{{ item.quantity }}</td>
              <td>{{ item.priceAtTime.toLocaleString() }}</td>
              <td>{{ (item.quantity * item.priceAtTime).toLocaleString() }}</td>
              <td>
                <button class="btn-small" @click="editQuantity(item.hashId, item.priceAtTime)">
                  Edit
                </button>
                <button
                  class="btn-small btn-danger"
                  @click="removeFromInventory(item.hashId)"
                >
                  Remove
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 4. Add item section -->
      <div class="add-item-section">
        <h3 class="section-title">Add Item</h3>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search for items..."
          class="item-search-input"
        />
        <div v-if="debouncedSearchQuery && filteredItems.length === 0" class="search-no-results">
          No items found
        </div>
        <div v-else-if="filteredItems.length > 0" class="search-results">
          <button
            v-for="item in filteredItems"
            :key="item.hashId"
            class="search-result-item"
            @click="addItemToInventory(item.hashId, item.price, item.name)"
          >
            <span class="item-name">{{ item.name }}</span>
            <span class="item-price">{{ item.price.toLocaleString() }} gold</span>
          </button>
        </div>
      </div>

      <!-- 5. Action bar -->
      <div class="action-bar">
        <button
          class="tracker-btn-primary"
          :disabled="!tracker.hasPendingChanges.value"
          @click="handleSaveSnapshot"
        >
          Save Snapshot
        </button>
        <button
          class="tracker-btn-secondary"
          :disabled="!tracker.hasPendingChanges.value"
          @click="handleDiscardChanges"
        >
          Discard Changes
        </button>
      </div>

      <!-- 6. Value summary card -->
      <div class="value-summary">
        <h3 class="section-title">Current Value</h3>
        <div class="value-grid">
          <div class="value-item">
            <span class="value-label">Gold:</span>
            <span class="value-amount">{{ goldInput.toLocaleString() }}</span>
          </div>
          <div class="value-item">
            <span class="value-label">Inventory:</span>
            <span class="value-amount">{{
              tracker.getEffectiveInventory.value
                .reduce((sum, item) => sum + item.quantity * item.priceAtTime, 0)
                .toLocaleString()
            }}</span>
          </div>
          <div class="value-item value-total">
            <span class="value-label">Total:</span>
            <span class="value-amount">{{ currentValue.toLocaleString() }}</span>
          </div>
        </div>
      </div>

      <!-- 7. Value history chart -->
      <div class="chart-section">
        <h3 class="section-title">Value History</h3>
        <div v-if="hasChartData" ref="chartContainer" class="chart-container">
          <canvas ref="chartCanvas"></canvas>
        </div>
        <div v-else class="empty-state">
          <p>No history yet. Save a snapshot to start tracking value over time.</p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.character-tracker {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Character selector */
.character-selector {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  padding: 1rem;
  box-shadow: var(--surface-shadow);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.character-pills {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.character-pill {
  padding: 0.5rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.character-pill:hover {
  background: rgba(255, 255, 255, 0.06);
}

.character-pill.active {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: white;
  font-weight: 600;
}

.add-character-btn {
  padding: 0.5rem 1rem;
  background: var(--accent-primary);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
  transition: opacity 0.2s;
}

.add-character-btn:hover {
  opacity: 0.9;
}

.add-character-inline {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.character-name-input {
  padding: 0.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.875rem;
  width: 150px;
}

.character-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-action {
  padding: 0.5rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.btn-action:hover {
  background: rgba(255, 255, 255, 0.06);
}

.btn-action.btn-danger {
  border-color: rgba(239, 68, 68, 0.5);
  color: rgba(239, 68, 68, 1);
}

.btn-action.btn-danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

/* Gold section */
.gold-section {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  padding: 1rem;
  box-shadow: var(--surface-shadow);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.gold-label {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.gold-input {
  padding: 0.5rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 1rem;
  width: 200px;
}

/* Inventory section */
.inventory-section {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  padding: 1.5rem;
  box-shadow: var(--surface-shadow);
}

.section-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 1rem 0;
}

.inventory-table {
  width: 100%;
  border-collapse: collapse;
}

.inventory-table th {
  text-align: left;
  padding: 0.75rem;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 2px solid var(--border-color);
}

.inventory-table td {
  padding: 0.75rem;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
}

.inventory-table tr.pending-change {
  background: rgba(251, 191, 36, 0.1);
}

.inventory-table tr.pending-change td {
  border-left: 3px solid rgba(251, 191, 36, 0.8);
}

.btn-small {
  padding: 0.25rem 0.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.75rem;
  margin-right: 0.5rem;
  transition: all 0.2s;
}

.btn-small:hover {
  background: rgba(255, 255, 255, 0.06);
}

.btn-small.btn-danger {
  border-color: rgba(239, 68, 68, 0.5);
  color: rgba(239, 68, 68, 1);
}

.btn-small.btn-danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

/* Add item section */
.add-item-section {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  padding: 1.5rem;
  box-shadow: var(--surface-shadow);
}

.item-search-input {
  width: 100%;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.search-results {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
}

.search-result-item {
  padding: 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
}

.search-result-item:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--accent-primary);
}

.item-name {
  color: var(--text-primary);
  font-size: 0.875rem;
}

.item-price {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.search-no-results {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.875rem;
  text-align: center;
}

/* Action bar */
.action-bar {
  display: flex;
  gap: 1rem;
}

.tracker-btn-primary,
.tracker-btn-secondary {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.tracker-btn-primary {
  background: var(--accent-primary);
  color: white;
}

.tracker-btn-primary:disabled {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: not-allowed;
  opacity: 0.5;
}

.tracker-btn-secondary {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

.tracker-btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tracker-btn-primary:not(:disabled):hover,
.tracker-btn-secondary:not(:disabled):hover {
  opacity: 0.9;
}

.btn-save,
.btn-cancel {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-save {
  background: var(--accent-primary);
  color: white;
}

.btn-cancel {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

/* Value summary */
.value-summary {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  padding: 1.5rem;
  box-shadow: var(--surface-shadow);
}

.value-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.value-item {
  display: flex;
  justify-content: space-between;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 6px;
}

.value-item.value-total {
  background: var(--accent-primary);
}

.value-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.value-item.value-total .value-label {
  color: rgba(255, 255, 255, 0.9);
}

.value-amount {
  font-size: 1.125rem;
  color: var(--text-primary);
  font-weight: 700;
}

.value-item.value-total .value-amount {
  color: white;
}

/* Chart section */
.chart-section {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  padding: 1.5rem;
  box-shadow: var(--surface-shadow);
}

.chart-container {
  position: relative;
  height: 400px;
  width: 100%;
}

/* Empty state */
.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

/* Mobile responsiveness */
@media (max-width: 767px) {
  .character-selector {
    flex-direction: column;
    align-items: stretch;
  }

  .character-pills {
    justify-content: center;
  }

  .character-actions {
    justify-content: center;
  }

  .gold-section {
    flex-direction: column;
    align-items: stretch;
  }

  .gold-input {
    width: 100%;
  }

  .inventory-table {
    font-size: 0.75rem;
  }

  .inventory-table th,
  .inventory-table td {
    padding: 0.5rem;
  }

  .action-bar {
    flex-direction: column;
  }

  .value-grid {
    grid-template-columns: 1fr;
  }

  .chart-container {
    height: 300px;
  }
}
</style>

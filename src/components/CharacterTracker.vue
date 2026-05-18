<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)
import { useCharacterTracker } from '../composables/useCharacterTracker'
import { useDataProvider } from '../composables/useDataProvider'
import { useToast } from '../composables/useToast'
import HtmlImport from './HtmlImport.vue'

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

// HTML import modal
const showHtmlImport = ref(false)

// Constants
const MAX_SEARCH_RESULTS = 20

// Gold input for active character
const goldInput = ref(0)
const goldInputFocused = ref(false)

// Chart refs
const charChartContainer = ref<HTMLElement | null>(null)
const charChartCanvas = ref<HTMLCanvasElement | null>(null)
let charChartInstance: Chart | null = null

const allChartContainer = ref<HTMLElement | null>(null)
const allChartCanvas = ref<HTMLCanvasElement | null>(null)
let allChartInstance: Chart | null = null

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

const handleGoldFocus = () => {
  goldInputFocused.value = true
}

const handleGoldBlur = () => {
  goldInputFocused.value = false
  handleGoldChange()
}

// Formatted gold display
const formattedGold = computed(() => {
  return goldInput.value.toLocaleString()
})

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
  ;dataProvider.allItems.value.forEach((item: { hashedId?: string; name: string; vendorValue?: number }) => {
    if (item.hashedId && !seen.has(item.hashedId)) {
      items.push({
        hashId: item.hashedId,
        name: item.name,
        price: item.vendorValue ?? 0,
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

  // Recreate charts after save
  nextTick(() => {
    setTimeout(() => {
      createCharts()
    }, 150)
  })
}

// Discard changes
const handleDiscardChanges = () => {
  tracker.discardChanges()
  showToast('Changes discarded', 'success')
}

// Undo latest snapshot
const handleUndoSnapshot = () => {
  if (!tracker.activeCharacter.value) return
  if (!confirm('Undo the latest snapshot? This will restore the previous state.')) return
  tracker.undoLatestSnapshot()
  goldInput.value = tracker.activeCharacter.value?.gold ?? 0
  showToast('Latest snapshot undone', 'success')
  nextTick(() => {
    setTimeout(() => {
      createCharts()
    }, 150)
  })
}

// Current inventory value
const inventoryValue = computed(() => {
  return tracker.getEffectiveInventory.value.reduce((sum, item) => {
    return sum + item.quantity * item.priceAtTime
  }, 0)
})

const currentValue = computed(() => {
  if (!tracker.activeCharacter.value) return 0
  return goldInput.value + inventoryValue.value
})

// Check if item is in pending changes
const isPendingChange = (hashId: string): boolean => {
  return tracker.pendingChanges.value.has(hashId)
}

// 15-minute aggregation helper for chart data
function aggregateTo15MinBuckets(
  entries: { timestamp: string; value: number }[]
): { label: string; value: number }[] {
  if (entries.length === 0) return []

  const buckets = new Map<number, number>() // bucketKey (ms) → highest value

  for (const entry of entries) {
    const date = new Date(entry.timestamp)
    const ms = date.getTime()
    // Floor to nearest 15-minute boundary
    const bucketKey = ms - (ms % (15 * 60 * 1000))
    const existing = buckets.get(bucketKey)
    if (existing === undefined || entry.value > existing) {
      buckets.set(bucketKey, entry.value)
    }
  }

  const sorted = [...buckets.entries()].sort((a, b) => a[0] - b[0])
  return sorted.map(([bucketMs, value]) => {
    const date = new Date(bucketMs)
    return {
      label: date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      value,
    }
  })
}

// Active character total value chart data
const charChartData = computed(() => {
  const char = tracker.activeCharacter.value
  if (!char || char.history.length === 0) return { labels: [], datasets: [] }

  const entries = char.history.map((snap) => ({
    timestamp: snap.timestamp,
    value: tracker.calculateSnapshotValue(snap),
  }))
  const aggregated = aggregateTo15MinBuckets(entries)

  return {
    labels: aggregated.map((e) => e.label),
    datasets: [
      {
        label: char.name,
        data: aggregated.map((e) => e.value),
        borderColor: 'rgba(129, 140, 248, 1)',
        backgroundColor: 'rgba(129, 140, 248, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: 'rgba(129, 140, 248, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
    ],
  }
})

// All characters combined total value chart data
const allChartData = computed(() => {
  const allChars = tracker.characters.value
  if (allChars.length === 0) return { labels: [], datasets: [] }

  const timestampSet = new Set<string>()
  for (const char of allChars) {
    for (const snap of char.history) {
      timestampSet.add(snap.timestamp)
    }
  }
  if (timestampSet.size === 0) return { labels: [], datasets: [] }

  const timestamps = [...timestampSet].sort()

  const charValueLists = allChars.map((char) =>
    char.history
      .slice()
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map((snap) => ({ ts: snap.timestamp, val: tracker.calculateSnapshotValue(snap) }))
  )

  const charLastValues = new Array<number>(allChars.length).fill(0)
  const charIndices = new Array<number>(allChars.length).fill(0)
  const rawEntries: { timestamp: string; value: number }[] = []

  for (const ts of timestamps) {
    for (let ci = 0; ci < allChars.length; ci++) {
      const list = charValueLists[ci]
      while (charIndices[ci] < list.length && list[charIndices[ci]].ts <= ts) {
        charLastValues[ci] = list[charIndices[ci]].val
        charIndices[ci]++
      }
    }
    rawEntries.push({
      timestamp: ts,
      value: charLastValues.reduce((sum, v) => sum + v, 0),
    })
  }

  const aggregated = aggregateTo15MinBuckets(rawEntries)

  return {
    labels: aggregated.map((e) => e.label),
    datasets: [
      {
        label: 'All Characters',
        data: aggregated.map((e) => e.value),
        borderColor: 'rgba(56, 189, 248, 1)',
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: 'rgba(56, 189, 248, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
    ],
  }
})

const hasCharChartData = computed(() => charChartData.value.labels.length > 0)
const hasAllChartData = computed(() => allChartData.value.labels.length > 0)

const chartOptions = (isMobile: boolean): Record<string, unknown> => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(17, 23, 34, 0.95)',
      titleColor: '#e5e7eb',
      bodyColor: '#e5e7eb',
      borderColor: '#374151',
      borderWidth: 1,
      padding: 12,
      displayColors: true,
      callbacks: {
        label: function (context: { parsed: { y: number | null } }) {
          const value = context.parsed.y
          if (value === null) return ''
          return `${Math.round(value).toLocaleString()} gold`
        },
      },
    },
  },
  scales: {
    x: {
      grid: { color: '#374151' },
      border: { display: false },
      ticks: { color: '#9ca3af', font: { size: isMobile ? 10 : 11 } },
    },
    y: {
      beginAtZero: true,
      grid: { color: '#374151' },
      border: { display: false },
      ticks: {
        color: '#9ca3af',
        font: { size: isMobile ? 10 : 11 },
        callback: function (value: string | number) {
          return typeof value === 'number' ? Math.round(value).toLocaleString() : ''
        },
      },
    },
  },
})

const createCharts = () => {
  if (charChartInstance) { charChartInstance.destroy(); charChartInstance = null }
  if (allChartInstance) { allChartInstance.destroy(); allChartInstance = null }

  const isMobile = window.innerWidth <= 767

  if (hasCharChartData.value && charChartCanvas.value) {
    const ctx = charChartCanvas.value.getContext('2d')
    if (ctx) {
      charChartInstance = new Chart(ctx, { type: 'line', data: charChartData.value, options: chartOptions(isMobile) })
    }
  }

  if (hasAllChartData.value && allChartCanvas.value) {
    const ctx = allChartCanvas.value.getContext('2d')
    if (ctx) {
      allChartInstance = new Chart(ctx, { type: 'line', data: allChartData.value, options: chartOptions(isMobile) })
    }
  }
}

const updateCharts = () => {
  if (charChartInstance) { charChartInstance.data = charChartData.value; charChartInstance.update() }
  if (allChartInstance) { allChartInstance.data = allChartData.value; allChartInstance.update() }
}

onMounted(() => {
  nextTick(() => setTimeout(() => createCharts(), 150))

  const containers = [charChartContainer.value, allChartContainer.value].filter(Boolean) as HTMLElement[]
  if (containers.length > 0 && typeof window !== 'undefined') {
    // eslint-disable-next-line no-undef
    resizeObserver = new ResizeObserver(() => {
      if (charChartInstance) charChartInstance.resize()
      if (allChartInstance) allChartInstance.resize()
    })
    containers.forEach((el) => resizeObserver!.observe(el))
  }
})

onBeforeUnmount(() => {
  if (searchDebounceTimeout.value) clearTimeout(searchDebounceTimeout.value)
  if (charChartInstance) { charChartInstance.destroy(); charChartInstance = null }
  if (allChartInstance) { allChartInstance.destroy(); allChartInstance = null }
  if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null }
})

watch(
  [charChartData, allChartData],
  () => {
    if (charChartInstance || allChartInstance) {
      updateCharts()
    } else if (hasCharChartData.value || hasAllChartData.value) {
      nextTick(() => setTimeout(() => createCharts(), 150))
    }
  },
  { deep: true }
)
</script>

<template>
  <div class="character-tracker">
    <!-- Top bar: character selector + actions -->
    <div class="top-bar">
      <div class="top-bar-left">
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
            + Add
          </button>
          <div v-if="showAddCharacter" class="add-character-inline">
            <input
              v-model="newCharacterName"
              type="text"
              placeholder="Name"
              class="character-name-input"
              @keyup.enter="handleAddCharacter"
              @keyup.escape="showAddCharacter = false"
            />
            <button class="btn-save" @click="handleAddCharacter">Create</button>
            <button class="btn-cancel" @click="showAddCharacter = false">✕</button>
          </div>
        </div>
      </div>
      <div v-if="tracker.activeCharacter.value" class="top-bar-right">
        <div class="top-bar-actions">
          <button class="btn-action" title="Rename character" @click="handleRenameCharacter">Rename</button>
          <button class="btn-action btn-danger" title="Delete character" @click="handleDeleteCharacter">Delete</button>
          <button class="html-import-btn" @click="showHtmlImport = true">
            <svg
width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            Import Inventory
          </button>
          <button
            v-if="tracker.canUndoSnapshot.value && !tracker.hasPendingChanges.value"
            class="btn-action btn-undo"
            title="Undo latest snapshot"
            @click="handleUndoSnapshot"
          >
            Undo
          </button>
        </div>
        <div v-if="tracker.hasPendingChanges.value" class="top-bar-save">
          <button
            class="tracker-btn-primary pulse-glow"
            @click="handleSaveSnapshot"
          >
            Save Snapshot
          </button>
          <button
            class="tracker-btn-secondary"
            @click="handleDiscardChanges"
          >
            Discard
          </button>
        </div>
      </div>
    </div>

    <div v-if="!tracker.activeCharacter.value" class="empty-state empty-state-hero">
      <div class="empty-state-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="22" y1="11" x2="16" y2="11" />
        </svg>
      </div>
      <p class="empty-state-title">No characters yet</p>
      <p class="empty-state-desc">Create a character to start tracking gold, inventory, and total value over time.</p>
    </div>

    <template v-if="tracker.activeCharacter.value">
      <!-- 2-column dashboard -->
      <div class="dashboard-grid">
        <!-- Left column -->
        <div class="dashboard-left">
          <!-- Gold + Value summary (compact row) -->
          <div class="gold-value-row">
            <div class="gold-input-group">
              <label class="gold-label">Gold</label>
              <div class="gold-input-wrapper">
                <input
                  v-if="goldInputFocused"
                  ref="goldInputRef"
                  v-model.number="goldInput"
                  type="number"
                  min="0"
                  class="gold-input"
                  @blur="handleGoldBlur"
                  @focus="handleGoldFocus"
                />
                <input
                  v-else
                  class="gold-input gold-input-display"
                  :value="formattedGold"
                  readonly
                  @focus="handleGoldFocus"
                />
              </div>
            </div>
            <div class="value-badges">
              <div class="value-badge">
                <span class="value-badge-label">Inventory</span>
                <span class="value-badge-amount">{{ inventoryValue.toLocaleString() }}</span>
              </div>
              <div class="value-badge value-badge-total">
                <span class="value-badge-label">Total</span>
                <span class="value-badge-amount">{{ currentValue.toLocaleString() }}</span>
              </div>
            </div>
          </div>

          <!-- Inventory section with integrated search -->
          <div class="inventory-section">
            <div class="inventory-header">
              <h3 class="section-title">Inventory</h3>
              <div class="search-wrapper">
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search items to add..."
                  class="item-search-input"
                />
                <div v-if="debouncedSearchQuery && filteredItems.length === 0" class="search-no-results">
                  No items found
                </div>
                <div v-else-if="filteredItems.length > 0" class="search-results-dropdown">
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
            </div>
            <div v-if="tracker.getEffectiveInventory.value.length === 0" class="empty-state empty-inventory">
              <p>No items in inventory. Use the search above to add items.</p>
            </div>
            <table v-else class="inventory-table mobile-card-layout">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Value</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in tracker.getEffectiveInventory.value"
                  :key="item.hashId"
                  :class="{ 'pending-change': isPendingChange(item.hashId) }"
                >
                  <td data-label="Item" class="name-cell">{{ tracker.resolveItemName(item.hashId) }}</td>
                  <td data-label="Qty">{{ item.quantity }}</td>
                  <td data-label="Price">{{ item.priceAtTime.toLocaleString() }}</td>
                  <td data-label="Value">{{ (item.quantity * item.priceAtTime).toLocaleString() }}</td>
                  <td data-label="" class="actions-cell">
                    <button class="btn-small" @click="editQuantity(item.hashId, item.priceAtTime)">
                      Edit
                    </button>
                    <button
                      class="btn-small btn-danger"
                      @click="removeFromInventory(item.hashId)"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Right column -->
        <div class="dashboard-right">
          <!-- Active character value chart -->
          <div class="chart-card">
            <h4 class="chart-title">{{ tracker.activeCharacter.value?.name ?? 'Character' }}</h4>
            <div v-if="hasCharChartData" ref="charChartContainer" class="chart-container chart-container-md">
              <canvas ref="charChartCanvas"></canvas>
            </div>
            <div v-else class="empty-state empty-chart">
              <p>No snapshots yet.</p>
            </div>
          </div>

          <!-- All characters combined value chart -->
          <div class="chart-card">
            <h4 class="chart-title">All Characters</h4>
            <div v-if="hasAllChartData" ref="allChartContainer" class="chart-container chart-container-md">
              <canvas ref="allChartCanvas"></canvas>
            </div>
            <div v-else class="empty-state empty-chart">
              <p>Save a snapshot to start tracking.</p>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- HTML import modal (teleported to body for z-index stacking) -->
    <Teleport to="body">
      <HtmlImport
        v-if="showHtmlImport"
        @close="showHtmlImport = false"
        @imported="showHtmlImport = false"
      />
    </Teleport>
  </div>
</template>

<style scoped>
.character-tracker {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* ===== Top bar ===== */
.top-bar {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  padding: 0.75rem 1rem;
  box-shadow: var(--surface-shadow);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.top-bar-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.top-bar-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.top-bar-actions {
  display: flex;
  gap: 0.375rem;
}

.top-bar-save {
  display: flex;
  gap: 0.375rem;
}

.character-pills {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
  align-items: center;
}

.character-pill {
  padding: 0.375rem 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.8125rem;
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
  padding: 0.375rem 0.75rem;
  background: var(--accent-primary);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 600;
  transition: opacity 0.2s;
}

.add-character-btn:hover {
  opacity: 0.9;
}

.add-character-inline {
  display: flex;
  gap: 0.375rem;
  align-items: center;
}

.character-name-input {
  padding: 0.375rem 0.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.8125rem;
  width: 120px;
}

.btn-action {
  padding: 0.375rem 0.625rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.75rem;
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

.btn-action.btn-undo {
  border-color: rgba(251, 191, 36, 0.5);
  color: rgba(251, 191, 36, 1);
}

.btn-action.btn-undo:hover {
  background: rgba(251, 191, 36, 0.1);
}

.html-import-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.625rem;
  min-height: unset;
  height: 30px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s var(--ease-in-out);
  white-space: nowrap;
  flex-shrink: 0;
}

.html-import-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

/* Action buttons */
.tracker-btn-primary,
.tracker-btn-secondary {
  padding: 0.375rem 0.875rem;
  border: none;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
  white-space: nowrap;
}

.tracker-btn-primary {
  background: var(--accent-primary);
  color: white;
}

.tracker-btn-secondary {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

.tracker-btn-primary:not(:disabled):hover,
.tracker-btn-secondary:not(:disabled):hover {
  opacity: 0.9;
}

/* Pulse/glow animation for pending changes */
@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 4px 1px rgba(99, 102, 241, 0.3);
  }
  50% {
    box-shadow: 0 0 12px 4px rgba(99, 102, 241, 0.5);
  }
}

.pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}

.btn-save,
.btn-cancel {
  padding: 0.375rem 0.75rem;
  border: none;
  border-radius: 6px;
  font-size: 0.8125rem;
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

/* ===== Dashboard grid ===== */
.dashboard-grid {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.dashboard-left {
  flex: 3;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dashboard-right {
  flex: 2;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* ===== Gold + Value summary row ===== */
.gold-value-row {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  padding: 0.75rem 1rem;
  box-shadow: var(--surface-shadow);
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.gold-input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.gold-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--warning);
  white-space: nowrap;
}

.gold-input-wrapper {
  position: relative;
}

.gold-input {
  padding: 0.375rem 0.625rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.875rem;
  width: 140px;
  font-variant-numeric: tabular-nums;
}

.gold-input-display {
  cursor: text;
}

.gold-input-display:hover {
  border-color: var(--accent-primary);
}

.value-badges {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}

.value-badge {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 0.375rem 0.75rem;
  background: var(--bg-secondary);
  border-radius: 6px;
}

.value-badge-total {
  background: var(--accent-primary);
}

.value-badge-label {
  font-size: 0.625rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.value-badge-total .value-badge-label {
  color: rgba(255, 255, 255, 0.8);
}

.value-badge-amount {
  font-size: 0.9375rem;
  color: var(--text-primary);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.value-badge-total .value-badge-amount {
  color: white;
}

/* ===== Inventory section ===== */
.inventory-section {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  padding: 1rem;
  box-shadow: var(--surface-shadow);
}

.inventory-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.section-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
}

.search-wrapper {
  position: relative;
  flex: 1;
  min-width: 180px;
}

.item-search-input {
  width: 100%;
  padding: 0.4375rem 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.8125rem;
}

.item-search-input:focus {
  outline: none;
  border-color: var(--accent-primary);
}

.search-results-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 20;
  margin-top: 4px;
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  max-height: 240px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.search-result-item {
  padding: 0.5rem 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: background 0.15s;
  border: none;
  background: none;
  text-align: left;
  width: 100%;
}

.search-result-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.search-result-item + .search-result-item {
  border-top: 1px solid var(--border-color);
}

.item-name {
  color: var(--text-primary);
  font-size: 0.8125rem;
}

.item-price {
  color: var(--text-secondary);
  font-size: 0.75rem;
  white-space: nowrap;
  margin-left: 1rem;
}

.search-no-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 20;
  margin-top: 4px;
  padding: 0.75rem;
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  color: var(--text-secondary);
  font-size: 0.8125rem;
  text-align: center;
}

.inventory-table {
  width: 100%;
  border-collapse: collapse;
}

.inventory-table th {
  text-align: left;
  padding: 0.5rem;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 2px solid var(--border-color);
}

.inventory-table td {
  padding: 0.5rem;
  color: var(--text-primary);
  font-size: 0.8125rem;
  border-bottom: 1px solid var(--border-color);
}

.inventory-table tr.pending-change {
  background: rgba(251, 191, 36, 0.1);
}

.inventory-table tr.pending-change td {
  border-left: 3px solid rgba(251, 191, 36, 0.8);
}

.name-cell {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actions-cell {
  white-space: nowrap;
}

.btn-small {
  padding: 0.1875rem 0.375rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.6875rem;
  margin-right: 0.25rem;
  transition: all 0.2s;
  min-height: 26px;
  min-width: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
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

/* ===== Chart cards ===== */
.chart-card {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  padding: 0.75rem 1rem;
  box-shadow: var(--surface-shadow);
}

.chart-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 0 0 0.5rem 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.chart-container {
  position: relative;
  width: 100%;
}

.chart-container-md {
  height: 220px;
}

.empty-chart {
  padding: 1.5rem 1rem;
}

/* ===== Empty state ===== */
.empty-state {
  padding: 1.5rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.8125rem;
}

.empty-state-hero {
  padding: 4rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
}

.empty-state-icon {
  color: var(--accent-primary);
  opacity: 0.6;
}

.empty-state-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.empty-state-desc {
  font-size: 0.875rem;
  color: var(--text-secondary);
  max-width: 360px;
  line-height: 1.5;
  margin: 0;
}

.empty-inventory {
  padding: 1rem;
}

.empty-inventory p {
  margin: 0;
}

/* ===== Mobile responsiveness ===== */
@media (max-width: 767px) {
  .top-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .top-bar-left,
  .top-bar-right {
    width: 100%;
  }

  .top-bar-right {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }

  .top-bar-actions {
    justify-content: center;
  }

  .top-bar-save {
    justify-content: center;
  }

  .character-pills {
    justify-content: center;
  }

  .dashboard-grid {
    flex-direction: column;
  }

  .gold-value-row {
    flex-direction: column;
    align-items: stretch;
  }

  .value-badges {
    margin-left: 0;
    justify-content: stretch;
  }

  .value-badge {
    flex: 1;
    align-items: center;
  }

  .gold-input {
    width: 100%;
  }

  .inventory-header {
    flex-direction: column;
    align-items: stretch;
  }

  .inventory-table {
    font-size: 0.75rem;
  }

  .inventory-table th,
  .inventory-table td {
    padding: 0.5rem;
  }

  .chart-container-md {
    height: 200px;
  }

  .btn-small {
    min-height: 44px;
    min-width: 44px;
  }

  /* Inventory mobile card overrides */
  .inventory-table.mobile-card-layout td[data-label='Value'] {
    font-weight: 700;
    color: var(--success);
    font-size: 1rem;
  }

  .inventory-table.mobile-card-layout td.actions-cell {
    order: 99;
    justify-content: flex-end;
    padding-top: 0.25rem;
  }

  .inventory-table.mobile-card-layout td.actions-cell::before {
    display: none;
  }
}
</style>

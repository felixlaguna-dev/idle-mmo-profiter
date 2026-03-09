<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useItemUses } from '../composables/useItemUses'
import { useHeatmap } from '../composables/useHeatmap'
import type { RankedActivity } from '../calculators/profitRanker'

const props = defineProps<{
  itemName: string
  anchorX: number
  anchorY: number
  visible: boolean
  rankedActivities: RankedActivity[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

// Get composables
const { getItemUses } = useItemUses()
const { getHeatmapStyle } = useHeatmap()

// Get item uses
const itemUses = computed(() => getItemUses(props.itemName))

// Add profit/hr to uses by matching with ranked activities
const usesWithProfit = computed(() => {
  const activityMap = new Map(props.rankedActivities.map((a) => [a.name, a]))

  return itemUses.value.uses.map((use) => {
    // Try to find matching activity
    let activity = activityMap.get(use.context)

    // For craftables with skill suffix, try removing the suffix
    if (!activity && use.type === 'craftable-material') {
      const contextWithoutSkill = use.context.replace(/ \((alchemy|forging)\)$/, '')
      activity = activityMap.get(contextWithoutSkill)
    }

    // For resource recipes, try removing skill suffix
    if (!activity && use.type === 'resource-material') {
      const contextWithoutSkill = use.context.replace(/ \((smelting|cooking|woodcutting|mining|fishing|hunt|dungeon)\)$/, '')
      activity = activityMap.get(contextWithoutSkill)
    }

    return {
      ...use,
      profitPerHour: activity?.profitPerHour,
    }
  })
})

// Group uses by category
const groupedUses = computed(() => {
  const groups = {
    craftable: usesWithProfit.value.filter((u) => u.type === 'craftable-material'),
    resource: usesWithProfit.value.filter((u) => u.type === 'resource-material'),
    dungeon: usesWithProfit.value.filter((u) => u.type === 'dungeon-drop'),
    gathering: usesWithProfit.value.filter((u) => u.type === 'gathering-source'),
    product: usesWithProfit.value.filter((u) => u.type === 'recipe-product'),
  }

  return groups
})

// Category keys for iteration
type CategoryKey = 'craftable' | 'resource' | 'dungeon' | 'gathering' | 'product'
const categoryKeys: CategoryKey[] = ['craftable', 'resource', 'dungeon', 'gathering', 'product']

// Check if mobile
const isMobile = ref(false)
const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

// Popover positioning
const popoverStyle = computed(() => {
  if (isMobile.value) {
    return {}
  }

  const padding = 8
  const popoverWidth = 400
  const minUsableHeight = 200

  // Position at cursor with slight offset
  let left = props.anchorX + 8
  let top = props.anchorY + 8

  // Clamp left to viewport bounds
  if (left + popoverWidth > window.innerWidth - padding) {
    left = window.innerWidth - popoverWidth - padding
  }
  if (left < padding) {
    left = padding
  }

  // Clamp top: constrain max-height to available space instead of flipping
  const availableBelow = window.innerHeight - top - padding
  let maxHeight = 500

  if (availableBelow < minUsableHeight) {
    // Not enough room below cursor — shift up just enough
    top = window.innerHeight - minUsableHeight - padding
    maxHeight = minUsableHeight
  } else if (availableBelow < maxHeight) {
    maxHeight = availableBelow
  }

  if (top < padding) {
    top = padding
  }

  return {
    position: 'fixed' as const,
    left: `${left}px`,
    top: `${top}px`,
    maxHeight: `${maxHeight}px`,
  }
})

// Close handlers
const close = () => {
  emit('close')
}

const handleClickOutside = (e: MouseEvent) => {
  if (props.visible) {
    const target = e.target as HTMLElement
    if (!target.closest('.item-uses-popover')) {
      close()
    }
  }
}

const handleEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.visible) {
    close()
  }
}

const handleScroll = (e: Event) => {
  if (props.visible && !isMobile.value) {
    // Don't close when scrolling inside the popover itself
    const target = e.target as HTMLElement
    if (target?.closest?.('.item-uses-popover')) return
    close()
  }
}

// Close on right-click outside so a new popover can open immediately
const handleContextMenuOutside = (e: MouseEvent) => {
  if (props.visible) {
    const target = e.target as HTMLElement
    if (!target.closest('.item-uses-popover')) {
      close()
    }
  }
}

// Setup listeners
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside)
        document.addEventListener('contextmenu', handleContextMenuOutside, true)
        document.addEventListener('keydown', handleEscape)
        document.addEventListener('scroll', handleScroll, true)
      }, 0)
    } else {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('contextmenu', handleContextMenuOutside, true)
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('scroll', handleScroll, true)
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('contextmenu', handleContextMenuOutside, true)
  document.removeEventListener('keydown', handleEscape)
  document.removeEventListener('scroll', handleScroll, true)
})

// Heatmap for profit values
const maxProfit = computed(() => {
  const profits = usesWithProfit.value
    .map((u) => u.profitPerHour || 0)
    .filter((p) => p > 0)
  return profits.length > 0 ? Math.max(...profits) : 0
})

const minProfit = computed(() => {
  const profits = usesWithProfit.value
    .map((u) => u.profitPerHour || 0)
    .filter((p) => p > 0)
  return profits.length > 0 ? Math.min(...profits) : 0
})

// Format profit
const formatProfit = (profit: number | undefined) => {
  if (profit === undefined) return ''
  return profit >= 0 ? `+${profit.toLocaleString()} g/h` : `${profit.toLocaleString()} g/h`
}

// Get category label
const getCategoryLabel = (category: string, count: number) => {
  const labels = {
    craftable: 'CRAFTING',
    resource: 'RESOURCE PROCESSING',
    dungeon: 'DUNGEON DROPS',
    gathering: 'GATHERING',
    product: 'PRODUCES',
  }
  return `${labels[category as keyof typeof labels]} (${count})`
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="item-uses-overlay" :class="{ mobile: isMobile }">
      <div
        class="item-uses-popover"
        :class="{ mobile: isMobile }"
        :style="popoverStyle"
        role="dialog"
        aria-modal="true"
        :aria-label="`Uses for ${itemName}`"
        @contextmenu.prevent
      >
        <!-- Header -->
        <div class="popover-header">
          <h3 class="popover-title">{{ itemName }}</h3>
          <button class="btn-close" aria-label="Close" @click="close">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="popover-content">
          <!-- No uses found -->
          <div v-if="itemUses.totalDemandSources === 0" class="empty-state">
            No demand sources found for this item.
          </div>

          <!-- Uses grouped by category -->
          <div v-else class="uses-list">
            <div
              v-for="category in categoryKeys"
              v-show="groupedUses[category].length > 0"
              :key="category"
              class="use-category"
            >
              <h4 class="category-header" :class="category">
                {{ getCategoryLabel(category, groupedUses[category].length) }}
              </h4>
              <div class="use-items">
                <div
                  v-for="(use, index) in groupedUses[category]"
                  :key="`${category}-${index}`"
                  class="use-item"
                >
                  <div class="use-main">
                    <span class="use-context">{{ use.context }}</span>
                    <span class="use-detail">{{ use.detail }}</span>
                  </div>
                  <div
                    v-if="use.profitPerHour !== undefined"
                    class="use-profit"
                    :style="getHeatmapStyle(use.profitPerHour, minProfit, maxProfit)"
                  >
                    {{ formatProfit(use.profitPerHour) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Overlay */
.item-uses-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 500;
  pointer-events: none;
}

.item-uses-overlay.mobile {
  background-color: rgba(0, 0, 0, 0.75);
  pointer-events: auto;
  display: flex;
  align-items: flex-end;
  animation: fadeIn 0.2s var(--ease-out);
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Popover */
.item-uses-popover {
  position: fixed;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  max-width: 400px;
  max-height: 500px;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  animation: popIn 0.2s var(--ease-out);
  z-index: 500;
}

@keyframes popIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.item-uses-popover.mobile {
  position: static;
  max-width: 100%;
  width: 100%;
  max-height: 75vh;
  border-radius: 1rem 1rem 0 0;
  animation: slideUp 0.3s var(--ease-out);
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

/* Header */
.popover-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
}

.popover-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.btn-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
  transition: all 0.2s var(--ease-out);
  min-width: 32px;
  min-height: 32px;
}

.btn-close:hover {
  color: var(--text-primary);
  background-color: var(--bg-tertiary);
}

.btn-close:focus {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}

/* Content */
.popover-content {
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  padding: 0;
}

.empty-state {
  padding: 2rem 1.25rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

/* Uses List */
.uses-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.use-category {
  display: flex;
  flex-direction: column;
}

.category-header {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 0.75rem 1.25rem 0.5rem;
  margin: 0;
  color: var(--text-secondary);
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.category-header.craftable {
  color: #4ade80;
}

.category-header.resource {
  color: #60a5fa;
}

.category-header.dungeon {
  color: #c084fc;
}

.category-header.gathering {
  color: #fbbf24;
}

.category-header.product {
  color: #ec4899;
}

.use-items {
  display: flex;
  flex-direction: column;
}

.use-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
  transition: background-color 0.2s var(--ease-out);
}

.use-item:last-child {
  border-bottom: none;
}

.use-item:hover {
  background-color: var(--bg-tertiary);
}

.use-main {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.use-context {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.use-detail {
  font-size: 0.75rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.use-profit {
  font-size: 0.8125rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  white-space: nowrap;
  flex-shrink: 0;
}

/* Responsive */
@media (max-width: 767px) {
  .item-uses-popover {
    max-width: 100%;
  }

  .popover-header::before {
    content: '';
    position: absolute;
    top: 0.5rem;
    left: 50%;
    transform: translateX(-50%);
    width: 2.5rem;
    height: 0.25rem;
    background-color: var(--border-color);
    border-radius: 0.125rem;
  }
}
</style>

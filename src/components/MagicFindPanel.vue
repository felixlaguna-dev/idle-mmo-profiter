<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMagicFindConfig } from '../composables/useMagicFindConfig'
import EditableValue from './EditableValue.vue'

// Initialize magic find config composable
const { magicFind, dungeonMF, totalMF } = useMagicFindConfig()

// Local state for collapse/expand
const isExpanded = ref(false)

// Emit event when dungeon button is clicked
const emit = defineEmits<{
  (e: 'open-dungeon-selector'): void
}>()

// Toggle collapse state
const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
}

// Handle keyboard navigation for summary row
const handleSummaryKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    toggleExpanded()
  }
}

// Handle dungeon selector button click
const openDungeonSelector = () => {
  emit('open-dungeon-selector')
}

// Computed breakdown summary
const breakdownSummary = computed(() => {
  return `Streak: ${magicFind.value.streak} + Dungeons: ${dungeonMF.value} + Items: ${magicFind.value.item} + Bonus: ${magicFind.value.bonus} = Total: ${totalMF.value}`
})
</script>

<template>
  <div class="magic-find-panel">
    <!-- Summary row (always visible) -->
    <div
      class="summary-row"
      tabindex="0"
      role="button"
      :aria-label="isExpanded ? 'Collapse Magic Find settings' : 'Expand Magic Find settings'"
      @click="toggleExpanded"
      @keydown="handleSummaryKeydown"
    >
      <div class="summary-left">
        <span class="summary-label">Magic Find:</span>
        <span class="summary-value">{{ totalMF }}%</span>
      </div>

      <div class="summary-right">
        <button
          class="dungeon-button"
          :title="`${dungeonMF} completed dungeons`"
          @click.stop="openDungeonSelector"
        >
          Dungeons: {{ dungeonMF }}
        </button>

        <button
          class="chevron-button"
          :class="{ expanded: isExpanded }"
          :aria-label="isExpanded ? 'Collapse Magic Find settings' : 'Expand Magic Find settings'"
          :aria-expanded="isExpanded"
        >
          <svg
            class="chevron-icon"
            :class="{ expanded: isExpanded }"
            viewBox="0 0 20 20"
            fill="currentColor"
            width="20"
            height="20"
          >
            <path
              fill-rule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- Collapsible card -->
    <div v-show="isExpanded" class="collapsible-card">
      <div class="inputs-grid">
        <EditableValue
          v-model="magicFind.streak"
          :default-value="10"
          label="MF from Streak"
        />
        <EditableValue
          v-model="magicFind.item"
          :default-value="3"
          label="MF from Items"
        />
        <EditableValue
          v-model="magicFind.bonus"
          :default-value="10"
          label="MF from Bonus"
        />
      </div>

      <div class="breakdown-summary">
        {{ breakdownSummary }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.magic-find-panel {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  box-shadow: var(--surface-shadow);
  margin-bottom: 1rem;
  overflow: hidden;
}

/* Summary row */
.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background-color 0.2s var(--ease-out);
  min-height: 44px;
}

.summary-row:hover {
  background-color: rgba(255, 255, 255, 0.04);
}

.summary-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.summary-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.summary-value {
  font-size: 1rem;
  color: var(--text-primary);
  font-weight: 700;
}

.summary-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Dungeon button */
.dungeon-button {
  padding: 0.5rem 1rem;
  min-height: 44px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.15) 100%);
  color: var(--accent-primary);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 1.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
  white-space: nowrap;
}

.dungeon-button:hover {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(37, 99, 235, 0.25) 100%);
  border-color: var(--accent-primary);
  transform: translateY(-1px);
}

/* Chevron button */
.chevron-button {
  padding: 0;
  min-width: 44px;
  min-height: 44px;
  width: 44px;
  height: 44px;
  background-color: transparent;
  color: var(--text-secondary);
  border: none;
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
  display: flex;
  align-items: center;
  justify-content: center;
}

.chevron-button:hover {
  color: var(--text-primary);
}

.chevron-icon {
  transition: transform 0.2s var(--ease-out);
  transform: rotate(-90deg);
}

.chevron-icon.expanded {
  transform: rotate(0deg);
}

/* Collapsible card */
.collapsible-card {
  padding: 1rem;
  background-color: var(--bg-secondary);
  border-top: 1px solid var(--surface-border);
  animation: expandCard 0.2s var(--ease-out);
}

@keyframes expandCard {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 300px;
  }
}

/* Inputs grid */
.inputs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

/* Breakdown summary */
.breakdown-summary {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-align: center;
  padding: 0.5rem;
  background-color: rgba(255, 255, 255, 0.02);
  border-radius: 0.375rem;
  font-family: 'Courier New', monospace;
  font-variant-numeric: tabular-nums;
}

/* Mobile responsive */
@media (max-width: 767px) {
  .summary-row {
    padding: 0.625rem 0.75rem;
    flex-wrap: wrap;
  }

  .summary-left {
    flex: 1;
  }

  .summary-right {
    gap: 0.25rem;
  }

  .dungeon-button {
    padding: 0.5rem 0.875rem;
    font-size: 0.8125rem;
    min-height: 48px;
  }

  .chevron-button {
    min-width: 48px;
    min-height: 48px;
    width: 48px;
    height: 48px;
  }

  .inputs-grid {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .collapsible-card {
    padding: 0.75rem;
  }

  .breakdown-summary {
    font-size: 0.6875rem;
    padding: 0.375rem;
  }
}

/* Tablet responsive */
@media (min-width: 768px) and (max-width: 1023px) {
  .inputs-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMagicFindConfig } from '../composables/useMagicFindConfig'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

// Access the magic find composable
const { allSelectableDungeons, toggleDungeon, isDungeonCompleted, dungeonMF, MF_ONLY_DUNGEONS } =
  useMagicFindConfig()

// Refs for focus management
// eslint-disable-next-line no-undef
const modalCloseButtonRef = ref<HTMLButtonElement | null>(null)
const modalContentRef = ref<HTMLElement | null>(null)
let previousFocus: HTMLElement | null = null

// Separate dungeons into profit and MF-only categories
const profitDungeons = computed(() => {
  const mfOnlySet = new Set(MF_ONLY_DUNGEONS)
  return allSelectableDungeons.value.filter((name) => !mfOnlySet.has(name))
})

const mfOnlyDungeons = computed(() => {
  const mfOnlySet = new Set(MF_ONLY_DUNGEONS)
  return allSelectableDungeons.value.filter((name) => mfOnlySet.has(name))
})

// Selection counts
const selectedCount = computed(() => dungeonMF.value)
const totalCount = computed(() => allSelectableDungeons.value.length)

// Select/Deselect all handlers
const selectAll = () => {
  allSelectableDungeons.value.forEach((dungeon) => {
    if (!isDungeonCompleted(dungeon)) {
      toggleDungeon(dungeon)
    }
  })
}

const deselectAll = () => {
  allSelectableDungeons.value.forEach((dungeon) => {
    if (isDungeonCompleted(dungeon)) {
      toggleDungeon(dungeon)
    }
  })
}

// Close modal
const closeModal = () => {
  emit('update:modelValue', false)
  // Restore focus
  setTimeout(() => {
    previousFocus?.focus()
  }, 100)
}

// Focus trap
const getFocusableElements = (container: HTMLElement) => {
  const focusableSelectors = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
  ]
  return Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelectors.join(', '))
  ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)
}

const handleModalKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    closeModal()
    return
  }

  if (e.key !== 'Tab' || !modalContentRef.value) return

  const focusableElements = getFocusableElements(modalContentRef.value)
  if (focusableElements.length === 0) return

  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]

  if (e.shiftKey && document.activeElement === firstElement) {
    e.preventDefault()
    lastElement.focus()
  } else if (!e.shiftKey && document.activeElement === lastElement) {
    e.preventDefault()
    firstElement.focus()
  }
}

// Set focus on open
const onOpen = () => {
  previousFocus = document.activeElement as HTMLElement
  setTimeout(() => {
    modalCloseButtonRef.value?.focus()
  }, 100)
}

// Watch for modal open
onMounted(() => {
  if (props.modelValue) {
    onOpen()
  }
})
</script>

<template>
  <div
    v-if="modelValue"
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="dungeon-selector-title"
    @click.self="closeModal"
  >
    <div ref="modalContentRef" class="modal-content" @keydown="handleModalKeydown">
      <!-- Header -->
      <div class="modal-header">
        <div class="header-content">
          <h2 id="dungeon-selector-title" class="modal-title">Completed Dungeons</h2>
          <div class="selection-badge">{{ selectedCount }}/{{ totalCount }} selected</div>
        </div>
        <button
          ref="modalCloseButtonRef"
          class="btn-close"
          title="Close"
          aria-label="Close dungeon selector"
          @click="closeModal"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <button class="btn-action" @click="selectAll">Select All</button>
        <button class="btn-action" @click="deselectAll">Deselect All</button>
      </div>

      <!-- Dungeon List -->
      <div class="dungeon-list">
        <!-- Profit Dungeons -->
        <div class="dungeon-group">
          <label
            v-for="dungeon in profitDungeons"
            :key="dungeon"
            class="dungeon-item"
            :class="{ selected: isDungeonCompleted(dungeon) }"
          >
            <input
              type="checkbox"
              :checked="isDungeonCompleted(dungeon)"
              :aria-label="`Toggle ${dungeon} completion`"
              @change="toggleDungeon(dungeon)"
            />
            <span class="checkbox-custom"></span>
            <span class="dungeon-name">{{ dungeon }}</span>
          </label>
        </div>

        <!-- MF-Only Dungeons -->
        <div v-if="mfOnlyDungeons.length > 0" class="dungeon-group">
          <div class="group-divider">
            <span class="divider-line"></span>
            <span class="divider-label">MF-Only Dungeons</span>
            <span class="divider-line"></span>
          </div>
          <label
            v-for="dungeon in mfOnlyDungeons"
            :key="dungeon"
            class="dungeon-item"
            :class="{ selected: isDungeonCompleted(dungeon) }"
          >
            <input
              type="checkbox"
              :checked="isDungeonCompleted(dungeon)"
              :aria-label="`Toggle ${dungeon} completion`"
              @change="toggleDungeon(dungeon)"
            />
            <span class="checkbox-custom"></span>
            <span class="dungeon-name">
              {{ dungeon }}
              <span class="mf-badge">MF-only</span>
            </span>
          </label>
        </div>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <div class="footer-summary">Dungeon MF: +{{ dungeonMF }}</div>
        <button class="btn-done" @click="closeModal">Done</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Modal Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
  will-change: opacity;
  contain: layout style paint;
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

/* Modal Content */
.modal-content {
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  max-width: 480px;
  width: 100%;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  position: relative;
  will-change: transform, opacity;
  contain: layout style paint;
  animation: slideIn 0.3s var(--ease-out);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* Modal Header */
.modal-header {
  position: sticky;
  top: 0;
  background-color: var(--bg-primary);
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  z-index: 10;
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.selection-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  background-color: rgba(59, 130, 246, 0.15);
  color: var(--accent-primary);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.75rem;
  width: fit-content;
}

.btn-close {
  padding: 0.5rem;
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  flex-shrink: 0;
}

.btn-close:hover {
  background-color: rgba(239, 68, 68, 0.1);
  color: var(--danger);
  border-color: var(--danger);
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}

.btn-close:active {
  transform: scale(0.95);
  box-shadow: 0 1px 4px rgba(239, 68, 68, 0.2);
}

.btn-close:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
}

.btn-action {
  flex: 1;
  padding: 0.5rem 1rem;
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
  min-height: 36px;
}

.btn-action:hover {
  background-color: var(--bg-secondary);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.btn-action:active {
  transform: scale(0.98);
}

.btn-action:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}

/* Dungeon List */
.dungeon-list {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.dungeon-group {
  display: flex;
  flex-direction: column;
}

/* Group Divider */
.group-divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem 0.75rem;
  margin-top: 0.5rem;
}

.divider-line {
  flex: 1;
  height: 1px;
  background-color: var(--border-color);
}

.divider-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

/* Dungeon Item */
.dungeon-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background-color 0.2s var(--ease-out);
  min-height: 44px;
  user-select: none;
}

.dungeon-item:last-child {
  border-bottom: none;
}

.dungeon-item:hover {
  background-color: var(--bg-tertiary);
}

.dungeon-item.selected {
  background-color: rgba(59, 130, 246, 0.08);
}

.dungeon-item.selected:hover {
  background-color: rgba(59, 130, 246, 0.12);
}

/* Hide native checkbox */
.dungeon-item input[type='checkbox'] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

/* Custom Checkbox */
.checkbox-custom {
  position: relative;
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-color);
  border-radius: 0.25rem;
  background-color: var(--bg-tertiary);
  transition: all 0.2s var(--ease-out);
  flex-shrink: 0;
}

.dungeon-item:hover .checkbox-custom {
  border-color: var(--accent-primary);
}

.dungeon-item input[type='checkbox']:checked + .checkbox-custom {
  background-color: var(--accent-primary);
  border-color: var(--accent-primary);
}

.dungeon-item input[type='checkbox']:checked + .checkbox-custom::after {
  content: '';
  position: absolute;
  left: 6px;
  top: 2px;
  width: 4px;
  height: 10px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.dungeon-item input[type='checkbox']:focus + .checkbox-custom {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}

/* Dungeon Name */
.dungeon-name {
  font-size: 0.875rem;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

/* MF Badge */
.mf-badge {
  font-size: 0.6875rem;
  color: var(--text-secondary);
  font-style: italic;
  font-weight: 500;
}

/* Modal Footer */
.modal-footer {
  position: sticky;
  bottom: 0;
  background-color: var(--bg-primary);
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.footer-summary {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.btn-done {
  padding: 0.5rem 1.5rem;
  background-color: var(--accent-primary);
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
  min-height: 36px;
}

.btn-done:hover {
  background-color: var(--accent-hover);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
}

.btn-done:active {
  transform: scale(0.98);
}

.btn-done:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}

/* Mobile Responsive */
@media (max-width: 379px) {
  .modal-overlay {
    padding: 0;
    align-items: flex-end;
    background-color: rgba(0, 0, 0, 0.85);
  }

  .modal-content {
    max-height: 92vh;
    border-radius: 1.25rem 1.25rem 0 0;
    width: 100%;
    max-width: 100%;
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

  .modal-header {
    padding: 1rem 1.25rem;
  }

  .modal-header::before {
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

  .modal-title {
    font-size: 1.125rem;
  }

  .btn-close {
    min-width: 48px;
    min-height: 48px;
    padding: 0.75rem;
  }

  .action-buttons {
    padding: 0.75rem 1rem;
  }

  .dungeon-item {
    padding: 0.625rem 1rem;
    min-height: 48px;
  }

  .modal-footer {
    padding: 0.75rem 1rem;
  }
}
</style>

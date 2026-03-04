<script setup lang="ts">
import { ref } from 'vue'
import { useStorage } from '../composables/useStorage'
import {
  exportSettings,
  importSettings,
  resetToDefaults,
  resetAll,
} from '../composables/useSettingsManager'
import { useDataProvider } from '../composables/useDataProvider'
import { useToast } from '../composables/useToast'
import ApiKeyInput from './ApiKeyInput.vue'
import EditableValue from './EditableValue.vue'
import type { MagicFindSettings } from '../types'

// Default values
const DEFAULT_MF: MagicFindSettings = {
  streak: 10,
  dungeon: 13,
  item: 3,
  bonus: 10,
}
const DEFAULT_TAX_RATE = 0.12

// Reactive storage for settings
const magicFind = useStorage<MagicFindSettings>('magicFind', { ...DEFAULT_MF })
const marketTaxRate = useStorage<number>('marketTaxRate', DEFAULT_TAX_RATE)

// Convert tax rate to percentage for display
const taxRatePercent = ref(marketTaxRate.value * 100)

// Watch tax rate percentage and update the decimal value
const updateTaxRate = (newPercent: number) => {
  taxRatePercent.value = newPercent
  marketTaxRate.value = newPercent / 100
}

const fileInput = ref<HTMLInputElement | null>(null)

// Initialize data provider and toast
const dataProvider = useDataProvider()
const { success } = useToast()

const handleExport = () => {
  exportSettings()
}

const handleExportDefaultsJson = () => {
  const jsonString = dataProvider.exportAsDefaultsJson()
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'defaults.json'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  success('defaults.json exported successfully')
}

const handleImportClick = () => {
  fileInput.value?.click()
}

const handleImportFile = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    await importSettings(file)
    // Reset file input
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }
}

const handleResetToDefaults = () => {
  resetToDefaults()
}

const handleResetAll = () => {
  resetAll()
}
</script>

<template>
  <div class="settings-panel">
    <h2 id="settings-title" class="panel-title">Settings</h2>

    <!-- API Key Section -->
    <section class="settings-section">
      <ApiKeyInput />
    </section>

    <!-- Magic Find Settings Section -->
    <section class="settings-section" aria-labelledby="magic-find-title">
      <h3 id="magic-find-title" class="section-title">Magic Find Settings</h3>
      <div class="settings-grid">
        <EditableValue
          v-model="magicFind.streak"
          :default-value="DEFAULT_MF.streak"
          label="MF Streak"
        />
        <EditableValue v-model="magicFind.item" :default-value="DEFAULT_MF.item" label="MF Item" />
        <EditableValue
          v-model="magicFind.bonus"
          :default-value="DEFAULT_MF.bonus"
          label="MF Bonus"
        />
      </div>
      <p class="settings-note">
        <span aria-hidden="true">ℹ️</span> Dungeon MF is configured in the Dungeons tab
      </p>
    </section>

    <!-- Market Tax Rate Section -->
    <section class="settings-section" aria-labelledby="market-settings-title">
      <h3 id="market-settings-title" class="section-title">Market Settings</h3>
      <div class="settings-grid">
        <EditableValue
          :model-value="taxRatePercent"
          :default-value="DEFAULT_TAX_RATE * 100"
          label="Market Tax Rate"
          suffix="%"
          @update:model-value="updateTaxRate"
        />
      </div>
    </section>

    <!-- Import/Export Section -->
    <section class="settings-section" aria-labelledby="backup-restore-title">
      <h3 id="backup-restore-title" class="section-title">Backup & Restore</h3>
      <div class="button-row">
        <button class="btn-secondary" aria-label="Export settings to file" @click="handleExport">
          <span aria-hidden="true">📥</span> Export Settings
        </button>
        <button
          class="btn-secondary"
          aria-label="Import settings from file"
          @click="handleImportClick"
        >
          <span aria-hidden="true">📤</span> Import Settings
        </button>
        <button
          class="btn-secondary"
          aria-label="Export defaults.json file"
          @click="handleExportDefaultsJson"
        >
          <span aria-hidden="true">💾</span> Export defaults.json
        </button>
        <input
          ref="fileInput"
          type="file"
          accept=".json"
          style="display: none"
          aria-label="Select settings file to import"
          @change="handleImportFile"
        />
      </div>
    </section>

    <!-- Reset Section -->
    <section class="settings-section" aria-labelledby="reset-title">
      <h3 id="reset-title" class="section-title">Reset</h3>
      <div class="button-row">
        <button
          class="btn-warning"
          aria-label="Reset settings to default values"
          @click="handleResetToDefaults"
        >
          <span aria-hidden="true">🔄</span> Reset to Defaults
        </button>
        <button
          class="btn-danger"
          aria-label="Reset all settings including API key"
          @click="handleResetAll"
        >
          <span aria-hidden="true">⚠️</span> Reset All (including API key)
        </button>
      </div>
      <p class="reset-hint">Reset to Defaults: Clears all custom values but keeps your API key.</p>
      <p class="reset-hint">Reset All: Clears everything including your API key.</p>
    </section>
  </div>
</template>

<style scoped>
.settings-panel {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  padding: 2rem;
  max-width: 800px;
}

.panel-title {
  margin: 0 0 1.5rem 0;
  font-size: 1.5rem;
  color: var(--text-primary);
  border-bottom: 2px solid var(--border-color);
  padding-bottom: 0.75rem;
}

.settings-section {
  margin-bottom: 2rem;
}

.settings-section:last-child {
  margin-bottom: 0;
}

.section-title {
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
  color: var(--text-primary);
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  padding: 1rem;
  background-color: var(--bg-tertiary);
  border-radius: 0.375rem;
  border: 1px solid var(--border-color);
}

.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.btn-secondary,
.btn-warning,
.btn-danger {
  padding: 0.625rem 1.25rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-secondary {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background-color: var(--bg-primary);
  border-color: var(--accent-primary);
}

.btn-warning {
  background-color: rgba(245, 158, 11, 0.1);
  color: var(--warning);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.btn-warning:hover {
  background-color: rgba(245, 158, 11, 0.2);
  border-color: var(--warning);
}

.btn-danger {
  background-color: rgba(239, 68, 68, 0.1);
  color: var(--danger);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.btn-danger:hover {
  background-color: rgba(239, 68, 68, 0.2);
  border-color: var(--danger);
}

.reset-hint {
  margin: 0.5rem 0 0 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-style: italic;
}

.settings-note {
  margin: 0.75rem 0 0 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-style: italic;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

@media (max-width: 640px) {
  .settings-panel {
    padding: 1.5rem;
  }

  .settings-grid {
    grid-template-columns: 1fr;
  }

  .button-row {
    flex-direction: column;
  }

  .btn-secondary,
  .btn-warning,
  .btn-danger {
    width: 100%;
  }
}
</style>

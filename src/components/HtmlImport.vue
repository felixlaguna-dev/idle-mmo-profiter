<script setup lang="ts">
import { ref } from 'vue'
import { useHtmlImport, CONSOLE_SNIPPET } from '../composables/useHtmlImport'
import type { ImportResult } from '../composables/useHtmlImport'

// -------------------------------------------------------------------------
// Props / emits
// -------------------------------------------------------------------------

const emit = defineEmits<{
  close: []
  imported: []
}>()

// -------------------------------------------------------------------------
// Composable
// -------------------------------------------------------------------------

const htmlImport = useHtmlImport()

const { isProcessing, progress, hasResults, matchedCount, unrecognizedCount, results, errors, goldExtracted } = htmlImport

// -------------------------------------------------------------------------
// JSON paste state
// -------------------------------------------------------------------------

const jsonInput = ref('')
const snippetCopied = ref(false)

function handleJsonPaste(_event: ClipboardEvent): void {
  // Let the default paste happen (textarea handles it via v-model)
  // After a short delay, auto-parse
  setTimeout(() => {
    if (jsonInput.value.trim()) {
      handleParseJson()
    }
  }, 100)
}

function handleParseJson(): void {
  if (!jsonInput.value.trim()) return
  htmlImport.processJson(jsonInput.value)
}

function copySnippet(): void {
  navigator.clipboard.writeText(CONSOLE_SNIPPET)
  snippetCopied.value = true
  setTimeout(() => { snippetCopied.value = false }, 2000)
}

// -------------------------------------------------------------------------
// Results helpers
// -------------------------------------------------------------------------

/**
 * Progress percentage clamped to [0, 100].
 */
function progressPercent(): number {
  if (!progress.value.total) return 0
  return Math.min(100, Math.round((progress.value.current / progress.value.total) * 100))
}

function confidenceClass(_result: ImportResult): string {
  return 'badge-green'
}

function confidenceLabel(_result: ImportResult): string {
  return 'Exact'
}

// -------------------------------------------------------------------------
// Per-row quantity editing
// -------------------------------------------------------------------------

const editingQuantities = ref<Record<string, string>>({})

function rowKey(result: ImportResult): string {
  return `${result.gridPosition.row}-${result.gridPosition.col}`
}

function quantityForRow(result: ImportResult): string {
  const key = rowKey(result)
  return editingQuantities.value[key] ?? String(result.quantity)
}

function onQuantityInput(result: ImportResult, event: Event): void {
  const input = event.target as HTMLInputElement
  const key = rowKey(result)
  editingQuantities.value[key] = input.value
  const parsed = parseInt(input.value)
  if (!isNaN(parsed) && parsed >= 0) {
    result.quantity = parsed
  }
}

// -------------------------------------------------------------------------
// Actions
// -------------------------------------------------------------------------

function handleApply(): void {
  htmlImport.applyToInventory()
  htmlImport.clearResults()
  emit('imported')
  emit('close')
}

function handleCancel(): void {
  htmlImport.clearResults()
  emit('close')
}

function handleRescan(): void {
  htmlImport.clearResults()
  jsonInput.value = ''
}
</script>

<template>
  <div class="html-import-overlay" role="dialog" aria-modal="true" aria-label="Import from HTML">
    <!-- Backdrop -->
    <div class="hi-backdrop" @click="handleCancel" />

    <!-- Modal panel -->
    <div class="hi-panel">
      <!-- Header -->
      <div class="hi-header">
        <div class="hi-header-title">
          <svg
class="hi-header-icon" width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          Import Inventory
        </div>
        <button class="hi-close-btn" aria-label="Close" @click="handleCancel">
          <svg
width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="hi-body">

        <!-- ============================================================
             STATE 1: Paste area (no results, not processing)
             ============================================================ -->
        <template v-if="!isProcessing && !hasResults">
          <div class="hi-json-paste">
            <div class="hi-steps">
              <div class="hi-step">
                <span class="hi-step-num">1</span>
                <span class="hi-step-text">Open your <strong>inventory page</strong> in the browser</span>
              </div>
              <div class="hi-step">
                <span class="hi-step-num">2</span>
                <span class="hi-step-text">Open DevTools console (<kbd>F12</kbd> → <kbd>Console</kbd>)</span>
              </div>
              <div class="hi-step">
                <span class="hi-step-num">3</span>
                <div class="hi-step-text">
                  Paste this snippet and press <kbd>Enter</kbd>:
                  <div class="hi-snippet-row">
                    <code class="hi-snippet-code">{{ CONSOLE_SNIPPET }}</code>
                    <button
                      :class="['hi-copy-btn', { 'hi-copy-btn--copied': snippetCopied }]"
                      :title="snippetCopied ? 'Copied!' : 'Copy snippet'"
                      @click="copySnippet"
                    >
                      <svg v-if="!snippetCopied" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                  </div>
                  <div class="hi-snippet-row hi-snippet-row--bookmarklet">
                    <a
                      :href="'javascript:' + CONSOLE_SNIPPET"
                      class="hi-bookmarklet-link"
                      title="Drag me to your bookmarks bar"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                      </svg>
                      Drag to bookmarks
                    </a>
                    <span class="hi-bookmarklet-hint">or click on inventory page</span>
                  </div>
                </div>
              </div>
              <div class="hi-step">
                <span class="hi-step-num">4</span>
                <span class="hi-step-text">The snippet copies JSON to your clipboard — paste it below:</span>
              </div>
            </div>
            <textarea
              v-model="jsonInput"
              class="hi-json-textarea"
              placeholder='{"gold":12345,"items":[{"n":"Acorn","q":50,"k":"standard"}]}'
              spellcheck="false"
              @paste="handleJsonPaste"
            />
            <button
              class="hi-parse-btn"
              :disabled="!jsonInput.trim() || isProcessing"
              @click="handleParseJson"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              Parse Inventory
            </button>
          </div>
        </template>

        <!-- ============================================================
             STATE 2: Processing
             ============================================================ -->
        <template v-else-if="isProcessing">
          <div class="hi-processing">
            <div class="hi-processing-placeholder">
              <div class="hi-spinner hi-spinner--lg" aria-hidden="true" />
            </div>

            <div class="hi-progress-wrap">
              <p class="hi-progress-step" aria-live="polite">{{ progress.step }}</p>
              <div
class="hi-progress-bar-track" role="progressbar"
                :aria-valuenow="progressPercent()"
                aria-valuemin="0" aria-valuemax="100">
                <div
                  class="hi-progress-bar-fill"
                  :style="{ width: progress.total > 0 ? `${progressPercent()}%` : '100%' }"
                  :class="{ 'hi-progress-bar-fill--indeterminate': progress.total === 0 }"
                />
              </div>
              <p v-if="progress.total > 0" class="hi-progress-count">
                {{ progress.current }} / {{ progress.total }}
              </p>
            </div>
          </div>
        </template>

        <!-- ============================================================
             STATE 3: Results review
             ============================================================ -->
        <template v-else-if="hasResults">
          <!-- Summary bar -->
          <div class="hi-summary">
            <span class="hi-summary-chip hi-summary-chip--green">
              <svg
width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {{ matchedCount }} matched
            </span>
            <span v-if="unrecognizedCount > 0" class="hi-summary-chip hi-summary-chip--gray">
              <svg
width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {{ unrecognizedCount }} unrecognized
            </span>
            <span v-if="goldExtracted !== null" class="hi-summary-chip hi-summary-chip--gold">
              <svg
width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <text x="12" y="16" text-anchor="middle" font-size="12" fill="currentColor" stroke="none">G</text>
              </svg>
              {{ goldExtracted.toLocaleString() }} gold
            </span>
            <span v-if="htmlImport.characterName.value" class="hi-summary-chip hi-summary-chip--blue">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              {{ htmlImport.characterName.value }}
            </span>
          </div>

          <!-- Results list -->
          <div class="hi-results-pane">
            <p class="hi-pane-label">Detected items</p>
            <div class="hi-results-list">

              <!-- Matched items section -->
              <template v-if="results.length > 0">
                <p class="hi-section-label">Matched items</p>
                <div
                  v-for="result in results"
                  :key="rowKey(result)"
                  class="hi-result-row hi-result-row--matched"
                >
                  <div class="hi-result-info">
                    <span class="hi-result-name">{{ result.name }}</span>
                    <span :class="['hi-badge', confidenceClass(result)]">
                      {{ confidenceLabel(result) }}
                    </span>
                  </div>

                  <div class="hi-result-qty">
                    <label :for="`qty-${rowKey(result)}`" class="hi-qty-label">Qty</label>
                    <input
                      :id="`qty-${rowKey(result)}`"
                      type="number"
                      min="0"
                      class="hi-qty-input"
                      :value="quantityForRow(result)"
                      @input="onQuantityInput(result, $event)"
                    />
                  </div>
                </div>
              </template>

              <!-- Unrecognized items section -->
              <template v-if="errors.filter(e => e.reason === 'no_match').length > 0">
                <p class="hi-section-label hi-section-label--gray">Unrecognized items</p>
                <div
                  v-for="err in errors.filter(e => e.reason === 'no_match')"
                  :key="`err-${err.gridPosition.row}-${err.gridPosition.col}`"
                  class="hi-result-row hi-result-row--unrecognized"
                >
                  <div class="hi-result-info">
                    <span class="hi-result-name hi-result-name--muted">Unknown item</span>
                    <span class="hi-badge badge-gray">Skipped</span>
                  </div>
                </div>
              </template>

            </div>
          </div>
        </template>

      </div>

      <!-- Footer actions -->
      <div class="hi-footer">
        <template v-if="hasResults && !isProcessing">
          <button class="hi-btn hi-btn--tertiary" @click="handleRescan">
            Re-scan
          </button>
          <div class="hi-footer-right">
            <button class="hi-btn hi-btn--secondary" @click="handleCancel">
              Cancel
            </button>
            <button
              class="hi-btn hi-btn--primary"
              :disabled="matchedCount === 0"
              @click="handleApply"
            >
              Import {{ matchedCount }} item{{ matchedCount !== 1 ? 's' : '' }} to {{ htmlImport.characterName.value || 'inventory' }}
            </button>
          </div>
        </template>
        <template v-else>
          <div class="hi-footer-right">
            <button class="hi-btn hi-btn--secondary" @click="handleCancel">
              Cancel
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* =========================================================================
  Overlay / modal shell
  ========================================================================= */

.html-import-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.hi-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(3px);
}

.hi-panel {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 820px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  box-shadow: var(--surface-shadow), 0 20px 60px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

/* =========================================================================
  Header
  ========================================================================= */

.hi-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--surface-border);
  flex-shrink: 0;
}

.hi-header-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text-primary);
}

.hi-header-icon {
  color: var(--accent-primary);
  flex-shrink: 0;
}

.hi-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  min-height: unset;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text-secondary);
  transition: all 0.2s var(--ease-in-out);
  flex-shrink: 0;
}

.hi-close-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--surface-border);
  color: var(--text-primary);
  transform: none;
  box-shadow: none;
}

/* =========================================================================
  Body (scrollable area)
  ========================================================================= */

.hi-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-height: 0;
}

/* =========================================================================
  JSON paste mode
  ========================================================================= */

.hi-json-paste {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.hi-steps {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--surface-radius);
}

.hi-step {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.hi-step-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  min-height: unset;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--accent-primary);
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
}

.hi-step-text {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.6;
  padding-top: 2px;
}

.hi-step-text strong {
  color: var(--text-primary);
}

.hi-step-text kbd {
  display: inline-block;
  padding: 1px 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-family: var(--font-mono, monospace);
  font-size: 0.7rem;
  color: var(--text-primary);
}

.hi-snippet-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding: var(--space-2);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
}

.hi-snippet-code {
  flex: 1;
  font-family: var(--font-mono, 'JetBrains Mono', 'Fira Code', monospace);
  font-size: 0.65rem;
  line-height: 1.4;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-all;
}

.hi-copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  min-height: unset;
  padding: 0;
  background: var(--accent-primary);
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s var(--ease-in-out);
}

.hi-copy-btn:hover {
  background: var(--accent-hover);
}

.hi-copy-btn--copied {
  background: rgba(16, 185, 129, 0.9);
  border-color: rgba(16, 185, 129, 0.9);
}

.hi-snippet-row--bookmarklet {
  margin-top: 0.375rem;
  gap: 0.5rem;
  align-items: center;
}

.hi-bookmarklet-link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: var(--accent-primary);
  color: white;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  text-decoration: none;
  cursor: grab;
  transition: opacity 0.2s;
}

.hi-bookmarklet-link:hover {
  opacity: 0.9;
}

.hi-bookmarklet-link:active {
  cursor: grabbing;
}

.hi-bookmarklet-hint {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #6b7280);
}

.hi-json-textarea {
  width: 100%;
  min-height: 120px;
  max-height: 300px;
  padding: var(--space-3);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--surface-radius);
  color: var(--text-primary);
  font-family: var(--font-mono, 'JetBrains Mono', 'Fira Code', monospace);
  font-size: 0.75rem;
  line-height: 1.5;
  resize: vertical;
  tab-size: 2;
}

.hi-json-textarea::placeholder {
  color: var(--text-secondary);
  opacity: 0.4;
}

.hi-json-textarea:focus {
  border-color: var(--accent-primary);
  outline-color: var(--accent-primary);
}

.hi-parse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  margin: 0 auto;
  padding: 0.6rem 1.5rem;
  min-height: unset;
  height: 40px;
  background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-hover) 100%);
  border: 1px solid var(--accent-primary);
  border-radius: 6px;
  color: white;
  font-size: var(--text-md);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s var(--ease-in-out);
  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.25);
}

.hi-parse-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--accent-hover) 0%, #1e40af 100%);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  transform: none;
}

.hi-parse-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: none;
}

/* =========================================================================
  STATE 2: Processing
  ========================================================================= */

.hi-processing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-6) 0;
}

.hi-processing-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
}

/* Spinner */
.hi-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(59, 130, 246, 0.25);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: hi-spin 0.7s linear infinite;
}

.hi-spinner--lg {
  width: 48px;
  height: 48px;
  border-width: 4px;
}

@keyframes hi-spin {
  to { transform: rotate(360deg); }
}

.hi-progress-wrap {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.hi-progress-step {
  font-size: var(--text-md);
  color: var(--text-secondary);
  font-weight: 500;
}

.hi-progress-bar-track {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 9999px;
  overflow: hidden;
}

.hi-progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-primary), #38bdf8);
  border-radius: 9999px;
  transition: width 0.25s var(--ease-out);
}

.hi-progress-bar-fill--indeterminate {
  width: 40% !important;
  animation: hi-indeterminate 1.4s ease-in-out infinite;
}

@keyframes hi-indeterminate {
  0%   { transform: translateX(-150%); }
  100% { transform: translateX(350%); }
}

.hi-progress-count {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

/* =========================================================================
  STATE 3: Results review
  ========================================================================= */

/* Summary chips */
.hi-summary {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.hi-summary-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  font-size: var(--text-sm);
  font-weight: 600;
}

.hi-summary-chip--green {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.hi-summary-chip--gray {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-secondary);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.hi-summary-chip--gold {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.3);
}

.hi-summary-chip--blue {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

/* Results pane */
.hi-results-pane {
  display: flex;
  flex-direction: column;
}

.hi-pane-label {
  font-size: var(--text-sm);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

.hi-results-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-height: 440px;
  overflow-y: auto;
  padding-right: var(--space-1);
}

.hi-section-label {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  margin: var(--space-2) 0 var(--space-1);
}

.hi-section-label--gray {
  color: var(--text-secondary);
  opacity: 0.7;
}

/* Individual result row */
.hi-result-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  transition: background 0.15s var(--ease-in-out);
}

.hi-result-row--matched {
  border-left: 3px solid rgba(52, 211, 153, 0.6);
}

.hi-result-row--unrecognized {
  border-left: 3px solid rgba(239, 68, 68, 0.4);
  opacity: 0.65;
}

/* Item info */
.hi-result-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.hi-result-name {
  font-size: var(--text-md);
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 260px;
}

.hi-result-name--muted {
  color: var(--text-secondary);
}

/* Confidence badges */
.hi-badge {
  flex-shrink: 0;
  display: inline-block;
  padding: 0.1rem 0.4rem;
  border-radius: 9999px;
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.badge-green  { background: rgba(16, 185, 129, 0.15); color: #34d399; }
.badge-gray   { background: rgba(255, 255, 255, 0.06); color: var(--text-secondary); }

/* Quantity input */
.hi-result-qty {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

.hi-qty-label {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
}

.hi-qty-input {
  width: 64px;
  min-height: unset;
  height: 30px;
  padding: 0.25rem 0.5rem;
  font-size: var(--text-sm);
  text-align: right;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.hi-qty-input:focus {
  border-color: var(--accent-primary);
  outline-color: var(--accent-primary);
}

/* =========================================================================
  Footer
  ========================================================================= */

.hi-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-6);
  border-top: 1px solid var(--surface-border);
  flex-shrink: 0;
  gap: var(--space-3);
}

.hi-footer-right {
  display: flex;
  gap: var(--space-2);
  margin-left: auto;
}

.hi-btn {
  padding: 0.5rem 1.25rem;
  min-height: unset;
  height: 38px;
  border-radius: 6px;
  font-size: var(--text-md);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s var(--ease-in-out);
}

.hi-btn:hover {
  transform: none;
  box-shadow: none;
}

.hi-btn--primary {
  background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-hover) 100%);
  border: 1px solid var(--accent-primary);
  color: white;
  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.25);
}

.hi-btn--primary:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--accent-hover) 0%, #1e40af 100%);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.hi-btn--primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.hi-btn--secondary {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

.hi-btn--secondary:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.hi-btn--tertiary {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-secondary);
}

.hi-btn--tertiary:hover {
  color: var(--text-primary);
  border-color: var(--border-color);
}

/* =========================================================================
  Responsive — mobile
  ========================================================================= */

@media (max-width: 767px) {
  .html-import-overlay {
    padding: 0;
    align-items: flex-end;
  }

  .hi-panel {
    max-width: 100%;
    max-height: 95vh;
    border-radius: var(--surface-radius) var(--surface-radius) 0 0;
  }

  .hi-results-list {
    max-height: 280px;
  }

  .hi-result-name {
    max-width: 120px;
  }

  .hi-body {
    padding: var(--space-4);
  }

  .hi-header {
    padding: var(--space-3) var(--space-4);
  }

  .hi-footer {
    padding: var(--space-3) var(--space-4);
    flex-wrap: wrap;
  }

  .hi-footer-right {
    margin-left: 0;
  }

  .hi-btn--primary {
    width: 100%;
    justify-content: center;
  }
}
</style>

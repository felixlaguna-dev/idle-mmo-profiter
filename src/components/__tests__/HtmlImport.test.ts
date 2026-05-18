import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed } from 'vue'
import HtmlImport from '../HtmlImport.vue'

// ---------------------------------------------------------------------------
// Mock the composable
// ---------------------------------------------------------------------------

const mockResults = ref<any[]>([])
const mockErrors = ref<any[]>([])
const mockIsProcessing = ref(false)
const mockProgress = ref({ step: 'Idle', current: 0, total: 0 })
const mockGoldExtracted = ref<number | null>(null)
const mockCharacterName = ref<string | null>(null)
const mockHasResults = computed(
  () => mockResults.value.length > 0 || mockErrors.value.length > 0,
)
const mockMatchedCount = computed(() => mockResults.value.length)
const mockUnrecognizedCount = computed(
  () => mockErrors.value.filter((e) => e.reason === 'no_match').length,
)

const mockProcessJson = vi.fn()
const mockApplyToInventory = vi.fn()
const mockClearResults = vi.fn()

vi.mock('../../composables/useHtmlImport', () => ({
  useHtmlImport: () => ({
    isProcessing: mockIsProcessing,
    progress: mockProgress,
    results: mockResults,
    errors: mockErrors,
    goldExtracted: mockGoldExtracted,
    characterName: mockCharacterName,
    hasResults: mockHasResults,
    matchedCount: mockMatchedCount,
    unrecognizedCount: mockUnrecognizedCount,
    processJson: mockProcessJson,
    applyToInventory: mockApplyToInventory,
    clearResults: mockClearResults,
  }),
  CONSOLE_SNIPPET: 'copy(JSON.stringify({test:true}))',
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(overrides: Partial<any> = {}): any {
  return {
    hashedId: 'item-abc',
    name: 'Iron Ore',
    quantity: 5,
    confidence: 1.0,
    matchDistance: 0,
    status: 'matched',
    gridPosition: { row: 0, col: 0 },
    cellRect: { x: 0, y: 0, w: 0, h: 0 },
    ...overrides,
  }
}

function makeError(overrides: Partial<any> = {}): any {
  return {
    gridPosition: { row: 1, col: 1 },
    reason: 'no_match',
    cellRect: { x: 0, y: 0, w: 0, h: 0 },
    ...overrides,
  }
}

function mountComponent() {
  return mount(HtmlImport, {
    attachTo: document.body,
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HtmlImport', () => {
  beforeEach(() => {
    mockResults.value = []
    mockErrors.value = []
    mockIsProcessing.value = false
    mockProgress.value = { step: 'Idle', current: 0, total: 0 }
    mockGoldExtracted.value = null
    mockCharacterName.value = null
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // State 1: HTML paste area
  // -------------------------------------------------------------------------

  describe('paste area (initial state)', () => {
    it('renders the HTML paste area when idle with no results', () => {
      const wrapper = mountComponent()
      expect(wrapper.find('.hi-json-paste').exists()).toBe(true)
    })

    it('shows instruction text', () => {
      const wrapper = mountComponent()
      expect(wrapper.find('.hi-steps').exists()).toBe(true)
    })

    it('shows parse button', () => {
      const wrapper = mountComponent()
      expect(wrapper.find('.hi-parse-btn').exists()).toBe(true)
    })

    it('disables parse button when textarea is empty', () => {
      const wrapper = mountComponent()
      const btn = wrapper.find<HTMLButtonElement>('.hi-parse-btn')
      expect(btn.element.disabled).toBe(true)
    })

    it('emits close when Cancel button is pressed', async () => {
      const wrapper = mountComponent()
      await wrapper.find('.hi-btn--secondary').trigger('click')
      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  // -------------------------------------------------------------------------
  // State 2: Processing
  // -------------------------------------------------------------------------

  describe('processing state', () => {
    it('renders spinner when isProcessing is true', async () => {
      mockIsProcessing.value = true
      const wrapper = mountComponent()
      await flushPromises()
      expect(wrapper.find('.hi-processing').exists()).toBe(true)
    })

    it('shows progress step text', async () => {
      mockIsProcessing.value = true
      mockProgress.value = { step: 'Parsing HTML…', current: 0, total: 0 }
      const wrapper = mountComponent()
      await flushPromises()
      expect(wrapper.find('.hi-progress-step').text()).toBe('Parsing HTML…')
    })

    it('shows progress count when total > 0', async () => {
      mockIsProcessing.value = true
      mockProgress.value = { step: 'Extracting items…', current: 8, total: 20 }
      const wrapper = mountComponent()
      await flushPromises()
      expect(wrapper.find('.hi-progress-count').text()).toContain('8')
      expect(wrapper.find('.hi-progress-count').text()).toContain('20')
    })
  })

  // -------------------------------------------------------------------------
  // State 3: Results review
  // -------------------------------------------------------------------------

  describe('results review state', () => {
    it('renders results section when hasResults is true', async () => {
      mockResults.value = [makeResult()]
      const wrapper = mountComponent()
      await flushPromises()
      expect(wrapper.find('.hi-summary').exists()).toBe(true)
      expect(wrapper.find('.hi-results-list').exists()).toBe(true)
    })

    it('shows matched count chip', async () => {
      mockResults.value = [makeResult()]
      const wrapper = mountComponent()
      await flushPromises()
      const greenChip = wrapper.find('.hi-summary-chip--green')
      expect(greenChip.exists()).toBe(true)
      expect(greenChip.text()).toContain('1 matched')
    })

    it('shows unrecognized chip when errors exist', async () => {
      mockResults.value = [makeResult()]
      mockErrors.value = [makeError()]
      const wrapper = mountComponent()
      await flushPromises()
      const grayChip = wrapper.find('.hi-summary-chip--gray')
      expect(grayChip.exists()).toBe(true)
      expect(grayChip.text()).toContain('1 unrecognized')
    })

    it('shows gold chip when gold was extracted', async () => {
      mockResults.value = [makeResult()]
      mockGoldExtracted.value = 1899173
      const wrapper = mountComponent()
      await flushPromises()
      const goldChip = wrapper.find('.hi-summary-chip--gold')
      expect(goldChip.exists()).toBe(true)
      expect(goldChip.text()).toContain('gold')
    })

    it('renders matched item row with item name', async () => {
      mockResults.value = [makeResult({ name: 'Iron Ore' })]
      const wrapper = mountComponent()
      await flushPromises()
      expect(wrapper.find('.hi-result-row--matched').exists()).toBe(true)
      expect(wrapper.find('.hi-result-name').text()).toBe('Iron Ore')
    })

    it('shows Exact badge (green) for HTML import', async () => {
      mockResults.value = [makeResult()]
      const wrapper = mountComponent()
      await flushPromises()
      const badge = wrapper.find('.badge-green')
      expect(badge.exists()).toBe(true)
      expect(badge.text()).toBe('Exact')
    })

    it('shows quantity input with correct initial value', async () => {
      mockResults.value = [makeResult({ quantity: 12 })]
      const wrapper = mountComponent()
      await flushPromises()
      const input = wrapper.find<HTMLInputElement>('.hi-qty-input')
      expect(input.element.value).toBe('12')
    })

    it('updates quantity when user edits the input', async () => {
      const result = makeResult({ quantity: 5 })
      mockResults.value = [result]
      const wrapper = mountComponent()
      await flushPromises()
      const input = wrapper.find<HTMLInputElement>('.hi-qty-input')
      await input.setValue('10')
      expect(result.quantity).toBe(10)
    })

    it('renders unrecognized item row', async () => {
      mockResults.value = [makeResult()]
      mockErrors.value = [makeError()]
      const wrapper = mountComponent()
      await flushPromises()
      expect(wrapper.find('.hi-result-row--unrecognized').exists()).toBe(true)
    })

    it('disables Import button when matchedCount is 0', async () => {
      // No results, no errors — but hasResults won't be true then.
      // Set only errors to trigger hasResults
      mockErrors.value = [makeError()]
      const wrapper = mountComponent()
      await flushPromises()
      const importBtn = wrapper.find<HTMLButtonElement>('.hi-btn--primary')
      expect(importBtn.element.disabled).toBe(true)
    })

    it('enables Import button when matchedCount > 0', async () => {
      mockResults.value = [makeResult()]
      const wrapper = mountComponent()
      await flushPromises()
      const importBtn = wrapper.find<HTMLButtonElement>('.hi-btn--primary')
      expect(importBtn.element.disabled).toBe(false)
    })

    it('Import button label shows correct item count', async () => {
      mockResults.value = [
        makeResult(),
        makeResult({ name: 'Coal', gridPosition: { row: 1, col: 0 } }),
      ]
      const wrapper = mountComponent()
      await flushPromises()
      expect(wrapper.find('.hi-btn--primary').text()).toContain('2 items')
    })

    it('calls applyToInventory and clearResults and emits events on Import click', async () => {
      mockResults.value = [makeResult()]
      const wrapper = mountComponent()
      await flushPromises()
      await wrapper.find('.hi-btn--primary').trigger('click')
      expect(mockApplyToInventory).toHaveBeenCalledOnce()
      expect(mockClearResults).toHaveBeenCalledOnce()
      expect(wrapper.emitted('imported')).toBeTruthy()
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('calls clearResults and emits close on Re-scan click', async () => {
      mockResults.value = [makeResult()]
      const wrapper = mountComponent()
      await flushPromises()
      await wrapper.find('.hi-btn--tertiary').trigger('click')
      expect(mockClearResults).toHaveBeenCalledOnce()
      expect(wrapper.emitted('close')).toBeFalsy()
    })

    it('calls clearResults and emits close on Cancel click in results view', async () => {
      mockResults.value = [makeResult()]
      const wrapper = mountComponent()
      await flushPromises()
      const cancelBtn = wrapper.findAll('.hi-btn--secondary')[0]
      await cancelBtn.trigger('click')
      expect(mockClearResults).toHaveBeenCalledOnce()
      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  // -------------------------------------------------------------------------
  // Modal structure
  // -------------------------------------------------------------------------

  describe('modal structure', () => {
    it('renders as a dialog with aria-modal', () => {
      const wrapper = mountComponent()
      const dialog = wrapper.find('[role="dialog"]')
      expect(dialog.exists()).toBe(true)
      expect(dialog.attributes('aria-modal')).toBe('true')
    })

    it('renders header with title', () => {
      const wrapper = mountComponent()
      expect(wrapper.find('.hi-header-title').text()).toContain('Import Inventory')
    })

    it('renders close button', () => {
      const wrapper = mountComponent()
      const closeBtn = wrapper.find('.hi-close-btn')
      expect(closeBtn.exists()).toBe(true)
      expect(closeBtn.attributes('aria-label')).toBe('Close')
    })

    it('emits close when close button is clicked', async () => {
      const wrapper = mountComponent()
      await wrapper.find('.hi-close-btn').trigger('click')
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('emits close when backdrop is clicked', async () => {
      const wrapper = mountComponent()
      await wrapper.find('.hi-backdrop').trigger('click')
      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })
})

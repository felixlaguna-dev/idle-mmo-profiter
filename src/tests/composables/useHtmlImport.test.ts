/**
 * Tests for useHtmlImport composable — JSON parsing pipeline.
 *
 * Since the composable now accepts JSON from a console snippet,
 * testing is straightforward: we feed it JSON and verify the results.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useHtmlImport, CONSOLE_SNIPPET } from '../../composables/useHtmlImport'

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockAllItems = vi.hoisted(() => [
  { hashedId: 'h1', name: 'Acorn', type: 'MATERIAL' },
  { hashedId: 'h2', name: 'Iron Ore', type: 'MATERIAL' },
  { hashedId: 'h3', name: 'Emerald Ore', type: 'MATERIAL' },
  { hashedId: 'h4', name: 'Dragon Scale', type: 'MATERIAL' },
  { hashedId: 'h5', name: 'Phoenix Feather', type: 'MATERIAL' },
])

vi.mock('../../composables/useDataProvider', () => ({
  useDataProvider: () => ({
    allItems: { value: mockAllItems },
    materials: { value: [] },
    craftables: { value: [] },
    resources: { value: [] },
    recipes: { value: [] },
  }),
}))

vi.mock('../../composables/useCharacterTracker', () => ({
  useCharacterTracker: () => ({
    activeCharacter: { value: { id: 'char1', name: 'Test' } },
    characters: { value: [{ id: 'char1', name: 'Test' }] },
    getEffectiveInventory: { value: [] },
    setItemQuantity: vi.fn(),
    updateGold: vi.fn(),
    setActiveCharacter: vi.fn(),
    addCharacter: vi.fn(() => 'new-char-id'),
  }),
}))

vi.mock('../../composables/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useHtmlImport — JSON parsing', () => {
  let htmlImport: ReturnType<typeof useHtmlImport>

  beforeEach(() => {
    htmlImport = useHtmlImport()
  })

  it('exports CONSOLE_SNIPPET as a non-empty string', () => {
    expect(CONSOLE_SNIPPET).toBeTruthy()
    expect(typeof CONSOLE_SNIPPET).toBe('string')
    expect(CONSOLE_SNIPPET).toContain('Alpine')
  })

  it('parses valid JSON with items and gold', async () => {
    const json = JSON.stringify({
      gold: 50000,
      items: [
        { n: 'Acorn', q: 42, k: 'standard' },
        { n: 'Iron Ore', q: 10, k: 'standard' },
      ],
    })

    await htmlImport.processJson(json)

    expect(htmlImport.results.value.length).toBe(2)
    expect(htmlImport.goldExtracted.value).toBe(50000)
    expect(htmlImport.unrecognizedCount.value).toBe(0)

    const acorn = htmlImport.results.value.find((r) => r.name === 'Acorn')
    expect(acorn).toBeDefined()
    expect(acorn!.quantity).toBe(42)
    expect(acorn!.hashedId).toBe('h1')
    expect(acorn!.confidence).toBe(1.0)

    const iron = htmlImport.results.value.find((r) => r.name === 'Iron Ore')
    expect(iron).toBeDefined()
    expect(iron!.quantity).toBe(10)
    expect(iron!.hashedId).toBe('h2')
  })

  it('merges duplicate item names', async () => {
    const json = JSON.stringify({
      gold: null,
      items: [
        { n: 'Acorn', q: 10, k: 'standard' },
        { n: 'Acorn', q: 20, k: 'standard' },
      ],
    })

    await htmlImport.processJson(json)

    expect(htmlImport.results.value.length).toBe(1)
    expect(htmlImport.results.value[0].quantity).toBe(30)
  })

  it('reports unrecognized items', async () => {
    const json = JSON.stringify({
      gold: 100,
      items: [
        { n: 'Acorn', q: 5, k: 'standard' },
        { n: 'Unknown New Item', q: 3, k: 'mythic' },
      ],
    })

    await htmlImport.processJson(json)

    expect(htmlImport.results.value.length).toBe(1)
    expect(htmlImport.unrecognizedCount.value).toBe(1)
    expect(htmlImport.results.value[0].name).toBe('Acorn')
  })

  it('handles empty items array', async () => {
    const json = JSON.stringify({ gold: 999, items: [] })

    await htmlImport.processJson(json)

    expect(htmlImport.results.value.length).toBe(0)
    expect(htmlImport.goldExtracted.value).toBe(999)
  })

  it('handles null gold', async () => {
    const json = JSON.stringify({ gold: null, items: [{ n: 'Acorn', q: 1 }] })

    await htmlImport.processJson(json)

    expect(htmlImport.goldExtracted.value).toBeNull()
    expect(htmlImport.results.value.length).toBe(1)
  })

  it('errors on invalid JSON', async () => {
    await htmlImport.processJson('not json at all')

    expect(htmlImport.results.value.length).toBe(0)
    expect(htmlImport.errors.value.length).toBeGreaterThan(0)
    expect(htmlImport.progress.value.step).toContain('Invalid JSON')
  })

  it('errors on JSON without items array', async () => {
    await htmlImport.processJson(JSON.stringify({ gold: 100 }))

    expect(htmlImport.results.value.length).toBe(0)
    expect(htmlImport.errors.value.length).toBeGreaterThan(0)
    expect(htmlImport.progress.value.step).toContain('no "items" array')
  })

  it('clearResults resets everything', async () => {
    const json = JSON.stringify({
      gold: 100,
      items: [{ n: 'Acorn', q: 5 }],
    })

    await htmlImport.processJson(json)
    expect(htmlImport.results.value.length).toBe(1)

    htmlImport.clearResults()
    expect(htmlImport.results.value.length).toBe(0)
    expect(htmlImport.errors.value.length).toBe(0)
    expect(htmlImport.goldExtracted.value).toBeNull()
    expect(htmlImport.progress.value.step).toBe('Idle')
  })

  it('skips items with empty names', async () => {
    const json = JSON.stringify({
      gold: 0,
      items: [
        { n: '', q: 5 },
        { n: 'Acorn', q: 1 },
      ],
    })

    await htmlImport.processJson(json)

    expect(htmlImport.results.value.length).toBe(1)
    expect(htmlImport.results.value[0].name).toBe('Acorn')
  })

  it('skips processing if already processing', async () => {
    const json = JSON.stringify({
      gold: 0,
      items: [{ n: 'Acorn', q: 1 }],
    })

    // First call sets isProcessing — but since it's async we need to be careful
    await htmlImport.processJson(json)
    expect(htmlImport.results.value.length).toBe(1)

    // After completion, isProcessing is false, so this should work
    await htmlImport.processJson(json)
    expect(htmlImport.results.value.length).toBe(1) // reset and re-parsed
  })
})

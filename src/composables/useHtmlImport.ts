/**
 * useHtmlImport — imports IdleMMO inventory data from a console JSON paste.
 *
 * Workflow:
 *   1. User opens idle-mmo.com/inventory in browser
 *   2. Opens DevTools console (F12)
 *   3. Pastes a one-liner snippet that extracts inventory data as JSON
 *   4. Copies the output to clipboard
 *   5. Pastes into our import UI
 *   6. We parse the JSON and match items by name → hashedId
 *
 * The console snippet accesses Alpine.js internals to grab the raw data
 * (item names, quantities, quality, gold) — 100% accurate and deterministic.
 *
 * Why not parse HTML? The inventory page uses Alpine.js templates. Item names
 * are only in JS expressions (x-tooltip), never rendered to static text, and
 * CDN image filenames are shared across multiple items. The only reliable
 * source of truth is the Alpine reactive data, accessible from the console.
 */

import { ref, computed } from 'vue'
import { useCharacterTracker } from './useCharacterTracker'
import { useToast } from './useToast'
import { useDataProvider } from './useDataProvider'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ImportResult {
  /** Sprite hash ID (game internal identifier). */
  hashedId: string
  /** Human-readable item name. */
  name: string
  /** Extracted quantity. */
  quantity: number
  /** Match confidence — always 1.0 for JSON import. */
  confidence: number
  /** Match distance — always 0 for JSON import. */
  matchDistance: number
  /** Match quality classification. */
  status: 'matched'
  /** Sequential position. */
  gridPosition: { row: number; col: number }
  /** Placeholder cell rect. */
  cellRect: { x: number; y: number; w: number; h: number }
}

export interface ImportError {
  gridPosition: { row: number; col: number }
  reason: 'no_match'
  cellRect: { x: number; y: number; w: number; h: number }
}

export interface ImportProgress {
  step: string
  current: number
  total: number
}

// ---------------------------------------------------------------------------
// Console snippet shown to the user
// ---------------------------------------------------------------------------

/**
 * The one-liner the user pastes into the idle-mmo.com DevTools console.
 * It accesses Alpine's internal data to extract the full inventory as JSON,
 * then copies it to the clipboard via copy() (a DevTools helper).
 */
export const CONSOLE_SNIPPET = `navigator.clipboard.writeText(JSON.stringify({gold:Alpine.store('current_character')?.gold??null,items:document.querySelector('[x-on\\\\:click*="selected_item"]')&&Alpine.$data(document.querySelector('[x-on\\\\:click*="selected_item"]'))?.inventory_items?.map(i=>({n:i.name,q:i.quantity,k:i.quality,t:i.tier}))||[]}))`

// ---------------------------------------------------------------------------
// Types for the extracted JSON
// ---------------------------------------------------------------------------

interface ExtractedItem {
  /** Item name (from Alpine data). */
  n: string
  /** Quantity (exact number). */
  q: number
  /** Quality tier (e.g. "mythic", "epic"). */
  k?: string
  /** Tier number for upgraded items. */
  t?: number
}

interface ExtractedData {
  /** Gold amount (from current_character store). */
  gold: number | null
  /** Inventory items. */
  items: ExtractedItem[]
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function useHtmlImport() {
  const isProcessing = ref(false)
  const progress = ref<ImportProgress>({ step: 'Idle', current: 0, total: 0 })
  const results = ref<ImportResult[]>([])
  const errors = ref<ImportError[]>([])
  const goldExtracted = ref<number | null>(null)
  const hasResults = computed(() => results.value.length > 0 || errors.value.length > 0)

  const matchedCount = computed(() => results.value.length)
  const unrecognizedCount = computed(() => errors.value.filter((e) => e.reason === 'no_match').length)

  // -----------------------------------------------------------------------
  // Core parsing
  // -----------------------------------------------------------------------

  async function processJson(jsonString: string): Promise<void> {
    if (isProcessing.value) return
    isProcessing.value = true
    results.value = []
    errors.value = []
    goldExtracted.value = null

    try {
      progress.value = { step: 'Parsing JSON…', current: 0, total: 0 }

      let data: ExtractedData
      try {
        data = JSON.parse(jsonString)
      } catch {
        throw new Error('Invalid JSON — paste the output from the console snippet')
      }

      if (!data.items || !Array.isArray(data.items)) {
        throw new Error('JSON has no "items" array — did you run the correct snippet?')
      }

      // Extract gold
      if (data.gold !== null && data.gold !== undefined) {
        goldExtracted.value = data.gold
      }

      progress.value = { step: `Matching ${data.items.length} items…`, current: 0, total: data.items.length }

      // Build name → hashedId lookup from allItems (also keep reverse for display)
      const dataProvider = useDataProvider()
      const nameLookup = new Map<string, string>()
      const hashToName = new Map<string, string>()
      for (const item of dataProvider.allItems.value) {
        if (item.hashedId && item.name) {
          nameLookup.set(item.name, item.hashedId)
          hashToName.set(item.hashedId, item.name)
        }
      }
      // Also add from other data sources (materials, craftables, etc.)
      for (const m of dataProvider.materials.value) {
        if (m.hashedId && m.name) { nameLookup.set(m.name, m.hashedId); hashToName.set(m.hashedId, m.name) }
      }
      for (const c of dataProvider.craftables.value) {
        if (c.hashedId && c.name) { nameLookup.set(c.name, c.hashedId); hashToName.set(c.hashedId, c.name) }
      }
      for (const r of dataProvider.resources.value) {
        if (r.hashedId && r.name) { nameLookup.set(r.name, r.hashedId); hashToName.set(r.hashedId, r.name) }
      }
      for (const r of dataProvider.recipes.value) {
        if (r.hashedId && r.name) { nameLookup.set(r.name, r.hashedId); hashToName.set(r.hashedId, r.name) }
      }

      // Merge same-name items (different tiers/stacks sum up)
      const mergedMap = new Map<string, { quantity: number; quality?: string }>()
      let position = 0

      for (const item of data.items) {
        position++
        progress.value = { step: `Matching items (${position}/${data.items.length})…`, current: position, total: data.items.length }

        const name = item.n?.trim()
        if (!name) continue

        const hashedId = nameLookup.get(name)
        if (!hashedId) {
          errors.value.push({
            gridPosition: { row: Math.floor(position / 7), col: position % 7 },
            reason: 'no_match',
            cellRect: { x: 0, y: 0, w: 0, h: 0 },
          })
          continue
        }

        const existing = mergedMap.get(hashedId)
        if (existing) {
          existing.quantity += item.q
        } else {
          mergedMap.set(hashedId, { quantity: item.q, quality: item.k })
        }
      }

      // Build results
      let row = 0
      for (const [hashedId, { quantity }] of mergedMap) {
        const name = hashToName.get(hashedId) ?? 'Unknown'
        results.value.push({
          hashedId,
          name,
          quantity,
          confidence: 1.0,
          matchDistance: 0,
          status: 'matched',
          gridPosition: { row, col: 0 },
          cellRect: { x: 0, y: 0, w: 0, h: 0 },
        })
        row++
      }

      progress.value = {
        step: `Done — ${results.value.length} unique items, ${errors.value.length} unrecognized`,
        current: data.items.length,
        total: data.items.length,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.value.push({
        gridPosition: { row: -1, col: -1 },
        reason: 'no_match',
        cellRect: { x: 0, y: 0, w: 0, h: 0 },
      })
      progress.value = { step: `Error: ${message}`, current: 0, total: 0 }
    } finally {
      isProcessing.value = false
    }
  }

  // -----------------------------------------------------------------------
  // Apply to inventory
  // -----------------------------------------------------------------------

  function applyToInventory(): void {
    const tracker = useCharacterTracker()
    const toast = useToast()

    if (!tracker.activeCharacter.value) {
      toast.error('No active character selected. Please select a character first.')
      return
    }

    // Build price map: max(marketPrice, vendorValue) per hashedId
    const dataProvider = useDataProvider()
    const priceMap = new Map<string, number>()
    for (const m of dataProvider.materials.value) {
      if (m.hashedId) priceMap.set(m.hashedId, Math.max(m.price ?? 0, m.vendorValue ?? 0))
    }
    for (const c of dataProvider.craftables.value) {
      if (c.hashedId) priceMap.set(c.hashedId, Math.max(c.price ?? 0, c.vendorValue ?? 0))
    }
    for (const r of dataProvider.resources.value) {
      if (r.hashedId) priceMap.set(r.hashedId, Math.max(r.marketPrice ?? 0, r.vendorValue ?? 0))
    }
    for (const r of dataProvider.recipes.value) {
      if (r.hashedId) priceMap.set(r.hashedId, Math.max(r.price ?? 0, r.vendorValue ?? 0))
    }
    for (const item of dataProvider.allItems.value as Array<{ hashedId?: string; vendorPrice?: number }>) {
      if (item.hashedId && !priceMap.has(item.hashedId)) {
        priceMap.set(item.hashedId, item.vendorPrice ?? 0)
      }
    }

    const effectiveInventory = tracker.getEffectiveInventory.value
    const existingQtyMap = new Map<string, number>()
    for (const item of effectiveInventory) {
      existingQtyMap.set(item.hashId, item.quantity)
    }

    let imported = 0
    for (const result of results.value) {
      const existing = existingQtyMap.get(result.hashedId) ?? 0
      const newQty = existing + result.quantity
      const priceAtTime = priceMap.get(result.hashedId) ?? 0
      tracker.setItemQuantity(result.hashedId, newQty, priceAtTime, result.name)
      existingQtyMap.set(result.hashedId, newQty)
      imported++
    }

    if (goldExtracted.value !== null) {
      tracker.updateGold(goldExtracted.value)
    }

    const unrecognized = errors.value.filter((e) => e.reason === 'no_match').length
    const parts: string[] = [`${imported} item${imported !== 1 ? 's' : ''} imported`]
    if (goldExtracted.value !== null) parts.push(`gold set to ${goldExtracted.value.toLocaleString()}`)
    if (unrecognized > 0) parts.push(`${unrecognized} unrecognized`)

    if (imported > 0 || goldExtracted.value !== null) {
      toast.success(parts.join(', ') + '.')
    } else {
      toast.warning(parts.join(', ') + '.')
    }
  }

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  function clearResults(): void {
    results.value = []
    errors.value = []
    goldExtracted.value = null
    progress.value = { step: 'Idle', current: 0, total: 0 }
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  return {
    isProcessing,
    progress,
    results,
    errors,
    goldExtracted,
    hasResults,
    matchedCount,
    unrecognizedCount,
    processJson,
    applyToInventory,
    clearResults,
  }
}

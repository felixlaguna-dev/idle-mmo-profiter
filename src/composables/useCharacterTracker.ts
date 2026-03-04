/**
 * Character Tracker Composable
 *
 * Manages character data, inventory, and historical value tracking.
 * Uses a pending changes pattern for bulk inventory edits.
 * Snapshots store HISTORICAL PRICES (priceAtTime) for true historical value tracking.
 */

import { computed, ref } from 'vue'
import { useStorage } from './useStorage'
import { useDataProvider } from './useDataProvider'
import type {
  CharacterStore,
  Character,
  CharacterSnapshot,
  CharacterInventoryItem,
} from '../types'

// Internal type for pending edits (before save)
interface PendingInventoryEdit {
  hashId: string
  quantity: number
  priceAtTime: number
  name?: string
}

// Singleton instance
let characterTrackerInstance: ReturnType<typeof createCharacterTracker> | null = null

function createCharacterTracker() {
  // Get data provider for item lookups
  const dataProvider = useDataProvider()

  // Create computed lookup maps for O(1) item access by hashId
  const itemNameMap = computed(() => {
    const map = new Map<string, string>()

    dataProvider.materials.value.forEach((m) => {
      if (m.hashedId) map.set(m.hashedId, m.name)
    })
    dataProvider.craftables.value.forEach((c) => {
      if (c.hashedId) map.set(c.hashedId, c.name)
    })
    dataProvider.resources.value.forEach((r) => {
      if (r.hashedId) map.set(r.hashedId, r.name)
    })
    dataProvider.recipes.value.forEach((r) => {
      if (r.hashedId) map.set(r.hashedId, r.name)
    })
    // Add allItems from defaults.json (items not in any category)
    dataProvider.allItems.value.forEach((item) => {
      if (item.hashedId && !map.has(item.hashedId)) {
        map.set(item.hashedId, item.name)
      }
    })

    return map
  })

  const itemPriceMap = computed(() => {
    const map = new Map<string, number>()

    dataProvider.materials.value.forEach((m) => {
      if (m.hashedId) map.set(m.hashedId, m.price)
    })
    dataProvider.craftables.value.forEach((c) => {
      if (c.hashedId) map.set(c.hashedId, c.price)
    })
    dataProvider.resources.value.forEach((r) => {
      if (r.hashedId) map.set(r.hashedId, r.marketPrice)
    })
    dataProvider.recipes.value.forEach((r) => {
      if (r.hashedId) map.set(r.hashedId, r.price)
    })
    // Add allItems from defaults.json (items not in any category)
    dataProvider.allItems.value.forEach((item) => {
      if (item.hashedId && !map.has(item.hashedId)) {
        map.set(item.hashedId, item.vendorPrice ?? 0)
      }
    })

    return map
  })

  // Persistent storage
  const store = useStorage<CharacterStore>('characterTracker', {
    characters: [],
    activeCharacterId: null,
  })

  // Pending changes map (hashId -> edit)
  const pendingChanges = ref<Map<string, PendingInventoryEdit>>(new Map())

  // Computed reactive refs
  const characters = computed(() => store.value.characters)

  const activeCharacter = computed<Character | null>(() => {
    if (!store.value.activeCharacterId) return null
    return (
      store.value.characters.find((c) => c.id === store.value.activeCharacterId) || null
    )
  })

  const hasPendingChanges = computed(() => pendingChanges.value.size > 0)

  /**
   * Generate a unique character ID
   */
  function generateId(): string {
    return `char-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  }

  /**
   * Add a new character
   * @returns The generated character ID
   */
  function addCharacter(name: string): string {
    const id = generateId()
    const newCharacter: Character = {
      id,
      name,
      gold: 0,
      inventory: [],
      history: [],
    }

    store.value.characters.push(newCharacter)
    store.value = { ...store.value }

    return id
  }

  /**
   * Remove a character
   * If the removed character was active, clear activeCharacterId
   */
  function removeCharacter(id: string): void {
    store.value.characters = store.value.characters.filter((c) => c.id !== id)
    if (store.value.activeCharacterId === id) {
      store.value.activeCharacterId = null
    }
    store.value = { ...store.value }
  }

  /**
   * Rename a character
   */
  function renameCharacter(id: string, name: string): void {
    const character = store.value.characters.find((c) => c.id === id)
    if (character) {
      character.name = name
      store.value = { ...store.value }
    }
  }

  /**
   * Set the active character
   */
  function setActiveCharacter(id: string): void {
    const exists = store.value.characters.some((c) => c.id === id)
    if (exists) {
      store.value.activeCharacterId = id
      store.value = { ...store.value }
      // Clear pending changes when switching characters
      pendingChanges.value.clear()
    }
  }

  /**
   * Update gold for the active character
   */
  function updateGold(gold: number): void {
    if (!activeCharacter.value) return

    const character = store.value.characters.find(
      (c) => c.id === activeCharacter.value!.id
    )
    if (character) {
      character.gold = gold
      store.value = { ...store.value }
    }
  }

  /**
   * Resolve current market price for a hashId
   * Uses computed Map for O(1) lookup
   */
  function resolveCurrentPrice(hashId: string): number {
    return itemPriceMap.value.get(hashId) ?? 0
  }

  /**
   * Set item quantity in pending changes
   * Quantity 0 marks item for removal
   * @param hashId - Item hash ID
   * @param quantity - Item quantity
   * @param priceAtTime - Optional price override (defaults to current market price)
   * @param name - Optional item name (for API-sourced items)
   */
  function setItemQuantity(
    hashId: string,
    quantity: number,
    priceAtTime?: number,
    name?: string
  ): void {
    const price = priceAtTime ?? resolveCurrentPrice(hashId)
    pendingChanges.value.set(hashId, { hashId, quantity, priceAtTime: price, name })
  }

  /**
   * Remove item (shorthand for setItemQuantity with 0)
   */
  function removeItem(hashId: string): void {
    setItemQuantity(hashId, 0)
  }

  /**
   * Discard all pending changes
   */
  function discardChanges(): void {
    pendingChanges.value.clear()
  }

  /**
   * Get effective inventory (current inventory + pending changes)
   * Used for preview before save
   */
  const getEffectiveInventory = computed<CharacterInventoryItem[]>(() => {
    if (!activeCharacter.value) return []

    // Start with current inventory
    const inventoryMap = new Map<string, CharacterInventoryItem>()
    activeCharacter.value.inventory.forEach((item) => {
      inventoryMap.set(item.hashId, { ...item })
    })

    // Apply pending changes
    pendingChanges.value.forEach((edit) => {
      if (edit.quantity === 0) {
        inventoryMap.delete(edit.hashId)
      } else {
        inventoryMap.set(edit.hashId, {
          hashId: edit.hashId,
          quantity: edit.quantity,
          priceAtTime: edit.priceAtTime,
          name: edit.name,
        })
      }
    })

    return Array.from(inventoryMap.values())
  })

  /**
   * Save snapshot - applies pending changes and creates history entry
   * HISTORICAL PRICES: Each item stores priceAtTime (the market price at save time)
   */
  function saveSnapshot(): void {
    if (!activeCharacter.value) return

    const character = store.value.characters.find(
      (c) => c.id === activeCharacter.value!.id
    )
    if (!character) return

    // Apply pending changes to character inventory
    const inventoryMap = new Map<string, CharacterInventoryItem>()
    character.inventory.forEach((item) => {
      inventoryMap.set(item.hashId, { ...item })
    })

    pendingChanges.value.forEach((edit) => {
      if (edit.quantity === 0) {
        inventoryMap.delete(edit.hashId)
      } else {
        inventoryMap.set(edit.hashId, {
          hashId: edit.hashId,
          quantity: edit.quantity,
          priceAtTime: edit.priceAtTime,
          name: edit.name,
        })
      }
    })

    character.inventory = Array.from(inventoryMap.values())

    // Create snapshot with HISTORICAL PRICES
    const snapshot: CharacterSnapshot = {
      timestamp: new Date().toISOString(),
      gold: character.gold,
      inventory: character.inventory.map((item) => ({ ...item })),
    }

    character.history.push(snapshot)
    store.value = { ...store.value }

    // Clear pending changes
    pendingChanges.value.clear()
  }

  /**
   * Calculate snapshot value using priceAtTime from the snapshot
   * For HISTORICAL PRICES, we use item.priceAtTime
   */
  function calculateSnapshotValue(snapshot: CharacterSnapshot): number {
    const inventoryValue = snapshot.inventory.reduce((sum, item) => {
      return sum + item.quantity * item.priceAtTime
    }, 0)

    return snapshot.gold + inventoryValue
  }

  /**
   * Resolve item name from hashId
   * Checks in order:
   * 1. Current inventory item name (for saved items with custom names)
   * 2. Pending changes name (for pending items with custom names)
   * 3. Defaults.json itemNameMap (for standard items)
   * 4. Falls back to hashId if not found
   */
  function resolveItemName(hashId: string): string {
    // Check if item exists in current inventory with a name
    if (activeCharacter.value) {
      const inventoryItem = activeCharacter.value.inventory.find((i) => i.hashId === hashId)
      if (inventoryItem?.name) return inventoryItem.name
    }

    // Check pending changes for name
    const pending = pendingChanges.value.get(hashId)
    if (pending?.name) return pending.name

    // Check defaults.json
    const defaultName = itemNameMap.value.get(hashId)
    if (defaultName) return defaultName

    // Fallback to hashId
    return hashId
  }

  return {
    // Reactive state
    characters,
    activeCharacter,
    pendingChanges: computed(() => pendingChanges.value),
    hasPendingChanges,
    getEffectiveInventory,

    // Character CRUD
    addCharacter,
    removeCharacter,
    renameCharacter,
    setActiveCharacter,
    updateGold,

    // Inventory editing
    setItemQuantity,
    removeItem,
    discardChanges,

    // Snapshot
    saveSnapshot,

    // Helpers
    calculateSnapshotValue,
    resolveItemName,
    resolveCurrentPrice,
  }
}

/**
 * Character Tracker composable (singleton)
 *
 * Returns the same reactive instance on every call.
 * This ensures all components share the same state.
 */
export function useCharacterTracker() {
  if (!characterTrackerInstance) {
    characterTrackerInstance = createCharacterTracker()
  }
  return characterTrackerInstance
}

/**
 * Reset the singleton instance (for testing only)
 * @internal
 */
export function resetCharacterTrackerInstance() {
  characterTrackerInstance = null
}

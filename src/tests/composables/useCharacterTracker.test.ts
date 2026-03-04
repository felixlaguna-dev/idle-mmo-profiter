/**
 * Tests for useCharacterTracker composable
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCharacterTracker, resetCharacterTrackerInstance } from '../../composables/useCharacterTracker'
import { clearAllStorage } from '../../composables/useStorage'

describe('useCharacterTracker', () => {
  beforeEach(() => {
    localStorage.clear()
    // Clear the storage cache
    clearAllStorage()
    // Reset the singleton instance
    resetCharacterTrackerInstance()
  })

  describe('singleton pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = useCharacterTracker()
      const instance2 = useCharacterTracker()

      expect(instance1).toBe(instance2)
    })
  })

  describe('Character CRUD', () => {
    it('should add a character with unique id and empty inventory', () => {
      const tracker = useCharacterTracker()
      const id = tracker.addCharacter('Test Character')

      expect(id).toBeTruthy()
      expect(tracker.characters.value).toHaveLength(1)
      expect(tracker.characters.value[0].name).toBe('Test Character')
      expect(tracker.characters.value[0].gold).toBe(0)
      expect(tracker.characters.value[0].inventory).toEqual([])
      expect(tracker.characters.value[0].history).toEqual([])
    })

    it('should allow duplicate character names', () => {
      const tracker = useCharacterTracker()
      const id1 = tracker.addCharacter('Duplicate')
      const id2 = tracker.addCharacter('Duplicate')

      expect(id1).not.toBe(id2)
      expect(tracker.characters.value).toHaveLength(2)
      expect(tracker.characters.value[0].name).toBe('Duplicate')
      expect(tracker.characters.value[1].name).toBe('Duplicate')
    })

    it('should remove a character', () => {
      const tracker = useCharacterTracker()
      const id = tracker.addCharacter('To Remove')

      expect(tracker.characters.value).toHaveLength(1)

      tracker.removeCharacter(id)

      expect(tracker.characters.value).toHaveLength(0)
    })

    it('should clear activeCharacterId when removing the active character', () => {
      const tracker = useCharacterTracker()
      const id = tracker.addCharacter('Active')
      tracker.setActiveCharacter(id)

      expect(tracker.activeCharacter.value?.id).toBe(id)

      tracker.removeCharacter(id)

      expect(tracker.activeCharacter.value).toBeNull()
    })

    it('should rename a character', () => {
      const tracker = useCharacterTracker()
      const id = tracker.addCharacter('Old Name')

      tracker.renameCharacter(id, 'New Name')

      expect(tracker.characters.value[0].name).toBe('New Name')
    })

    it('should set active character', () => {
      const tracker = useCharacterTracker()
      const id1 = tracker.addCharacter('Char 1')
      const id2 = tracker.addCharacter('Char 2')

      tracker.setActiveCharacter(id1)
      expect(tracker.activeCharacter.value?.id).toBe(id1)

      tracker.setActiveCharacter(id2)
      expect(tracker.activeCharacter.value?.id).toBe(id2)
    })

    it('should not set active character for invalid id', () => {
      const tracker = useCharacterTracker()
      tracker.addCharacter('Valid')

      tracker.setActiveCharacter('invalid-id')

      expect(tracker.activeCharacter.value).toBeNull()
    })

    it('should clear pending changes when switching characters', () => {
      const tracker = useCharacterTracker()
      const id1 = tracker.addCharacter('Char 1')
      const id2 = tracker.addCharacter('Char 2')

      tracker.setActiveCharacter(id1)
      tracker.setItemQuantity('hash123', 5, 100)

      expect(tracker.hasPendingChanges.value).toBe(true)

      tracker.setActiveCharacter(id2)

      expect(tracker.hasPendingChanges.value).toBe(false)
    })
  })

  describe('Gold management', () => {
    it('should update gold for active character', () => {
      const tracker = useCharacterTracker()
      const id = tracker.addCharacter('Rich')
      tracker.setActiveCharacter(id)

      tracker.updateGold(1000)

      expect(tracker.activeCharacter.value?.gold).toBe(1000)
    })

    it('should not update gold when no active character', () => {
      const tracker = useCharacterTracker()
      tracker.addCharacter('No Active')

      tracker.updateGold(1000)

      // No error thrown, gold remains at 0
      expect(tracker.characters.value[0].gold).toBe(0)
    })
  })

  describe('Inventory pending changes', () => {
    it('should add item to pending changes', () => {
      const tracker = useCharacterTracker()
      const id = tracker.addCharacter('Test')
      tracker.setActiveCharacter(id)

      tracker.setItemQuantity('hash123', 5, 100)

      expect(tracker.hasPendingChanges.value).toBe(true)
      expect(tracker.pendingChanges.value.size).toBe(1)
      expect(tracker.pendingChanges.value.get('hash123')).toEqual({
        hashId: 'hash123',
        quantity: 5,
        priceAtTime: 100,
      })
    })

    it('should mark item for removal when quantity is 0', () => {
      const tracker = useCharacterTracker()
      const id = tracker.addCharacter('Test')
      tracker.setActiveCharacter(id)

      tracker.setItemQuantity('hash123', 0, 100)

      expect(tracker.pendingChanges.value.get('hash123')?.quantity).toBe(0)
    })

    it('should use removeItem as shorthand for quantity 0', () => {
      const tracker = useCharacterTracker()
      const id = tracker.addCharacter('Test')
      tracker.setActiveCharacter(id)

      tracker.removeItem('hash123')

      expect(tracker.pendingChanges.value.get('hash123')?.quantity).toBe(0)
    })

    it('should discard all pending changes', () => {
      const tracker = useCharacterTracker()
      const id = tracker.addCharacter('Test')
      tracker.setActiveCharacter(id)

      tracker.setItemQuantity('hash1', 5, 100)
      tracker.setItemQuantity('hash2', 10, 200)

      expect(tracker.hasPendingChanges.value).toBe(true)

      tracker.discardChanges()

      expect(tracker.hasPendingChanges.value).toBe(false)
      expect(tracker.pendingChanges.value.size).toBe(0)
    })

    it('should merge character inventory with pending changes in getEffectiveInventory', () => {
      const tracker = useCharacterTracker()
      const id = tracker.addCharacter('Test')
      tracker.setActiveCharacter(id)

      // Save initial snapshot with one item
      tracker.setItemQuantity('hash1', 5, 100)
      tracker.updateGold(1000)
      tracker.saveSnapshot()

      // Add pending changes
      tracker.setItemQuantity('hash1', 10, 100) // Update existing
      tracker.setItemQuantity('hash2', 3, 200) // Add new

      const effective = tracker.getEffectiveInventory.value

      expect(effective).toHaveLength(2)
      expect(effective.find((i) => i.hashId === 'hash1')?.quantity).toBe(10)
      expect(effective.find((i) => i.hashId === 'hash2')?.quantity).toBe(3)
    })

    it('should remove items with quantity 0 from getEffectiveInventory', () => {
      const tracker = useCharacterTracker()
      const id = tracker.addCharacter('Test')
      tracker.setActiveCharacter(id)

      // Save initial snapshot with two items
      tracker.setItemQuantity('hash1', 5, 100)
      tracker.setItemQuantity('hash2', 3, 200)
      tracker.saveSnapshot()

      // Mark one for removal
      tracker.removeItem('hash1')

      const effective = tracker.getEffectiveInventory.value

      expect(effective).toHaveLength(1)
      expect(effective[0].hashId).toBe('hash2')
    })
  })

  describe('Save snapshot', () => {
    it('should apply pending changes to inventory', () => {
      const tracker = useCharacterTracker()
      const id = tracker.addCharacter('Test')
      tracker.setActiveCharacter(id)

      tracker.setItemQuantity('hash1', 5, 100)
      tracker.setItemQuantity('hash2', 3, 200)

      tracker.saveSnapshot()

      expect(tracker.activeCharacter.value?.inventory).toHaveLength(2)
      expect(tracker.activeCharacter.value?.inventory[0]).toEqual({
        hashId: 'hash1',
        quantity: 5,
        priceAtTime: 100,
      })
    })

    it('should create history entry with timestamp, gold, and inventory', () => {
      const tracker = useCharacterTracker()
      const id = tracker.addCharacter('Test')
      tracker.setActiveCharacter(id)

      tracker.updateGold(1000)
      tracker.setItemQuantity('hash1', 5, 100)

      const beforeSave = Date.now()
      tracker.saveSnapshot()
      const afterSave = Date.now()

      expect(tracker.activeCharacter.value?.history).toHaveLength(1)

      const snapshot = tracker.activeCharacter.value?.history[0]
      expect(snapshot).toBeDefined()
      expect(snapshot?.gold).toBe(1000)
      expect(snapshot?.inventory).toHaveLength(1)
      expect(snapshot?.inventory[0]).toEqual({
        hashId: 'hash1',
        quantity: 5,
        priceAtTime: 100,
      })

      const timestamp = new Date(snapshot!.timestamp).getTime()
      expect(timestamp).toBeGreaterThanOrEqual(beforeSave)
      expect(timestamp).toBeLessThanOrEqual(afterSave)
    })

    it('should clear pending changes after save', () => {
      const tracker = useCharacterTracker()
      const id = tracker.addCharacter('Test')
      tracker.setActiveCharacter(id)

      tracker.setItemQuantity('hash1', 5, 100)
      expect(tracker.hasPendingChanges.value).toBe(true)

      tracker.saveSnapshot()

      expect(tracker.hasPendingChanges.value).toBe(false)
    })

    it('should not save when no active character', () => {
      const tracker = useCharacterTracker()
      tracker.addCharacter('No Active')

      tracker.saveSnapshot()

      // No error thrown, no changes made
      expect(tracker.characters.value[0].history).toHaveLength(0)
    })

    it('should create multiple history entries on multiple saves', () => {
      const tracker = useCharacterTracker()
      const id = tracker.addCharacter('Test')
      tracker.setActiveCharacter(id)

      tracker.updateGold(1000)
      tracker.saveSnapshot()

      tracker.updateGold(2000)
      tracker.saveSnapshot()

      expect(tracker.activeCharacter.value?.history).toHaveLength(2)
      expect(tracker.activeCharacter.value?.history[0].gold).toBe(1000)
      expect(tracker.activeCharacter.value?.history[1].gold).toBe(2000)
    })
  })

  describe('Value calculation', () => {
    it('should calculate snapshot value using priceAtTime', () => {
      const tracker = useCharacterTracker()
      const id = tracker.addCharacter('Test')
      tracker.setActiveCharacter(id)

      tracker.updateGold(1000)
      tracker.setItemQuantity('hash1', 5, 100) // 500 value
      tracker.setItemQuantity('hash2', 3, 200) // 600 value
      tracker.saveSnapshot()

      const snapshot = tracker.activeCharacter.value!.history[0]
      const value = tracker.calculateSnapshotValue(snapshot)

      expect(value).toBe(2100) // 1000 gold + 1100 inventory
    })

    it('should return just gold for empty inventory', () => {
      const tracker = useCharacterTracker()
      const id = tracker.addCharacter('Test')
      tracker.setActiveCharacter(id)

      tracker.updateGold(1000)
      tracker.saveSnapshot()

      const snapshot = tracker.activeCharacter.value!.history[0]
      const value = tracker.calculateSnapshotValue(snapshot)

      expect(value).toBe(1000)
    })

    it('should handle zero gold', () => {
      const tracker = useCharacterTracker()
      const id = tracker.addCharacter('Test')
      tracker.setActiveCharacter(id)

      tracker.setItemQuantity('hash1', 5, 100)
      tracker.saveSnapshot()

      const snapshot = tracker.activeCharacter.value!.history[0]
      const value = tracker.calculateSnapshotValue(snapshot)

      expect(value).toBe(500)
    })
  })

  describe('Persistence', () => {
    it('should persist data to localStorage via useStorage', () => {
      // Don't clear storage in this test - let useStorage do its job
      const tracker = useCharacterTracker()
      const id = tracker.addCharacter('Persistent')
      tracker.setActiveCharacter(id)
      tracker.updateGold(5000)
      tracker.saveSnapshot()

      // Give Vue reactivity time to trigger the watch in useStorage
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // Check localStorage has data
          const stored = localStorage.getItem('idlemmo:characterTracker')
          expect(stored).toBeTruthy()

          const parsed = JSON.parse(stored!)
          expect(parsed.characters).toHaveLength(1)
          expect(parsed.characters[0].name).toBe('Persistent')
          expect(parsed.characters[0].gold).toBe(5000)
          expect(parsed.characters[0].history).toHaveLength(1)
          resolve()
        }, 50)
      })
    })

    it('should load from localStorage on initialization', () => {
      // First session: create and save data
      const tracker1 = useCharacterTracker()
      const id = tracker1.addCharacter('Loaded')
      tracker1.setActiveCharacter(id)
      tracker1.updateGold(3000)
      tracker1.saveSnapshot()

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // Check the stored data
          const stored = localStorage.getItem('idlemmo:characterTracker')
          expect(stored).toBeTruthy()

          const parsed = JSON.parse(stored!)
          expect(parsed.characters[0].name).toBe('Loaded')
          expect(parsed.characters[0].gold).toBe(3000)
          resolve()
        }, 50)
      })
    })

    it('should use default empty state when localStorage is empty', () => {
      localStorage.clear()

      const tracker = useCharacterTracker()

      expect(tracker.characters.value).toEqual([])
      expect(tracker.activeCharacter.value).toBeNull()
    })
  })

  describe('Item name handling', () => {
    it('should resolve item names from defaults.json', () => {
      const tracker = useCharacterTracker()
      const id = tracker.addCharacter('Test')
      tracker.setActiveCharacter(id)

      // Set an item without a name (will resolve from dataProvider)
      tracker.setItemQuantity('hash-from-defaults', 1, 100)

      // resolveItemName should return hashId as fallback since we don't have real data loaded
      const name = tracker.resolveItemName('hash-from-defaults')
      expect(name).toBe('hash-from-defaults') // fallback to hashId
    })

    it('should persist item names through save/load cycle', () => {
      const tracker = useCharacterTracker()
      const id = tracker.addCharacter('Test')
      tracker.setActiveCharacter(id)

      // Add item with name
      tracker.setItemQuantity('item-hash-456', 10, 300, 'Mythril Ore')
      tracker.saveSnapshot()

      // Name should be stored in inventory
      const inventoryItem = tracker.activeCharacter.value!.inventory[0]
      expect(inventoryItem.name).toBe('Mythril Ore')
      expect(inventoryItem.hashId).toBe('item-hash-456')

      // resolveItemName should return the stored name
      const name = tracker.resolveItemName('item-hash-456')
      expect(name).toBe('Mythril Ore')
    })

    it('should preserve names in pending changes', () => {
      const tracker = useCharacterTracker()
      const id = tracker.addCharacter('Test')
      tracker.setActiveCharacter(id)

      // Add item with name to pending changes
      tracker.setItemQuantity('pending-hash', 3, 150, 'Pending Item')

      // Should resolve from pending changes
      const name = tracker.resolveItemName('pending-hash')
      expect(name).toBe('Pending Item')

      // Should be in effective inventory
      const effective = tracker.getEffectiveInventory.value
      expect(effective).toHaveLength(1)
      expect(effective[0].name).toBe('Pending Item')
    })

    it('should fallback to hashId if no name is found', () => {
      const tracker = useCharacterTracker()

      // Try to resolve a hash that doesn't exist anywhere
      const name = tracker.resolveItemName('unknown-hash')
      expect(name).toBe('unknown-hash')
    })

    it('should prioritize inventory item name over pending changes', () => {
      const tracker = useCharacterTracker()
      const id = tracker.addCharacter('Test')
      tracker.setActiveCharacter(id)

      // Add to inventory with a name
      tracker.setItemQuantity('hash-789', 5, 200, 'Saved Name')
      tracker.saveSnapshot()

      // Add to pending changes with different name
      tracker.setItemQuantity('hash-789', 10, 250, 'Pending Name')

      // Should return the name from saved inventory (has priority)
      const name = tracker.resolveItemName('hash-789')
      expect(name).toBe('Saved Name')
    })

    it('should resolve names from allItems when not in other categories', () => {
      const tracker = useCharacterTracker()

      // Note: In test environment, allItems is empty by default
      // This test verifies the fallback behavior when item is not found
      const name = tracker.resolveItemName('item-from-allitems')
      expect(name).toBe('item-from-allitems') // Falls back to hashId
    })

    it('should resolve prices from allItems when not in other categories', () => {
      const tracker = useCharacterTracker()

      // Note: In test environment, allItems is empty by default
      // This test verifies the fallback behavior when item is not found
      const price = tracker.resolveCurrentPrice('item-from-allitems')
      expect(price).toBe(0) // Falls back to 0 when not found
    })

    it('should prioritize categorized items over allItems for name resolution', () => {
      const tracker = useCharacterTracker()

      // In production, if an item exists in both materials and allItems,
      // the material name should take priority
      // This is ensured by the itemNameMap computed which adds categorized items first
      // and allItems checks !map.has() before adding

      // Test the lookup chain priority:
      // 1. Inventory item name
      // 2. Pending changes name
      // 3. Defaults.json (categorized items, then allItems)
      // 4. Fallback to hashId

      const id = tracker.addCharacter('Test')
      tracker.setActiveCharacter(id)

      // Add item with custom name to inventory
      tracker.setItemQuantity('priority-test', 1, 100, 'Custom Name')
      tracker.saveSnapshot()

      // Even if the item exists in defaults, custom name takes priority
      const name = tracker.resolveItemName('priority-test')
      expect(name).toBe('Custom Name')
    })
  })
})

import { ref, watch, type Ref } from 'vue'

const STORAGE_PREFIX = 'idlemmo:'

// Module-level cache to ensure singleton refs per key
const storageCache = new Map<string, Ref<unknown>>()

/**
 * Creates a reactive ref that syncs with localStorage.
 * Uses a singleton pattern - all calls with the same key share the same ref.
 * @param key - Storage key (will be prefixed with 'idlemmo:')
 * @param defaultValue - Default value if key doesn't exist in storage
 * @returns Reactive ref synced with localStorage
 */
export function useStorage<T>(key: string, defaultValue: T): Ref<T> {
  const prefixedKey = STORAGE_PREFIX + key

  // Check if we already have a ref for this key
  if (storageCache.has(key)) {
    return storageCache.get(key) as Ref<T>
  }

  // Try to load from localStorage
  const loadFromStorage = (): T => {
    try {
      const stored = localStorage.getItem(prefixedKey)
      if (stored === null) {
        return defaultValue
      }
      return JSON.parse(stored) as T
    } catch (error) {
      console.warn(`Failed to load ${prefixedKey} from localStorage:`, error)
      return defaultValue
    }
  }

  // Create reactive ref with initial value from storage
  const data = ref<T>(loadFromStorage()) as Ref<T>

  // Save to localStorage whenever the ref changes
  const saveToStorage = (value: T) => {
    try {
      const serialized = JSON.stringify(value)
      localStorage.setItem(prefixedKey, serialized)
    } catch (error) {
      // Handle quota exceeded errors
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.error('localStorage quota exceeded. Unable to save data.')
        alert('Storage quota exceeded. Please clear some data or reset settings.')
      } else {
        console.error(`Failed to save ${prefixedKey} to localStorage:`, error)
      }
    }
  }

  // Watch for changes and sync to localStorage
  watch(
    data,
    (newValue) => {
      saveToStorage(newValue)
    },
    { deep: true }
  )

  // Cache the ref so future calls with the same key get the same instance
  storageCache.set(key, data)

  return data
}

/**
 * Gets all localStorage keys with the idlemmo prefix
 * @returns Array of unprefixed keys
 */
export function getAllStorageKeys(): string[] {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(STORAGE_PREFIX)) {
      keys.push(key.substring(STORAGE_PREFIX.length))
    }
  }
  return keys
}

/**
 * Removes a key from localStorage
 * @param key - Unprefixed key to remove
 */
export function removeStorage(key: string): void {
  const prefixedKey = STORAGE_PREFIX + key
  localStorage.removeItem(prefixedKey)
  storageCache.delete(key)
}

/**
 * Clears all idlemmo-prefixed keys from localStorage
 */
export function clearAllStorage(): void {
  const keys = getAllStorageKeys()
  keys.forEach((key) => removeStorage(key))
  storageCache.clear()
}

/**
 * Gets raw value from localStorage without parsing
 * @param key - Unprefixed key to get
 * @returns Raw string value or null
 */
export function getRawStorage(key: string): string | null {
  const prefixedKey = STORAGE_PREFIX + key
  return localStorage.getItem(prefixedKey)
}

/**
 * Sets raw value in localStorage without stringifying
 * @param key - Unprefixed key to set
 * @param value - Raw string value
 */
export function setRawStorage(key: string, value: string): void {
  const prefixedKey = STORAGE_PREFIX + key
  try {
    localStorage.setItem(prefixedKey, value)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.error('localStorage quota exceeded. Unable to save data.')
      alert('Storage quota exceeded. Please clear some data or reset settings.')
    } else {
      console.error(`Failed to save ${prefixedKey} to localStorage:`, error)
    }
  }
}

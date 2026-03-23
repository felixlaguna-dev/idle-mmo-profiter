/**
 * Refresh vendor prices for equipment items in defaults.json
 *
 * This script:
 * 1. Reads defaults.json
 * 2. For all equipment items in allItems[] that have quality MYTHIC or LEGENDARY,
 *    fetches the current vendor_price from the API via /item/search
 * 3. Updates vendorPrice values in defaults.json
 * 4. Handles rate limits (20 req/min) with delays
 *
 * Run with: tsx scripts/refresh-vendor-prices.ts
 *
 * Options:
 * --dry-run     Print what would change but don't write file
 * --limit=N     Only process first N items (for testing)
 * --all         Process all equipment items regardless of quality
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { apiClient } from '../src/api/client.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Equipment types to refresh
const EQUIPMENT_TYPES = new Set([
  'SWORD', 'BOW', 'STAFF', 'SHIELD', 'HELMET', 'CHESTPLATE',
  'BOOTS', 'GLOVES', 'GREAVES', 'RING', 'AMULET', 'AXE',
  'PICKAXE', 'FISHING_ROD',
])

// Target qualities (by default, only refresh mythic and legendary)
const TARGET_QUALITIES = new Set(['MYTHIC', 'LEGENDARY'])

interface AllItem {
  hashedId: string
  name: string
  type: string
  vendorPrice: number | null
  [key: string]: unknown
}

interface DefaultData {
  allItems: AllItem[]
  [key: string]: unknown
}

interface ItemSearchResult {
  hashed_id: string
  name: string
  type: string
  quality: string
  vendor_price: number | null
}

interface ItemSearchResponse {
  items: ItemSearchResult[]
  pagination: {
    current_page: number
    last_page: number
  }
}

// Load API key from .env file
function loadApiKeyFromEnv(): string | null {
  const envPath = path.join(__dirname, '../.env')
  try {
    const envContent = fs.readFileSync(envPath, 'utf8')
    const match = envContent.match(/^IDLE_MMO_SECRET_KEY_CLI=(.+)$/m)
    return match ? match[1].trim() : null
  } catch {
    return null
  }
}

// Get API key from CLI argument, process.env, or .env file
function getApiKey(): string | null {
  const args = process.argv.slice(2)
  const apiKeyArg = args.find((arg) => arg.startsWith('--api-key='))
  if (apiKeyArg) {
    console.log('Using API key from --api-key argument')
    return apiKeyArg.split('=')[1]
  }

  const processEnvKey = process.env.IDLE_MMO_SECRET_KEY_CLI
  if (processEnvKey) {
    console.log('Using API key from process.env.IDLE_MMO_SECRET_KEY_CLI')
    return processEnvKey
  }

  const envKey = loadApiKeyFromEnv()
  if (envKey) {
    console.log('Using API key from .env file')
    return envKey
  }

  return null
}

async function main() {
  console.log('IdleMMO Equipment Vendor Price Refresh Script')
  console.log('=============================================\n')

  const apiKey = getApiKey()
  if (!apiKey) {
    console.error('Error: API key is required')
    process.exit(1)
  }

  // Configure the API client for Node.js usage
  apiClient.configure({
    baseUrl: 'https://api.idle-mmo.com/v1',
    apiKey: apiKey,
  })

  // Check for CLI flags
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const refreshAll = args.includes('--all')
  const limitArg = args.find((arg) => arg.startsWith('--limit='))
  const itemLimit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity

  if (dryRun) console.log('DRY RUN MODE - No changes will be written to file\n')
  if (refreshAll) console.log('ALL MODE - Processing all equipment items regardless of quality\n')
  if (itemLimit < Infinity) console.log(`LIMIT MODE - Processing only first ${itemLimit} items\n`)

  // Read defaults.json
  const defaultsPath = path.join(__dirname, '../src/data/defaults.json')
  const data: DefaultData = JSON.parse(fs.readFileSync(defaultsPath, 'utf8'))

  // Get equipment items from allItems
  const allItems = data.allItems || []
  const equipmentItems = allItems.filter(
    (item) => item.type && EQUIPMENT_TYPES.has(item.type)
  )

  console.log(`Total items in allItems: ${allItems.length}`)
  console.log(`Equipment items: ${equipmentItems.length}`)

  // Build a map of hashedId -> allItems index for quick lookups
  const hashedIdToIndex = new Map<string, number>()
  allItems.forEach((item, index) => {
    if (item.hashedId) hashedIdToIndex.set(item.hashedId, index)
  })

  // Strategy: search for equipment items by name to get current vendor_price
  // We search by item name to get exact match and quality information
  let updatedCount = 0
  let noChangeCount = 0
  let skippedCount = 0
  let errorCount = 0
  let processed = 0

  // Use the item search endpoint with quality filter to find mythic/legendary items
  const qualityFilters = refreshAll
    ? ['MYTHIC', 'LEGENDARY', 'EPIC', 'PREMIUM', 'REFINED', 'STANDARD']
    : ['MYTHIC', 'LEGENDARY']

  console.log(`\nSearching for ${qualityFilters.join(', ')} equipment items...\n`)

  // Collect items to update from allItems that are equipment
  // Then batch-fetch their info from API by searching by name
  const itemsToProcess = equipmentItems.slice(0, itemLimit)

  console.log(`Processing ${itemsToProcess.length} equipment items...\n`)

  for (const item of itemsToProcess) {
    processed++

    if (processed % 10 === 0) {
      console.log(`Progress: ${processed}/${itemsToProcess.length} (${updatedCount} updated, ${noChangeCount} unchanged, ${skippedCount} skipped)`)
    }

    try {
      // Search for this specific item by name
      const searchResult = await apiClient.get<ItemSearchResponse>('/item/search', {
        query: item.name,
        page: 1,
      })

      // Find exact match by hashedId or name+type
      const apiItem = searchResult.items.find(
        (i) => i.hashed_id === item.hashedId ||
                (i.name === item.name && i.type === item.type)
      )

      if (!apiItem) {
        console.log(`  SKIP: ${item.name} - not found in API search results`)
        skippedCount++
        continue
      }

      // Skip if quality doesn't match target (unless --all mode)
      if (!refreshAll && !TARGET_QUALITIES.has(apiItem.quality)) {
        skippedCount++
        continue
      }

      const currentPrice = item.vendorPrice
      const newPrice = apiItem.vendor_price

      if (currentPrice === newPrice) {
        noChangeCount++
        continue
      }

      console.log(`  UPDATE: ${item.name} (${apiItem.quality}) ${currentPrice} -> ${newPrice}`)

      if (!dryRun) {
        const index = hashedIdToIndex.get(item.hashedId)
        if (index !== undefined) {
          data.allItems[index].vendorPrice = newPrice
        }
      }
      updatedCount++
    } catch (error) {
      console.error(`  ERROR: ${item.name} - ${error instanceof Error ? error.message : 'unknown error'}`)
      errorCount++
    }
  }

  console.log(`\n=== RESULTS ===`)
  console.log(`Processed: ${processed} items`)
  console.log(`Updated: ${updatedCount}`)
  console.log(`No change: ${noChangeCount}`)
  console.log(`Skipped: ${skippedCount}`)
  console.log(`Errors: ${errorCount}`)

  if (!dryRun && updatedCount > 0) {
    fs.writeFileSync(defaultsPath, JSON.stringify(data, null, 2) + '\n', 'utf8')
    console.log(`\nDefaults.json updated with ${updatedCount} price changes.`)
  } else if (dryRun) {
    console.log('\nDRY RUN: No changes written.')
  } else {
    console.log('\nNo changes needed.')
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

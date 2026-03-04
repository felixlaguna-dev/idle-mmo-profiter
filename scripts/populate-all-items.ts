/**
 * Populate all game items from IdleMMO API into defaults.json
 *
 * This script:
 * 1. Reads defaults.json
 * 2. Fetches ALL game items from /item/search endpoint (paginated)
 * 3. Deduplicates against existing items in categories
 * 4. Adds new 'allItems' array to defaults.json
 * 5. Respects API rate limits (20 req/min)
 * 6. Shows progress in console
 *
 * Run with: tsx scripts/populate-all-items.ts
 *
 * API key resolution order:
 * 1. CLI argument: --api-key=<key> (explicit override)
 * 2. process.env.IDLE_MMO_SECRET_KEY_CLI (works in CI with Docker -e flag)
 * 3. .env file (IDLE_MMO_SECRET_KEY_CLI) (local dev fallback)
 * 4. Interactive prompt
 *
 * Options:
 * --limit=N     Process only first N pages (for testing)
 * --dry-run     Print what would change but don't write file
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import readline from 'readline'
import { apiClient } from '../src/api/client.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Types - minimal interface for the items we need
interface DefaultItem {
  id?: string
  name: string
  hashedId?: string
  price?: number
  marketPrice?: number
  [key: string]: unknown // preserve other fields
}

interface DefaultData {
  materials: DefaultItem[]
  craftables: DefaultItem[]
  resources: DefaultItem[]
  recipes: DefaultItem[]
  craftableRecipes?: DefaultItem[]
  allItems?: AllItem[]
  [key: string]: unknown // preserve other top-level fields
}

interface AllItem {
  hashedId: string
  name: string
  type: string
  vendorPrice: number | null
}

interface ItemSearchResult {
  hashed_id: string
  name: string
  description: string
  image_url: string
  type: string
  quality: string
  vendor_price: number | null
}

interface ItemSearchResponse {
  items: ItemSearchResult[]
  pagination: {
    current_page: number
    last_page: number
    per_page: number
    total: number
    from: number
    to: number
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

// Get API key from CLI argument, process.env, .env file, or prompt
async function getApiKey(): Promise<string> {
  // 1. Check CLI argument (explicit override)
  const args = process.argv.slice(2)
  const apiKeyArg = args.find((arg) => arg.startsWith('--api-key='))

  if (apiKeyArg) {
    console.log('Using API key from --api-key argument')
    return apiKeyArg.split('=')[1]
  }

  // 2. Check process.env (works in CI with Docker -e flag)
  const processEnvKey = process.env.IDLE_MMO_SECRET_KEY_CLI
  if (processEnvKey) {
    console.log('Using API key from process.env.IDLE_MMO_SECRET_KEY_CLI')
    return processEnvKey
  }

  // 3. Check .env file (local dev fallback)
  const envKey = loadApiKeyFromEnv()
  if (envKey) {
    console.log('Using API key from .env file (IDLE_MMO_SECRET_KEY_CLI)')
    return envKey
  }

  // 4. Prompt for API key
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question('Enter your IdleMMO API key: ', (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

// Main function
async function main() {
  console.log('IdleMMO All Items Population Script')
  console.log('====================================\n')

  // Get API key
  const apiKey = await getApiKey()

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
  const limitArg = args.find((arg) => arg.startsWith('--limit='))
  const pageLimit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity
  const dryRun = args.includes('--dry-run')

  if (dryRun) {
    console.log('DRY RUN MODE - No changes will be written to file\n')
  }

  if (pageLimit < Infinity) {
    console.log(`LIMIT MODE - Processing only first ${pageLimit} pages\n`)
  }

  // Read defaults.json
  const defaultsPath = path.join(__dirname, '../src/data/defaults.json')
  const data: DefaultData = JSON.parse(fs.readFileSync(defaultsPath, 'utf8'))

  // Build a Set of all existing hashedIds to avoid duplicates
  const existingHashIds = new Set<string>()

  data.materials.forEach((item) => {
    if (item.hashedId) existingHashIds.add(item.hashedId)
  })
  data.craftables.forEach((item) => {
    if (item.hashedId) existingHashIds.add(item.hashedId)
  })
  data.resources.forEach((item) => {
    if (item.hashedId) existingHashIds.add(item.hashedId)
  })
  data.recipes.forEach((item) => {
    if (item.hashedId) existingHashIds.add(item.hashedId)
  })
  if (data.craftableRecipes) {
    data.craftableRecipes.forEach((item) => {
      if (item.hashedId) existingHashIds.add(item.hashedId)
    })
  }

  console.log(`Found ${existingHashIds.size} existing items across all categories`)
  console.log('Fetching all items from API...\n')

  // IdleMMO API requires a search query parameter
  // Strategy: iterate through alphabet (a-z) and numbers (0-9) to cover all items
  const searchQueries = [
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  ]

  console.log(`Using alphabet search strategy (${searchQueries.length} queries)\n`)

  // Collect all items
  const allItems: AllItem[] = []
  let newItemCount = 0
  let duplicateCount = 0
  let totalRequests = 0
  let queryIndex = 0

  // Fetch items for each search query
  for (const query of searchQueries) {
    console.log(`\n=== Search query: "${query}" ===`)

    // Fetch first page to get total page count for this query
    const firstPageResponse = await apiClient.get<ItemSearchResponse>('/item/search', {
      query,
      page: 1,
    })
    totalRequests++

    const totalPages = firstPageResponse.pagination.last_page
    const totalItems = firstPageResponse.pagination.total

    console.log(
      `Query "${query}": ${totalItems} items, ${totalPages} pages`
    )

    // Apply page limit across ALL queries (not per query)
    const remainingLimit = pageLimit - totalRequests + 1
    const pagesToFetch = Math.min(totalPages, remainingLimit)

    // Process first page
    let queryNewItems = 0
    let queryDuplicates = 0

    firstPageResponse.items.forEach((apiItem) => {
      if (existingHashIds.has(apiItem.hashed_id)) {
        queryDuplicates++
        duplicateCount++
      } else {
        allItems.push({
          hashedId: apiItem.hashed_id,
          name: apiItem.name,
          type: apiItem.type,
          vendorPrice: apiItem.vendor_price,
        })
        existingHashIds.add(apiItem.hashed_id)
        queryNewItems++
        newItemCount++
      }
    })

    // Fetch remaining pages for this query
    for (let page = 2; page <= pagesToFetch; page++) {
      const response = await apiClient.get<ItemSearchResponse>('/item/search', { query, page })
      totalRequests++

      response.items.forEach((apiItem) => {
        if (existingHashIds.has(apiItem.hashed_id)) {
          queryDuplicates++
          duplicateCount++
        } else {
          allItems.push({
            hashedId: apiItem.hashed_id,
            name: apiItem.name,
            type: apiItem.type,
            vendorPrice: apiItem.vendor_price,
          })
          existingHashIds.add(apiItem.hashed_id)
          queryNewItems++
          newItemCount++
        }
      })

      // Check if we've hit the page limit
      if (totalRequests >= pageLimit) {
        console.log(`\nPage limit reached (${pageLimit} requests), stopping`)
        break
      }
    }

    console.log(
      `Query "${query}" complete: ${queryNewItems} new items, ${queryDuplicates} duplicates`
    )

    queryIndex++

    // Check if we've hit the page limit
    if (totalRequests >= pageLimit) {
      break
    }

    // Show overall progress
    const progress = Math.round((queryIndex / searchQueries.length) * 100)
    const estimatedRemaining = Math.ceil((totalRequests * searchQueries.length) / queryIndex / 20)
    console.log(
      `Progress: ${queryIndex}/${searchQueries.length} queries (${progress}%), ${totalRequests} requests, ~${estimatedRemaining}min estimated remaining`
    )
  }

  console.log('\n=== Fetch Complete ===\n')
  console.log(`Total API requests: ${totalRequests}`)
  console.log(`Total items fetched: ${newItemCount + duplicateCount}`)
  console.log(`New items to add: ${newItemCount}`)
  console.log(`Duplicates skipped: ${duplicateCount}`)
  console.log(`Total unique items: ${existingHashIds.size}`)

  // Update defaults.json with allItems array
  data.allItems = allItems

  // Write to file (unless dry run)
  if (!dryRun) {
    console.log('\n=== Writing results to defaults.json ===')
    fs.writeFileSync(defaultsPath, JSON.stringify(data, null, 2) + '\n', 'utf8')
    console.log(`✓ Added ${newItemCount} items to allItems array in defaults.json`)
  } else {
    console.log('\n[DRY RUN] No changes written to defaults.json')
    console.log(`Would have added ${newItemCount} items to allItems array`)
  }

  console.log('\nDone!')
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

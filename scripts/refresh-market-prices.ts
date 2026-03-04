/**
 * Refresh market prices for all items in defaults.json
 *
 * This script:
 * 1. Reads defaults.json
 * 2. For each item with hashedId, calls the IdleMMO API to get current market price
 * 3. Updates price/marketPrice fields based on item type
 * 4. Skips untradable recipes
 * 5. Syncs resourceGathering prices from resources array
 * 6. Writes results back to defaults.json
 * 7. Handles rate limits (20 req/min) with delays between requests
 * 8. Shows progress in console
 *
 * Run with: tsx scripts/refresh-market-prices.ts
 *
 * API key resolution order:
 * 1. CLI argument: --api-key=<key> (explicit override)
 * 2. process.env.IDLE_MMO_SECRET_KEY_CLI (works in CI with Docker -e flag)
 * 3. .env file (IDLE_MMO_SECRET_KEY_CLI) (local dev fallback)
 * 4. Interactive prompt
 *
 * Options:
 * --limit=N     Process only first N items (for testing)
 * --dry-run     Print what would change but don't write file
 * --smart       Only refresh items that are due based on their suggested refresh frequency
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import readline from 'readline'
import { apiClient } from '../src/api/client.js'
import { getMarketHistory } from '../src/api/services.js'
import {
  computeSuggestedRefreshMinutes,
  formatRefreshInterval,
} from '../src/utils/refreshFrequency.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Default refresh interval for items with insufficient sales data (24 hours)
const DEFAULT_REFRESH_MINUTES = 1440 // 24 hours

// Types - minimal interface for the items we need to update
interface DefaultItem {
  id?: string
  name: string
  hashedId?: string
  price?: number
  marketPrice?: number
  isUntradable?: boolean
  lastUpdated?: string
  suggestedRefreshMinutes?: number
  lastSaleAt?: string // Most recent sale timestamp for low-confidence detection
  [key: string]: unknown // preserve other fields
}

interface DefaultData {
  materials: DefaultItem[]
  craftables: DefaultItem[]
  resources: DefaultItem[]
  recipes: DefaultItem[]
  resourceGathering: DefaultItem[]
  [key: string]: unknown // preserve other top-level fields
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

// Category configuration for price field mapping
type CategoryName = 'materials' | 'craftables' | 'resources' | 'recipes'
type PriceField = 'price' | 'marketPrice'

const CATEGORY_CONFIG: Record<CategoryName, { priceField: PriceField }> = {
  materials: { priceField: 'price' },
  craftables: { priceField: 'price' },
  resources: { priceField: 'marketPrice' },
  recipes: { priceField: 'price' },
}

interface ProcessResult {
  updated: boolean
  oldPrice: number | undefined
  newPrice: number | null
  skipped: boolean
  skipReason?: string
  suggestedRefreshMinutes?: number
}

/**
 * Check if an item is due for refresh based on lastUpdated and suggestedRefreshMinutes
 */
function isDueForRefresh(item: DefaultItem): {
  due: boolean
  minutesSinceLast?: number
  minutesUntilDue?: number
} {
  // Always due if never refreshed
  if (!item.lastUpdated) {
    return { due: true }
  }

  // Always due if no suggestion (need to compute one)
  if (!item.suggestedRefreshMinutes) {
    return { due: true }
  }

  // Calculate time since last update
  const lastUpdatedTime = new Date(item.lastUpdated).getTime()
  const currentTime = Date.now()
  const minutesSinceLast = (currentTime - lastUpdatedTime) / (1000 * 60)

  // Check if due
  if (minutesSinceLast >= item.suggestedRefreshMinutes) {
    return { due: true, minutesSinceLast }
  }

  // Not due yet
  const minutesUntilDue = item.suggestedRefreshMinutes - minutesSinceLast
  return { due: false, minutesSinceLast, minutesUntilDue }
}

/**
 * Process a single item: fetch market price and update in-place
 *
 * @param item - The item to process
 * @param priceField - Which field to update ('price' or 'marketPrice')
 * @param index - Current item index (for progress display)
 * @param total - Total number of items to process
 * @param categoryName - Category name for display
 * @returns Processing result with update status
 */
async function processItem(
  item: DefaultItem,
  priceField: PriceField,
  index: number,
  total: number,
  categoryName: string
): Promise<ProcessResult> {
  console.log(`[${index}/${total}] Processing: ${item.name} (${categoryName})`)

  // Skip if no hashedId
  if (!item.hashedId) {
    console.log(`  ⊘ No hashedId, skipped`)
    return {
      updated: false,
      oldPrice: item[priceField] as number | undefined,
      newPrice: null,
      skipped: true,
      skipReason: 'no-hashedId',
    }
  }

  // Skip if untradable
  if (item.isUntradable === true) {
    console.log(`  ⊘ Untradable, skipped`)
    return {
      updated: false,
      oldPrice: item[priceField] as number | undefined,
      newPrice: null,
      skipped: true,
      skipReason: 'untradable',
    }
  }

  // Fetch market history to get both price and suggested refresh interval
  const marketData = await getMarketHistory(item.hashedId)

  if (!marketData || marketData.latest_sold.length === 0) {
    console.log(`  ⚠ No market data available`)
    return {
      updated: false,
      oldPrice: item[priceField] as number | undefined,
      newPrice: null,
      skipped: false,
    }
  }

  // Compute average price from latest_sold (replicate getAverageMarketPrice logic)
  const recentTransactions = marketData.latest_sold.slice(0, 10).map((e) => e.price_per_item)
  const average = recentTransactions.reduce((a, b) => a + b, 0) / recentTransactions.length
  const newPrice = Math.round(average * 10) / 10 // Round to 1 decimal place
  const oldPrice = item[priceField] as number | undefined

  // Compute suggested refresh interval
  const computedRefreshMinutes = computeSuggestedRefreshMinutes(marketData)

  // Use computed value or default if insufficient data
  const suggestedRefreshMinutes =
    computedRefreshMinutes !== null ? computedRefreshMinutes : DEFAULT_REFRESH_MINUTES
  const usedDefault = computedRefreshMinutes === null

  // Update the price in-place
  ;(item as Record<string, unknown>)[priceField] = newPrice

  // Set lastUpdated timestamp
  item.lastUpdated = new Date().toISOString()

  // Set suggestedRefreshMinutes (either computed or default)
  item.suggestedRefreshMinutes = suggestedRefreshMinutes

  // Extract and store the most recent sale timestamp for low-confidence detection
  // latest_sold is sorted by recency (most recent first)
  if (marketData.latest_sold.length > 0) {
    item.lastSaleAt = marketData.latest_sold[0].sold_at
  }

  // Show the change with refresh interval
  if (oldPrice !== undefined) {
    const change = newPrice - oldPrice
    const changeSymbol = change > 0 ? '↑' : change < 0 ? '↓' : '='
    const refreshInfo = ` [refresh: ${formatRefreshInterval(suggestedRefreshMinutes)}${usedDefault ? ' (default)' : ''}]`
    console.log(
      `  ✓ ${oldPrice} → ${newPrice} (${changeSymbol} ${Math.abs(change).toFixed(1)})${refreshInfo}`
    )
  } else {
    const refreshInfo = ` [refresh: ${formatRefreshInterval(suggestedRefreshMinutes)}${usedDefault ? ' (default)' : ''}]`
    console.log(`  ✓ New price: ${newPrice}${refreshInfo}`)
  }

  return {
    updated: true,
    oldPrice,
    newPrice,
    skipped: false,
    suggestedRefreshMinutes,
  }
}

// Main function
async function main() {
  console.log('IdleMMO Market Price Refresh Script')
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
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity
  const dryRun = args.includes('--dry-run')
  const smartMode = args.includes('--smart')

  if (dryRun) {
    console.log('DRY RUN MODE - No changes will be written to file\n')
  }

  if (smartMode) {
    console.log('SMART MODE - Only refreshing items that are due\n')
  }

  // Read defaults.json
  const defaultsPath = path.join(__dirname, '../src/data/defaults.json')
  const data: DefaultData = JSON.parse(fs.readFileSync(defaultsPath, 'utf8'))

  // Count items with hashedId per category
  const materialsWithHashedId = data.materials.filter((item) => item.hashedId).length
  const craftablesWithHashedId = data.craftables.filter((item) => item.hashedId).length
  const resourcesWithHashedId = data.resources.filter((item) => item.hashedId).length
  const recipesWithHashedId = data.recipes.filter(
    (item) => item.hashedId && !item.isUntradable
  ).length
  const untradableRecipes = data.recipes.filter((item) => item.isUntradable).length

  const totalItems =
    materialsWithHashedId + craftablesWithHashedId + resourcesWithHashedId + recipesWithHashedId

  console.log('Item counts:')
  console.log(`  Materials: ${materialsWithHashedId} items with hashedId`)
  console.log(`  Craftables: ${craftablesWithHashedId} items with hashedId`)
  console.log(`  Resources: ${resourcesWithHashedId} items with hashedId`)
  console.log(
    `  Recipes: ${recipesWithHashedId} tradable items with hashedId (${untradableRecipes} untradable, will skip)`
  )
  console.log(
    `  Resource Gathering: ${data.resourceGathering.length} items (will sync from resources)`
  )
  console.log(`\nTotal items to fetch: ${totalItems}`)
  // Estimated time based on 20 req/min rate limit
  const estimatedMinutes = Math.ceil(totalItems / 20)
  console.log(`Estimated time: ~${estimatedMinutes} minutes (API rate limit: 20 req/min)\n`)

  if (limit < Infinity) {
    console.log(`Limiting to first ${limit} items for testing\n`)
  }

  // Smart mode pre-run analysis
  if (smartMode) {
    let dueNow = 0
    let notYetDue = 0
    let neverRefreshed = 0

    const allItems = [
      ...data.materials.filter((item) => item.hashedId),
      ...data.craftables.filter((item) => item.hashedId),
      ...data.resources.filter((item) => item.hashedId),
      ...data.recipes.filter((item) => item.hashedId && !item.isUntradable),
    ]

    // Include craftableRecipes in analysis
    const craftableRecipesForAnalysis = (data as DefaultData & { craftableRecipes?: DefaultItem[] }).craftableRecipes || []

    for (const item of [...allItems, ...craftableRecipesForAnalysis]) {
      if (!item.lastUpdated) {
        neverRefreshed++
      }
      const refreshStatus = isDueForRefresh(item)
      if (refreshStatus.due) {
        dueNow++
      } else {
        notYetDue++
      }
    }

    console.log('Smart mode analysis:')
    console.log(`  Due now: ${dueNow} items (${allItems.length} main + ${craftableRecipesForAnalysis.length} craftableRecipes)`)
    console.log(`  Not yet due: ${notYetDue} items`)
    console.log(`  Never refreshed: ${neverRefreshed} items (will refresh)`)
    const estimatedDueMinutes = Math.ceil(dueNow / 20)
    console.log(`  Estimated time: ~${estimatedDueMinutes} minutes\n`)
  }

  const startTime = Date.now()
  let currentIndex = 0
  let updatedCount = 0
  let skippedCount = 0
  let noDataCount = 0
  let smartSkippedCount = 0

  // Refresh frequency distribution
  let fastRefreshCount = 0 // < 1 hour
  let mediumRefreshCount = 0 // 1-24 hours
  let slowRefreshCount = 0 // > 24 hours
  let minRefreshMinutes: number | null = null
  let maxRefreshMinutes: number | null = null

  // Per-category stats
  const categoryStats = {
    materials: { updated: 0, noData: 0, skipped: 0, total: 0 },
    craftables: { updated: 0, noData: 0, skipped: 0, total: 0 },
    resources: { updated: 0, noData: 0, skipped: 0, total: 0 },
    recipes: { updated: 0, noData: 0, skipped: 0, total: 0 },
  }

  // Process materials
  console.log(`\n=== Processing Materials (${materialsWithHashedId} items) ===\n`)
  for (const item of data.materials) {
    if (!item.hashedId) continue
    if (currentIndex >= limit) break

    // Smart mode: check if due for refresh
    if (smartMode) {
      const refreshStatus = isDueForRefresh(item)
      if (!refreshStatus.due) {
        console.log(
          `  ⏳ ${item.name}: Not due (last: ${formatRefreshInterval(refreshStatus.minutesSinceLast!)} ago, next in: ${formatRefreshInterval(refreshStatus.minutesUntilDue!)})`
        )
        smartSkippedCount++
        continue
      }
    }

    currentIndex++

    const result = await processItem(
      item,
      CATEGORY_CONFIG.materials.priceField,
      currentIndex,
      Math.min(totalItems, limit),
      'materials'
    )

    categoryStats.materials.total++
    if (result.updated) {
      updatedCount++
      categoryStats.materials.updated++

      // Track refresh frequency distribution
      if (result.suggestedRefreshMinutes !== undefined) {
        if (result.suggestedRefreshMinutes < 60) {
          fastRefreshCount++
        } else if (result.suggestedRefreshMinutes < 24 * 60) {
          mediumRefreshCount++
        } else {
          slowRefreshCount++
        }

        if (minRefreshMinutes === null || result.suggestedRefreshMinutes < minRefreshMinutes) {
          minRefreshMinutes = result.suggestedRefreshMinutes
        }
        if (maxRefreshMinutes === null || result.suggestedRefreshMinutes > maxRefreshMinutes) {
          maxRefreshMinutes = result.suggestedRefreshMinutes
        }
      }
    }
    if (result.skipped) {
      skippedCount++
      categoryStats.materials.skipped++
    }
    if (!result.updated && !result.skipped && result.newPrice === null) {
      noDataCount++
      categoryStats.materials.noData++
    }

    // Rate limiting is now handled automatically by apiClient
  }

  // Process craftables
  console.log(`\n=== Processing Craftables (${craftablesWithHashedId} items) ===\n`)
  for (const item of data.craftables) {
    if (!item.hashedId) continue
    if (currentIndex >= limit) break

    // Smart mode: check if due for refresh
    if (smartMode) {
      const refreshStatus = isDueForRefresh(item)
      if (!refreshStatus.due) {
        console.log(
          `  ⏳ ${item.name}: Not due (last: ${formatRefreshInterval(refreshStatus.minutesSinceLast!)} ago, next in: ${formatRefreshInterval(refreshStatus.minutesUntilDue!)})`
        )
        smartSkippedCount++
        continue
      }
    }

    currentIndex++

    const result = await processItem(
      item,
      CATEGORY_CONFIG.craftables.priceField,
      currentIndex,
      Math.min(totalItems, limit),
      'craftables'
    )

    categoryStats.craftables.total++
    if (result.updated) {
      updatedCount++
      categoryStats.craftables.updated++

      // Track refresh frequency distribution
      if (result.suggestedRefreshMinutes !== undefined) {
        if (result.suggestedRefreshMinutes < 60) {
          fastRefreshCount++
        } else if (result.suggestedRefreshMinutes < 24 * 60) {
          mediumRefreshCount++
        } else {
          slowRefreshCount++
        }

        if (minRefreshMinutes === null || result.suggestedRefreshMinutes < minRefreshMinutes) {
          minRefreshMinutes = result.suggestedRefreshMinutes
        }
        if (maxRefreshMinutes === null || result.suggestedRefreshMinutes > maxRefreshMinutes) {
          maxRefreshMinutes = result.suggestedRefreshMinutes
        }
      }
    }
    if (result.skipped) {
      skippedCount++
      categoryStats.craftables.skipped++
    }
    if (!result.updated && !result.skipped && result.newPrice === null) {
      noDataCount++
      categoryStats.craftables.noData++
    }

    // Rate limiting is now handled automatically by apiClient
  }

  // Process resources
  console.log(`\n=== Processing Resources (${resourcesWithHashedId} items) ===\n`)
  for (const item of data.resources) {
    if (!item.hashedId) continue
    if (currentIndex >= limit) break

    // Smart mode: check if due for refresh
    if (smartMode) {
      const refreshStatus = isDueForRefresh(item)
      if (!refreshStatus.due) {
        console.log(
          `  ⏳ ${item.name}: Not due (last: ${formatRefreshInterval(refreshStatus.minutesSinceLast!)} ago, next in: ${formatRefreshInterval(refreshStatus.minutesUntilDue!)})`
        )
        smartSkippedCount++
        continue
      }
    }

    currentIndex++

    const result = await processItem(
      item,
      CATEGORY_CONFIG.resources.priceField,
      currentIndex,
      Math.min(totalItems, limit),
      'resources'
    )

    categoryStats.resources.total++
    if (result.updated) {
      updatedCount++
      categoryStats.resources.updated++

      // Track refresh frequency distribution
      if (result.suggestedRefreshMinutes !== undefined) {
        if (result.suggestedRefreshMinutes < 60) {
          fastRefreshCount++
        } else if (result.suggestedRefreshMinutes < 24 * 60) {
          mediumRefreshCount++
        } else {
          slowRefreshCount++
        }

        if (minRefreshMinutes === null || result.suggestedRefreshMinutes < minRefreshMinutes) {
          minRefreshMinutes = result.suggestedRefreshMinutes
        }
        if (maxRefreshMinutes === null || result.suggestedRefreshMinutes > maxRefreshMinutes) {
          maxRefreshMinutes = result.suggestedRefreshMinutes
        }
      }
    }
    if (result.skipped) {
      skippedCount++
      categoryStats.resources.skipped++
    }
    if (!result.updated && !result.skipped && result.newPrice === null) {
      noDataCount++
      categoryStats.resources.noData++
    }

    // Rate limiting is now handled automatically by apiClient
  }

  // Process recipes (skip untradable)
  console.log(`\n=== Processing Recipes (${recipesWithHashedId} tradable items) ===\n`)
  for (const item of data.recipes) {
    if (!item.hashedId) continue
    if (item.isUntradable === true) continue // Skip untradable recipes
    if (currentIndex >= limit) break

    // Smart mode: check if due for refresh
    if (smartMode) {
      const refreshStatus = isDueForRefresh(item)
      if (!refreshStatus.due) {
        console.log(
          `  ⏳ ${item.name}: Not due (last: ${formatRefreshInterval(refreshStatus.minutesSinceLast!)} ago, next in: ${formatRefreshInterval(refreshStatus.minutesUntilDue!)})`
        )
        smartSkippedCount++
        continue
      }
    }

    currentIndex++

    const result = await processItem(
      item,
      CATEGORY_CONFIG.recipes.priceField,
      currentIndex,
      Math.min(totalItems, limit),
      'recipes'
    )

    categoryStats.recipes.total++
    if (result.updated) {
      updatedCount++
      categoryStats.recipes.updated++

      // Track refresh frequency distribution
      if (result.suggestedRefreshMinutes !== undefined) {
        if (result.suggestedRefreshMinutes < 60) {
          fastRefreshCount++
        } else if (result.suggestedRefreshMinutes < 24 * 60) {
          mediumRefreshCount++
        } else {
          slowRefreshCount++
        }

        if (minRefreshMinutes === null || result.suggestedRefreshMinutes < minRefreshMinutes) {
          minRefreshMinutes = result.suggestedRefreshMinutes
        }
        if (maxRefreshMinutes === null || result.suggestedRefreshMinutes > maxRefreshMinutes) {
          maxRefreshMinutes = result.suggestedRefreshMinutes
        }
      }
    }
    if (result.skipped) {
      skippedCount++
      categoryStats.recipes.skipped++
    }
    if (!result.updated && !result.skipped && result.newPrice === null) {
      noDataCount++
      categoryStats.recipes.noData++
    }

    // Rate limiting is now handled automatically by apiClient
  }

  // Sync resourceGathering prices from resources (no API call needed)
  console.log(`\n=== Syncing Resource Gathering Prices ===\n`)
  const resourcePriceMap = new Map<string, number>()
  data.resources.forEach((r) => {
    resourcePriceMap.set(r.name, r.marketPrice)
  })

  let syncedCount = 0
  data.resourceGathering.forEach((rg) => {
    const resourcePrice = resourcePriceMap.get(rg.name)
    if (resourcePrice !== undefined) {
      const oldPrice = rg.marketPrice
      rg.marketPrice = resourcePrice
      console.log(`  ✓ ${rg.name}: ${oldPrice} → ${resourcePrice}`)
      syncedCount++
    } else {
      console.log(`  ⊘ ${rg.name}: No matching resource, keeping ${rg.marketPrice}`)
    }
  })

  // Process craftableRecipes: fetch lastSaleAt for each craftableRecipe
  // This is needed because craftables are auto-generated from craftableRecipes
  // and they need lastSaleAt for low-confidence detection to work
  const craftableRecipes = (data as DefaultData & { craftableRecipes?: DefaultItem[] }).craftableRecipes
  let craftableRecipeSmartSkipped = 0
  if (craftableRecipes && craftableRecipes.length > 0) {
    console.log(`\n=== Processing Craftable Recipes (${craftableRecipes.length} items) ===\n`)

    // Build a map of producesItemName -> recipe for lookup
    const recipeByProducesName = new Map<string, DefaultItem>()
    data.recipes.forEach((recipe) => {
      if (recipe.producesItemName && recipe.producesItemHashedId) {
        recipeByProducesName.set(recipe.producesItemName, recipe)
      }
    })

    let craftableRecipeUpdatedCount = 0
    for (const craftableRecipe of craftableRecipes) {
      if (currentIndex >= limit) break

      // Find the matching recipe to get the hashedId
      const matchingRecipe = recipeByProducesName.get(craftableRecipe.name)
      if (!matchingRecipe || !matchingRecipe.producesItemHashedId) {
        console.log(`  ⊘ ${craftableRecipe.name}: No matching recipe with hashedId, skipped`)
        continue
      }

      // Smart mode: check if due for refresh
      if (smartMode) {
        const refreshStatus = isDueForRefresh(craftableRecipe)
        if (!refreshStatus.due) {
          console.log(
            `  ⏳ ${craftableRecipe.name}: Not due (last: ${formatRefreshInterval(refreshStatus.minutesSinceLast!)} ago, next in: ${formatRefreshInterval(refreshStatus.minutesUntilDue!)})`
          )
          craftableRecipeSmartSkipped++
          smartSkippedCount++
          continue
        }
      }

      currentIndex++
      console.log(`[${currentIndex}/${Math.min(totalItems + craftableRecipes.length, limit)}] Processing: ${craftableRecipe.name} (craftableRecipe)`)

      // Fetch market history to get lastSaleAt
      const marketData = await getMarketHistory(matchingRecipe.producesItemHashedId)

      if (!marketData || marketData.latest_sold.length === 0) {
        console.log(`  ⚠ No market data available for ${craftableRecipe.name}`)
        continue
      }

      // Extract and store the most recent sale timestamp
      const lastSaleAt = marketData.latest_sold[0].sold_at
      ;(craftableRecipe as Record<string, unknown>).lastSaleAt = lastSaleAt

      // Compute and store refresh interval so smart mode can skip next time
      const computedRefreshMinutes = computeSuggestedRefreshMinutes(marketData)
      craftableRecipe.lastUpdated = new Date().toISOString()
      craftableRecipe.suggestedRefreshMinutes =
        computedRefreshMinutes !== null ? computedRefreshMinutes : DEFAULT_REFRESH_MINUTES

      craftableRecipeUpdatedCount++
      console.log(`  ✓ lastSaleAt: ${lastSaleAt} [refresh: ${formatRefreshInterval(craftableRecipe.suggestedRefreshMinutes)}]`)
    }

    console.log(`\nCraftable recipes updated: ${craftableRecipeUpdatedCount}`)
    if (smartMode && craftableRecipeSmartSkipped > 0) {
      console.log(`Craftable recipes skipped (not due): ${craftableRecipeSmartSkipped}`)
    }
  }

  const endTime = Date.now()
  const durationMinutes = ((endTime - startTime) / 1000 / 60).toFixed(2)

  console.log('\n=== Market Price Refresh Complete ===\n')
  console.log('Results by category:')

  if (categoryStats.materials.total > 0) {
    console.log(
      `  Materials:  ${categoryStats.materials.updated} updated, ${categoryStats.materials.noData} no data, ${categoryStats.materials.skipped} skipped (${categoryStats.materials.total} total)`
    )
  }

  if (categoryStats.craftables.total > 0) {
    console.log(
      `  Craftables: ${categoryStats.craftables.updated} updated, ${categoryStats.craftables.noData} no data, ${categoryStats.craftables.skipped} skipped (${categoryStats.craftables.total} total)`
    )
  }

  if (categoryStats.resources.total > 0) {
    console.log(
      `  Resources:  ${categoryStats.resources.updated} updated, ${categoryStats.resources.noData} no data, ${categoryStats.resources.skipped} skipped (${categoryStats.resources.total} total)`
    )
  }

  if (categoryStats.recipes.total > 0) {
    console.log(
      `  Recipes:    ${categoryStats.recipes.updated} updated, ${categoryStats.recipes.noData} no data, ${categoryStats.recipes.skipped} skipped (${categoryStats.recipes.total} processed, ${untradableRecipes} untradable skipped)`
    )
  }

  console.log(`  ResourceGathering: ${syncedCount} synced from resources`)

  if (smartMode) {
    console.log(
      `\nSmart mode: ${updatedCount} items refreshed, ${smartSkippedCount} items skipped (not yet due)`
    )
  }

  console.log(`\nTotal: ${updatedCount} updated, ${noDataCount} no data, ${skippedCount} skipped`)

  // Show refresh frequency distribution
  const totalWithSuggestion = fastRefreshCount + mediumRefreshCount + slowRefreshCount
  if (totalWithSuggestion > 0) {
    console.log('\nRefresh frequency distribution:')
    console.log(`  Fast refresh (< 1h):     ${fastRefreshCount} items`)
    console.log(`  Medium refresh (1-24h):  ${mediumRefreshCount} items`)
    console.log(`  Slow refresh (> 24h):    ${slowRefreshCount} items`)
    console.log(`  Total with suggestions:  ${totalWithSuggestion} items`)

    if (minRefreshMinutes !== null && maxRefreshMinutes !== null) {
      console.log(
        `  Fastest: ${formatRefreshInterval(minRefreshMinutes)}, Slowest: ${formatRefreshInterval(maxRefreshMinutes)}`
      )
    }
  }

  console.log(`\nTime taken: ${durationMinutes} minutes`)

  // Write to file (unless dry run)
  if (!dryRun) {
    if (updatedCount === 0 && syncedCount === 0) {
      console.log('\nNo price changes detected, file not modified')
    } else {
      console.log('\n=== Writing results to defaults.json ===')
      fs.writeFileSync(defaultsPath, JSON.stringify(data, null, 2) + '\n', 'utf8')
      console.log('✓ Prices written to src/data/defaults.json')
    }
  } else {
    console.log('\n[DRY RUN] No changes written to defaults.json')
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

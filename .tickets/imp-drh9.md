---
id: imp-drh9
status: closed
deps: []
links: []
created: 2026-03-04T17:06:09Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-dx4t
---
# Phase 1: Data collection — extract weeklySalesVolume in refresh script

Modify scripts/refresh-market-prices.ts to extract weekly sales volume from the already-fetched marketData response.

## Changes to scripts/refresh-market-prices.ts

### 1. Add weeklySalesVolume to DefaultItem interface (line ~46)
Add optional field:
  weeklySalesVolume?: number

### 2. Create helper function computeWeeklySalesVolume()
- Takes marketData.history_data (array of MarketHistoryEntry with date, total_sold, average_price)
- Filters entries where date is within the last 7 days from now
- Sums total_sold from those entries
- Returns the integer sum (0 if no entries)

### 3. Call helper in processItem() (after line ~253)
After extracting lastSaleAt, add:
  const weeklySalesVolume = computeWeeklySalesVolume(marketData.history_data)
  item.weeklySalesVolume = weeklySalesVolume

### 4. Call helper in craftableRecipes processing block (after line ~731)
After extracting lastSaleAt for craftableRecipes, also compute and store:
  (craftableRecipe as Record<string, unknown>).weeklySalesVolume = computeWeeklySalesVolume(marketData.history_data)

### 5. Add weeklySalesVolume to ProcessResult interface (optional, for logging)
Optionally include weeklySalesVolume in the result so the script can log volume stats.

## Key details
- history_data is already returned by getMarketHistory() — see MarketHistoryResponse in src/api/services.ts
- MarketHistoryEntry has: { date: string, total_sold: number, average_price: number }
- date format from API is ISO date string (YYYY-MM-DD)
- No extra API calls are needed

## Affected file
- /home/felix/idle-mmo-profiter/scripts/refresh-market-prices.ts

## Acceptance Criteria

- [ ] computeWeeklySalesVolume() function exists and correctly sums total_sold for last 7 days
- [ ] weeklySalesVolume is stored on every processed item in defaults.json
- [ ] weeklySalesVolume is stored on craftableRecipes entries too
- [ ] Dry-run test shows volume data being collected
- [ ] Items with no history_data get weeklySalesVolume of 0


## Notes

**2026-03-04T17:10:22Z**

Phase 1 implementation complete.

Changes made to scripts/refresh-market-prices.ts:
1. Added weeklySalesVolume?: number to DefaultItem interface (line 56)
2. Created computeWeeklySalesVolume() helper function that:
   - Takes history_data array
   - Filters entries within last 7 days
   - Sums total_sold from matching entries
   - Returns 0 if no data
3. Called helper in processItem() after lastSaleAt extraction (line 260-262)
4. Called helper in craftableRecipes processing after lastSaleAt extraction (line 738-740)

The data will now be collected when the refresh script runs (requires API key, not running during implementation).

---
id: imp-jepe
status: open
deps: []
links: [imp-dx4t]
created: 2026-03-04T16:23:49Z
type: feature
priority: 2
assignee: Félix Laguna Teno
tags: [ui, data, refresh-script]
---
# Sales volume icons: track weekly item volume and show tier icons in activity tabs

## Goal
Track how many units of each item were sold in the last 7 days and display volume-tier icons in the Crafting and Dungeon activity tabs, so users can visually distinguish high-volume items (reliable profit) from low-volume flukes.

## Context
- The market history API (`GET /v1/item/{hashed_item_id}/market-history`) returns two data sources:
  - **`history_data`**: array of daily aggregates with `date`, `total_sold` (integer), and `average_price` — this is the primary source for weekly volume
  - **`latest_sold`**: array of recent individual transactions with `quantity`, `price_per_item`, `total_price`, `sold_at`
- The `MarketHistoryResponse` type in `src/api/services.ts` already includes `MarketHistoryEntry` with `total_sold`
- The refresh script currently ignores `history_data` entirely — it only uses `latest_sold` for price averaging and `lastSaleAt`
- Low-confidence detection (`src/utils/priceConfidence.ts`) is binary (30-day threshold) — this feature adds a **granular volume signal**
- API params: `tier` (integer, 0 = base), `type` ("listings" | "orders"). No pagination params for history_data

## Implementation

### 1. Data Collection (refresh script)
**File:** `scripts/refresh-market-prices.ts`

- Use `history_data` (daily aggregates) from the already-fetched `marketData` response — no extra API calls needed
- Sum `total_sold` from `history_data` entries where `date` is within the last 7 days to get `weeklySalesVolume`
- Store `weeklySalesVolume` on each item in `defaults.json`

### 2. Type Updates
**Files:** `src/types/index.ts`, script interfaces

- Add `weeklySalesVolume?: number` to:
  - `Material`, `Craftable`, `Recipe` interfaces
  - `DefaultItem` interface in the refresh script
  - `CraftableRecipe` (propagate from craftable item)

### 3. Volume Tier Classification
**New file:** `src/utils/salesVolume.ts`

Define volume tiers based on weekly sales volume. Suggested tiers (tune after seeing real data):
- **Dead** (0 units) — no sales at all
- **Trickle** (1-9 units) — barely trading, likely a fluke
- **Moderate** (10-49 units) — some activity, worth watching
- **Active** (50-199 units) — reliable demand
- **Hot** (200+ units) — high-volume, strong signal

Each tier maps to an icon + tooltip text + optional color.

### 4. Icon Display in Activity Tabs
**Files:** `src/components/CraftableTable.vue`, `src/components/DungeonTable.vue`

- Add a small volume icon next to each item name (or in its own narrow column)
- Icon varies by tier (e.g., single flame to double flame to fire, or similar visual metaphor)
- Tooltip on hover shows: "X units sold this week"
- For craftables: show the volume of the **finished product** (not materials)
- For dungeons: could show aggregate or per-drop volume (TBD)

### 5. Propagate Volume Through Calculators
**Files:** `src/calculators/craftableCalculator.ts`, `src/calculators/dungeonCalculator.ts`

- Pass `weeklySalesVolume` through to `CraftableProfitResult` and `DungeonDropResult`
- Dungeon-level volume could be the min/avg of its tradable drops' volumes

## Notes
- **No extra API calls needed** — `history_data` is already in the `MarketHistoryResponse` returned by `getMarketHistory()`, just currently unused by the refresh script
- `history_data` provides daily `total_sold` counts which are far more reliable for volume than counting `latest_sold` entries (which may be truncated)
- Tier thresholds should be easy to tune — keep them in a single config object
- This complements (does not replace) the existing low-confidence system
- Consider whether sorting by volume tier would be useful (probably yes, as secondary sort)

## API Reference
```
GET /v1/item/{hashed_item_id}/market-history
Scope: v1.item.market_history
Params: tier (integer), type ("listings" | "orders")

Response.history_data[]: { date: string, total_sold: integer, average_price: integer }
Response.latest_sold[]: { item: {...}, tier, quantity, price_per_item, total_price, sold_at }
```

## Affected Files
- `scripts/refresh-market-prices.ts` — collect volume data
- `src/types/index.ts` — new fields
- `src/utils/salesVolume.ts` — new: tier classification
- `src/components/CraftableTable.vue` — show icons
- `src/components/DungeonTable.vue` — show icons
- `src/calculators/craftableCalculator.ts` — propagate volume
- `src/calculators/dungeonCalculator.ts` — propagate volume
- `src/data/defaults.json` — will include volume data after refresh


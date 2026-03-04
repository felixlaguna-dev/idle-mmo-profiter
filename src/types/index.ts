// Core data entities

export interface Material {
  id: string
  name: string
  price: number
  hashedId?: string
  vendorValue?: number
  lastUpdated?: string
  suggestedRefreshMinutes?: number
  /** ISO timestamp of most recent sale from market history */
  lastSaleAt?: string
  /** Weekly sales volume (units sold in last 7 days) from market history */
  weeklySalesVolume?: number
}

export interface Craftable {
  id: string
  name: string
  price: number
  hashedId?: string
  vendorValue?: number
  lastUpdated?: string
  suggestedRefreshMinutes?: number
  /** ISO timestamp of most recent sale from market history */
  lastSaleAt?: string
  /** Weekly sales volume (units sold in last 7 days) from market history */
  weeklySalesVolume?: number
}

export interface Resource {
  id: string
  name: string
  marketPrice: number
  vendorValue: number
  hashedId?: string
  lastUpdated?: string
  suggestedRefreshMinutes?: number
}

export interface Recipe {
  id: string
  name: string
  price: number
  chance: number
  value?: number
  hashedId?: string
  vendorValue?: number
  uses?: number
  producesItemName?: string
  producesItemHashedId?: string
  producesItemVendorValue?: number
  tradableCounterpartId?: string
  isUntradable?: boolean
  lastUpdated?: string
  suggestedRefreshMinutes?: number
  /** ISO timestamp of most recent sale from market history */
  lastSaleAt?: string
  /** Weekly sales volume (units sold in last 7 days) from market history */
  weeklySalesVolume?: number
}

export interface DungeonDrop {
  recipeName: string
  expectedValue: number
}

export interface Dungeon {
  name: string
  runCost: number
  timeSeconds: number
  numDrops: number
  drops: DungeonDrop[]
}

export interface CraftableMaterial {
  name: string
  quantity: number
}

export interface CraftableRecipe {
  name: string
  timeSeconds: number
  materials: CraftableMaterial[]
  currentPrice: number
  recipeId?: string
  untradableRecipeId?: string
  recipeName?: string
  recipeUses?: number
  skill?: 'alchemy' | 'forging'
  /** ISO timestamp of most recent sale from market history */
  lastSaleAt?: string
  /** Weekly sales volume (units sold in last 7 days) from market history */
  weeklySalesVolume?: number
}

export interface ResourceInput {
  /** Resource name from the Market tab */
  resourceName: string
  /** Quantity of this resource needed */
  quantity: number
  /** If true, use market price; if false, use gathering cost */
  useMarketPrice: boolean
}

export interface ResourceGather {
  name: string
  timeSeconds: number
  /** Base gathering cost (e.g., fishing rod, pickaxe wear) */
  baseCost: number
  /** Input resources required (e.g., Coal for cooking) */
  inputs?: ResourceInput[]
  vendorValue: number
  marketPrice: number
  /** Computed cost (baseCost + sum of input costs) - calculated dynamically */
  cost?: number
}

// Settings and configuration

export interface MagicFindSettings {
  streak: number
  dungeon: number
  item: number
  bonus: number
}

export interface AppSettings {
  apiKey: string | null
  marketTaxRate: number
  magicFind: MagicFindSettings
}

// Results and calculations

export type ActivityType = 'dungeon' | 'craftable' | 'resource'

export interface ProfitResult {
  activityName: string
  type: ActivityType
  profitPerHour: number
  profitPerAction: number
  timePerAction: number
  cost: number
}

// API Authentication types

export interface ApiKeyInfo {
  name: string
  rate_limit: number
  expires_at: string
  scopes: string[] | null
}

export interface AuthCheckResponse {
  authenticated: boolean
  user: {
    id: number
  }
  character: {
    id: number
    hashed_id: string
    name: string
  }
  api_key: ApiKeyInfo
}

// Default data structure (matches defaults.json)

export interface DefaultData {
  materials: Material[]
  craftables: Craftable[]
  resources: Resource[]
  recipes: Recipe[]
  dungeons: Dungeon[]
  craftableRecipes: CraftableRecipe[]
  resourceGathering: ResourceGather[]
  magicFindDefaults: MagicFindSettings
  marketTaxRate: number
  allItems?: Array<{
    hashedId: string
    name: string
    type: string
    vendorPrice: number | null
  }>
}

// Character Value Tracker types

export interface CharacterInventoryItem {
  hashId: string
  quantity: number
  priceAtTime: number
  /** Optional item name for API-sourced items not in defaults.json */
  name?: string
}

export interface CharacterSnapshot {
  timestamp: string
  gold: number
  inventory: CharacterInventoryItem[]
}

export interface Character {
  id: string
  name: string
  gold: number
  inventory: CharacterInventoryItem[]
  history: CharacterSnapshot[]
}

export interface CharacterStore {
  characters: Character[]
  activeCharacterId: string | null
}

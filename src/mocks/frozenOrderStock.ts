import { allocateFrozenStockFefo, returnFrozenStock } from '../domain/frozenAllocation'
import type { FrozenOrderConfiguration, OrderItem } from '../components/new-order/types'

const saleDate = '2026-09-04'

interface FrozenLotState {
  id: string
  frozenConfigurationId: string
  manufacturedOn: string
  expiresOn: string
  availableQuantity: number
}

const configurations = [
  {
    id: 'cong-1001',
    producibleItemId: 'prod-1004',
    producibleName: 'Estrogonofe de frango',
    presentation: '300 g',
    unitPrice: 29,
    active: true
  },
  {
    id: 'cong-1002',
    producibleItemId: 'prod-1004',
    producibleName: 'Estrogonofe de frango',
    presentation: '450 g',
    unitPrice: 39,
    active: false
  }
]

let sessionLots: FrozenLotState[] = [
  { id: 'lote-2026-0814-a', frozenConfigurationId: 'cong-1001', manufacturedOn: '2026-06-14', expiresOn: '2026-09-12', availableQuantity: 6 },
  { id: 'lote-2026-0818-a', frozenConfigurationId: 'cong-1001', manufacturedOn: '2026-08-17', expiresOn: '2026-11-15', availableQuantity: 14 },
  { id: 'lote-2026-0603-a', frozenConfigurationId: 'cong-1001', manufacturedOn: '2026-06-03', expiresOn: '2026-09-01', availableQuantity: 3 }
]

function availableLots(configurationId: string) {
  return sessionLots
    .filter(lot => lot.frozenConfigurationId === configurationId && lot.expiresOn >= saleDate && lot.availableQuantity > 0)
    .sort((first, second) => first.expiresOn.localeCompare(second.expiresOn)
      || first.manufacturedOn.localeCompare(second.manufacturedOn)
      || first.id.localeCompare(second.id))
}

export function getFrozenOrderConfigurations(): FrozenOrderConfiguration[] {
  return configurations
    .filter(configuration => configuration.active)
    .map(configuration => {
      const lots = availableLots(configuration.id)
      return {
        id: configuration.id,
        producibleItemId: configuration.producibleItemId,
        producibleName: configuration.producibleName,
        presentation: configuration.presentation,
        unitPrice: configuration.unitPrice,
        availableQuantity: lots.reduce((total, lot) => total + lot.availableQuantity, 0),
        nextExpiration: lots[0]?.expiresOn
      }
    })
}

export function getFrozenStockIssues(items: OrderItem[]) {
  const requested = new Map<string, number>()
  for (const item of items) {
    if (item.fulfillmentSource === 'frozen-stock' && item.frozenStock?.allocationStatus === 'pending')
      requested.set(item.frozenStock.configurationId, (requested.get(item.frozenStock.configurationId) ?? 0) + 1)
  }
  return [...requested.entries()].flatMap(([configurationId, quantity]) => {
    const configuration = getFrozenOrderConfigurations().find(current => current.id === configurationId)
    return !configuration || configuration.availableQuantity < quantity
      ? [`Estoque congelado insuficiente para ${configuration?.producibleName ?? 'a configuração selecionada'} · ${configuration?.presentation ?? configurationId}`]
      : []
  })
}

export function previewFrozenOrderAllocations(items: OrderItem[]) {
  let lots = structuredClone(sessionLots)
  return items.flatMap(item => {
    if (item.fulfillmentSource !== 'frozen-stock' || !item.frozenStock || item.frozenStock.allocationStatus !== 'pending')
      return []
    const result = allocateFrozenStockFefo(lots, item.frozenStock.configurationId, 1, saleDate)
    lots = result.lots
    return [{ itemId: item.id, name: item.frozenStock.producibleName, presentation: item.frozenStock.presentation, allocations: result.allocations }]
  })
}

export function allocateFrozenOrderItems(items: OrderItem[]) {
  let lots = structuredClone(sessionLots)
  const updated = structuredClone(items)
  for (const item of updated) {
    if (item.fulfillmentSource !== 'frozen-stock' || !item.frozenStock || item.frozenStock.allocationStatus !== 'pending')
      continue
    const result = allocateFrozenStockFefo(lots, item.frozenStock.configurationId, 1, saleDate)
    lots = result.lots
    item.frozenStock.allocations = result.allocations
    item.frozenStock.allocationStatus = 'allocated'
  }
  sessionLots = lots
  return updated
}

export function handleFrozenCancellation(items: OrderItem[], automaticReturn: boolean) {
  const updated = structuredClone(items)
  if (automaticReturn) {
    const allocations = updated.flatMap(item => item.frozenStock?.allocationStatus === 'allocated'
      ? item.frozenStock.allocations
      : [])
    sessionLots = returnFrozenStock(sessionLots, allocations)
  }
  for (const item of updated) {
    if (!item.frozenStock || item.frozenStock.allocationStatus !== 'allocated') continue
    item.frozenStock.allocationStatus = automaticReturn ? 'returned' : 'manual-review'
  }
  return updated
}

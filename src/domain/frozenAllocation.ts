export interface AllocatableFrozenLot {
  id: string
  frozenConfigurationId: string
  manufacturedOn: string
  expiresOn: string
  availableQuantity: number
}

export interface FrozenLotAllocation {
  lotId: string
  manufacturedOn: string
  expiresOn: string
  quantity: number
}

export function allocateFrozenStockFefo<T extends AllocatableFrozenLot>(
  sourceLots: T[],
  configurationId: string,
  quantity: number,
  saleDate: string
) {
  if (!Number.isInteger(quantity) || quantity < 1)
    throw new Error('A quantidade congelada deve ser inteira e maior que zero.')

  const lots = structuredClone(sourceLots)
  const eligible = lots
    .filter(lot => lot.frozenConfigurationId === configurationId
      && lot.availableQuantity > 0
      && lot.expiresOn >= saleDate)
    .sort((first, second) => first.expiresOn.localeCompare(second.expiresOn)
      || first.manufacturedOn.localeCompare(second.manufacturedOn)
      || first.id.localeCompare(second.id))

  const available = eligible.reduce((total, lot) => total + lot.availableQuantity, 0)
  if (available < quantity)
    throw new Error(`Saldo congelado insuficiente. Disponível: ${available}.`)

  const allocations: FrozenLotAllocation[] = []
  let remaining = quantity
  for (const lot of eligible) {
    if (!remaining) break
    const allocated = Math.min(lot.availableQuantity, remaining)
    lot.availableQuantity -= allocated
    remaining -= allocated
    allocations.push({
      lotId: lot.id,
      manufacturedOn: lot.manufacturedOn,
      expiresOn: lot.expiresOn,
      quantity: allocated
    })
  }

  return { lots, allocations }
}

export function returnFrozenStock<T extends AllocatableFrozenLot>(
  sourceLots: T[],
  allocations: FrozenLotAllocation[]
) {
  const lots = structuredClone(sourceLots)
  for (const allocation of allocations) {
    const lot = lots.find(current => current.id === allocation.lotId)
    if (lot) lot.availableQuantity += allocation.quantity
  }
  return lots
}

export interface CapacityItem {
  fulfillmentSource?: 'daily-production' | 'frozen-stock'
}

export interface CapacitySnapshot {
  limit: number
  used: number
  requested: number
  remaining: number
  projectedUsed: number
  projectedRemaining: number
  exceeded: boolean
}

export function dailyProductionDemand(items: CapacityItem[]) {
  return items.filter(item => item.fulfillmentSource !== 'frozen-stock').length
}

export function capacitySnapshot(limit: number, used: number, requested = 0): CapacitySnapshot {
  const safeLimit = Math.max(0, Math.trunc(limit))
  const safeUsed = Math.max(0, Math.trunc(used))
  const safeRequested = Math.max(0, Math.trunc(requested))
  const projectedUsed = safeUsed + safeRequested

  return {
    limit: safeLimit,
    used: safeUsed,
    requested: safeRequested,
    remaining: Math.max(0, safeLimit - safeUsed),
    projectedUsed,
    projectedRemaining: Math.max(0, safeLimit - projectedUsed),
    exceeded: projectedUsed > safeLimit
  }
}

export function cancellationReleasesCapacity(status: string) {
  return status === 'confirmed'
}

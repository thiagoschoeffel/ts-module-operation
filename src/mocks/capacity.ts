import type { OrderItem } from '../components/new-order/types'
import { capacitySnapshot, dailyProductionDemand } from '../domain/capacity'

const storageKey = 'ts-operation-capacity-v1'
const defaultLimit = 90
const defaultUsed = 71

interface CapacityState {
  used: number
  reservations: Record<string, number>
  releasedOrderIds: string[]
}

function initialState(): CapacityState {
  return { used: defaultUsed, reservations: {}, releasedOrderIds: [] }
}

function readState() {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return initialState()
    const parsed = JSON.parse(raw) as Partial<CapacityState>
    return {
      used: Number.isFinite(parsed.used) ? Math.max(0, Math.trunc(parsed.used!)) : defaultUsed,
      reservations: parsed.reservations && typeof parsed.reservations === 'object' ? parsed.reservations : {},
      releasedOrderIds: Array.isArray(parsed.releasedOrderIds) ? parsed.releasedOrderIds : []
    }
  }
  catch {
    return initialState()
  }
}

function writeState(state: CapacityState) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state))
  }
  catch {
    // O fluxo demonstrativo continua funcional na página atual.
  }
}

export function getCapacitySnapshot(items: OrderItem[] = [], scenario?: string) {
  const state = readState()
  const used = scenario === 'capacidade-esgotada' ? defaultLimit : state.used
  return capacitySnapshot(defaultLimit, used, dailyProductionDemand(items))
}

export function reserveCapacityForOrder(orderId: string | number, items: OrderItem[], simulateConflict = false) {
  const state = readState()
  const key = String(orderId)
  if (state.reservations[key] !== undefined)
    return capacitySnapshot(defaultLimit, state.used, 0)

  const requested = dailyProductionDemand(items)
  const currentUsed = simulateConflict ? defaultLimit : state.used
  const snapshot = capacitySnapshot(defaultLimit, currentUsed, requested)
  if (snapshot.exceeded)
    throw new Error(`A capacidade mudou durante a confirmação. Restam ${snapshot.remaining} refeições e este pedido precisa de ${requested}. Revise o pedido e tente novamente.`)

  state.used += requested
  state.reservations[key] = requested
  state.releasedOrderIds = state.releasedOrderIds.filter(id => id !== key)
  writeState(state)
  return capacitySnapshot(defaultLimit, state.used, 0)
}

export function releaseCapacityForOrder(orderId: string | number, items: OrderItem[]) {
  const state = readState()
  const key = String(orderId)
  if (state.releasedOrderIds.includes(key))
    return capacitySnapshot(defaultLimit, state.used, 0)

  const reserved = state.reservations[key] ?? dailyProductionDemand(items)
  state.used = Math.max(0, state.used - reserved)
  delete state.reservations[key]
  state.releasedOrderIds.push(key)
  writeState(state)
  return capacitySnapshot(defaultLimit, state.used, 0)
}

export function rollbackCapacityReservation(orderId: string | number) {
  const state = readState()
  const key = String(orderId)
  const reserved = state.reservations[key]
  if (reserved === undefined) return
  state.used = Math.max(0, state.used - reserved)
  delete state.reservations[key]
  writeState(state)
}

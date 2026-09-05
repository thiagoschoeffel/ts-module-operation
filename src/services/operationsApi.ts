import type { AuthenticatedApiRequest } from './ordersApi'
import type { PackingLabelBundle, PackingLabelPrintSelection } from '../types/packingLabels'

export interface ApiProductionSnapshot {
  orderCount: number
  mealCount: number
  inProductionCount: number
  customizationCount: number
  needs: Array<{
    id: string
    name: string
    unit: string
    quantity: number
    orderCount: number
    windows: Array<{ window: string, quantity: number }>
    customizations: Array<{ label: string, quantity: number }>
  }>
  updatedAt: string
}

export interface ApiPackingItem {
  id: string
  name: string
  presentation?: string
  quantity: number
  isFrozen: boolean
  detailLines: string[]
  attentionLines: string[]
}

export interface ApiPackingOrder {
  id: string
  version: number
  customerName: string
  customerPhone?: string
  deliveryWindow?: string
  items: ApiPackingItem[]
  packedAt?: string
  packedBy?: string
  labels?: PackingLabelBundle
  printAttempts: Array<{
    id: string
    attemptedAt: string
    responsibleName: string
    selection: PackingLabelPrintSelection
    status: 'Succeeded' | 'Failed'
    errorMessage?: string
  }>
}

export interface ApiPackingQueue {
  awaiting: ApiPackingOrder[]
  packed: ApiPackingOrder[]
  awaitingItemCount: number
  packedItemCount: number
  attentionCount: number
}

async function apiError(response: Response) {
  try {
    const body = await response.json() as { detail?: string, title?: string }
    return new Error(body.detail ?? body.title ?? 'Não foi possível concluir a operação.')
  }
  catch {
    return new Error('Não foi possível concluir a operação.')
  }
}

async function json<T>(request: AuthenticatedApiRequest, path: string, init?: RequestInit): Promise<T> {
  const response = await request(path, init)
  if (!response.ok) throw await apiError(response)
  return response.json() as Promise<T>
}

function operationalDate() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export function getProductionSnapshot(request: AuthenticatedApiRequest, date = operationalDate()) {
  return json<ApiProductionSnapshot>(request, `/api/operations/production?operationalDate=${encodeURIComponent(date)}`)
}

export function getPackingQueue(request: AuthenticatedApiRequest, date = operationalDate()) {
  return json<ApiPackingQueue>(request, `/api/operations/packing?operationalDate=${encodeURIComponent(date)}`)
}

export function packOrder(request: AuthenticatedApiRequest, order: ApiPackingOrder, idempotencyKey: string = crypto.randomUUID()) {
  return json<ApiPackingOrder>(request, `/api/operations/packing/${encodeURIComponent(order.id)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ expectedVersion: order.version })
  })
}

export function recordLabelPrint(
  request: AuthenticatedApiRequest,
  orderId: string,
  selection: PackingLabelPrintSelection,
  status: 'Succeeded' | 'Failed',
  errorMessage?: string,
  idempotencyKey: string = crypto.randomUUID()
) {
  return json(request, `/api/operations/packing/${encodeURIComponent(orderId)}/print-attempts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ ...selection, status, errorMessage })
  })
}

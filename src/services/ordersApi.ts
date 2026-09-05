export type AuthenticatedApiRequest = (path: string, init?: RequestInit) => Promise<Response>

export type ApiOrderStatus = 'Open' | 'Confirmed' | 'InProduction' | 'InPacking' | 'InDelivery' | 'Completed' | 'Cancelled' | 'DeliveryFailed'
export type ApiFulfillmentMode = 'DailyProduction' | 'FrozenStock'

export interface ApiOrderItem {
  id: string
  offerId: string
  offerName: string
  fulfillmentMode: ApiFulfillmentMode
  quantity: number
  unitPrice: number
  total: number
  frozenConfigurationId?: string
  producibleItemId?: string
  producibleItemName?: string
  frozenPresentation?: string
}

export interface ApiOrderSummary {
  id: string
  customerId: string
  customerName?: string
  operationalDate: string
  status: ApiOrderStatus
  version: number
  itemCount: number
  dailyCapacityUnits: number
  totalAmount: number
}

export interface ApiOrderDetails extends Omit<ApiOrderSummary, 'itemCount'> {
  items: ApiOrderItem[]
  confirmation?: {
    confirmedAt: string
    subtotal: number
    planCreditCoveredAmount: number
    discountAmount: number
    discountReason?: string
    deliveryFee: number
    financialCreditApplied: number
    amountDue: number
    frozenAllocations: Array<{ orderItemId: string, frozenConfigurationId: string, frozenLotId: string, quantity: number }>
    components: Array<{ orderItemId: string, name: string, totalQuantity: number, measurementUnit: string, dietaryMarkers: string[] }>
    planCredits: Array<{ orderItemId: string, planName: string, quantity: number, coveredAmount: number }>
  }
  lifecycle: Array<{
    id: string
    type: 'StatusTransition' | 'Rescheduled' | 'Cancelled'
    previousStatus: ApiOrderStatus
    newStatus: ApiOrderStatus
    previousOperationalDate: string
    newOperationalDate: string
    reason: string
    occurredAt: string
    capacityUnitsReleased: number
    planCreditsReversed: number
    financialCreditReversed: number
    chargesCancelled: number
  }>
}

export interface ApiDailyCapacity {
  operationalDate: string
  totalUnits: number
  reservedUnits: number
  availableUnits: number
  version: number
}

export interface ApiOrderAuthoringContext {
  offers: Array<{ id: string, name: string, fulfillmentMode: ApiFulfillmentMode, effectivePrice?: number, requiresMenuChoice: boolean }>
  producibles: Array<{ id: string, name: string }>
  menuOptions: Array<{ id: string, category: string, producibleItemId: string, producibleItemName: string, availability: 'Available' | 'SoldOut' | 'Suspended' }>
  frozenConfigurations: Array<{
    id: string
    offerId: string
    producibleItemId: string
    producibleItemName: string
    presentation: string
    unitPrice: number
    availableQuantity: number
    nextExpiration?: string
  }>
}

export interface OrderItemInput {
  offerId: string
  quantity: number
  unitPrice?: number
  frozenConfigurationId?: string
  producibleItemId?: string
}

export class ApiConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiConflictError'
  }
}

async function apiError(response: Response) {
  let message = 'Não foi possível concluir a operação.'
  try {
    const problem = await response.json() as { detail?: string, title?: string, errors?: Record<string, string[]> }
    message = problem.detail ?? Object.values(problem.errors ?? {})[0]?.[0] ?? problem.title ?? message
  }
  catch { /* resposta sem Problem Details */ }
  return response.status === 409 ? new ApiConflictError(message) : new Error(message)
}

async function json<T>(request: AuthenticatedApiRequest, path: string, init?: RequestInit): Promise<T> {
  const response = await request(path, init)
  if (!response.ok) throw await apiError(response)
  return response.json() as Promise<T>
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export function listOrders(request: AuthenticatedApiRequest) {
  return json<ApiOrderSummary[]>(request, '/api/orders')
}

export function getOrder(request: AuthenticatedApiRequest, orderId: string) {
  return json<ApiOrderDetails>(request, `/api/orders/${encodeURIComponent(orderId)}`)
}

export function getOrderAuthoringContext(request: AuthenticatedApiRequest, operationalDate: string) {
  return json<ApiOrderAuthoringContext>(request, `/api/orders/authoring-context?operationalDate=${encodeURIComponent(operationalDate)}`)
}

export async function getDailyCapacity(request: AuthenticatedApiRequest, operationalDate: string) {
  const response = await request(`/api/daily-capacities/${encodeURIComponent(operationalDate)}`)
  if (response.status === 404) return undefined
  if (!response.ok) throw await apiError(response)
  return response.json() as Promise<ApiDailyCapacity>
}

export function saveOrder(request: AuthenticatedApiRequest, input: {
  id?: string
  customerId: string
  customerName?: string
  operationalDate: string
  expectedVersion?: number
  items: OrderItemInput[]
  idempotencyKey?: string
}) {
  const path = input.id ? `/api/orders/${encodeURIComponent(input.id)}` : '/api/orders'
  return json<{ id: string, status: ApiOrderStatus, version: number }>(request, path, {
    method: input.id ? 'PUT' : 'POST',
    headers: { ...jsonHeaders, 'Idempotency-Key': input.idempotencyKey ?? crypto.randomUUID() },
    body: JSON.stringify({
      customerId: input.customerId,
      customerName: input.customerName,
      operationalDate: input.operationalDate,
      items: input.items,
      ...(input.id ? { expectedVersion: input.expectedVersion } : {})
    })
  })
}

export function confirmOrder(request: AuthenticatedApiRequest, order: ApiOrderDetails, idempotencyKey?: string) {
  return json(request, `/api/orders/${encodeURIComponent(order.id)}/confirmation`, {
    method: 'POST',
    headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey ?? crypto.randomUUID() },
    body: JSON.stringify({ expectedVersion: order.version })
  })
}

export function rescheduleOrder(request: AuthenticatedApiRequest, order: ApiOrderDetails, newOperationalDate: string, reason: string, idempotencyKey?: string) {
  return json(request, `/api/orders/${encodeURIComponent(order.id)}/rescheduling`, {
    method: 'POST',
    headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey ?? crypto.randomUUID() },
    body: JSON.stringify({ expectedVersion: order.version, newOperationalDate, reason })
  })
}

export function cancelOrder(request: AuthenticatedApiRequest, order: ApiOrderDetails, reason: string, idempotencyKey?: string) {
  const hasFrozenAllocation = Boolean(order.confirmation?.frozenAllocations.length)
  const beforeProduction = order.status === 'Confirmed'
  return json(request, `/api/orders/${encodeURIComponent(order.id)}/cancellation`, {
    method: 'POST',
    headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey ?? crypto.randomUUID() },
    body: JSON.stringify({
      expectedVersion: order.version,
      reason,
      commercialDisposition: order.status === 'Open' ? 'NotApplicable' : beforeProduction ? 'Reverse' : 'Preserve',
      frozenDisposition: !hasFrozenAllocation ? 'NotApplicable' : beforeProduction ? 'ReturnToStock' : 'Quarantine'
    })
  })
}

export const orderStatusPresentation: Record<ApiOrderStatus, { label: string, group: 'aberto' | 'andamento' | 'concluido' | 'problema', variant: 'neutral' | 'info' | 'success' | 'danger' }> = {
  Open: { label: 'Aberto', group: 'aberto', variant: 'neutral' },
  Confirmed: { label: 'Confirmado', group: 'andamento', variant: 'info' },
  InProduction: { label: 'Em produção', group: 'andamento', variant: 'info' },
  InPacking: { label: 'Em embalagem', group: 'andamento', variant: 'info' },
  InDelivery: { label: 'Em entrega', group: 'andamento', variant: 'info' },
  Completed: { label: 'Concluído', group: 'concluido', variant: 'success' },
  Cancelled: { label: 'Cancelado', group: 'concluido', variant: 'neutral' },
  DeliveryFailed: { label: 'Falha na entrega', group: 'problema', variant: 'danger' }
}

export function shortOrderId(id: string) {
  return id.slice(0, 8).toUpperCase()
}

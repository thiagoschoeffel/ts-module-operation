import type { AuthenticatedApiRequest } from './ordersApi'

export type DeliveryRouteStatus = 'Planned' | 'InProgress' | 'Completed' | 'Cancelled'
export type DeliveryAttemptResult = 'Succeeded' | 'Failed'
export interface DeliveryDriver { id: string, identification: string, name: string, phone?: string, isActive: boolean, isAvailable: boolean, version: number }
export interface DeliveryOrder { id: string, version: number, status: string, date: string, deliveryWindow: string, customerName: string, customerPhone?: string, address: string, preferredDriverId?: string }
export interface DeliveryStop { id: string, orderId: string, position: number, customerName: string, customerPhone?: string, address: string, result?: DeliveryAttemptResult }
export interface DeliveryAttempt { id: string, orderId: string, driverId: string, driverName: string, result: DeliveryAttemptResult, failureReason?: string, note?: string, receivedBy?: string, occurredAt: string }
export interface DeliveryRoute { id: string, date: string, deliveryWindow: string, driverId: string, driverName: string, status: DeliveryRouteStatus, version: number, createdAt: string, startedAt?: string, completedAt?: string, cancelledAt?: string, stops: DeliveryStop[], attempts: DeliveryAttempt[] }
export interface LogisticsSnapshot { drivers: DeliveryDriver[], availableOrders: DeliveryOrder[], routes: DeliveryRoute[], reschedules: Array<{ id: string, orderId: string, previousDate: string, previousWindow: string, newDate: string, newWindow: string, reason: string, occurredAt: string }> }

async function json<T>(request: AuthenticatedApiRequest, path: string, init?: RequestInit): Promise<T> {
  const response = await request(path, init)
  if (!response.ok) { try { const body = await response.json() as { detail?: string, title?: string }; throw new Error(body.detail ?? body.title ?? 'Não foi possível concluir a operação.') } catch (error) { if (error instanceof Error) throw error; throw new Error('Não foi possível concluir a operação.') } }
  return response.json() as Promise<T>
}
const headers = { 'Content-Type': 'application/json' }
export const getLogistics = (request: AuthenticatedApiRequest) => json<LogisticsSnapshot>(request, '/api/logistics')
export const createRoute = (request: AuthenticatedApiRequest, input: { date: string, deliveryWindow: string, driverId: string, orderIds: string[] }) => json<DeliveryRoute>(request, '/api/delivery-routes', { method: 'POST', headers, body: JSON.stringify(input) })
export const updateRoute = (request: AuthenticatedApiRequest, route: DeliveryRoute, driverId: string, orderIds: string[]) => json<DeliveryRoute>(request, `/api/delivery-routes/${route.id}`, { method: 'PUT', headers, body: JSON.stringify({ date: route.date, deliveryWindow: route.deliveryWindow, driverId, orderIds, expectedVersion: route.version }) })
export const startRoute = (request: AuthenticatedApiRequest, route: DeliveryRoute) => json<DeliveryRoute>(request, `/api/delivery-routes/${route.id}/start`, { method: 'POST', headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ expectedVersion: route.version }) })
export const cancelRoute = (request: AuthenticatedApiRequest, route: DeliveryRoute) => json<DeliveryRoute>(request, `/api/delivery-routes/${route.id}/cancellation`, { method: 'POST', headers, body: JSON.stringify({ expectedVersion: route.version }) })
export const recordAttempt = (request: AuthenticatedApiRequest, route: DeliveryRoute, stop: DeliveryStop, result: DeliveryAttemptResult, failureReason?: string, note?: string, receivedBy?: string) => json<DeliveryAttempt>(request, `/api/delivery-routes/${route.id}/stops/${stop.id}/attempts`, { method: 'POST', headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ result, failureReason, note, receivedBy }) })
export const rescheduleDelivery = (request: AuthenticatedApiRequest, orderId: string, newDate: string, newWindow: string, reason: string) => json(request, `/api/orders/${orderId}/delivery-rescheduling`, { method: 'POST', headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ newDate, newWindow, reason }) })
export function shortLogisticsId(value: string) { return value.slice(0, 8).toUpperCase() }

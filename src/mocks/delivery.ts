import {
  assignOrderToDeliveryRoute,
  getAllOrderDetails,
  getOrderDetail,
  recordOrderDelivery,
  startOrderDelivery,
  updatePlannedOrderRoute,
  type DeliveryAttempt,
  type OrderDetail
} from './orderDetail'

export type DeliveryRouteStatus = 'planned' | 'in-progress' | 'completed'

export interface DeliveryDriverOption {
  id: string
  name: string
  phone?: string
  active: boolean
}

export interface DeliveryRoute {
  id: number
  driverId?: string
  driverName: string
  status: DeliveryRouteStatus
  orderIds: number[]
  createdAt: string
  startedAt?: string
  completedAt?: string
}

export interface DeliverySnapshot {
  available: OrderDetail[]
  routes: DeliveryRoute[]
  ordersById: Map<number, OrderDetail>
  deliveredCount: number
  failedCount: number
}

const routeStorageKey = 'ts-operation-delivery-routes-v1'
const driverStorageKey = 'ts-management-delivery-drivers-v1'
const fallbackDrivers: DeliveryDriverOption[] = [
  { id: 'ent-1001', name: 'Carlos Souza', phone: '(11) 99876-4321', active: true },
  { id: 'ent-1002', name: 'Mariana Lima', phone: '(11) 98765-1204', active: true },
  { id: 'ent-1003', name: 'Rafael Santos', active: true },
  { id: 'ent-1004', name: 'Beatriz Oliveira', phone: '(11) 97654-8090', active: false }
]

const mockRouteMetadata: Record<number, Pick<DeliveryRoute, 'driverId' | 'createdAt' | 'startedAt' | 'completedAt'>> = {
  10: { driverId: 'ent-1003', createdAt: 'Hoje 09:58', startedAt: 'Hoje 10:20', completedAt: 'Hoje 10:46' },
  11: { driverId: 'ent-1002', createdAt: 'Hoje 10:02', startedAt: 'Hoje 10:31', completedAt: 'Hoje 10:54' },
  12: { driverId: 'ent-1001', createdAt: 'Hoje 10:25', startedAt: 'Hoje 10:40', completedAt: undefined },
  21: { driverId: 'ent-1003', createdAt: 'Hoje 11:05', startedAt: undefined, completedAt: undefined },
  22: { driverId: 'ent-1002', createdAt: 'Hoje 11:22', startedAt: undefined, completedAt: undefined },
  23: { driverId: 'ent-1001', createdAt: 'Hoje 11:52', startedAt: 'Hoje 12:08', completedAt: undefined },
  24: { driverId: 'ent-1002', createdAt: 'Hoje 10:42', startedAt: 'Hoje 10:58', completedAt: 'Hoje 11:47' },
  25: { driverId: 'ent-1003', createdAt: 'Hoje 11:36', startedAt: 'Hoje 12:00', completedAt: 'Hoje 12:42' },
  26: { driverId: 'ent-1001', createdAt: 'Hoje 12:20', startedAt: 'Hoje 12:41', completedAt: undefined }
}

function readStoredRoutes(): DeliveryRoute[] {
  try {
    const stored = window.localStorage.getItem(routeStorageKey)
    return stored ? JSON.parse(stored) as DeliveryRoute[] : []
  }
  catch {
    return []
  }
}

function writeStoredRoutes(routes: DeliveryRoute[]) {
  try {
    window.localStorage.setItem(routeStorageKey, JSON.stringify(routes))
  }
  catch {
    // A demonstração continua funcional enquanto esta página permanecer aberta.
  }
}

function derivedRoutes(orders: OrderDetail[]) {
  const groups = new Map<number, OrderDetail[]>()
  for (const order of orders) {
    if (!order.route)
      continue
    groups.set(order.route.id, [...(groups.get(order.route.id) ?? []), order])
  }

  return [...groups.entries()].map(([id, routeOrders]): DeliveryRoute => {
    const orderedRouteOrders = [...routeOrders].sort((first, second) => (first.route?.stop ?? 0) - (second.route?.stop ?? 0))
    const metadata = mockRouteMetadata[id]
    const pending = routeOrders.some(order => order.status === 'delivery' || order.route?.status === 'in-progress')
    const planned = routeOrders.every(order => order.route?.status === 'planned')
    return {
      id,
      driverId: metadata?.driverId,
      driverName: orderedRouteOrders[0]?.route?.driver ?? 'Entregador não informado',
      status: planned ? 'planned' : pending ? 'in-progress' : 'completed',
      orderIds: orderedRouteOrders.map(order => order.id),
      createdAt: metadata?.createdAt ?? 'Hoje 10:25',
      startedAt: planned ? undefined : metadata?.startedAt ?? 'Hoje 10:40',
      completedAt: !planned && !pending ? metadata?.completedAt ?? 'Hoje 12:15' : undefined
    }
  })
}

function allRoutes(orders: OrderDetail[]) {
  const routes = new Map(derivedRoutes(orders).map(route => [route.id, route]))
  for (const route of readStoredRoutes())
    routes.set(route.id, route)
  return [...routes.values()].sort((first, second) => second.id - first.id)
}

function saveRoute(route: DeliveryRoute) {
  const routes = readStoredRoutes().filter(current => current.id !== route.id)
  writeStoredRoutes([structuredClone(route), ...routes])
}

function removeRoute(routeId: number) {
  writeStoredRoutes(readStoredRoutes().filter(route => route.id !== routeId))
}

export function getDeliveryDrivers(): DeliveryDriverOption[] {
  try {
    const storedValue = window.localStorage.getItem(driverStorageKey)
    const stored = storedValue ? JSON.parse(storedValue) as DeliveryDriverOption[] : []
    const storedIds = new Set(stored.map(driver => driver.id))
    return structuredClone([...stored, ...fallbackDrivers.filter(driver => !storedIds.has(driver.id))])
  }
  catch {
    return structuredClone(fallbackDrivers)
  }
}

export function getDeliverySnapshot(): DeliverySnapshot {
  const orders = getAllOrderDetails()
  const routes = allRoutes(orders)
  return {
    available: orders
      .filter(order => order.status === 'packing' && Boolean(order.packedAt) && !order.route)
      .sort((first, second) => (first.deliveryWindow ?? '').localeCompare(second.deliveryWindow ?? '') || first.id - second.id),
    routes,
    ordersById: new Map(orders.map(order => [order.id, order])),
    deliveredCount: orders.filter(order => order.status === 'completed' && Boolean(order.deliveryAttempts?.length)).length,
    failedCount: orders.filter(order => order.status === 'failed').length
  }
}

export function createDeliveryRoute(driver: DeliveryDriverOption, orderIds: number[]) {
  const snapshot = getDeliverySnapshot()
  const orders = orderIds
    .map(id => snapshot.ordersById.get(id))
    .filter((order): order is OrderDetail => Boolean(order && snapshot.available.some(available => available.id === order.id)))
  if (!orders.length)
    return undefined

  const routeId = Math.max(0, ...snapshot.routes.map(route => route.id)) + 1
  const route: DeliveryRoute = {
    id: routeId,
    driverId: driver.id,
    driverName: driver.name,
    status: 'planned',
    orderIds: orders.map(order => order.id),
    createdAt: 'Hoje 12:40'
  }
  orders.forEach((order, index) => assignOrderToDeliveryRoute(order, {
    id: route.id,
    driver: route.driverName,
    stop: index + 1,
    stopCount: orders.length,
    status: 'planned'
  }))
  saveRoute(route)
  return route
}

export function updateDeliveryRoute(routeId: number, driver: DeliveryDriverOption, orderIds: number[]) {
  const snapshot = getDeliverySnapshot()
  const route = snapshot.routes.find(current => current.id === routeId)
  if (!route || route.status !== 'planned' || !orderIds.length)
    return undefined

  const currentOrders = route.orderIds
    .map(id => snapshot.ordersById.get(id))
    .filter((order): order is OrderDetail => Boolean(order))
  const deliveryWindow = currentOrders[0]?.deliveryWindow
  const eligibleOrders = getAllOrderDetails().filter(order => order.status === 'packing'
    && Boolean(order.packedAt)
    && order.deliveryWindow === deliveryWindow
    && (!order.route || order.route.id === routeId))
  const eligibleById = new Map(eligibleOrders.map(order => [order.id, order]))
  const selectedOrders = orderIds.map(id => eligibleById.get(id)).filter((order): order is OrderDetail => Boolean(order))
  if (!selectedOrders.length)
    return undefined

  const selectedIds = new Set(selectedOrders.map(order => order.id))
  currentOrders.filter(order => !selectedIds.has(order.id)).forEach(order => updatePlannedOrderRoute(order))
  selectedOrders.forEach((order, index) => updatePlannedOrderRoute(order, {
    id: route.id,
    driver: driver.name,
    stop: index + 1,
    stopCount: selectedOrders.length,
    status: 'planned'
  }))

  const updated: DeliveryRoute = {
    ...route,
    driverId: driver.id,
    driverName: driver.name,
    orderIds: selectedOrders.map(order => order.id)
  }
  saveRoute(updated)
  return updated
}

export function deleteDeliveryRoute(routeId: number) {
  const snapshot = getDeliverySnapshot()
  const route = snapshot.routes.find(current => current.id === routeId)
  if (!route || route.status !== 'planned')
    return false
  route.orderIds.forEach((id) => {
    const order = snapshot.ordersById.get(id)
    if (order)
      updatePlannedOrderRoute(order)
  })
  removeRoute(routeId)
  return true
}

export function startDeliveryRoute(routeId: number) {
  const snapshot = getDeliverySnapshot()
  const route = snapshot.routes.find(current => current.id === routeId)
  if (!route || route.status !== 'planned')
    return
  route.orderIds.forEach((id) => {
    const order = getOrderDetail(id)
    if (order)
      startOrderDelivery(order)
  })
  saveRoute({ ...route, status: 'in-progress', startedAt: 'Hoje 12:45' })
}

export function finishDeliveryStop(
  routeId: number,
  orderId: number,
  result: DeliveryAttempt['result'],
  reason?: string,
  note?: string
) {
  const snapshot = getDeliverySnapshot()
  const route = snapshot.routes.find(current => current.id === routeId)
  const order = getOrderDetail(orderId)
  if (!route || route.status !== 'in-progress' || !order || order.route?.id !== routeId)
    return

  recordOrderDelivery(order, result, reason, note)
  const refreshedOrders = route.orderIds.map(id => getOrderDetail(id)).filter((item): item is OrderDetail => Boolean(item))
  const isComplete = refreshedOrders.every(item => item.status === 'completed' || item.status === 'failed')
  saveRoute({
    ...route,
    status: isComplete ? 'completed' : 'in-progress',
    completedAt: isComplete ? 'Hoje 13:18' : undefined
  })
}

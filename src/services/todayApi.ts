import { getLogistics, type LogisticsSnapshot } from './logisticsApi.ts'
import { getPackingQueue, getProductionSnapshot, type ApiPackingQueue, type ApiProductionSnapshot } from './operationsApi.ts'
import { getDailyCapacity, listOrders, type ApiDailyCapacity, type ApiOrderSummary, type AuthenticatedApiRequest } from './ordersApi.ts'

export type ApiMenuAvailability = 'Available' | 'SoldOut' | 'Suspended'

export interface ApiDailyMenu {
  date: string
  status: 'Draft' | 'Published'
  publishedAt?: string
  updatedAt: string
  version: number
  options: Array<{
    id: string
    category: string
    producibleItemId: string
    producibleName: string
    availability: ApiMenuAvailability
  }>
}

export interface TodaySnapshot {
  operationalDate: string
  orders: ApiOrderSummary[]
  capacity?: ApiDailyCapacity
  production?: ApiProductionSnapshot
  packing?: ApiPackingQueue
  logistics?: LogisticsSnapshot
  menu?: ApiDailyMenu
  synchronization: {
    failedSources: string[]
    completedAt: string
  }
}

export function localDateIso(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function getDailyMenu(request: AuthenticatedApiRequest, date: string) {
  const response = await request(`/api/menus/${encodeURIComponent(date)}`)
  if (response.status === 404) return undefined
  if (!response.ok) throw new Error('Não foi possível carregar o cardápio do dia.')
  return response.json() as Promise<ApiDailyMenu>
}

function valueOrUndefined<T>(result: PromiseSettledResult<T>) {
  return result.status === 'fulfilled' ? result.value : undefined
}

export async function loadTodaySnapshot(request: AuthenticatedApiRequest, operationalDate = localDateIso()): Promise<TodaySnapshot> {
  const [orders, capacity, production, packing, logistics, menu] = await Promise.allSettled([
    listOrders(request, { from: operationalDate, to: operationalDate, pageSize: 100 }),
    getDailyCapacity(request, operationalDate),
    getProductionSnapshot(request, operationalDate),
    getPackingQueue(request, operationalDate),
    getLogistics(request),
    getDailyMenu(request, operationalDate)
  ] as const)

  return {
    operationalDate,
    orders: valueOrUndefined(orders)?.items ?? [],
    capacity: valueOrUndefined(capacity),
    production: valueOrUndefined(production),
    packing: valueOrUndefined(packing),
    logistics: valueOrUndefined(logistics),
    menu: valueOrUndefined(menu),
    synchronization: {
      failedSources: [orders, capacity, production, packing, logistics, menu]
        .map((result, index) => result.status === 'rejected'
          ? ['pedidos', 'capacidade', 'produção', 'embalagem', 'entregas', 'cardápio'][index]
          : undefined)
        .filter((source): source is string => Boolean(source)),
      completedAt: new Date().toISOString()
    }
  }
}

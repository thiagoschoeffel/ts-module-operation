import { getAllOrderDetails, type OrderDetail } from './orderDetail'

export interface ProductionWindowNeed {
  window: string
  quantity: number
}

export interface ProductionCustomization {
  label: string
  quantity: number
}

export interface ProductionNeed {
  id: string
  name: string
  unit: string
  quantity: number
  orderCount: number
  windows: ProductionWindowNeed[]
  customizations: ProductionCustomization[]
}

export interface ProductionSnapshot {
  orderCount: number
  mealCount: number
  inProductionCount: number
  customizationCount: number
  needs: ProductionNeed[]
  updatedAt: Date
}

const productionStatuses = new Set<OrderDetail['status']>(['confirmed', 'in-production'])

function normalizedKey(value: string) {
  return value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function getProductionSnapshot(): ProductionSnapshot {
  const orders = getAllOrderDetails().filter(order => productionStatuses.has(order.status))
  const needs = new Map<string, {
    name: string
    unit: string
    quantity: number
    orderIds: Set<number>
    windows: Map<string, number>
    customizations: Map<string, number>
  }>()

  for (const order of orders) {
    for (const item of order.items) {
      const components = item.effectiveComponents ?? []
      for (const [componentIndex, component] of components.entries()) {
        const key = component.id || normalizedKey(component.name)
        const current = needs.get(key) ?? {
          name: component.name,
          unit: component.unit,
          quantity: 0,
          orderIds: new Set<number>(),
          windows: new Map<string, number>(),
          customizations: new Map<string, number>()
        }
        const window = order.deliveryWindow ?? 'Sem janela'
        current.quantity += component.quantity
        current.orderIds.add(order.id)
        current.windows.set(window, (current.windows.get(window) ?? 0) + component.quantity)
        if (componentIndex === 0) {
          for (const customization of item.customizations)
            current.customizations.set(customization, (current.customizations.get(customization) ?? 0) + 1)
        }
        needs.set(key, current)
      }
    }
  }

  return {
    orderCount: orders.length,
    mealCount: orders.reduce((total, order) => total + order.items.length, 0),
    inProductionCount: orders.filter(order => order.status === 'in-production').length,
    customizationCount: orders.reduce(
      (total, order) => total + order.items.filter(item => item.customizations.length > 0).length,
      0
    ),
    needs: [...needs.entries()]
      .map(([id, need]) => ({
        id,
        name: need.name,
        unit: need.unit,
        quantity: need.quantity,
        orderCount: need.orderIds.size,
        windows: [...need.windows.entries()]
          .map(([window, quantity]) => ({ window, quantity }))
          .sort((first, second) => first.window.localeCompare(second.window)),
        customizations: [...need.customizations.entries()]
          .map(([label, quantity]) => ({ label, quantity }))
          .sort((first, second) => second.quantity - first.quantity)
      }))
      .sort((first, second) => second.quantity - first.quantity || first.name.localeCompare(second.name)),
    updatedAt: new Date()
  }
}

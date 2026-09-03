import { getAllOrderDetails, type OrderDetail } from './orderDetail'

export interface PackingSnapshot {
  awaiting: OrderDetail[]
  packed: OrderDetail[]
  awaitingItemCount: number
  packedItemCount: number
  restrictionCount: number
}

function byDeliveryWindow(first: OrderDetail, second: OrderDetail) {
  return (first.deliveryWindow ?? 'Sem janela').localeCompare(second.deliveryWindow ?? 'Sem janela')
    || first.id - second.id
}

export function getPackingSnapshot(): PackingSnapshot {
  const packingOrders = getAllOrderDetails()
    .filter(order => order.status === 'packing' && !order.route)
    .sort(byDeliveryWindow)
  const awaiting = packingOrders.filter(order => !order.packedAt)
  const packed = packingOrders.filter(order => Boolean(order.packedAt))

  return {
    awaiting,
    packed,
    awaitingItemCount: awaiting.reduce((total, order) => total + order.items.length, 0),
    packedItemCount: packed.reduce((total, order) => total + order.items.length, 0),
    restrictionCount: awaiting.filter(order => Boolean(order.customer.restriction)
      || order.items.some(item => item.customizations.length > 0 || item.hasRestrictionConflict)).length
  }
}

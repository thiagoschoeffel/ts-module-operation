import type { CustomerAddress, OrderItem } from '../components/new-order/types'
import type { PackingLabelBundle } from '../types/packingLabels'

export interface PackingLabelOrderSource {
  id: string | number
  customer: {
    name: string
    phone: string
    channel: 'WhatsApp' | 'Telefone' | 'Balcão'
    restriction?: string
  }
  deliveryAddress?: CustomerAddress
  items: OrderItem[]
}

function toPlainText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, ' · ')
    .replace(/<\/p>|<\/li>|<\/h[1-6]>|<\/blockquote>/gi, ' · ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s*·\s*·\s*/g, ' · ')
    .replace(/^\s*·\s*|\s*·\s*$/g, '')
    .trim()
}

function uniqueLines(lines: Array<string | undefined>) {
  return [...new Set(lines.map(line => line ? toPlainText(line) : '').filter(Boolean))]
}

function productName(item: OrderItem) {
  return item.fulfillmentSource === 'frozen-stock' && item.frozenStock
    ? `${item.frozenStock.producibleName} · ${item.frozenStock.presentation}`
    : item.name
}

function addressLines(address?: CustomerAddress) {
  if (!address) return []
  return [
    `${address.street}, ${address.number}${address.complement ? ` · ${address.complement}` : ''}`,
    `${address.neighborhood} · ${address.city}/${address.state} · CEP ${address.postalCode}`,
    address.referencePoint ? `Referência: ${address.referencePoint}` : undefined
  ].filter((line): line is string => Boolean(line))
}

export function createPackingLabelBundle(
  order: PackingLabelOrderSource,
  createdAt = new Date().toISOString()
): PackingLabelBundle {
  const orderId = String(order.id)
  const dailyItems = order.items.filter(item => item.fulfillmentSource === 'daily-production')
  const frozenItems = order.items.filter(item => item.fulfillmentSource === 'frozen-stock')

  return {
    createdAt,
    dailyItemLabels: dailyItems.map((item, index) => ({
      id: `pedido-${orderId}-item-${item.id}-${index + 1}`,
      orderItemId: item.id,
      orderId,
      customerName: order.customer.name,
      productName: item.name,
      detailLines: uniqueLines(item.details),
      attentionLines: uniqueLines([
        ...item.customizations,
        ...item.additions,
        item.hasRestrictionConflict ? order.customer.restriction ?? 'Conferir restrição alimentar' : undefined
      ])
    })),
    preLabeledFrozenItemIds: frozenItems.map(item => item.id),
    externalPackageLabel: {
      id: `pedido-${orderId}-pacote`,
      orderId,
      customerName: order.customer.name,
      phone: order.customer.channel === 'Balcão' ? undefined : order.customer.phone,
      addressLines: order.customer.channel === 'Balcão' ? [] : addressLines(order.deliveryAddress),
      itemSummary: order.items.map(productName)
    }
  }
}

export function fullPackingLabelSelection(bundle: PackingLabelBundle) {
  return {
    dailyItemLabelIds: bundle.dailyItemLabels.map(label => label.id),
    includeExternalPackageLabel: true
  }
}

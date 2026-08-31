import { customers, formatCurrency, offers } from '../components/new-order/mockData'
import type { CustomerAddress, OrderItem } from '../components/new-order/types'
import { mockOrders, type MockOrder, type OrderStatus } from './orders'

export type OrderDetailStatus =
  | 'open'
  | 'confirmed'
  | 'in-production'
  | 'packing'
  | 'delivery'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type OrderAllowedAction = 'edit' | 'confirm' | 'cancel' | 'mark-packed' | 'reschedule'

export interface CancellationPreview {
  stageLabel: string
  warning?: string
  effects: string[]
}

export interface CancellationRecord {
  reason: string
  detail?: string
  stageLabel: string
  actor: string
  occurredAt: string
  effects: string[]
}

export interface DeliveryAttempt {
  id: string
  occurredAt: string
  result: 'success' | 'failed'
  reason?: string
  note?: string
  driver: string
}

export interface DeliveryReschedule {
  previousWindow: string
  newWindow: string
  reason: string
  note?: string
  actor: string
  occurredAt: string
}

export interface OrderHistoryEntry {
  id: string
  time: string
  title: string
  actor: string
}

export interface OrderDetail {
  id: number
  status: OrderDetailStatus
  readyForReview: boolean
  createdAt: string
  confirmedAt?: string
  customer: {
    id: string
    name: string
    phone: string
    channel: 'WhatsApp' | 'Telefone' | 'Balcão'
    preference?: string
    restriction?: string
  }
  deliveryAddress?: CustomerAddress
  deliveryWindow?: string
  deliveryFee: number
  items: OrderItem[]
  note?: string
  planCreditCount: number
  planCreditValue: number
  financialCreditValue: number
  discountValue: number
  discountReason?: string
  pendingIssues: string[]
  allowedActions: OrderAllowedAction[]
  cancellationReasons: { value: string; label: string }[]
  cancellationPreview?: CancellationPreview
  cancellation?: CancellationRecord
  productionStartedAt?: string
  packedAt?: string
  packedBy?: string
  route?: {
    id: number
    driver: string
    stop: number
    stopCount: number
    status: 'planned' | 'in-progress' | 'completed'
  }
  completedAt?: string
  deliveryAttempts?: DeliveryAttempt[]
  reschedule?: DeliveryReschedule
  history: OrderHistoryEntry[]
}

const cancellationReasons = [
  { value: 'customer-withdrew', label: 'Cliente desistiu' },
  { value: 'duplicate', label: 'Pedido duplicado' },
  { value: 'order-error', label: 'Erro no pedido' },
  { value: 'operational-impossibility', label: 'Impossibilidade operacional' },
  { value: 'other', label: 'Outro' }
]

const statusLabel: Record<OrderDetailStatus, string> = {
  open: 'Aberto',
  confirmed: 'Confirmado',
  'in-production': 'Em produção',
  packing: 'Em embalagem',
  delivery: 'Em entrega',
  completed: 'Concluído',
  failed: 'Falha na entrega',
  cancelled: 'Cancelado'
}

function domainStateFor(status: OrderDetailStatus): Pick<OrderDetail, 'allowedActions' | 'cancellationReasons' | 'cancellationPreview'> {
  const effectsByStatus: Partial<Record<OrderDetailStatus, string[]>> = {
    open: [
      'O pedido será marcado como cancelado.',
      'Nenhum crédito foi consumido.',
      'Nenhuma capacidade definitiva foi reservada.'
    ],
    confirmed: [
      'A capacidade reservada será liberada.',
      'Os créditos de plano consumidos serão estornados.',
      'O crédito financeiro aplicável será devolvido.',
      'As cobranças pendentes serão canceladas.'
    ],
    'in-production': [
      'O pedido será cancelado operacionalmente.',
      'A capacidade não será liberada automaticamente.',
      'Créditos e valores serão tratados conforme as regras aplicáveis.'
    ],
    packing: [
      'O pedido será cancelado operacionalmente.',
      'A capacidade não será liberada automaticamente.',
      'Créditos e valores serão tratados conforme as regras aplicáveis.'
    ],
    failed: [
      'O pedido será cancelado operacionalmente.',
      'A tentativa de entrega permanecerá no histórico.',
      'Créditos e valores serão tratados conforme as regras aplicáveis.'
    ]
  }
  const actions: Record<OrderDetailStatus, OrderAllowedAction[]> = {
    open: ['edit', 'confirm', 'cancel'],
    confirmed: ['cancel'],
    'in-production': ['cancel'],
    packing: ['mark-packed', 'cancel'],
    delivery: [],
    completed: [],
    failed: ['reschedule', 'cancel'],
    cancelled: []
  }
  const effects = effectsByStatus[status]
  return {
    allowedActions: actions[status],
    cancellationReasons,
    cancellationPreview: effects ? {
      stageLabel: statusLabel[status],
      warning: ['in-production', 'packing'].includes(status)
        ? 'Este pedido já entrou em produção. O cancelamento operacional não garante estorno financeiro integral.'
        : undefined,
      effects
    } : undefined
  }
}

function replaceDomainState(order: OrderDetail, status: OrderDetailStatus) {
  const state = domainStateFor(status)
  order.status = status
  order.allowedActions = [...state.allowedActions]
  order.cancellationReasons = state.cancellationReasons.map(reason => ({ ...reason }))
  order.cancellationPreview = state.cancellationPreview
    ? { ...state.cancellationPreview, effects: [...state.cancellationPreview.effects] }
    : undefined
}

export function getOrderDomainState(status: OrderDetailStatus) {
  return structuredClone(domainStateFor(status))
}

const storageKey = 'ts-operation-order-details-v1'

const featuredOrder: OrderDetail = {
  id: 149,
  status: 'open',
  readyForReview: true,
  createdAt: 'Hoje às 11:32',
  customer: {
    id: 'maria-silva',
    name: 'Maria Silva',
    phone: '(11) 99876-5432',
    channel: 'WhatsApp',
    preference: 'Sem arroz',
    restriction: 'Lactose'
  },
  deliveryAddress: {
    id: 'order-149-delivery-snapshot',
    label: 'Casa',
    postalCode: '01001-000',
    street: 'Rua das Flores',
    number: '120',
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP'
  },
  deliveryWindow: '12:00–13:00',
  deliveryFee: 4,
  items: [
    {
      id: 'order-149-item-1',
      offerId: 'complete',
      name: 'Prato + Salada P + Fruta',
      price: 39,
      details: ['Tradicional · Estrogonofe de frango', 'Salada P · Salada de folhas', 'Fruta · Banana'],
      customizations: ['Sem arroz'],
      additions: ['Proteína extra · + R$ 5,00'],
      hasRestrictionConflict: false
    },
    {
      id: 'order-149-item-2',
      offerId: 'daily',
      name: 'Prato do dia',
      price: 25,
      details: ['Low Carb · Frango grelhado'],
      customizations: ['Arroz substituído por legumes refogados'],
      additions: [],
      hasRestrictionConflict: false
    }
  ],
  note: 'Entregar na portaria. Cliente pediu para não tocar o interfone.',
  planCreditCount: 2,
  planCreditValue: 59,
  financialCreditValue: 0,
  discountValue: 0,
  pendingIssues: [],
  ...domainStateFor('open'),
  history: [
    { id: 'created', time: 'Hoje 11:32', title: 'Pedido criado', actor: 'Ana' }
  ]
}

function parseCurrency(value: string) {
  return Number(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0
}

function detailStatusFromSummary(order: MockOrder): OrderDetailStatus {
  const label = order.statusLabel.toLocaleLowerCase('pt-BR')
  if (label.includes('cancelado')) return 'cancelled'
  if (label.includes('entregue') || label.includes('retirado')) return 'completed'
  if (label.includes('saiu para entrega')) return 'delivery'
  if (label.includes('embalagem') || label.includes('separação')) return 'packing'
  if (label.includes('produção')) return 'in-production'
  if (label.includes('confirmado')) return 'confirmed'
  if (label.includes('falha na entrega')) return 'failed'
  return 'open'
}

function pendingIssuesFromSummary(order: MockOrder) {
  if (order.id === featuredOrder.id)
    return []
  if (order.status === 'problema')
    return [order.statusLabel]
  if (order.status === 'revisao' && !order.statusLabel.toLocaleLowerCase('pt-BR').includes('pronto'))
    return [order.statusLabel]
  if (order.status === 'aberto' && order.statusLabel !== 'Pedido aberto' && order.statusLabel !== 'Aguardando confirmação')
    return [order.statusLabel]
  return []
}

function genericItems(order: MockOrder): OrderItem[] {
  const financialTotal = parseCurrency(order.total)
  const deliveryFee = order.deliveryWindow && financialTotal >= 4 ? 4 : 0
  const itemTotal = Math.max(0, financialTotal - deliveryFee)
  const basePrice = order.itemCount ? itemTotal / order.itemCount : 0

  return Array.from({ length: order.itemCount }, (_, index) => {
    const offer = offers[index % offers.length]
    const restrictionConflict = Boolean(order.dietaryRestriction && order.statusLabel.toLocaleLowerCase('pt-BR').includes('restrição'))
    return {
      id: `order-${order.id}-item-${index + 1}`,
      offerId: offer.id,
      name: offer.name,
      price: basePrice,
      details: [offer.description],
      customizations: [],
      additions: [],
      hasRestrictionConflict: restrictionConflict && index === 0
    }
  })
}

function detailFromSummary(order: MockOrder): OrderDetail {
  const customer = customers.find(current => current.name === order.customer || current.phone === order.phone)
  const status = detailStatusFromSummary(order)
  const deliveryAddress = customer?.addresses[0]
  const financialTotal = parseCurrency(order.total)
  const deliveryFee = order.deliveryWindow && financialTotal >= 4 ? 4 : 0
  const currentStatusHistory = status === 'open'
    ? []
    : [{ id: `status-${order.id}`, time: `Hoje ${order.createdAt}`, title: order.statusLabel, actor: 'Ana' }]

  const operationalState: Partial<OrderDetail> = status === 'in-production'
    ? { productionStartedAt: `Hoje às ${order.createdAt}` }
    : status === 'packing'
      ? { productionStartedAt: 'Hoje às 09:50' }
      : status === 'delivery'
        ? { packedAt: 'Hoje às 10:32', packedBy: 'Joana', route: { id: 12, driver: 'Carlos Souza', stop: 4, stopCount: 8, status: 'in-progress' } }
        : status === 'completed'
          ? {
              packedAt: 'Hoje às 10:32',
              packedBy: 'Joana',
              completedAt: `Hoje às ${order.createdAt}`,
              route: { id: 12, driver: 'Carlos Souza', stop: 4, stopCount: 8, status: 'completed' },
              deliveryAttempts: [{ id: `attempt-${order.id}`, occurredAt: `Hoje às ${order.createdAt}`, result: 'success', driver: 'Carlos Souza' }]
            }
          : status === 'failed'
            ? {
                packedAt: 'Hoje às 12:32',
                packedBy: 'Joana',
                route: { id: 12, driver: 'Carlos Souza', stop: 4, stopCount: 8, status: 'in-progress' },
                deliveryAttempts: [{ id: `attempt-${order.id}`, occurredAt: 'Hoje às 13:12', result: 'failed', reason: 'Cliente ausente', note: 'Interfone sem resposta.', driver: 'Carlos Souza' }]
              }
            : status === 'cancelled'
              ? {
                  cancellation: {
                    reason: 'Cliente desistiu',
                    stageLabel: 'Confirmado',
                    actor: 'Ana Souza',
                    occurredAt: `Hoje às ${order.createdAt}`,
                    effects: ['Capacidade liberada', '1 crédito de plano estornado', 'Cobrança pendente cancelada']
                  }
                }
              : {}

  return {
    id: order.id,
    status,
    readyForReview: order.status === 'revisao' && pendingIssuesFromSummary(order).length === 0,
    createdAt: `Hoje às ${order.createdAt}`,
    confirmedAt: status === 'confirmed' ? `Hoje às ${order.createdAt} por Ana` : undefined,
    customer: {
      id: customer?.id ?? `customer-order-${order.id}`,
      name: order.customer,
      phone: order.phone,
      channel: order.channel,
      preference: customer?.preference,
      restriction: customer?.restriction ?? (order.dietaryRestriction ? 'Restrição cadastrada' : undefined)
    },
    deliveryAddress: deliveryAddress ? { ...deliveryAddress, id: `order-${order.id}-delivery-snapshot` } : undefined,
    deliveryWindow: order.deliveryWindow,
    deliveryFee,
    items: genericItems(order),
    planCreditCount: 0,
    planCreditValue: 0,
    financialCreditValue: 0,
    discountValue: 0,
    pendingIssues: pendingIssuesFromSummary(order),
    ...domainStateFor(status),
    ...operationalState,
    history: [
      ...currentStatusHistory,
      { id: `created-${order.id}`, time: `Hoje ${order.createdAt}`, title: 'Pedido criado', actor: 'Ana' }
    ]
  }
}

function readStoredOrders(): OrderDetail[] {
  try {
    const stored = window.localStorage.getItem(storageKey)
    const parsed = stored ? JSON.parse(stored) as OrderDetail[] : []
    return parsed.map(order => {
      const fallbackState = domainStateFor(order.status)
      return {
        ...order,
        discountValue: order.discountValue ?? 0,
        pendingIssues: order.pendingIssues ?? [],
        allowedActions: order.allowedActions ?? fallbackState.allowedActions,
        cancellationReasons: order.cancellationReasons ?? fallbackState.cancellationReasons,
        cancellationPreview: order.cancellationPreview ?? fallbackState.cancellationPreview
      }
    })
  }
  catch {
    return []
  }
}

function writeStoredOrders(orders: OrderDetail[]) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(orders))
  }
  catch {
    // A demonstração continua funcional enquanto esta página permanecer aberta.
  }
}

export function cloneOrderDetail(order: OrderDetail): OrderDetail {
  return structuredClone(order)
}

export function getOrderDetail(orderId: string | number): OrderDetail | undefined {
  const stored = readStoredOrders().find(order => String(order.id) === String(orderId))
  if (stored)
    return cloneOrderDetail(stored)
  if (String(featuredOrder.id) === String(orderId))
    return cloneOrderDetail(featuredOrder)
  const summary = mockOrders.find(order => String(order.id) === String(orderId))
  return summary ? detailFromSummary(summary) : undefined
}

export function saveOrderDetail(order: OrderDetail) {
  const orders = readStoredOrders().filter(current => current.id !== order.id)
  orders.push(cloneOrderDetail(order))
  writeStoredOrders(orders)
}

export function confirmOrderDetail(order: OrderDetail) {
  const updated = cloneOrderDetail(order)
  replaceDomainState(updated, 'confirmed')
  updated.readyForReview = false
  updated.confirmedAt = 'Hoje às 11:46 por Ana'
  updated.history.unshift({
    id: `confirmed-${Date.now()}`,
    time: 'Hoje 11:46',
    title: 'Pedido confirmado',
    actor: 'Ana'
  })
  saveOrderDetail(updated)
  return updated
}

export function cancelOrderDetail(order: OrderDetail, reasonValue: string, detail?: string) {
  const preview = order.cancellationPreview
  if (!order.allowedActions.includes('cancel') || !preview)
    return order

  const updated = cloneOrderDetail(order)
  const reason = updated.cancellationReasons.find(option => option.value === reasonValue)?.label ?? reasonValue
  updated.cancellation = {
    reason,
    detail: detail?.trim() || undefined,
    stageLabel: preview.stageLabel,
    actor: 'Ana Souza',
    occurredAt: 'Hoje às 14:28',
    effects: [...preview.effects]
  }
  replaceDomainState(updated, 'cancelled')
  updated.history.unshift({
    id: `cancelled-${Date.now()}`,
    time: 'Hoje 14:28',
    title: `Pedido cancelado · ${reason}`,
    actor: 'Ana'
  })
  saveOrderDetail(updated)
  return updated
}

export function markOrderPacked(order: OrderDetail) {
  if (!order.allowedActions.includes('mark-packed'))
    return order

  const updated = cloneOrderDetail(order)
  updated.packedAt = 'Hoje às 12:32'
  updated.packedBy = 'Ana'
  updated.allowedActions = updated.allowedActions.filter(action => action !== 'mark-packed')
  updated.history.unshift({
    id: `packed-${Date.now()}`,
    time: 'Hoje 12:32',
    title: 'Pedido embalado',
    actor: 'Ana'
  })
  saveOrderDetail(updated)
  return updated
}

export function rescheduleOrderDelivery(order: OrderDetail, newWindow: string, reason: string, note?: string) {
  const previousWindow = order.deliveryWindow
  if (!order.allowedActions.includes('reschedule') || !previousWindow)
    return order

  const updated = cloneOrderDetail(order)
  updated.reschedule = {
    previousWindow,
    newWindow,
    reason,
    note: note?.trim() || undefined,
    actor: 'Ana Souza',
    occurredAt: 'Hoje às 13:20'
  }
  updated.deliveryWindow = newWindow
  updated.allowedActions = updated.allowedActions.filter(action => action !== 'reschedule')
  updated.history.unshift({
    id: `rescheduled-${Date.now()}`,
    time: 'Hoje 13:20',
    title: `Entrega reagendada para ${newWindow}`,
    actor: 'Ana'
  })
  saveOrderDetail(updated)
  return updated
}

export function nextOrderId() {
  return Math.max(0, ...mockOrders.map(order => order.id), ...readStoredOrders().map(order => order.id)) + 1
}

function summaryStatus(order: OrderDetail): { status: OrderStatus; label: string } {
  if (order.status === 'open')
    return order.readyForReview
      ? { status: 'revisao', label: 'Pronto para revisão' }
      : order.pendingIssues.length
        ? { status: 'problema', label: order.pendingIssues[0] }
        : { status: 'aberto', label: 'Pedido aberto' }
  if (order.status === 'completed') return { status: 'concluido', label: 'Concluído' }
  if (order.status === 'cancelled') return { status: 'concluido', label: 'Cancelado' }
  if (order.status === 'failed') return { status: 'problema', label: 'Falha na entrega' }
  if (order.status === 'in-production') return { status: 'andamento', label: 'Em produção' }
  if (order.status === 'packing') return { status: 'andamento', label: 'Em embalagem' }
  if (order.status === 'delivery') return { status: 'andamento', label: 'Em entrega' }
  return { status: 'andamento', label: 'Confirmado' }
}

export function getOrderSummaries(): MockOrder[] {
  const summaries = new Map(mockOrders.map(order => [order.id, { ...order }]))
  for (const order of readStoredOrders()) {
    const state = summaryStatus(order)
    const total = Math.max(0,
      order.items.reduce((sum, item) => sum + item.price, 0)
      + order.deliveryFee
      - order.planCreditValue
      - order.financialCreditValue
      - order.discountValue
    )
    summaries.set(order.id, {
      id: order.id,
      createdAt: order.createdAt.replace('Hoje às ', ''),
      customer: order.customer.name,
      phone: order.customer.phone,
      channel: order.customer.channel,
      itemCount: order.items.length,
      status: state.status,
      statusLabel: state.label,
      deliveryWindow: order.deliveryWindow as MockOrder['deliveryWindow'],
      total: formatCurrency(total),
      dietaryRestriction: Boolean(order.customer.restriction)
    })
  }
  return [...summaries.values()].sort((first, second) => second.id - first.id)
}

import { customers, formatCurrency, offers } from '../components/new-order/mockData'
import type { CustomerAddress, OrderItem, PaymentCondition, PaymentMethod } from '../components/new-order/types'
import { getPublishedMenu } from './dailyMenu'
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
  routeId: number
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
  paymentCondition: PaymentCondition
  paymentMethod: PaymentMethod
  paymentDueDate?: string
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

const mockRouteAssignments: Record<number, NonNullable<OrderDetail['route']>> = {
  141: { id: 11, driver: 'Mariana Lima', stop: 1, stopCount: 1, status: 'completed' },
  142: { id: 10, driver: 'Rafael Santos', stop: 1, stopCount: 1, status: 'completed' },
  143: { id: 12, driver: 'Carlos Souza', stop: 1, stopCount: 1, status: 'in-progress' },
  156: { id: 22, driver: 'Mariana Lima', stop: 3, stopCount: 3, status: 'planned' },
  157: { id: 22, driver: 'Mariana Lima', stop: 2, stopCount: 3, status: 'planned' },
  158: { id: 22, driver: 'Mariana Lima', stop: 1, stopCount: 3, status: 'planned' },
  159: { id: 21, driver: 'Rafael Santos', stop: 2, stopCount: 2, status: 'planned' },
  160: { id: 21, driver: 'Rafael Santos', stop: 1, stopCount: 2, status: 'planned' },
  161: { id: 26, driver: 'Carlos Souza', stop: 1, stopCount: 2, status: 'completed' },
  162: { id: 25, driver: 'Rafael Santos', stop: 3, stopCount: 3, status: 'completed' },
  163: { id: 25, driver: 'Rafael Santos', stop: 2, stopCount: 3, status: 'completed' },
  164: { id: 25, driver: 'Rafael Santos', stop: 1, stopCount: 3, status: 'completed' },
  165: { id: 24, driver: 'Mariana Lima', stop: 3, stopCount: 3, status: 'completed' },
  166: { id: 24, driver: 'Mariana Lima', stop: 2, stopCount: 3, status: 'completed' },
  167: { id: 24, driver: 'Mariana Lima', stop: 1, stopCount: 3, status: 'completed' },
  168: { id: 23, driver: 'Carlos Souza', stop: 1, stopCount: 3, status: 'completed' },
  169: { id: 23, driver: 'Carlos Souza', stop: 2, stopCount: 3, status: 'in-progress' },
  170: { id: 23, driver: 'Carlos Souza', stop: 3, stopCount: 3, status: 'in-progress' },
  171: { id: 26, driver: 'Carlos Souza', stop: 2, stopCount: 2, status: 'in-progress' }
}

const mockDeliveryAttemptData: Record<number, { occurredAt: string, reason?: string, note?: string }> = {
  141: { occurredAt: 'Hoje às 10:54' },
  142: { occurredAt: 'Hoje às 10:46', reason: 'Cliente ausente', note: 'Duas tentativas de contato sem resposta.' },
  161: { occurredAt: 'Hoje às 12:57', reason: 'Endereço não localizado', note: 'Numeração não encontrada na quadra informada.' },
  162: { occurredAt: 'Hoje às 12:42' },
  163: { occurredAt: 'Hoje às 12:31', reason: 'Cliente recusou o pedido', note: 'Cliente informou que o pedido chegou fora do horário combinado.' },
  164: { occurredAt: 'Hoje às 12:18' },
  165: { occurredAt: 'Hoje às 11:47' },
  166: { occurredAt: 'Hoje às 11:32' },
  167: { occurredAt: 'Hoje às 11:16' },
  168: { occurredAt: 'Hoje às 12:21' }
}

const mockDeliveryNotes: Record<number, string> = {
  153: '<p>Entregar na recepção e identificar como pedido corporativo.</p>',
  156: '<p>Ligar ao chegar. Portão lateral após as 13h.</p>',
  160: '<p>Não tocar o interfone; deixar com a portaria do bloco B.</p>',
  169: '<p>Cliente solicitou contato cinco minutos antes da chegada.</p>',
  171: '<p>Levar a máquina de cartão até a entrada principal.</p>'
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
      effectiveComponents: [
        { id: 'prod-1004', name: 'Estrogonofe de frango', unit: 'porções', quantity: 1, source: 'producible' },
        { id: 'side-small-salad', name: 'Salada de folhas', unit: 'porções', quantity: 1, source: 'offer-component' },
        { id: 'fruit-banana', name: 'Banana', unit: 'unidades', quantity: 1, source: 'offer-component' },
        { id: 'adic-1001', name: 'Proteína extra', unit: 'porções', quantity: 1, source: 'addon' }
      ],
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
      effectiveComponents: [
        { id: 'prod-1003', name: 'Frango grelhado', unit: 'porções', quantity: 1, source: 'producible' }
      ],
      hasRestrictionConflict: false
    }
  ],
  note: '<h3>Orientações para a entrega</h3><p><strong>Entregar na portaria.</strong> Cliente estará em reunião no horário previsto.</p><ul><li>Não tocar o interfone.</li><li>Ligar antes de sair para a entrega.</li></ul><blockquote>Confirmar o recebimento com a portaria.</blockquote>',
  paymentCondition: 'deferred',
  paymentMethod: 'pix',
  paymentDueDate: '2026-09-10',
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
  if (label.includes('embalag') || label.includes('embalad') || label.includes('separação')) return 'packing'
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
    const menu = getPublishedMenu()
    const availableDishes = menu?.options.filter(option => option.availability === 'available') ?? []
    const dish = availableDishes[(order.id + index) % Math.max(availableDishes.length, 1)]
    const hasAlternativeSide = offer.name.toLocaleLowerCase('pt-BR').includes('ou fruta')
    const details = [
      ...(offer.componentTypes.includes('Prato do dia')
        ? [`${dish?.category ?? 'Tradicional'} · ${dish?.producibleName ?? 'Estrogonofe de frango'}`]
        : []),
      ...(offer.componentTypes.includes('Salada G')
        ? ['Salada G · Salada de folhas']
        : offer.componentTypes.includes('Salada P') && (!hasAlternativeSide || index % 2 === 0)
          ? ['Salada P · Salada de folhas']
          : []),
      ...(offer.componentTypes.includes('Fruta') && (!hasAlternativeSide || index % 2 !== 0)
        ? [`Fruta · ${index % 2 === 0 ? 'Banana' : 'Maçã'}`]
        : [])
    ]
    const restrictionConflict = Boolean(order.dietaryRestriction && order.statusLabel.toLocaleLowerCase('pt-BR').includes('restrição'))
    return {
      id: `order-${order.id}-item-${index + 1}`,
      offerId: offer.id,
      name: offer.name,
      price: basePrice,
      details: details.length ? details : [offer.name],
      customizations: order.id === 133 && index === 0 ? ['Sem arroz'] : [],
      additions: [],
      effectiveComponents: [
        ...(dish ? [{
          id: dish.producibleId,
          name: dish.producibleName,
          unit: 'porções' as const,
          quantity: 1,
          source: 'producible' as const
        }] : []),
        ...(offer.componentTypes.includes('Salada G') || (offer.componentTypes.includes('Salada P') && (!hasAlternativeSide || index % 2 === 0)) ? [{
          id: offer.componentTypes.includes('Salada G') ? 'side-large-salad' : 'side-small-salad',
          name: 'Salada de folhas',
          unit: 'porções' as const,
          quantity: 1,
          source: 'offer-component' as const
        }] : []),
        ...(offer.componentTypes.includes('Fruta') && (!hasAlternativeSide || index % 2 !== 0) ? [{
          id: index % 2 === 0 ? 'fruit-banana' : 'fruit-apple',
          name: index % 2 === 0 ? 'Banana' : 'Maçã',
          unit: 'unidades' as const,
          quantity: 1,
          source: 'offer-component' as const
        }] : [])
      ],
      hasRestrictionConflict: restrictionConflict && index === 0
    }
  })
}

function detailFromSummary(order: MockOrder): OrderDetail {
  const customer = customers.find(current => current.name === order.customer || current.phone === order.phone)
  const status = detailStatusFromSummary(order)
  const isPickup = order.statusLabel.toLocaleLowerCase('pt-BR').includes('retirado')
  const isPacked = order.statusLabel.toLocaleLowerCase('pt-BR').includes('embalad')
  const deliveryAddress = customer?.addresses[0]
  const financialTotal = parseCurrency(order.total)
  const deliveryFee = order.deliveryWindow && financialTotal >= 4 ? 4 : 0
  const currentStatusHistory = status === 'open'
    ? []
    : [{ id: `status-${order.id}`, time: `Hoje ${order.createdAt}`, title: order.statusLabel, actor: 'Ana' }]
  const assignedRoute = mockRouteAssignments[order.id]
  const deliveryAttemptData = mockDeliveryAttemptData[order.id]

  const operationalState: Partial<OrderDetail> = status === 'in-production'
    ? { productionStartedAt: `Hoje às ${order.createdAt}` }
    : status === 'packing'
      ? isPacked
        ? {
            productionStartedAt: 'Hoje às 09:50',
            packedAt: `Hoje às ${order.createdAt}`,
            packedBy: 'Joana',
            route: assignedRoute ? { ...assignedRoute } : undefined,
            allowedActions: []
          }
        : { productionStartedAt: 'Hoje às 09:50' }
      : status === 'delivery'
        ? { packedAt: 'Hoje às 10:32', packedBy: 'Joana', route: assignedRoute ? { ...assignedRoute } : { id: 12, driver: 'Carlos Souza', stop: 1, stopCount: 1, status: 'in-progress' } }
        : status === 'completed' && !isPickup
          ? {
              packedAt: 'Hoje às 10:32',
              packedBy: 'Joana',
              completedAt: deliveryAttemptData?.occurredAt ?? `Hoje às ${order.createdAt}`,
              route: assignedRoute ? { ...assignedRoute } : { id: 11, driver: 'Mariana Lima', stop: 1, stopCount: 1, status: 'completed' },
              deliveryAttempts: [{ id: `attempt-${order.id}`, routeId: assignedRoute?.id ?? 11, occurredAt: deliveryAttemptData?.occurredAt ?? `Hoje às ${order.createdAt}`, result: 'success', driver: assignedRoute?.driver ?? 'Mariana Lima' }]
            }
          : status === 'completed'
            ? { completedAt: `Hoje às ${order.createdAt}` }
          : status === 'failed'
            ? {
                packedAt: 'Hoje às 12:32',
                packedBy: 'Joana',
                route: assignedRoute ? { ...assignedRoute } : { id: 10, driver: 'Rafael Santos', stop: 1, stopCount: 1, status: 'completed' },
                deliveryAttempts: [{
                  id: `attempt-${order.id}`,
                  routeId: assignedRoute?.id ?? 10,
                  occurredAt: deliveryAttemptData?.occurredAt ?? 'Hoje às 13:12',
                  result: 'failed',
                  reason: deliveryAttemptData?.reason ?? 'Cliente ausente',
                  note: deliveryAttemptData?.note ?? 'Interfone sem resposta.',
                  driver: assignedRoute?.driver ?? 'Rafael Santos'
                }]
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
    note: mockDeliveryNotes[order.id],
    paymentCondition: 'cash',
    paymentMethod: 'pix',
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
        paymentCondition: order.paymentCondition ?? 'cash',
        paymentMethod: order.paymentMethod ?? 'pix',
        discountValue: order.discountValue ?? 0,
        pendingIssues: order.pendingIssues ?? [],
        deliveryAttempts: order.deliveryAttempts?.map(attempt => ({
          ...attempt,
          routeId: attempt.routeId ?? order.route?.id ?? 0
        })),
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

export function assignOrderToDeliveryRoute(
  order: OrderDetail,
  route: NonNullable<OrderDetail['route']>
) {
  if (order.status !== 'packing' || !order.packedAt || order.route)
    return order

  const updated = cloneOrderDetail(order)
  updated.route = { ...route }
  updated.history.unshift({
    id: `route-${route.id}-${Date.now()}`,
    time: 'Hoje 12:40',
    title: `Pedido incluído na rota #${route.id}`,
    actor: 'Ana'
  })
  saveOrderDetail(updated)
  return updated
}

export function updatePlannedOrderRoute(
  order: OrderDetail,
  route?: NonNullable<OrderDetail['route']>
) {
  if (order.status !== 'packing' || !order.packedAt || (order.route && order.route.status !== 'planned'))
    return order

  const updated = cloneOrderDetail(order)
  const previousRouteId = updated.route?.id
  updated.route = route ? { ...route } : undefined
  updated.history.unshift({
    id: `route-updated-${Date.now()}-${updated.id}`,
    time: 'Hoje 12:42',
    title: route
      ? `Planejamento atualizado · rota #${route.id}`
      : `Pedido removido da rota #${previousRouteId ?? '—'}`,
    actor: 'Ana'
  })
  saveOrderDetail(updated)
  return updated
}

export function startOrderDelivery(order: OrderDetail) {
  if (order.status !== 'packing' || !order.packedAt || !order.route || order.route.status !== 'planned')
    return order

  const route = { ...order.route, status: 'in-progress' as const }
  const updated = cloneOrderDetail(order)
  replaceDomainState(updated, 'delivery')
  updated.route = route
  updated.history.unshift({
    id: `delivery-started-${Date.now()}`,
    time: 'Hoje 12:45',
    title: `Saiu para entrega · rota #${route.id}`,
    actor: route.driver
  })
  saveOrderDetail(updated)
  return updated
}

export function recordOrderDelivery(
  order: OrderDetail,
  result: DeliveryAttempt['result'],
  reason?: string,
  note?: string
) {
  if (order.status !== 'delivery' || !order.route)
    return order

  const route = { ...order.route, status: 'completed' as const }
  const updated = cloneOrderDetail(order)
  const occurredAt = 'Hoje às 13:18'
  const driver = route.driver
  const attempt: DeliveryAttempt = {
    id: `attempt-${updated.id}-${Date.now()}`,
    routeId: route.id,
    occurredAt,
    result,
    reason: result === 'failed' ? reason : undefined,
    note: note?.trim() || undefined,
    driver
  }

  updated.deliveryAttempts = [...(updated.deliveryAttempts ?? []), attempt]
  updated.route = route
  if (result === 'success') {
    replaceDomainState(updated, 'completed')
    updated.completedAt = occurredAt
  }
  else {
    replaceDomainState(updated, 'failed')
  }
  updated.history.unshift({
    id: `delivery-${result}-${Date.now()}`,
    time: 'Hoje 13:18',
    title: result === 'success' ? 'Entrega concluída' : `Falha na entrega · ${reason ?? 'Motivo não informado'}`,
    actor: driver
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
  updated.route = undefined
  updated.completedAt = undefined
  replaceDomainState(updated, 'packing')
  updated.allowedActions = updated.allowedActions.filter(action => action !== 'mark-packed')
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
  if (order.status === 'packing') return { status: 'andamento', label: order.packedAt ? 'Embalado' : 'Em embalagem' }
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

export function getAllOrderDetails(): OrderDetail[] {
  return getOrderSummaries()
    .map(order => getOrderDetail(order.id))
    .filter((order): order is OrderDetail => Boolean(order))
}

export interface CustomerAddress {
  id: string
  label: string
  postalCode: string
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  state: string
  referencePoint?: string
}

export type PaymentCondition = 'cash' | 'on-delivery' | 'deferred'
export type PaymentMethod = 'pix' | 'cash' | 'credit-card' | 'debit-card'

export interface PlanAcquisition {
  id: string
  planName: string
  acquiredAt: string
  remainingCredits: number
  compatibleOfferIds: string[]
}

export interface Customer {
  id: string
  name: string
  phone: string
  channel: 'WhatsApp' | 'Telefone' | 'Balcão'
  restriction?: string
  preference?: string
  paymentPreference?: {
    condition: PaymentCondition
    method: PaymentMethod
  }
  planAcquisitions?: PlanAcquisition[]
  financialCreditBalance?: number
  addresses: CustomerAddress[]
}

export interface OrderItem {
  id: string
  offerId: string
  name: string
  price: number
  details: string[]
  additions: string[]
  fulfillmentSource: 'daily-production' | 'frozen-stock'
  frozenStock?: FrozenOrderItemSnapshot
  /** Snapshot operacional usado por Produção; textos de apresentação não são fonte de cálculo. */
  effectiveComponents: OrderItemComponent[]
  customizations: string[]
  hasRestrictionConflict: boolean
}

export interface FrozenOrderItemSnapshot {
  configurationId: string
  producibleItemId: string
  producibleName: string
  presentation: string
  unitPrice: number
  allocationStatus: 'pending' | 'allocated' | 'returned' | 'manual-review'
  allocations: FrozenOrderLotAllocation[]
}

export interface FrozenOrderLotAllocation {
  lotId: string
  manufacturedOn: string
  expiresOn: string
  quantity: number
}

export interface FrozenOrderConfiguration {
  id: string
  producibleItemId: string
  producibleName: string
  presentation: string
  unitPrice: number
  availableQuantity: number
  nextExpiration?: string
}

export interface OrderItemComponent {
  id: string
  name: string
  unit: 'porções' | 'unidades'
  quantity: number
  source: 'producible' | 'addon' | 'offer-component'
}

export interface Offer {
  id: string
  name: string
  price: number
  requiresConfiguration: boolean
  description: string
  componentTypes: string[]
  allowedAddons: { id: string; name: string; price: number }[]
}

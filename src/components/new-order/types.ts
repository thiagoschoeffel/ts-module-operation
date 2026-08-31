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
  customizations: string[]
  hasRestrictionConflict: boolean
}

export interface Offer {
  id: string
  name: string
  price: number
  requiresConfiguration: boolean
  description: string
}

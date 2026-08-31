export interface CustomerAddress {
  id: string
  label: string
  street: string
  neighborhood: string
}

export interface Customer {
  id: string
  name: string
  phone: string
  channel: 'WhatsApp' | 'Telefone' | 'Balcão'
  restriction?: string
  preference?: string
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

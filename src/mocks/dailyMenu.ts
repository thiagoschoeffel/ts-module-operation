import type { Offer } from '../components/new-order/types'

export type MenuAvailability = 'available' | 'sold-out' | 'suspended'

export interface PublishedMenuOption {
  id: string
  category: string
  producibleId: string
  producibleName: string
  availability: MenuAvailability
}

interface PublishedMenuOffer {
  offerId: string
  name: string
  description?: string
  effectivePrice: number
  availability: MenuAvailability
  order: number
  requiresConfiguration: boolean
  componentTypes: string[]
  allowedAddons: { id: string; name: string; price: number }[]
}

export interface PublishedDailyMenu {
  date: string
  status: 'published'
  options: PublishedMenuOption[]
  offers: PublishedMenuOffer[]
  publishedAt?: string
  updatedAt: string
}

const storageKey = 'ts-commercial-daily-menus-v1'

export function localDateIso(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fallbackMenu(): PublishedDailyMenu {
  const date = localDateIso()
  const addons = {
    protein: { id: 'adic-1001', name: 'Proteína extra', price: 8 },
    beans: { id: 'adic-1002', name: 'Feijão extra', price: 4 },
    sauce: { id: 'adic-1003', name: 'Molho extra', price: 2.5 }
  }
  return {
    date, status: 'published', publishedAt: `${date}T08:00:00`, updatedAt: `${date}T08:00:00`,
    options: [
      { id: 'traditional', category: 'Tradicional', producibleId: 'prod-1004', producibleName: 'Estrogonofe de frango', availability: 'available' },
      { id: 'low-carb', category: 'Low Carb', producibleId: 'prod-1003', producibleName: 'Frango grelhado', availability: 'available' },
      { id: 'vegetarian', category: 'Vegetariano', producibleId: 'prod-1006', producibleName: 'Legumes assados', availability: 'sold-out' }
    ],
    offers: [
      { offerId: 'oferta-1001', name: 'Prato do dia', description: 'Refeição principal do cardápio.', effectivePrice: 28, availability: 'available', order: 1, requiresConfiguration: true, componentTypes: ['Prato do dia'], allowedAddons: [addons.protein, addons.beans, addons.sauce] },
      { offerId: 'oferta-1002', name: 'Prato + Salada P', effectivePrice: 34, availability: 'available', order: 2, requiresConfiguration: true, componentTypes: ['Prato do dia', 'Salada P'], allowedAddons: [addons.protein, addons.sauce] },
      { offerId: 'oferta-1003', name: 'Prato + Fruta', effectivePrice: 32, availability: 'available', order: 3, requiresConfiguration: true, componentTypes: ['Prato do dia', 'Fruta'], allowedAddons: [addons.protein] },
      { offerId: 'oferta-1004', name: 'Prato + Salada P + Fruta', effectivePrice: 38, availability: 'available', order: 4, requiresConfiguration: true, componentTypes: ['Prato do dia', 'Salada P', 'Fruta'], allowedAddons: [addons.protein, addons.beans, addons.sauce] },
      { offerId: 'oferta-1005', name: 'Prato + Salada ou Fruta', effectivePrice: 34, availability: 'available', order: 5, requiresConfiguration: true, componentTypes: ['Prato do dia', 'Salada P', 'Fruta', 'Salada G'], allowedAddons: [addons.protein, addons.sauce] },
      { offerId: 'oferta-1006', name: 'Salada G', effectivePrice: 24, availability: 'available', order: 6, requiresConfiguration: false, componentTypes: ['Salada G'], allowedAddons: [addons.protein, addons.sauce] }
    ]
  }
}

function isPublishedMenu(value: unknown): value is PublishedDailyMenu {
  if (typeof value !== 'object' || value === null) return false
  const menu = value as Partial<PublishedDailyMenu>
  return menu.status === 'published' && typeof menu.date === 'string'
    && typeof menu.updatedAt === 'string'
    && Array.isArray(menu.options)
    && menu.options.every(option => typeof option.id === 'string' && typeof option.category === 'string'
      && typeof option.producibleName === 'string'
      && ['available', 'sold-out', 'suspended'].includes(option.availability))
    && Array.isArray(menu.offers)
    && menu.offers.every(offer => typeof offer.offerId === 'string' && typeof offer.name === 'string'
      && typeof offer.effectivePrice === 'number' && typeof offer.order === 'number'
      && typeof offer.requiresConfiguration === 'boolean'
      && ['available', 'sold-out', 'suspended'].includes(offer.availability)
      && Array.isArray(offer.componentTypes) && Array.isArray(offer.allowedAddons))
}

export function getPublishedMenu(date = localDateIso()): PublishedDailyMenu | undefined {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    if (Array.isArray(parsed)) {
      const stored = parsed.find(value => isPublishedMenu(value) && value.date === date)
      if (stored && isPublishedMenu(stored)) return structuredClone(stored)
    }
  }
  catch { /* Usa a massa demonstrativa quando a persistência local estiver inválida. */ }
  return date === localDateIso() ? fallbackMenu() : undefined
}

export function getAvailableOffers(date = localDateIso()): Offer[] {
  return (getPublishedMenu(date)?.offers ?? [])
    .filter(offer => offer.availability === 'available')
    .sort((a, b) => a.order - b.order)
    .map(offer => ({
      id: offer.offerId,
      name: offer.name,
      price: offer.effectivePrice,
      requiresConfiguration: offer.requiresConfiguration,
      description: offer.description ?? offer.componentTypes.join(' · '),
      componentTypes: offer.componentTypes,
      allowedAddons: offer.allowedAddons
    }))
}

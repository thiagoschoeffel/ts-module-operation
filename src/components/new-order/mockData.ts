import type { Customer, Offer } from './types'
import { getAvailableOffers } from '../../mocks/dailyMenu'

export const customers: Customer[] = [
  {
    id: 'maria-silva',
    name: 'Maria Silva',
    phone: '(11) 99876-5432',
    channel: 'WhatsApp',
    restriction: 'Lactose',
    preference: 'Sem arroz',
    paymentPreference: { condition: 'on-delivery', method: 'pix' },
    planAcquisitions: [
      {
        id: 'maria-plan-complete-2026-08',
        planName: 'Plano Prato + Salada + Fruta',
        acquiredAt: '2026-08-03',
        remainingCredits: 3,
        compatibleOfferIds: ['oferta-1004', 'oferta-1001']
      }
    ],
    financialCreditBalance: 8,
    addresses: [
      { id: 'maria-casa', label: 'Casa', postalCode: '01001-000', street: 'Rua das Flores', number: '120', neighborhood: 'Centro', city: 'São Paulo', state: 'SP' },
      { id: 'maria-trabalho', label: 'Trabalho', postalCode: '01310-100', street: 'Av. Paulista', number: '900', complement: '8º andar', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP' }
    ]
  },
  {
    id: 'joao-souza',
    name: 'João Souza',
    phone: '(11) 98765-4321',
    channel: 'Telefone',
    paymentPreference: { condition: 'on-delivery', method: 'cash' },
    addresses: [
      { id: 'joao-casa', label: 'Casa', postalCode: '01232-010', street: 'Rua do Bosque', number: '48', neighborhood: 'Santa Cecília', city: 'São Paulo', state: 'SP' }
    ]
  },
  {
    id: 'ana-lima',
    name: 'Ana Lima',
    phone: '(11) 97654-3210',
    channel: 'Balcão',
    preference: 'Pouco sal',
    paymentPreference: { condition: 'cash', method: 'debit-card' },
    addresses: []
  },
  {
    id: 'carlos-mendes',
    name: 'Carlos Mendes',
    phone: '(11) 96543-2109',
    channel: 'Telefone',
    restriction: 'Glúten',
    paymentPreference: { condition: 'deferred', method: 'pix' },
    addresses: [
      { id: 'carlos-casa', label: 'Casa', postalCode: '05435-000', street: 'Rua Harmonia', number: '215', neighborhood: 'Vila Madalena', city: 'São Paulo', state: 'SP' }
    ]
  },
  {
    id: 'beatriz-rocha',
    name: 'Beatriz Rocha',
    phone: '(11) 95432-1098',
    channel: 'WhatsApp',
    preference: 'Vegetariano',
    paymentPreference: { condition: 'cash', method: 'pix' },
    addresses: [
      { id: 'beatriz-casa', label: 'Casa', postalCode: '01415-001', street: 'Rua das Acácias', number: '77', neighborhood: 'Jardins', city: 'São Paulo', state: 'SP' },
      { id: 'beatriz-faculdade', label: 'Faculdade', postalCode: '01504-001', street: 'Rua Vergueiro', number: '1211', neighborhood: 'Liberdade', city: 'São Paulo', state: 'SP' }
    ]
  },
  {
    id: 'roberto-alves',
    name: 'Roberto Alves',
    phone: '(11) 94321-0987',
    channel: 'Telefone',
    restriction: 'Lactose',
    preference: 'Substituir arroz por legumes',
    paymentPreference: { condition: 'on-delivery', method: 'cash' },
    planAcquisitions: [
      {
        id: 'roberto-plan-meal-2026-07',
        planName: 'Plano Prato do Dia',
        acquiredAt: '2026-07-28',
        remainingCredits: 2,
        compatibleOfferIds: ['oferta-1001', 'oferta-1003']
      }
    ],
    addresses: [
      { id: 'roberto-casa', label: 'Casa', postalCode: '05042-000', street: 'Rua Clélia', number: '540', neighborhood: 'Lapa', city: 'São Paulo', state: 'SP' }
    ]
  },
  {
    id: 'fernanda-nunes',
    name: 'Fernanda Nunes',
    phone: '(11) 93210-9876',
    channel: 'WhatsApp',
    restriction: 'Amendoim',
    paymentPreference: { condition: 'cash', method: 'credit-card' },
    financialCreditBalance: 12.5,
    addresses: []
  },
  {
    id: 'lucas-martins',
    name: 'Lucas Martins',
    phone: '(11) 92109-8765',
    channel: 'Balcão',
    paymentPreference: { condition: 'cash', method: 'debit-card' },
    addresses: [
      { id: 'lucas-casa', label: 'Casa', postalCode: '05022-000', street: 'Av. Pompéia', number: '680', neighborhood: 'Pompéia', city: 'São Paulo', state: 'SP' },
      { id: 'lucas-trabalho', label: 'Trabalho', postalCode: '04538-133', street: 'Av. Faria Lima', number: '3477', complement: 'Torre B', neighborhood: 'Itaim Bibi', city: 'São Paulo', state: 'SP' },
      { id: 'lucas-familia', label: 'Família', postalCode: '05061-300', street: 'Rua Cerro Corá', number: '1880', neighborhood: 'Alto da Lapa', city: 'São Paulo', state: 'SP' }
    ]
  }
]

export const offers: Offer[] = getAvailableOffers()

export const deliveryWindowOptions = [
  { value: '11:00–12:00', label: '11:00–12:00' },
  { value: '12:00–13:00', label: '12:00–13:00' },
  { value: '13:00–14:00', label: '13:00–14:00' }
]

/**
 * Pedidos realizados até 10h15 entram na entrega até 12h. Pedidos feitos
 * depois desse corte e até 12h entram na faixa com entregas a partir de
 * 12h30. Depois das 12h, é usada a próxima janela disponível da operação.
 */
export function getDefaultDeliveryWindow(date = new Date()) {
  const orderTimeInMinutes = date.getHours() * 60 + date.getMinutes()
  if (orderTimeInMinutes <= 10 * 60 + 15)
    return deliveryWindowOptions[0].value
  if (orderTimeInMinutes <= 12 * 60)
    return deliveryWindowOptions[1].value
  return deliveryWindowOptions[2].value
}

export const riceSubstitutionOptions = [
  { value: 'vegetables', label: 'Legumes refogados', description: 'Opção disponível no cardápio de hoje' },
  { value: 'salad', label: 'Salada de folhas', description: 'Porção adicional da salada do dia' }
]

export const paymentConditionOptions = [
  { value: 'cash', label: 'À vista' },
  { value: 'on-delivery', label: 'Na entrega' },
  { value: 'deferred', label: 'A prazo' }
]

export const paymentMethodOptions = [
  { value: 'pix', label: 'Pix' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'credit-card', label: 'Cartão de crédito' },
  { value: 'debit-card', label: 'Cartão de débito' }
]

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

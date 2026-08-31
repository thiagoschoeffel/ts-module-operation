import type { Customer, Offer } from './types'

export const customers: Customer[] = [
  {
    id: 'maria-silva',
    name: 'Maria Silva',
    phone: '(11) 99876-5432',
    channel: 'WhatsApp',
    restriction: 'Lactose',
    preference: 'Sem arroz',
    addresses: [
      { id: 'maria-casa', label: 'Casa', street: 'Rua das Flores, 120', neighborhood: 'Centro' },
      { id: 'maria-trabalho', label: 'Trabalho', street: 'Av. Paulista, 900', neighborhood: 'Bela Vista' }
    ]
  },
  {
    id: 'joao-souza',
    name: 'João Souza',
    phone: '(11) 98765-4321',
    channel: 'Telefone',
    addresses: [
      { id: 'joao-casa', label: 'Casa', street: 'Rua do Bosque, 48', neighborhood: 'Santa Cecília' }
    ]
  },
  {
    id: 'ana-lima',
    name: 'Ana Lima',
    phone: '(11) 97654-3210',
    channel: 'Balcão',
    preference: 'Pouco sal',
    addresses: []
  },
  {
    id: 'carlos-mendes',
    name: 'Carlos Mendes',
    phone: '(11) 96543-2109',
    channel: 'Telefone',
    restriction: 'Glúten',
    addresses: [
      { id: 'carlos-casa', label: 'Casa', street: 'Rua Harmonia, 215', neighborhood: 'Vila Madalena' }
    ]
  },
  {
    id: 'beatriz-rocha',
    name: 'Beatriz Rocha',
    phone: '(11) 95432-1098',
    channel: 'WhatsApp',
    preference: 'Vegetariano',
    addresses: [
      { id: 'beatriz-casa', label: 'Casa', street: 'Rua das Acácias, 77', neighborhood: 'Jardins' },
      { id: 'beatriz-faculdade', label: 'Faculdade', street: 'Rua Vergueiro, 1211', neighborhood: 'Liberdade' }
    ]
  },
  {
    id: 'roberto-alves',
    name: 'Roberto Alves',
    phone: '(11) 94321-0987',
    channel: 'Telefone',
    restriction: 'Lactose',
    preference: 'Sem arroz',
    addresses: [
      { id: 'roberto-casa', label: 'Casa', street: 'Rua Clélia, 540', neighborhood: 'Lapa' }
    ]
  },
  {
    id: 'fernanda-nunes',
    name: 'Fernanda Nunes',
    phone: '(11) 93210-9876',
    channel: 'WhatsApp',
    restriction: 'Amendoim',
    addresses: []
  },
  {
    id: 'lucas-martins',
    name: 'Lucas Martins',
    phone: '(11) 92109-8765',
    channel: 'Balcão',
    addresses: [
      { id: 'lucas-casa', label: 'Casa', street: 'Av. Pompéia, 680', neighborhood: 'Pompéia' },
      { id: 'lucas-trabalho', label: 'Trabalho', street: 'Av. Faria Lima, 3477', neighborhood: 'Itaim Bibi' },
      { id: 'lucas-familia', label: 'Família', street: 'Rua Cerro Corá, 1880', neighborhood: 'Alto da Lapa' }
    ]
  }
]

export const offers: Offer[] = [
  { id: 'daily', name: 'Prato do dia', price: 25, requiresConfiguration: false, description: 'Tradicional · Estrogonofe de frango' },
  { id: 'salad', name: 'Prato + Salada P', price: 30, requiresConfiguration: false, description: 'Tradicional · Salada de folhas' },
  { id: 'fruit', name: 'Prato + Fruta', price: 29, requiresConfiguration: true, description: 'Escolha o prato e a fruta' },
  { id: 'complete', name: 'Prato + Salada P + Fruta', price: 34, requiresConfiguration: true, description: 'Escolha o prato, a fruta e adicionais' },
  { id: 'salad-only', name: 'Salada grande', price: 22, requiresConfiguration: false, description: 'Folhas, legumes e molho da casa' },
  { id: 'dessert', name: 'Sobremesa do dia', price: 8, requiresConfiguration: false, description: 'Mousse de maracujá' }
]

export const deliveryWindowOptions = [
  { value: '11:00–12:00', label: '11:00–12:00' },
  { value: '12:00–13:00', label: '12:00–13:00' },
  { value: '13:00–14:00', label: '13:00–14:00' }
]

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

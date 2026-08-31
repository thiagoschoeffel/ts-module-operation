export type OrderStatus = 'revisao' | 'aberto' | 'andamento' | 'concluido' | 'problema'
export type OrderChannel = 'WhatsApp' | 'Telefone' | 'Balcão'
export type DeliveryWindow = '11:00–12:00' | '12:00–13:00' | '13:00–14:00'

export interface MockOrder {
  id: number
  createdAt: string
  customer: string
  phone: string
  channel: OrderChannel
  itemCount: number
  status: OrderStatus
  statusLabel: string
  deliveryWindow?: DeliveryWindow
  total: string
  dietaryRestriction?: boolean
}

/**
 * Massa temporária da operação. Ela combina todos os status, origens e janelas,
 * além de pedidos sem entrega, sem valor financeiro e com restrição alimentar.
 * A quantidade também garante que a paginação possa ser exercitada.
 */
export const mockOrders: MockOrder[] = [
  { id: 149, createdAt: '11:32', customer: 'Maria Silva', phone: '(11) 99876-5432', channel: 'WhatsApp', itemCount: 2, status: 'revisao', statusLabel: 'Pronto para revisão', deliveryWindow: '12:00–13:00', total: 'R$ 9,00', dietaryRestriction: true },
  { id: 148, createdAt: '10:42', customer: 'Mariana Costa', phone: '(11) 99123-4501', channel: 'WhatsApp', itemCount: 4, status: 'problema', statusLabel: 'Restrição divergente', deliveryWindow: '11:00–12:00', total: 'R$ 41,00', dietaryRestriction: true },
  { id: 147, createdAt: '10:35', customer: 'João Souza', phone: '(11) 98765-4321', channel: 'Telefone', itemCount: 1, status: 'andamento', statusLabel: 'Em produção', deliveryWindow: '12:00–13:00', total: 'R$ 32,00' },
  { id: 146, createdAt: '10:21', customer: 'Ana Lima', phone: '(11) 97654-3210', channel: 'Balcão', itemCount: 3, status: 'concluido', statusLabel: 'Confirmado', deliveryWindow: '13:00–14:00', total: 'R$ 0,00' },
  { id: 145, createdAt: '10:12', customer: 'Carlos Mendes', phone: '(11) 96543-2109', channel: 'Telefone', itemCount: 2, status: 'aberto', statusLabel: 'Pedido aberto', total: 'R$ 29,00' },
  { id: 144, createdAt: '10:04', customer: 'Beatriz Rocha', phone: '(11) 95432-1098', channel: 'WhatsApp', itemCount: 1, status: 'revisao', statusLabel: 'Aguardando revisão', deliveryWindow: '12:00–13:00', total: 'R$ 25,00' },
  { id: 143, createdAt: '09:56', customer: 'Roberto Alves', phone: '(11) 94321-0987', channel: 'Balcão', itemCount: 5, status: 'andamento', statusLabel: 'Saiu para entrega', deliveryWindow: '11:00–12:00', total: 'R$ 78,00' },
  { id: 142, createdAt: '09:48', customer: 'Fernanda Nunes', phone: '(11) 93210-9876', channel: 'WhatsApp', itemCount: 2, status: 'problema', statusLabel: 'Falha na entrega', deliveryWindow: '13:00–14:00', total: 'R$ 34,00' },
  { id: 141, createdAt: '09:39', customer: 'Lucas Martins', phone: '(11) 92109-8765', channel: 'Telefone', itemCount: 1, status: 'concluido', statusLabel: 'Entregue', deliveryWindow: '12:00–13:00', total: 'R$ 4,00' },
  { id: 140, createdAt: '09:31', customer: 'Patrícia Gomes', phone: '(11) 91098-7654', channel: 'Balcão', itemCount: 2, status: 'aberto', statusLabel: 'Aguardando itens', total: 'R$ 30,00' },
  { id: 139, createdAt: '09:22', customer: 'Rafael Cardoso', phone: '(11) 90987-6543', channel: 'WhatsApp', itemCount: 3, status: 'revisao', statusLabel: 'Pagamento em revisão', deliveryWindow: '13:00–14:00', total: 'R$ 61,00' },
  { id: 138, createdAt: '09:14', customer: 'Camila Ribeiro', phone: '(11) 99870-1122', channel: 'Telefone', itemCount: 1, status: 'andamento', statusLabel: 'Em separação', deliveryWindow: '11:00–12:00', total: 'R$ 29,00' },
  { id: 137, createdAt: '09:05', customer: 'Eduardo Freitas', phone: '(11) 98760-2233', channel: 'Balcão', itemCount: 2, status: 'concluido', statusLabel: 'Retirado', total: 'R$ 55,00' },
  { id: 136, createdAt: '08:57', customer: 'Juliana Castro', phone: '(11) 97650-3344', channel: 'WhatsApp', itemCount: 4, status: 'problema', statusLabel: 'Pagamento recusado', deliveryWindow: '12:00–13:00', total: 'R$ 96,00' },
  { id: 135, createdAt: '08:48', customer: 'Gustavo Barros', phone: '(11) 96540-4455', channel: 'Telefone', itemCount: 1, status: 'aberto', statusLabel: 'Aguardando confirmação', deliveryWindow: '13:00–14:00', total: 'R$ 25,00' },
  { id: 134, createdAt: '08:39', customer: 'Sofia Teixeira', phone: '(11) 95430-5566', channel: 'Balcão', itemCount: 2, status: 'revisao', statusLabel: 'Pronto para revisão', total: 'R$ 59,00', dietaryRestriction: true },
  { id: 133, createdAt: '08:31', customer: 'Henrique Melo', phone: '(11) 94320-6677', channel: 'WhatsApp', itemCount: 3, status: 'andamento', statusLabel: 'Em produção', deliveryWindow: '11:00–12:00', total: 'R$ 68,00' },
  { id: 132, createdAt: '08:23', customer: 'Aline Moraes', phone: '(11) 93210-7788', channel: 'Telefone', itemCount: 1, status: 'concluido', statusLabel: 'Cancelado', deliveryWindow: '13:00–14:00', total: 'R$ 0,00' },
  { id: 131, createdAt: '08:14', customer: 'Diego Ramos', phone: '(11) 92100-8899', channel: 'Balcão', itemCount: 2, status: 'problema', statusLabel: 'Item indisponível', total: 'R$ 30,00' },
  { id: 130, createdAt: '08:02', customer: 'Lívia Correia', phone: '(11) 91090-9900', channel: 'WhatsApp', itemCount: 3, status: 'aberto', statusLabel: 'Pedido aberto', deliveryWindow: '12:00–13:00', total: 'R$ 63,00' }
]

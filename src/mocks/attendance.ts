import type { AttendanceConversation, AttendanceMessage, AttendanceMode, WhatsAppQuotaUsage } from '../types/attendance'
import { whatsAppTextToDisplayHtml } from '../domain/whatsappText'
import { quotaStatus } from '../domain/whatsappQuota'

const quotaSnapshot = {
  businessPhoneNumber: '(11) 4000-2026',
  periodLabel: 'Setembro de 2026',
  freeServiceMessageLimit: 1000,
  automationPauseAt: 970,
  deliveredServiceMessages: 938,
  reservedServiceMessages: 2,
  renewsAtLabel: '1º de outubro de 2026'
}

const initialConversations: AttendanceConversation[] = [
  {
    id: 'conversation-maria',
    customerId: 'maria-silva',
    customerName: 'Maria Silva',
    phone: '(11) 99876-5432',
    mode: 'human',
    assignedTo: 'Ana',
    unreadCount: 2,
    lastMessageAt: '11:46',
    orderId: 149,
    orderPreparation: 'ready-for-review',
    messages: [
      message('wamid.maria.1', 'inbound', 'customer', '<p>Bom dia! Quero dois pratos de hoje, sem arroz.</p>', '11:39'),
      message('wamid.maria.2', 'outbound', 'automation', '<p>Bom dia, Maria! Separei dois pratos e mantive sua preferência sem arroz. A entrega é no trabalho?</p>', '11:40'),
      message('wamid.maria.3', 'inbound', 'customer', '<p>Isso, no trabalho. Pode ser entre 12h e 13h.</p>', '11:44'),
      message('wamid.maria.4', 'inbound', 'customer', '<p>E confirma se está tudo sem lactose, por favor.</p>', '11:46')
    ]
  },
  {
    id: 'conversation-beatriz',
    customerId: 'beatriz-rocha',
    customerName: 'Beatriz Rocha',
    phone: '(11) 95432-1098',
    mode: 'automated',
    unreadCount: 0,
    lastMessageAt: '11:32',
    orderPreparation: 'assembling',
    messages: [
      message('wamid.beatriz.1', 'inbound', 'customer', '<p>Oi! Tem alguma opção vegetariana congelada?</p>', '11:30'),
      message('wamid.beatriz.2', 'outbound', 'automation', '<p>Oi, Beatriz! Vou conferir as opções com estoque disponível para você.</p>', '11:32')
    ]
  },
  {
    id: 'conversation-fernanda',
    customerId: 'fernanda-nunes',
    customerName: 'Fernanda Nunes',
    phone: '(11) 93210-9876',
    mode: 'automated',
    unreadCount: 1,
    lastMessageAt: '11:18',
    messages: [
      message('wamid.fernanda.1', 'inbound', 'customer', '<p>Quero repetir o pedido de ontem.</p>', '11:18', 'failed')
    ]
  },
  {
    id: 'conversation-paulo',
    customerName: 'Paulo Henrique',
    phone: '(11) 90000-1188',
    mode: 'closed',
    assignedTo: 'Ana',
    unreadCount: 0,
    lastMessageAt: '10:54',
    orderId: 148,
    messages: [
      message('wamid.paulo.1', 'inbound', 'customer', '<p>Obrigado, vou acompanhar por aqui.</p>', '10:53'),
      message('wamid.paulo.2', 'outbound', 'operator', '<p>Perfeito! Seu pedido ficou registrado.</p>', '10:54')
    ]
  },
  compactConversation('juliana', 'Juliana Castro', '(11) 97650-3344', '10:47', 'human', 3, 'Você consegue ajustar o endereço da entrega?'),
  compactConversation('rafael', 'Rafael Cardoso', '(11) 90987-6543', '10:35', 'automated', 0, 'Quais são as opções do cardápio de hoje?'),
  compactConversation('henrique', 'Henrique Melo', '(11) 94320-6677', '10:22', 'automated', 1, 'Ainda dá tempo de pedir para o almoço?'),
  compactConversation('sonia', 'Sônia Almeida', '(11) 95555-0000', '10:08', 'human', 0, 'Pode incluir uma salada adicional?'),
  compactConversation('lucas', 'Lucas Martins', '(11) 92109-8765', '09:56', 'automated', 4, 'Vou retirar no balcão.'),
  compactConversation('mariana', 'Mariana Costa', '(11) 99123-4501', '09:42', 'automated', 0, 'Esse prato contém amendoim?'),
  compactConversation('roberto', 'Roberto Alves', '(11) 94321-0987', '09:27', 'human', 2, 'Quero usar os créditos do meu plano.'),
  compactConversation('camila', 'Camila Ferreira', '(11) 98881-2345', '09:11', 'automated', 0, 'Tem entrega para a Vila Mariana?'),
  compactConversation('gabriel', 'Gabriel Santos', '(11) 97772-3456', '08:58', 'automated', 1, 'Bom dia, quero fazer meu primeiro pedido.'),
  compactConversation('patricia', 'Patrícia Gomes', '(11) 96663-4567', '08:41', 'closed', 0, 'Obrigada pelo atendimento!')
]

let conversations = structuredClone(initialConversations)

function message(
  externalId: string,
  direction: AttendanceMessage['direction'],
  origin: AttendanceMessage['origin'],
  content: string,
  time: string,
  processingStatus: AttendanceMessage['processingStatus'] = 'processed'
): AttendanceMessage {
  return {
    id: externalId,
    externalId,
    direction,
    origin,
    content,
    platformTimestamp: `Hoje ${time}`,
    receivedTimestamp: `Hoje ${time}`,
    processingStatus
  }
}

function compactConversation(
  id: string,
  customerName: string,
  phone: string,
  lastMessageAt: string,
  mode: AttendanceMode,
  unreadCount: number,
  content: string
): AttendanceConversation {
  return {
    id: `conversation-${id}`,
    customerName,
    phone,
    mode,
    assignedTo: mode === 'human' ? 'Ana' : undefined,
    unreadCount,
    lastMessageAt,
    messages: [message(`wamid.${id}.1`, 'inbound', 'customer', `<p>${content}</p>`, lastMessageAt)]
  }
}

function wait(duration = 250) {
  return new Promise<void>((resolve) => setTimeout(resolve, duration))
}

export async function loadAttendanceConversations() {
  await wait()
  return structuredClone(conversations)
}

export async function loadWhatsAppQuotaUsage(): Promise<WhatsAppQuotaUsage> {
  await wait(120)
  return { ...quotaSnapshot, status: quotaStatus(quotaSnapshot) }
}

export async function changeAttendanceMode(conversationId: string, mode: AttendanceMode) {
  await wait(180)
  const conversation = conversations.find(item => item.id === conversationId)
  if (!conversation) throw new Error('Conversa não encontrada.')
  conversation.mode = mode
  conversation.assignedTo = mode === 'human' ? 'Ana' : undefined
  return structuredClone(conversation)
}

export async function sendAttendanceMessage(conversationId: string, whatsAppText: string) {
  await wait(220)
  const conversation = conversations.find(item => item.id === conversationId)
  if (!conversation) throw new Error('Conversa não encontrada.')
  const now = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date())
  const sent = message(
    `local.${conversationId}.${Date.now()}`,
    'outbound',
    'operator',
    whatsAppTextToDisplayHtml(whatsAppText),
    now
  )
  conversation.messages.push(sent)
  conversation.mode = 'human'
  conversation.assignedTo = 'Ana'
  conversation.lastMessageAt = now
  return structuredClone(conversation)
}

export async function retryAttendanceMessage(conversationId: string, externalId: string) {
  const conversation = conversations.find(item => item.id === conversationId)
  const target = conversation?.messages.find(item => item.externalId === externalId)
  if (!conversation || !target) throw new Error('Mensagem não encontrada.')

  // O identificador externo é preservado: uma retentativa atualiza o mesmo registro.
  target.processingStatus = 'processing'
  await wait(500)
  target.processingStatus = 'processed'
  return structuredClone(conversation)
}

export function resetAttendanceMock() {
  conversations = structuredClone(initialConversations)
}

export type AttendanceMode = 'automated' | 'human' | 'closed'
export type MessageDirection = 'inbound' | 'outbound'
export type MessageOrigin = 'customer' | 'automation' | 'operator'
export type MessageProcessingStatus = 'received' | 'processing' | 'processed' | 'failed' | 'ignored'
export type WhatsAppQuotaStatus = 'normal' | 'attention' | 'alert' | 'critical' | 'automation-blocked'

export interface AttendanceMessage {
  id: string
  externalId: string
  direction: MessageDirection
  origin: MessageOrigin
  content: string
  platformTimestamp: string
  receivedTimestamp: string
  processingStatus: MessageProcessingStatus
}

export interface AttendanceConversation {
  id: string
  customerId?: string
  customerName: string
  phone: string
  mode: AttendanceMode
  assignedTo?: string
  unreadCount: number
  lastMessageAt: string
  orderId?: number
  orderPreparation?: 'assembling' | 'ready-for-review'
  messages: AttendanceMessage[]
}

export interface WhatsAppQuotaUsage {
  businessPhoneNumber: string
  periodLabel: string
  freeServiceMessageLimit: number
  automationPauseAt: number
  deliveredServiceMessages: number
  reservedServiceMessages: number
  renewsAtLabel: string
  status: WhatsAppQuotaStatus
}

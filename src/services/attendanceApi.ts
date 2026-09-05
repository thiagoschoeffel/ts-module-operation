import { whatsAppTextToDisplayHtml } from '../domain/whatsappText.ts'
import type { AttendanceConversation, AttendanceMode, WhatsAppQuotaUsage } from '../types/attendance'
import type { AuthenticatedApiRequest } from './ordersApi'

interface ApiMessage { id: string, externalId: string, direction: 'Inbound' | 'Outbound', origin: 'Customer' | 'Automation' | 'Operator', content: string, platformTimestamp: string, receivedTimestamp: string, processingStatus: 'Received' | 'Processing' | 'Processed' | 'Failed' | 'Ignored', deliveryStatus: string, failureReason?: string }
interface ApiConversation { id: string, customerId?: string, customerName: string, phone: string, mode: 'Automated' | 'Human' | 'Closed', assignedTo?: string, unreadCount: number, lastMessageAt: string, orderId?: string, version: number, messages: ApiMessage[] }
interface ApiQuota { businessPhoneNumber: string, periodStart: string, freeServiceMessageLimit: number, automationPauseAt: number, deliveredServiceMessages: number, reservedServiceMessages: number, renewsAt: string, status: WhatsAppQuotaUsage['status'] }
interface ApiSnapshot { conversations: ApiConversation[], quota: ApiQuota }

async function json<T>(request: AuthenticatedApiRequest, path: string, init?: RequestInit): Promise<T> {
  const response = await request(path, init)
  if (!response.ok) { let message = 'Não foi possível concluir a operação.'; try { const body = await response.json() as { detail?: string, title?: string }; message = body.detail ?? body.title ?? message } catch { /* sem problem details */ } throw new Error(message) }
  return response.json() as Promise<T>
}
const headers = { 'Content-Type': 'application/json' }
const modeToApi = { automated: 'Automated', human: 'Human', closed: 'Closed' } as const
const date = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`))
const instant = (value: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
function conversation(value: ApiConversation): AttendanceConversation {
  return { ...value, orderId: value.orderId, mode: value.mode.toLowerCase() as AttendanceMode, lastMessageAt: instant(value.lastMessageAt), messages: value.messages.map(message => ({ ...message, direction: message.direction.toLowerCase() as 'inbound' | 'outbound', origin: message.origin.toLowerCase() as 'customer' | 'automation' | 'operator', content: whatsAppTextToDisplayHtml(message.content), platformTimestamp: instant(message.platformTimestamp), receivedTimestamp: instant(message.receivedTimestamp), processingStatus: message.processingStatus.toLowerCase() as AttendanceConversation['messages'][number]['processingStatus'], failureReason: message.failureReason })) }
}
function quota(value: ApiQuota): WhatsAppQuotaUsage { return { ...value, periodLabel: date(value.periodStart), renewsAtLabel: date(value.renewsAt) } }
export async function loadAttendance(request: AuthenticatedApiRequest) { const result = await json<ApiSnapshot>(request, '/api/attendance'); return { conversations: result.conversations.map(conversation), quota: quota(result.quota) } }
export async function changeAttendanceMode(request: AuthenticatedApiRequest, value: AttendanceConversation, mode: AttendanceMode) { return conversation(await json<ApiConversation>(request, `/api/attendance/conversations/${value.id}/mode`, { method: 'PUT', headers, body: JSON.stringify({ mode: modeToApi[mode], expectedVersion: value.version }) })) }
export async function sendAttendanceMessage(request: AuthenticatedApiRequest, id: string, text: string) { return conversation(await json<ApiConversation>(request, `/api/attendance/conversations/${id}/messages`, { method: 'POST', headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ content: text }) })) }
export async function retryAttendanceMessage(request: AuthenticatedApiRequest, conversationId: string, messageId: string) { return conversation(await json<ApiConversation>(request, `/api/attendance/conversations/${conversationId}/messages/${messageId}/retry`, { method: 'POST' })) }

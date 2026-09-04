<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRefs, watch } from 'vue'
import {
  Alert,
  ArrowLeftIcon,
  Avatar,
  Badge,
  BotIcon,
  Button,
  Card,
  CheckIcon,
  CircleAlertIcon,
  EmptyState,
  InboxIcon,
  Input,
  MessageCircleIcon,
  MinusIcon,
  RefreshCwIcon,
  SearchIcon,
  SendIcon,
  sanitizeRichText,
  ScrollArea,
  Tabs,
  Textarea,
  UserRoundIcon,
  type TabItem
} from '@thiagoschoeffel/ts-components'
import {
  changeAttendanceMode,
  loadAttendanceConversations,
  retryAttendanceMessage,
  sendAttendanceMessage
} from '../mocks/attendance'
import AttendanceSkeleton from '../components/attendance/AttendanceSkeleton.vue'
import { richTextToWhatsAppText } from '../domain/whatsappText'
import { operationalQuotaUsage } from '../domain/whatsappQuota'
import type { AttendanceConversation, AttendanceMessage, AttendanceMode, WhatsAppQuotaUsage } from '../types/attendance'
import { navigate } from '../utils/navigation'

type AttendanceFilter = 'open' | 'human' | 'failed' | 'closed'
type AttendanceScenario = 'default' | 'empty' | 'error' | 'loading'

const props = defineProps<{
  quotaUsage?: WhatsAppQuotaUsage
}>()
const { quotaUsage } = toRefs(props)

const params = new URLSearchParams(window.location.search)
const validFilters = new Set<AttendanceFilter>(['open', 'human', 'failed', 'closed'])
const requestedFilter = params.get('tab') as AttendanceFilter | null
const requestedConversationId = params.get('conversa') ?? ''
const scenario = (['empty', 'error', 'loading'].includes(params.get('mock') ?? '') ? params.get('mock') : 'default') as AttendanceScenario
const activeFilter = ref<AttendanceFilter>(requestedFilter && validFilters.has(requestedFilter) ? requestedFilter : 'open')
const search = ref(params.get('busca') ?? '')
const conversations = ref<AttendanceConversation[]>([])
const selectedId = ref(requestedConversationId)
const loading = ref(true)
const loadError = ref(false)
const errorScenarioConsumed = ref(false)
const mobileConversationOpen = ref(Boolean(requestedConversationId))
const messageDraft = ref('')
const sending = ref(false)
const updatingMode = ref(false)
const retryingMessageId = ref('')
const feedback = ref('')
const messageScrollArea = ref<{ $el: Element }>()
let feedbackTimeout: ReturnType<typeof setTimeout> | undefined

const tabs: TabItem[] = [
  { value: 'open', label: 'Em aberto' },
  { value: 'human', label: 'Com humano' },
  { value: 'failed', label: 'Falhas' },
  { value: 'closed', label: 'Encerradas' }
]

const selectedConversation = computed(() => conversations.value.find(item => item.id === selectedId.value))
const filteredConversations = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('pt-BR')
  return conversations.value.filter(conversation => {
    const matchesTab = activeFilter.value === 'open'
      ? conversation.mode !== 'closed'
      : activeFilter.value === 'human'
        ? conversation.mode === 'human'
        : activeFilter.value === 'failed'
          ? conversation.messages.some(message => message.processingStatus === 'failed')
          : conversation.mode === 'closed'
    const matchesSearch = !query
      || conversation.customerName.toLocaleLowerCase('pt-BR').includes(query)
      || conversation.phone.replace(/\D/g, '').includes(query.replace(/\D/g, ''))
    return matchesTab && matchesSearch
  })
})
const hasAnyConversation = computed(() => conversations.value.length > 0)
const quotaExhausted = computed(() => Boolean(
  quotaUsage.value
  && operationalQuotaUsage(quotaUsage.value) >= quotaUsage.value.freeServiceMessageLimit
))
const canSend = computed(() => Boolean(
  selectedConversation.value?.mode === 'human'
  && !quotaExhausted.value
  && sanitizeRichText(messageDraft.value).replace(/<[^>]*>/g, '').trim()
))

function modeLabel(mode: AttendanceMode) {
  return mode === 'automated' ? 'Automatizado' : mode === 'human' ? 'Humano' : 'Encerrado'
}

function modeVariant(mode: AttendanceMode) {
  return mode === 'automated' ? 'info' : mode === 'human' ? 'success' : 'neutral'
}

function processingLabel(status: AttendanceMessage['processingStatus']) {
  const labels = { received: 'Recebida', processing: 'Processando', processed: 'Processada', failed: 'Falhou', ignored: 'Ignorada' }
  return labels[status]
}

function processingVariant(status: AttendanceMessage['processingStatus']) {
  if (status === 'processed') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'processing' || status === 'received') return 'warning'
  return 'neutral'
}

function conversationInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0))
    .join('')
    .toLocaleUpperCase('pt-BR')
}

function tabCount(value: string) {
  if (value === 'open') return conversations.value.filter(item => item.mode !== 'closed').length
  if (value === 'human') return conversations.value.filter(item => item.mode === 'human').length
  if (value === 'failed') return conversations.value.filter(item => item.messages.some(message => message.processingStatus === 'failed')).length
  return conversations.value.filter(item => item.mode === 'closed').length
}

function scrollMessagesToBottom() {
  void nextTick(() => {
    requestAnimationFrame(() => {
      const viewport = messageScrollArea.value?.$el.querySelector<HTMLElement>('[data-reka-scroll-area-viewport]')
      if (viewport)
        viewport.scrollTop = viewport.scrollHeight
    })
  })
}

function sanitizedMessage(content: string) {
  return sanitizeRichText(content)
}

function selectConversation(id: string) {
  selectedId.value = id
  mobileConversationOpen.value = true
  const conversation = conversations.value.find(item => item.id === id)
  if (conversation) conversation.unreadCount = 0
}

function replaceConversation(updated: AttendanceConversation) {
  const index = conversations.value.findIndex(item => item.id === updated.id)
  if (index >= 0) conversations.value[index] = updated
}

function showFeedback(message: string) {
  feedback.value = message
  if (feedbackTimeout) clearTimeout(feedbackTimeout)
  feedbackTimeout = setTimeout(() => { feedback.value = '' }, 3000)
}

async function load() {
  loading.value = true
  loadError.value = false
  if (scenario === 'loading') return
  try {
    if (scenario === 'error' && !errorScenarioConsumed.value) {
      errorScenarioConsumed.value = true
      throw new Error('Falha demonstrativa.')
    }
    conversations.value = scenario === 'empty' ? [] : await loadAttendanceConversations()
    if (!conversations.value.some(item => item.id === selectedId.value))
      selectedId.value = conversations.value.find(item => item.mode !== 'closed')?.id ?? conversations.value[0]?.id ?? ''
    scrollMessagesToBottom()
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

async function setMode(mode: AttendanceMode) {
  if (!selectedConversation.value) return
  updatingMode.value = true
  try {
    replaceConversation(await changeAttendanceMode(selectedConversation.value.id, mode))
    showFeedback(mode === 'human' ? 'Atendimento assumido por Ana; automação pausada.' : mode === 'automated' ? 'Automação retomada.' : 'Conversa encerrada.')
  } finally {
    updatingMode.value = false
  }
}

async function sendMessage() {
  if (!selectedConversation.value || !canSend.value) return
  sending.value = true
  try {
    const whatsAppText = richTextToWhatsAppText(sanitizeRichText(messageDraft.value))
    replaceConversation(await sendAttendanceMessage(selectedConversation.value.id, whatsAppText))
    messageDraft.value = ''
    scrollMessagesToBottom()
    showFeedback('Mensagem enviada e registrada no histórico.')
  } finally {
    sending.value = false
  }
}

async function retryMessage(message: AttendanceMessage) {
  if (!selectedConversation.value) return
  retryingMessageId.value = message.id
  try {
    replaceConversation(await retryAttendanceMessage(selectedConversation.value.id, message.externalId))
    showFeedback('Mensagem reprocessada sem criar uma cópia.')
  } finally {
    retryingMessageId.value = ''
  }
}

function openOrder() {
  const conversation = selectedConversation.value
  if (!conversation) return
  const returnUrl = `/operacoes/atendimento?conversa=${encodeURIComponent(conversation.id)}`
  if (conversation.orderId) {
    navigate(`/operacoes/pedidos/${conversation.orderId}?retorno=${encodeURIComponent(returnUrl)}`)
    return
  }
  const customer = conversation.customerId ? `&cliente=${encodeURIComponent(conversation.customerId)}` : ''
  navigate(`/operacoes/pedidos/novo?retorno=${encodeURIComponent(returnUrl)}${customer}&origem=WhatsApp`)
}

watch([activeFilter, search, selectedId], () => {
  const url = new URL(window.location.href)
  activeFilter.value === 'open' ? url.searchParams.delete('tab') : url.searchParams.set('tab', activeFilter.value)
  search.value ? url.searchParams.set('busca', search.value) : url.searchParams.delete('busca')
  selectedId.value ? url.searchParams.set('conversa', selectedId.value) : url.searchParams.delete('conversa')
  window.history.replaceState(window.history.state, '', url)
})

watch([activeFilter, search], () => {
  if (!filteredConversations.value.some(item => item.id === selectedId.value))
    selectedId.value = filteredConversations.value[0]?.id ?? ''
})

watch(selectedId, scrollMessagesToBottom, { flush: 'post' })

onMounted(load)
onBeforeUnmount(() => { if (feedbackTimeout) clearTimeout(feedbackTimeout) })
</script>

<template>
  <div class="md:flex md:h-full md:min-h-0 md:flex-col">
    <Alert v-if="feedback" class="mb-4" variants="success" :description="feedback">
      <template #icon>
        <CheckIcon />
      </template>
    </Alert>

    <div class="min-h-0 flex-1 overflow-hidden">
      <AttendanceSkeleton v-if="loading" />

      <EmptyState v-else-if="loadError" title="Não foi possível carregar o atendimento"
        description="Tente novamente para recuperar as conversas." :bordered="false">
        <template #icon>
          <CircleAlertIcon />
        </template>
        <template #action><Button variant="secondary" @click="load">Tentar novamente</Button></template>
      </EmptyState>

      <EmptyState v-else-if="!hasAnyConversation" title="Nenhuma conversa recebida"
        description="As conversas iniciadas pelos clientes aparecerão aqui." :bordered="false">
        <template #icon>
          <InboxIcon />
        </template>
      </EmptyState>

      <div v-else
        class="attendance-layout grid h-full min-h-0 gap-4 bg-slate-50/70 md:grid-cols-[30rem_minmax(0,1fr)]">
        <aside :class="{ 'is-conversation-open': mobileConversationOpen }"
          class="attendance-master min-h-0 min-w-0 flex-col">
          <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <div class="overflow-x-auto pb-1">
              <Tabs v-model="activeFilter" :tabs="tabs" size="small" aria-label="Filtrar conversas">
                <template #badge="{ tab }">
                  <Badge variant="neutral" size="small">{{ tabCount(tab.value) }}</Badge>
                </template>
              </Tabs>
            </div>
            <Input v-model="search" class="mt-3" type="search" aria-label="Buscar conversa"
              placeholder="Buscar por nome ou telefone" clearable>
              <template #leading>
                <SearchIcon />
              </template>
            </Input>
          </div>

          <Card class="conversation-list-card mt-3 min-h-0 flex-1 [&>div]:min-h-0 [&>div]:p-0">
            <ScrollArea class="h-full min-h-0" scrollbar-visibility="auto" role="tablist"
              aria-label="Conversas do WhatsApp">
              <div class="space-y-1 pt-2 pr-4 pb-2 pl-2">
                <button v-for="conversation in filteredConversations" :key="conversation.id" type="button" role="tab"
                  :aria-selected="conversation.id === selectedId" :aria-controls="`attendance-panel-${conversation.id}`"
                  class="conversation-tab flex w-full cursor-pointer gap-3 border p-3 text-left transition-colors"
                  :class="conversation.id === selectedId ? 'rounded-lg border-slate-200 bg-white' : 'rounded-lg border-transparent bg-transparent hover:bg-slate-100/70'"
                  @click="selectConversation(conversation.id)">
                  <Avatar :fallback="conversationInitials(conversation.customerName)"
                    :alt-text="conversation.customerName" />
                  <span class="min-w-0 flex-1">
                    <span class="flex items-start justify-between gap-2">
                      <span class="truncate text-sm font-semibold text-slate-800">{{ conversation.customerName }}</span>
                      <span class="shrink-0 text-xs text-slate-400">{{ conversation.lastMessageAt }}</span>
                    </span>
                    <span class="mt-1 flex min-h-5 items-center justify-between gap-2">
                      <span class="truncate text-xs text-slate-500">{{ conversation.phone }}</span>
                      <span v-if="conversation.unreadCount"
                        class="inline-flex min-h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 text-[0.6875rem] font-semibold leading-none text-white"
                        :aria-label="`${conversation.unreadCount} mensagens não lidas`">{{ conversation.unreadCount
                        }}</span>
                    </span>
                    <Badge class="mt-2" :variant="modeVariant(conversation.mode)" size="small">{{
                      modeLabel(conversation.mode) }}</Badge>
                  </span>
                </button>

                <EmptyState v-if="!filteredConversations.length" size="small" title="Nenhuma conversa encontrada"
                  description="Altere a busca ou o filtro selecionado." :bordered="false">
                  <template #icon>
                    <SearchIcon />
                  </template>
                </EmptyState>
              </div>
            </ScrollArea>
          </Card>
        </aside>

        <section v-if="selectedConversation" :id="`attendance-panel-${selectedConversation.id}`" role="tabpanel"
          :class="{ 'is-conversation-open': mobileConversationOpen }"
          class="attendance-detail min-h-[32rem] min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs md:min-h-0">
          <header class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
            <div class="flex min-w-0 items-center gap-3">
              <button type="button" class="cursor-pointer text-slate-400 hover:text-slate-800 md:hidden"
                aria-label="Voltar para conversas" @click="mobileConversationOpen = false">
                <ArrowLeftIcon class="size-5" />
              </button>
              <div class="min-w-0">
                <h2 class="truncate font-semibold text-slate-800">{{ selectedConversation.customerName }}</h2>
                <p class="text-xs text-slate-500">{{ selectedConversation.phone }} · WhatsApp</p>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <Button variant="secondary" size="small" @click="openOrder">{{ selectedConversation.orderId ? `Ver pedido
                #${selectedConversation.orderId}` : 'Montar pedido aberto' }}</Button>
              <Button v-if="selectedConversation.mode === 'automated'" size="small" :loading="updatingMode"
                @click="setMode('human')"><template #icon>
                  <UserRoundIcon />
                </template>Assumir</Button>
              <Button v-else-if="selectedConversation.mode === 'human'" variant="secondary" size="small"
                :loading="updatingMode" :disabled="quotaUsage?.status === 'automation-blocked'"
                @click="setMode('automated')"><template #icon>
                  <BotIcon />
                </template>Retomar
                automação</Button>
              <Button v-else variant="secondary" size="small" :loading="updatingMode"
                @click="setMode('human')">Reabrir</Button>
            </div>
          </header>

          <div class="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
            <span v-if="selectedConversation.mode === 'human'">Atendimento humano por {{ selectedConversation.assignedTo
            }};
              a automação está pausada.</span>
            <span v-else-if="selectedConversation.mode === 'automated'">Automação ativa; respostas humanas detectadas
              pausam
              o fluxo.</span>
            <span v-else>Conversa encerrada; o histórico permanece disponível.</span>
          </div>

          <ScrollArea ref="messageScrollArea" class="conversation-history min-h-0 flex-1" scrollbar-visibility="auto"
            aria-live="polite">
            <div class="space-y-4 p-4 pr-6">
              <div v-for="message in selectedConversation.messages" :key="message.id" class="flex"
                :class="message.direction === 'outbound' ? 'justify-end' : 'justify-start'">
                <div class="max-w-[85%] rounded-lg border px-4 py-3 shadow-sm md:max-w-[70%]"
                  :class="message.direction === 'outbound' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'">
                  <div class="mb-1 flex items-center gap-2 text-xs text-slate-500">
                    <BotIcon v-if="message.origin === 'automation'" class="size-3.5" aria-hidden="true" />
                    <UserRoundIcon v-else-if="message.origin === 'operator'" class="size-3.5" aria-hidden="true" />
                    <MessageCircleIcon v-else class="size-3.5" aria-hidden="true" />
                    <span>{{ message.origin === 'automation' ? 'Automação' : message.origin === 'operator' ? 'Ana' :
                      selectedConversation.customerName }}</span>
                    <span>· {{ message.platformTimestamp }}</span>
                  </div>
                  <div class="text-sm text-slate-700 [&_p]:my-0" v-html="sanitizedMessage(message.content)" />
                  <div class="mt-2 flex items-center justify-end gap-2">
                    <Badge :variant="processingVariant(message.processingStatus)" size="small">
                      <span class="inline-flex items-center gap-1">
                        <CheckIcon v-if="message.processingStatus === 'processed'" class="size-3" aria-hidden="true" />
                        <RefreshCwIcon v-else-if="message.processingStatus === 'processing'" class="size-3 animate-spin"
                          aria-hidden="true" />
                        <InboxIcon v-else-if="message.processingStatus === 'received'" class="size-3"
                          aria-hidden="true" />
                        <CircleAlertIcon v-else-if="message.processingStatus === 'failed'" class="size-3"
                          aria-hidden="true" />
                        <MinusIcon v-else class="size-3" aria-hidden="true" />
                        {{ processingLabel(message.processingStatus) }}
                      </span>
                    </Badge>
                    <Button v-if="message.processingStatus === 'failed'" variant="secondary" size="small"
                      :loading="retryingMessageId === message.id" @click="retryMessage(message)"><template #icon>
                        <RefreshCwIcon />
                      </template>Reprocessar</Button>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <form v-if="selectedConversation.mode === 'human'" class="border-t border-slate-200 bg-white p-4"
            @submit.prevent="sendMessage">
            <Alert v-if="quotaExhausted" class="mb-3" variants="danger"
              description="A franquia gratuita terminou. O envio pela API está bloqueado até a renovação mensal ou a autorização explícita de custos.">
              <template #icon><CircleAlertIcon /></template>
            </Alert>
            <Textarea v-model="messageDraft" class="whatsapp-composer" rich-text :rows="3" resize="none"
              aria-label="Mensagem para o cliente" :disabled="quotaExhausted"
              description="Formatação compatível com o WhatsApp: negrito, itálico, tachado e listas."
              placeholder="Escreva uma mensagem..." />
            <div class="mt-3 flex justify-between gap-3">
              <Button type="button" variant="secondary" size="small" :loading="updatingMode"
                @click="setMode('closed')">Encerrar conversa</Button>
              <Button type="submit" size="small" :loading="sending" :disabled="!canSend"><template #icon>
                  <SendIcon />
                </template>Enviar</Button>
            </div>
          </form>
          <div v-else class="border-t border-slate-200 bg-white p-4 text-sm text-slate-500">
            {{ selectedConversation.mode === 'automated' ? 'Assuma o atendimento para responder manualmente.' : 'Reabra a conversa para enviar uma nova mensagem.' }}
          </div>
        </section>

        <EmptyState v-else class="hidden md:flex" title="Selecione uma conversa"
          description="Escolha uma conversa para ver o histórico e atender o cliente." :bordered="false">
          <template #icon>
            <MessageCircleIcon />
          </template>
        </EmptyState>
      </div>
    </div>
  </div>
</template>

<style scoped>
.attendance-master {
  display: flex;
}

.attendance-detail {
  display: none;
}

.attendance-master.is-conversation-open {
  display: none;
}

.attendance-detail.is-conversation-open {
  display: flex;
}

.conversation-list-card,
.conversation-history {
  background-color: color-mix(in oklab, var(--color-slate-50) 75%, var(--color-slate-100));
}

.whatsapp-composer :deep([role="toolbar"] > div),
.whatsapp-composer :deep([role="toolbar"] > span),
.whatsapp-composer :deep([aria-label="Sublinhado"]),
.whatsapp-composer :deep([aria-label="Alinhar à esquerda"]),
.whatsapp-composer :deep([aria-label="Centralizar"]),
.whatsapp-composer :deep([aria-label="Alinhar à direita"]),
.whatsapp-composer :deep([aria-label="Adicionar link"]),
.whatsapp-composer :deep([title="Cor do texto"]) {
  display: none;
}

@media (min-width: 48rem) {

  .attendance-layout>.attendance-master,
  .attendance-layout>.attendance-detail {
    display: flex;
  }
}
</style>

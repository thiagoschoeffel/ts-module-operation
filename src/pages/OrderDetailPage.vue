<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Alert,
  Badge,
  Button,
  Card,
  CheckIcon,
  ChevronLeftIcon,
  Drawer,
  PackageCheckIcon,
  Progress,
  sanitizeRichText,
  Select,
  Textarea,
  TriangleAlertIcon
} from '@thiagoschoeffel/ts-components'
import { formatAddressLocation, formatAddressStreet } from '../components/new-order/address'
import { formatCurrency, paymentConditionOptions, paymentMethodOptions } from '../components/new-order/mockData'
import {
  cancelOrderDetail,
  confirmOrderDetail,
  getOrderDetail,
  markOrderPacked,
  rescheduleOrderDelivery,
  type OrderAllowedAction,
  type OrderDetail,
  type OrderDetailStatus
} from '../mocks/orderDetail'

const props = defineProps<{ orderId?: string }>()
const emit = defineEmits<{
  loaded: [order: OrderDetail | undefined]
}>()

const loading = ref(true)
const loadFailed = ref(false)
const order = ref<OrderDetail>()
const confirmationOpen = ref(false)
const validating = ref(false)
const validationProgress = ref(0)
const validationComplete = ref(false)
const confirming = ref(false)
const confirmationFeedback = ref('')
const cancellationOpen = ref(false)
const cancellationReason = ref('')
const cancellationDetail = ref('')
const cancellationSubmitted = ref(false)
const cancelling = ref(false)
const packing = ref(false)
const rescheduleOpen = ref(false)
const rescheduleWindow = ref('')
const rescheduleReason = ref('Cliente ausente')
const rescheduleNote = ref('')
const rescheduleSubmitted = ref(false)
const rescheduling = ref(false)
let loadingTimeout: ReturnType<typeof setTimeout> | undefined
let validationTimeout: ReturnType<typeof setTimeout> | undefined
let validationProgressInterval: ReturnType<typeof setInterval> | undefined
let confirmationTimeout: ReturnType<typeof setTimeout> | undefined
let actionTimeout: ReturnType<typeof setTimeout> | undefined

const subtotal = computed(() => order.value?.items.reduce((total, item) => total + item.price, 0) ?? 0)
const total = computed(() => Math.max(0,
  subtotal.value
  + (order.value?.deliveryFee ?? 0)
  - (order.value?.planCreditValue ?? 0)
  - (order.value?.financialCreditValue ?? 0)
  - (order.value?.discountValue ?? 0)
))
const hasBlockingRestriction = computed(() => order.value?.items.some(item => item.hasRestrictionConflict) ?? false)
const itemCount = computed(() => order.value?.items.length ?? 0)
const sanitizedOrderNote = computed(() => sanitizeRichText(order.value?.note ?? ''))
function richTextPlainText(value?: string) { return sanitizeRichText(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() }
const paymentConditionLabel = computed(() => paymentConditionOptions.find(option => option.value === order.value?.paymentCondition)?.label)
const paymentMethodLabel = computed(() => paymentMethodOptions.find(option => option.value === order.value?.paymentMethod)?.label)
const paymentDueDateLabel = computed(() => order.value?.paymentDueDate
  ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${order.value.paymentDueDate}T12:00:00`))
  : undefined)
const operationalIssues = computed(() => {
  if (!order.value)
    return []
  const issues = [...order.value.pendingIssues]
  if (order.value.customer.channel !== 'Balcão' && !order.value.deliveryAddress)
    issues.push('Endereço não definido')
  if (order.value.customer.channel !== 'Balcão' && !order.value.deliveryWindow)
    issues.push('Janela de entrega não definida')
  if (hasBlockingRestriction.value)
    issues.push('Restrição alimentar')
  return [...new Set(issues)]
})
const canConfirm = computed(() => validationComplete.value && operationalIssues.value.length === 0)
const canCancel = computed(() => Boolean(
  cancellationReason.value
  && (cancellationReason.value !== 'other' || richTextPlainText(cancellationDetail.value))
))
const canReschedule = computed(() => Boolean(rescheduleWindow.value && richTextPlainText(rescheduleReason.value)))
const failedDeliveryAttempts = computed(() => order.value?.deliveryAttempts?.filter(attempt => attempt.result === 'failed') ?? [])
const rescheduleWindowOptions = computed(() => ['11:00–12:00', '12:00–13:00', '13:00–14:00', '14:00–15:00']
  .filter(window => window !== order.value?.deliveryWindow)
  .map(window => ({ value: window, label: window })))
const statusTimestamp = computed(() => {
  if (!order.value)
    return ''
  if (order.value.cancellation)
    return `Cancelado ${order.value.cancellation.occurredAt.toLocaleLowerCase('pt-BR')} por ${order.value.cancellation.actor}`
  if (order.value.completedAt)
    return `Concluído ${order.value.completedAt.toLocaleLowerCase('pt-BR')}`
  if (order.value.status === 'failed')
    return `Falha registrada ${order.value.deliveryAttempts?.at(-1)?.occurredAt.toLocaleLowerCase('pt-BR') ?? ''}`
  if (order.value.status === 'delivery')
    return `Em entrega · rota #${order.value.route?.id ?? '—'}`
  if (order.value.packedAt)
    return `Embalado ${order.value.packedAt.toLocaleLowerCase('pt-BR')} por ${order.value.packedBy}`
  if (order.value.status === 'packing')
    return 'Em embalagem · aguardando conferência'
  if (order.value.productionStartedAt)
    return `Em produção desde ${order.value.productionStartedAt.replace('Hoje às ', '')}`
  if (order.value.confirmedAt)
    return `Confirmado ${order.value.confirmedAt.toLocaleLowerCase('pt-BR')}`
  return `${order.value.createdAt} · ${order.value.customer.channel}`
})
const returnUrl = computed(() => {
  const candidate = new URLSearchParams(window.location.search).get('retorno')
  return candidate && /^\/operacoes\/pedidos(?:\?.*)?$/.test(candidate)
    ? candidate
    : '/operacoes/pedidos'
})

const statusPresentation: Record<OrderDetailStatus, {
  label: string
  variant: 'neutral' | 'info' | 'success' | 'danger'
}> = {
  open: { label: 'Aberto', variant: 'neutral' },
  confirmed: { label: 'Confirmado', variant: 'info' },
  'in-production': { label: 'Em produção', variant: 'info' },
  packing: { label: 'Em embalagem', variant: 'info' },
  delivery: { label: 'Em entrega', variant: 'info' },
  completed: { label: 'Concluído', variant: 'success' },
  failed: { label: 'Falha na entrega', variant: 'danger' },
  cancelled: { label: 'Cancelado', variant: 'neutral' }
}

function loadOrder() {
  if (loadingTimeout)
    clearTimeout(loadingTimeout)
  loading.value = true
  loadFailed.value = new URLSearchParams(window.location.search).get('falha') === 'carregamento'
  order.value = undefined
  emit('loaded', undefined)

  loadingTimeout = setTimeout(() => {
    loading.value = false
    if (loadFailed.value)
      return
    order.value = props.orderId ? getOrderDetail(props.orderId) : undefined
    emit('loaded', order.value)
  }, 350)
}

function goToOrders() {
  window.location.assign(returnUrl.value)
}

function retryLoad() {
  const url = new URL(window.location.href)
  url.searchParams.delete('falha')
  window.history.replaceState(window.history.state, '', url)
  loadOrder()
}

function editOrder() {
  if (order.value)
    window.location.assign(`/operacoes/pedidos/${order.value.id}/editar?retorno=${encodeURIComponent(returnUrl.value)}`)
}

function viewCustomer() {
  window.location.assign('/operacoes/atendimento')
}

function hasAction(action: OrderAllowedAction) {
  return order.value?.allowedActions.includes(action) ?? false
}

function openConfirmation() {
  if (validationTimeout)
    clearTimeout(validationTimeout)
  if (validationProgressInterval)
    clearInterval(validationProgressInterval)
  confirmationOpen.value = true
  validating.value = true
  validationProgress.value = 0
  validationComplete.value = false
  validationProgressInterval = setInterval(() => {
    validationProgress.value = Math.min(100, validationProgress.value + (100 / 30))
    if (validationProgress.value < 100)
      return

    if (validationProgressInterval)
      clearInterval(validationProgressInterval)
    validationProgressInterval = undefined
    validationTimeout = setTimeout(() => {
      validating.value = false
      validationComplete.value = true
    }, 250)
  }, 100)
}

function confirmOrder(close: () => void) {
  if (!order.value || !canConfirm.value)
    return
  confirming.value = true
  confirmationTimeout = setTimeout(() => {
    if (!order.value)
      return
    order.value = confirmOrderDetail(order.value)
    confirming.value = false
    confirmationFeedback.value = `Pedido #${order.value.id} confirmado`
    emit('loaded', order.value)
    close()
  }, 650)
}

function openCancellation() {
  cancellationReason.value = ''
  cancellationDetail.value = ''
  cancellationSubmitted.value = false
  cancellationOpen.value = true
}

function cancelOrder(close: () => void) {
  cancellationSubmitted.value = true
  if (!order.value || !canCancel.value)
    return
  cancelling.value = true
  actionTimeout = setTimeout(() => {
    if (!order.value)
      return
    const id = order.value.id
    order.value = cancelOrderDetail(order.value, cancellationReason.value, cancellationDetail.value)
    cancelling.value = false
    confirmationFeedback.value = `Pedido #${id} cancelado`
    emit('loaded', order.value)
    close()
  }, 650)
}

function markPacked() {
  if (!order.value)
    return
  packing.value = true
  actionTimeout = setTimeout(() => {
    if (!order.value)
      return
    order.value = markOrderPacked(order.value)
    packing.value = false
    confirmationFeedback.value = `Pedido #${order.value.id} marcado como embalado`
    emit('loaded', order.value)
  }, 550)
}

function openReschedule() {
  rescheduleWindow.value = ''
  rescheduleReason.value = order.value?.deliveryAttempts?.at(-1)?.reason ?? 'Cliente ausente'
  rescheduleNote.value = ''
  rescheduleSubmitted.value = false
  rescheduleOpen.value = true
}

function rescheduleOrder(close: () => void) {
  rescheduleSubmitted.value = true
  if (!order.value || !canReschedule.value)
    return
  rescheduling.value = true
  actionTimeout = setTimeout(() => {
    if (!order.value)
      return
    order.value = rescheduleOrderDelivery(order.value, rescheduleWindow.value, rescheduleReason.value, rescheduleNote.value)
    rescheduling.value = false
    confirmationFeedback.value = `Entrega do pedido #${order.value.id} reagendada`
    emit('loaded', order.value)
    close()
  }, 650)
}

watch(() => props.orderId, loadOrder)
onMounted(loadOrder)
onBeforeUnmount(() => {
  if (loadingTimeout) clearTimeout(loadingTimeout)
  if (validationTimeout) clearTimeout(validationTimeout)
  if (validationProgressInterval) clearInterval(validationProgressInterval)
  if (confirmationTimeout) clearTimeout(confirmationTimeout)
  if (actionTimeout) clearTimeout(actionTimeout)
})
</script>

<template>
  <section aria-label="Detalhe do pedido">
    <div v-if="loading" class="animate-pulse space-y-4" aria-label="Carregando pedido">
      <div class="flex items-center justify-between gap-4">
        <div class="h-5 w-52 rounded bg-slate-200"></div>
        <div class="h-9 w-48 rounded-lg bg-slate-200"></div>
      </div>
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div class="space-y-4">
          <div v-for="index in 3" :key="index" class="h-44 rounded-xl border border-slate-200 bg-white shadow-xs"></div>
        </div>
        <div class="h-80 rounded-xl border border-slate-200 bg-white shadow-xs"></div>
      </div>
    </div>

    <Card v-else-if="loadFailed || !order" class="mx-auto max-w-xl">
      <div class="py-5 text-center">
        <TriangleAlertIcon class="mx-auto size-8 text-slate-400" aria-hidden="true" />
        <h2 class="mt-4 text-lg font-semibold text-slate-900">
          {{ loadFailed ? 'Não foi possível carregar o pedido' : 'Pedido não encontrado' }}
        </h2>
        <p class="mt-2 text-sm text-slate-500">
          {{ loadFailed ? 'Verifique a conexão e tente novamente.' : 'O pedido solicitado não existe ou não está mais disponível.' }}
        </p>
        <div class="mt-5 flex flex-wrap justify-center gap-3">
          <Button v-if="loadFailed" type="button" @click="retryLoad">Tentar novamente</Button>
          <Button type="button" variant="secondary" @click="goToOrders">Voltar para pedidos</Button>
        </div>
      </div>
    </Card>

    <template v-else>
      <Alert
        v-if="confirmationFeedback"
        class="mb-4"
        variants="success"
        :description="confirmationFeedback"
        closable
        @close="confirmationFeedback = ''">
        <template #icon><CheckIcon /></template>
      </Alert>

      <div class="ts-responsive-row mb-5 gap-4">
        <div class="flex flex-col items-start gap-2">
          <p class="font-medium text-slate-800">{{ order.customer.name }}</p>
          <p class="text-sm text-slate-500">{{ statusTimestamp }}</p>
          <div class="flex flex-wrap items-center gap-2">
            <Badge size="medium" :variant="statusPresentation[order.status].variant">
              {{ statusPresentation[order.status].label }}
            </Badge>
            <Badge v-if="order.readyForReview" size="medium" variant="warning">Pronto para revisão</Badge>
          </div>
        </div>
        <div class="flex flex-col gap-3 sm:items-end">
          <button
            type="button"
            class="order-2 inline-flex cursor-pointer items-center gap-1 self-start text-sm font-medium text-slate-400 transition-colors hover:text-slate-800 sm:hidden"
            @click="goToOrders">
            <ChevronLeftIcon class="size-4" aria-hidden="true" />
            Voltar para pedidos
          </button>
          <div v-if="order.allowedActions.length" class="order-1 flex flex-wrap justify-end gap-3">
            <Button v-if="hasAction('edit')" type="button" variant="secondary" @click="editOrder">Editar pedido</Button>
            <Button v-if="hasAction('confirm')" type="button" @click="openConfirmation">Confirmar pedido</Button>
            <Button v-if="hasAction('reschedule')" type="button" @click="openReschedule">Reagendar entrega</Button>
            <Button v-if="hasAction('mark-packed')" type="button" :loading="packing" @click="markPacked">
              <template #icon><PackageCheckIcon /></template>
              Marcar como embalado
            </Button>
            <Button v-if="hasAction('cancel')" type="button" variant="danger" @click="openCancellation">Cancelar pedido</Button>
          </div>
        </div>
      </div>

      <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div class="min-w-0 space-y-4">
          <Card v-if="order.status === 'confirmed'">
            <template #header><h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Operação</h2></template>
            <p class="flex items-center gap-2 font-medium text-emerald-700"><CheckIcon class="size-4" /> Pedido confirmado</p>
            <p class="mt-2 text-slate-500">Aguardando produção.</p>
          </Card>

          <Card v-else-if="order.status === 'in-production'">
            <template #header><h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Produção</h2></template>
            <p class="font-semibold text-slate-900">Em produção</p>
            <p class="mt-2 text-slate-500">Necessidade deste pedido: {{ itemCount }} {{ itemCount === 1 ? 'refeição' : 'refeições' }}.</p>
          </Card>

          <Card v-else-if="order.status === 'packing'">
            <template #header><h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Embalagem</h2></template>
            <template v-if="order.packedAt">
              <p class="flex items-center gap-2 font-medium text-emerald-700"><CheckIcon class="size-4" /> Embalagem concluída</p>
              <p class="mt-2 text-slate-500">Embalado {{ order.packedAt.toLocaleLowerCase('pt-BR') }} por {{ order.packedBy }}. Aguardando inclusão em rota.</p>
            </template>
            <template v-else>
              <p class="font-semibold text-slate-900">Confira os itens antes de finalizar.</p>
              <p class="mt-2 text-slate-500">{{ itemCount }} {{ itemCount === 1 ? 'item' : 'itens' }} para conferência.</p>
            </template>
          </Card>

          <Card v-else-if="order.status === 'delivery' && order.route">
            <template #header><h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Entrega</h2></template>
            <div class="grid gap-5 sm:grid-cols-2">
              <div><p class="text-xs font-medium uppercase tracking-wide text-slate-400">Rota</p><p class="mt-1 font-semibold text-slate-900">#{{ order.route.id }} · Em execução</p></div>
              <div><p class="text-xs font-medium uppercase tracking-wide text-slate-400">Entregador</p><p class="mt-1 font-medium text-slate-700">{{ order.route.driver }}</p></div>
              <div><p class="text-xs font-medium uppercase tracking-wide text-slate-400">Janela</p><p class="mt-1 font-medium text-slate-700">{{ order.deliveryWindow }}</p></div>
              <div><p class="text-xs font-medium uppercase tracking-wide text-slate-400">Parada</p><p class="mt-1 font-medium text-slate-700">{{ order.route.stop }} de {{ order.route.stopCount }}</p></div>
            </div>
          </Card>

          <Card v-else-if="order.status === 'completed'">
            <template #header><h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Entrega</h2></template>
            <p class="flex items-center gap-2 font-medium text-emerald-700"><CheckIcon class="size-4" /> Entrega concluída</p>
            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <div><p class="text-xs font-medium uppercase tracking-wide text-slate-400">Entregador</p><p class="mt-1 text-slate-700">{{ order.route?.driver ?? 'Não informado' }}</p></div>
              <div><p class="text-xs font-medium uppercase tracking-wide text-slate-400">Horário</p><p class="mt-1 text-slate-700">{{ order.completedAt }}</p></div>
            </div>
          </Card>

          <Card v-if="failedDeliveryAttempts.length">
            <template #header><h2 class="text-xs font-semibold uppercase tracking-wider text-red-600">Falhas de entrega</h2></template>
            <div class="space-y-4">
              <div v-for="attempt in failedDeliveryAttempts" :key="attempt.id" class="grid gap-4 sm:grid-cols-2">
                <div><p class="text-xs font-medium uppercase tracking-wide text-slate-400">Tentativa</p><p class="mt-1 font-medium text-slate-800">{{ attempt.occurredAt }}</p></div>
                <div><p class="text-xs font-medium uppercase tracking-wide text-slate-400">Motivo</p><p class="mt-1 font-medium text-red-700">{{ attempt.reason }}</p></div>
                <div><p class="text-xs font-medium uppercase tracking-wide text-slate-400">Entregador</p><p class="mt-1 text-slate-700">{{ attempt.driver }}</p></div>
                <div><p class="text-xs font-medium uppercase tracking-wide text-slate-400">Rota</p><p class="mt-1 text-slate-700">#{{ attempt.routeId }}</p></div>
                <div v-if="attempt.note"><p class="text-xs font-medium uppercase tracking-wide text-slate-400">Observação</p><div class="mt-1 space-y-2 whitespace-pre-line text-slate-700 [&_a]:text-blue-600 [&_a]:underline [&_blockquote]:border-l-3 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_em]:italic [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_s]:line-through [&_strong]:font-semibold [&_u]:underline [&_ul]:list-disc [&_ul]:pl-6" v-html="sanitizeRichText(attempt.note)" /></div>
              </div>
            </div>
          </Card>

          <Card v-if="order.reschedule">
            <template #header><h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Nova tentativa</h2></template>
            <p class="font-medium text-emerald-700">Entrega reagendada</p>
            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <div><p class="text-xs font-medium uppercase tracking-wide text-slate-400">Janela anterior</p><p class="mt-1 text-slate-700">{{ order.reschedule.previousWindow }}</p></div>
              <div><p class="text-xs font-medium uppercase tracking-wide text-slate-400">Nova janela</p><p class="mt-1 font-medium text-slate-900">{{ order.reschedule.newWindow }}</p></div>
              <div><p class="text-xs font-medium uppercase tracking-wide text-slate-400">Motivo</p><div class="mt-1 space-y-2 text-slate-700 [&_a]:text-blue-600 [&_a]:underline [&_blockquote]:border-l-3 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_em]:italic [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_s]:line-through [&_strong]:font-semibold [&_u]:underline [&_ul]:list-disc [&_ul]:pl-5" v-html="sanitizeRichText(order.reschedule.reason)" /></div>
              <div><p class="text-xs font-medium uppercase tracking-wide text-slate-400">Responsável</p><p class="mt-1 text-slate-700">{{ order.reschedule.actor }}</p></div>
              <div v-if="order.reschedule.note" class="sm:col-span-2"><p class="text-xs font-medium uppercase tracking-wide text-slate-400">Observação</p><div class="mt-1 space-y-2 text-slate-700 [&_a]:text-blue-600 [&_a]:underline [&_blockquote]:border-l-3 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_em]:italic [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_s]:line-through [&_strong]:font-semibold [&_u]:underline [&_ul]:list-disc [&_ul]:pl-5" v-html="sanitizeRichText(order.reschedule.note)" /></div>
            </div>
          </Card>

          <Card v-if="order.status === 'cancelled' && order.cancellation">
            <template #header><h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Cancelamento</h2></template>
            <div class="grid gap-5 sm:grid-cols-2">
              <div><p class="text-xs font-medium uppercase tracking-wide text-slate-400">Motivo</p><p class="mt-1 font-medium text-slate-800">{{ order.cancellation.reason }}</p><div v-if="order.cancellation.detail" class="mt-1 space-y-2 text-slate-500 [&_a]:text-blue-600 [&_a]:underline [&_blockquote]:border-l-3 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_em]:italic [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_s]:line-through [&_strong]:font-semibold [&_u]:underline [&_ul]:list-disc [&_ul]:pl-5" v-html="sanitizeRichText(order.cancellation.detail)" /></div>
              <div><p class="text-xs font-medium uppercase tracking-wide text-slate-400">Estágio no cancelamento</p><p class="mt-1 font-medium text-slate-800">{{ order.cancellation.stageLabel }}</p></div>
              <div><p class="text-xs font-medium uppercase tracking-wide text-slate-400">Responsável</p><p class="mt-1 text-slate-700">{{ order.cancellation.actor }}</p></div>
              <div><p class="text-xs font-medium uppercase tracking-wide text-slate-400">Data e hora</p><p class="mt-1 text-slate-700">{{ order.cancellation.occurredAt }}</p></div>
            </div>
            <div v-if="order.cancellation.effects.length" class="mt-5 border-t border-slate-100 pt-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Efeitos</p>
              <p v-for="effect in order.cancellation.effects" :key="effect" class="mt-2 flex items-start gap-2 text-slate-700"><CheckIcon class="mt-0.5 size-4 shrink-0 text-emerald-600" />{{ effect }}</p>
            </div>
          </Card>

          <Card>
            <template #header><h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Cliente</h2></template>
            <div class="grid gap-5 sm:grid-cols-2">
              <div>
                <p class="font-semibold text-slate-900">{{ order.customer.name }}</p>
                <p class="mt-1 text-slate-500">{{ order.customer.phone }}</p>
              </div>
              <div>
                <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Origem</p>
                <p class="mt-1 font-medium text-slate-700">{{ order.customer.channel }}</p>
              </div>
              <div v-if="order.customer.preference">
                <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Preferência do cliente</p>
                <p class="mt-1 text-slate-700">{{ order.customer.preference }}</p>
              </div>
              <div v-if="order.customer.restriction">
                <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Restrição alimentar</p>
                <p class="mt-1 flex items-center gap-2 font-medium text-amber-700">
                  <TriangleAlertIcon class="size-4" aria-hidden="true" />{{ order.customer.restriction }}
                </p>
              </div>
            </div>
            <template #footer>
              <Button type="button" variant="secondary" size="small" @click="viewCustomer">Ver cliente</Button>
            </template>
          </Card>

          <Card>
            <template #header><h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Entrega</h2></template>
            <div class="grid gap-5 sm:grid-cols-3">
              <div class="sm:col-span-2">
                <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Endereço</p>
                <template v-if="order.deliveryAddress">
                  <p class="mt-1 font-semibold text-slate-900">{{ order.deliveryAddress.label }}</p>
                  <p class="mt-1 text-slate-600">{{ formatAddressStreet(order.deliveryAddress) }}</p>
                  <p class="text-slate-500">{{ formatAddressLocation(order.deliveryAddress) }}</p>
                  <p v-if="order.deliveryAddress.referencePoint" class="mt-2 text-xs text-slate-500">Referência: {{ order.deliveryAddress.referencePoint }}</p>
                </template>
                <p v-else class="mt-1 flex items-start gap-2 font-medium text-amber-700">
                  <TriangleAlertIcon class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  Endereço não definido
                </p>
              </div>
              <div class="space-y-4">
                <div><p class="text-xs font-medium uppercase tracking-wide text-slate-400">Janela</p><p class="mt-1 font-medium text-slate-700">{{ order.deliveryWindow ?? 'Não definida' }}</p></div>
                <div><p class="text-xs font-medium uppercase tracking-wide text-slate-400">Taxa</p><p class="mt-1 font-medium text-slate-700">{{ formatCurrency(order.deliveryFee) }}</p></div>
              </div>
            </div>
          </Card>

          <Card aria-labelledby="order-items-title">
            <template #header>
              <h2 id="order-items-title" class="text-xs font-semibold uppercase tracking-wider text-slate-500">Itens do pedido</h2>
            </template>
            <div class="space-y-3">
              <article
                v-for="item in order.items"
                :key="item.id"
                class="rounded-lg border border-slate-200 bg-white p-4">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <h3 class="font-semibold text-slate-800">{{ item.name }}</h3>
                    <p v-for="detail in item.details" :key="detail" class="mt-1 text-sm text-slate-500">{{ detail }}</p>
                  </div>
                  <p class="shrink-0 font-semibold text-slate-800">{{ formatCurrency(item.price) }}</p>
                </div>
                <div v-if="item.customizations.length || item.additions.length" class="mt-4 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
                  <div v-if="item.customizations.length">
                    <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Personalização</p>
                    <p v-for="customization in item.customizations" :key="customization" class="mt-1 text-sm text-slate-600">{{ customization }}</p>
                  </div>
                  <div v-if="item.additions.length">
                    <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Adicional</p>
                    <p v-for="addition in item.additions" :key="addition" class="mt-1 text-sm text-slate-600">{{ addition }}</p>
                  </div>
                </div>
                <Alert
                  v-if="order.customer.restriction"
                  class="mt-4"
                  :variants="item.hasRestrictionConflict ? 'danger' : 'success'"
                  :title="item.hasRestrictionConflict ? 'Revisão necessária' : 'Restrição alimentar verificada'"
                  :description="item.hasRestrictionConflict ? `${order.customer.name} possui restrição a ${order.customer.restriction.toLocaleLowerCase('pt-BR')} e este item tem uma incompatibilidade.` : `Composição verificada para a restrição a ${order.customer.restriction.toLocaleLowerCase('pt-BR')}: sem incompatibilidades.`">
                  <template #icon><TriangleAlertIcon v-if="item.hasRestrictionConflict" /><CheckIcon v-else /></template>
                </Alert>
              </article>
            </div>
          </Card>

          <Card>
            <template #header><h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Financeiro</h2></template>
            <div class="grid gap-5 sm:grid-cols-3">
              <div>
                <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Condição de pagamento</p>
                <p class="mt-1 font-medium text-slate-800">{{ paymentConditionLabel }}</p>
              </div>
              <div>
                <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Forma de pagamento</p>
                <p class="mt-1 font-medium text-slate-800">{{ paymentMethodLabel }}</p>
              </div>
              <div v-if="paymentDueDateLabel">
                <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Vencimento</p>
                <p class="mt-1 font-medium text-slate-800">{{ paymentDueDateLabel }}</p>
              </div>
            </div>

            <dl class="mt-5 grid gap-y-3 border-t border-slate-100 pt-4 sm:grid-cols-2 sm:gap-x-10">
              <div class="flex justify-between gap-4"><dt>Subtotal</dt><dd class="font-medium text-slate-800">{{ formatCurrency(subtotal) }}</dd></div>
              <div class="flex justify-between gap-4"><dt>Taxa de entrega</dt><dd class="font-medium text-slate-800">{{ formatCurrency(order.deliveryFee) }}</dd></div>
              <div v-if="order.planCreditValue" class="flex justify-between gap-4"><dt>Crédito de plano</dt><dd class="font-medium text-emerald-700">− {{ formatCurrency(order.planCreditValue) }}</dd></div>
              <div v-if="order.financialCreditValue" class="flex justify-between gap-4"><dt>Crédito financeiro</dt><dd class="font-medium text-emerald-700">− {{ formatCurrency(order.financialCreditValue) }}</dd></div>
              <div v-if="order.discountValue" class="flex justify-between gap-4"><dt>Desconto manual</dt><dd class="font-medium text-emerald-700">− {{ formatCurrency(order.discountValue) }}</dd></div>
              <div class="flex justify-between gap-4 font-semibold text-slate-900"><dt>Total financeiro</dt><dd>{{ formatCurrency(total) }}</dd></div>
            </dl>

            <div v-if="order.discountReason" class="mt-4 rounded-lg bg-slate-50 p-3">
              <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Motivo do desconto</p>
              <p class="mt-1 text-slate-700">{{ order.discountReason }}</p>
            </div>
          </Card>

          <Card v-if="order.note">
            <template #header><h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Observação</h2></template>
            <div
              class="space-y-2 whitespace-pre-line text-slate-700 [&_a]:text-blue-600 [&_a]:underline [&_blockquote]:border-l-3 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_em]:italic [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_s]:line-through [&_strong]:font-semibold [&_u]:underline [&_ul]:list-disc [&_ul]:pl-6"
              v-html="sanitizedOrderNote" />
          </Card>
        </div>

        <aside class="min-w-0 lg:sticky lg:top-6">
          <Card>
            <template #header><h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Resumo do pedido</h2></template>
            <div class="space-y-5">
              <p class="font-medium text-slate-800">{{ itemCount }} {{ itemCount === 1 ? 'item' : 'itens' }}</p>
              <dl class="space-y-3">
                <div class="flex justify-between gap-4"><dt>Subtotal</dt><dd class="font-medium text-slate-800">{{ formatCurrency(subtotal) }}</dd></div>
                <div v-if="order.planCreditCount" class="flex justify-between gap-4"><dt>Crédito de plano</dt><dd class="font-medium text-slate-800">{{ order.planCreditCount }} créditos</dd></div>
                <div v-if="order.discountValue" class="flex justify-between gap-4"><dt>Desconto</dt><dd class="font-medium text-emerald-700">− {{ formatCurrency(order.discountValue) }}</dd></div>
                <div class="flex justify-between gap-4"><dt>Taxa de entrega</dt><dd class="font-medium text-slate-800">{{ formatCurrency(order.deliveryFee) }}</dd></div>
                <div class="flex justify-between gap-4 border-t border-slate-200 pt-3"><dt class="font-semibold text-slate-900">Total financeiro</dt><dd class="font-semibold text-slate-900">{{ formatCurrency(total) }}</dd></div>
              </dl>
              <div v-if="order.planCreditCount" class="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                <p class="font-semibold text-slate-700">{{ order.status === 'open' ? 'Crédito sugerido' : 'Crédito consumido' }}</p>
                <p class="mt-1">{{ order.planCreditCount }} créditos{{ order.status === 'open' ? ' · serão consumidos somente na confirmação' : '' }}</p>
              </div>
              <div v-if="!['completed', 'cancelled'].includes(order.status)" class="border-t border-slate-200 pt-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Pendências</p>
                <div v-if="operationalIssues.length" class="mt-3 space-y-2">
                  <p v-for="issue in operationalIssues" :key="issue" class="flex items-center gap-2 font-medium text-amber-700">
                    <TriangleAlertIcon class="size-4 shrink-0" /> {{ issue }}
                  </p>
                </div>
                <p v-else class="mt-3 flex items-center gap-2 font-medium text-emerald-700">
                  <CheckIcon class="size-4" />
                  {{ order.status === 'open' ? 'Pedido pronto para confirmação' : 'Sem pendências operacionais' }}
                </p>
              </div>
              <Button v-if="hasAction('confirm')" class="w-full" type="button" @click="openConfirmation">Confirmar pedido</Button>
            </div>
          </Card>
        </aside>
      </div>

      <section class="mt-6" aria-labelledby="order-history-title">
        <Card>
          <template #header><h2 id="order-history-title" class="text-xs font-semibold uppercase tracking-wider text-slate-500">Histórico</h2></template>
          <ol class="divide-y divide-slate-100">
            <li v-for="entry in order.history" :key="entry.id" class="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[7rem_minmax(0,1fr)_8rem] sm:gap-4">
              <time class="text-xs font-medium text-slate-400">{{ entry.time }}</time>
              <p class="font-medium text-slate-800">{{ entry.title }}</p>
              <p class="text-sm text-slate-500 sm:text-right">{{ entry.actor }}</p>
            </li>
          </ol>
        </Card>
      </section>

      <Drawer
        :open="confirmationOpen"
        side="right"
        size="large"
        :title="`Confirmar pedido #${order.id}`"
        description="Confira os efeitos desta confirmação."
        @update:open="confirmationOpen = $event">
        <template #trigger><button type="button" class="hidden" tabindex="-1" aria-hidden="true"></button></template>
        <div class="space-y-5">
          <div class="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-3">
            <p class="text-slate-400">Cliente</p><p class="font-medium text-slate-800">{{ order.customer.name }}</p>
            <p class="text-slate-400">Entrega</p><p class="font-medium text-slate-800">{{ order.deliveryWindow ?? 'Não definida' }}</p>
            <p class="text-slate-400">Itens</p><p class="font-medium text-slate-800">{{ itemCount }}</p>
          </div>
          <div v-if="validating" class="space-y-3" role="status">
            <p class="font-medium text-slate-700">Verificando pedido...</p>
            <Progress
              :value="validationProgress"
              variant="info"
              size="small"
              label="Verificando pedido" />
          </div>
          <template v-else-if="validationComplete">
            <Alert
              v-if="operationalIssues.length"
              variants="danger"
              title="Não é possível confirmar este pedido"
              :description="operationalIssues.join(' · ')">
              <template #icon><TriangleAlertIcon /></template>
              <template #actions><Button type="button" variant="secondary" size="small" @click="editOrder">Editar pedido</Button></template>
            </Alert>
            <div v-else class="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
              <p class="flex items-center gap-2 font-medium"><CheckIcon class="size-4" /> Capacidade disponível</p>
              <p class="flex items-center gap-2 font-medium"><CheckIcon class="size-4" /> Restrições verificadas</p>
            </div>
            <div class="space-y-2 border-t border-slate-200 pt-4">
              <p><span class="font-medium text-slate-800">Plano:</span> {{ order.planCreditCount }} créditos serão consumidos</p>
              <p><span class="font-medium text-slate-800">Financeiro:</span> {{ formatCurrency(total) }} será devido</p>
            </div>
          </template>
        </div>
        <template #footer="{ close }">
          <div class="flex justify-end">
            <Button type="button" :disabled="!canConfirm" :loading="confirming" @click="confirmOrder(close)">Confirmar pedido</Button>
          </div>
        </template>
      </Drawer>

      <Drawer
        :open="cancellationOpen"
        side="right"
        size="large"
        :title="`Cancelar pedido #${order.id}`"
        :description="`${order.customer.name} · ${itemCount} ${itemCount === 1 ? 'item' : 'itens'} · Entrega ${order.deliveryWindow ?? 'não definida'}`"
        @update:open="cancellationOpen = $event">
        <template #trigger><button type="button" class="hidden" tabindex="-1" aria-hidden="true"></button></template>
        <div class="space-y-5">
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Estágio atual</p>
            <p class="mt-1 font-semibold text-slate-900">{{ order.cancellationPreview?.stageLabel }}</p>
          </div>

          <Alert
            v-if="order.cancellationPreview?.warning"
            variants="warning"
            title="Pedido já em produção"
            :description="order.cancellationPreview.warning">
            <template #icon><TriangleAlertIcon /></template>
          </Alert>

          <Select
            v-model="cancellationReason"
            label="Motivo"
            placeholder="Selecione o motivo"
            :options="order.cancellationReasons"
            :error="cancellationSubmitted && !cancellationReason ? 'Informe o motivo do cancelamento.' : undefined"
            required />

          <Textarea
            v-if="cancellationReason === 'other'"
            v-model="cancellationDetail"
            label="Descreva o motivo"
            rich-text
            placeholder="Informe o que motivou o cancelamento"
            :rows="3"
            :error="cancellationSubmitted && !richTextPlainText(cancellationDetail) ? 'Descreva o motivo do cancelamento.' : undefined"
            required />

          <div v-if="order.cancellationPreview" class="border-t border-slate-200 pt-5">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Efeitos desta operação</h3>
            <ul class="mt-3 space-y-3">
              <li v-for="effect in order.cancellationPreview.effects" :key="effect" class="flex items-start gap-2 text-slate-700">
                <CheckIcon class="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                {{ effect }}
              </li>
            </ul>
          </div>
        </div>
        <template #footer="{ close }">
          <div class="flex justify-end">
            <Button type="button" variant="danger" :loading="cancelling" @click="cancelOrder(close)">
              {{ cancelling ? 'Cancelando...' : 'Cancelar pedido' }}
            </Button>
          </div>
        </template>
      </Drawer>

      <Drawer
        :open="rescheduleOpen"
        side="right"
        size="large"
        title="Reagendar entrega"
        :description="`Pedido #${order.id} · ${order.customer.name}`"
        @update:open="rescheduleOpen = $event">
        <template #trigger><button type="button" class="hidden" tabindex="-1" aria-hidden="true"></button></template>
        <div class="space-y-5">
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Janela anterior</p>
            <p class="mt-1 font-semibold text-slate-900">{{ order.deliveryWindow }}</p>
          </div>
          <Select
            v-model="rescheduleWindow"
            label="Nova janela"
            placeholder="Selecione uma janela"
            :options="rescheduleWindowOptions"
            :error="rescheduleSubmitted && !rescheduleWindow ? 'Informe a nova janela.' : undefined"
            required />
          <Textarea
            v-model="rescheduleReason"
            label="Motivo"
            rich-text
            :rows="2"
            :error="rescheduleSubmitted && !richTextPlainText(rescheduleReason) ? 'Informe o motivo do reagendamento.' : undefined"
            required />
          <Textarea v-model="rescheduleNote" label="Observação" rich-text placeholder="Informação útil para a nova tentativa" :rows="3" />
        </div>
        <template #footer="{ close }">
          <div class="flex justify-end">
            <Button type="button" :loading="rescheduling" @click="rescheduleOrder(close)">
              {{ rescheduling ? 'Reagendando...' : 'Reagendar' }}
            </Button>
          </div>
        </template>
      </Drawer>
    </template>
  </section>
</template>

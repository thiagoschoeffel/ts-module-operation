<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Alert, Badge, Button, Card, CheckIcon, Drawer, EmptyState, Input, sanitizeRichText, Textarea, TriangleAlertIcon } from '@thiagoschoeffel/ts-components'
import { cancelOrder, confirmOrder, getDailyCapacity, getOrder, orderStatusPresentation, rescheduleOrder, shortOrderId, type ApiDailyCapacity, type ApiOrderDetails, type AuthenticatedApiRequest } from '../services/ordersApi'
import { navigate } from '../utils/navigation'

const props = defineProps<{ orderId?: string, apiRequest?: AuthenticatedApiRequest }>()
const order = ref<ApiOrderDetails>()
const capacity = ref<ApiDailyCapacity>()
const loading = ref(true)
const error = ref('')
const feedback = ref('')
const acting = ref(false)
const confirmationOpen = ref(false)
const cancellationOpen = ref(false)
const cancellationReason = ref('')
const rescheduleOpen = ref(false)
const newOperationalDate = ref('')
const rescheduleReason = ref('')
const confirmationKey = ref(crypto.randomUUID())
const cancellationKey = ref(crypto.randomUUID())
const rescheduleKey = ref(crypto.randomUUID())

const canCancel = computed(() => order.value && !['Completed', 'Cancelled'].includes(order.value.status))
const canReschedule = computed(() => order.value?.status === 'Confirmed')
const projectedAvailable = computed(() => capacity.value && order.value ? capacity.value.availableUnits - (order.value.status === 'Open' ? order.value.dailyCapacityUnits : 0) : undefined)

function returnUrl() {
  const candidate = new URLSearchParams(window.location.search).get('retorno')
  return candidate && /^\/operacoes\/(?:pedidos|atendimento)(?:\?.*)?$/.test(candidate) ? candidate : '/operacoes/pedidos'
}
function formatCurrency(value: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value) }
function formatDate(value: string) { return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00`)) }
function formatInstant(value: string) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) }
function richTextPlainText(value: string) { return sanitizeRichText(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() }

async function load() {
  if (!props.apiRequest || !props.orderId) {
    error.value = 'A sessão autenticada ou o pedido não está disponível.'
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    order.value = await getOrder(props.apiRequest, props.orderId)
    capacity.value = await getDailyCapacity(props.apiRequest, order.value.operationalDate)
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Não foi possível carregar o pedido.' }
  finally { loading.value = false }
}

async function runAction(action: () => Promise<unknown>, message: string) {
  acting.value = true
  error.value = ''
  try {
    await action()
    feedback.value = message
    confirmationOpen.value = false
    cancellationOpen.value = false
    rescheduleOpen.value = false
    await load()
    return true
  }
  catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Não foi possível concluir a operação.'
    await load().catch(() => undefined)
    error.value = message
    return false
  }
  finally { acting.value = false }
}

async function submitConfirmation() {
  if (props.apiRequest && order.value && await runAction(() => confirmOrder(props.apiRequest!, order.value!, confirmationKey.value), `Pedido #${shortOrderId(order.value.id)} confirmado.`)) confirmationKey.value = crypto.randomUUID()
}
async function submitCancellation() {
  if (props.apiRequest && order.value && richTextPlainText(cancellationReason.value) && await runAction(() => cancelOrder(props.apiRequest!, order.value!, cancellationReason.value, cancellationKey.value), `Pedido #${shortOrderId(order.value.id)} cancelado.`)) cancellationKey.value = crypto.randomUUID()
}
async function submitReschedule() {
  if (props.apiRequest && order.value && newOperationalDate.value && richTextPlainText(rescheduleReason.value) && await runAction(() => rescheduleOrder(props.apiRequest!, order.value!, newOperationalDate.value, rescheduleReason.value, rescheduleKey.value), `Pedido #${shortOrderId(order.value.id)} reagendado.`)) rescheduleKey.value = crypto.randomUUID()
}
function editOrder() { if (order.value) navigate(`/operacoes/pedidos/${order.value.id}/editar?retorno=${encodeURIComponent(returnUrl())}`) }

watch(() => props.orderId, load)
onMounted(load)
</script>

<template>
  <section aria-label="Detalhe do pedido">
    <div v-if="loading" class="space-y-4"><div v-for="index in 3" :key="index" class="h-44 animate-pulse rounded-lg border border-slate-200 bg-white" /></div>
    <EmptyState v-else-if="!order" title="Pedido indisponível" :description="error || 'O pedido não foi encontrado.'" role="alert"><template #icon><TriangleAlertIcon /></template><template #action><Button variant="secondary" @click="load">Tentar novamente</Button></template></EmptyState>
    <div v-else class="space-y-4">
      <Alert v-if="feedback" variants="success" :description="feedback" closable @close="feedback = ''"><template #icon><CheckIcon /></template></Alert>
      <Alert v-if="error" variants="danger" title="A operação não foi concluída" :description="error" closable @close="error = ''"><template #icon><TriangleAlertIcon /></template></Alert>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3"><h2 class="text-lg font-semibold text-slate-900">#{{ shortOrderId(order.id) }}</h2><Badge :variant="orderStatusPresentation[order.status].variant">{{ orderStatusPresentation[order.status].label }}</Badge></div>
        <div class="flex flex-wrap gap-2">
          <Button v-if="order.status === 'Open'" variant="secondary" @click="editOrder">Editar</Button>
          <Button v-if="order.status === 'Open'" @click="confirmationOpen = true">Confirmar pedido</Button>
          <Button v-if="canReschedule" variant="secondary" @click="rescheduleOpen = true">Reagendar</Button>
          <Button v-if="canCancel" variant="danger" @click="cancellationOpen = true">Cancelar pedido</Button>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div class="space-y-4">
          <Card>
            <template #header><h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Pedido</h3></template>
            <dl class="grid gap-4 text-sm sm:grid-cols-3"><div><dt class="text-slate-400">Cliente</dt><dd class="mt-1 font-medium text-slate-800">{{ order.customerId }}</dd></div><div><dt class="text-slate-400">Data operacional</dt><dd class="mt-1 font-medium text-slate-800">{{ formatDate(order.operationalDate) }}</dd></div><div><dt class="text-slate-400">Versão</dt><dd class="mt-1 font-medium text-slate-800">{{ order.version }}</dd></div></dl>
          </Card>
          <Card>
            <template #header><h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Itens</h3></template>
            <div class="space-y-3"><article v-for="item in order.items" :key="item.id" class="rounded-lg border border-slate-200 p-4"><div class="flex justify-between gap-4"><div><p class="font-medium text-slate-800">{{ item.offerName }} <Badge v-if="item.fulfillmentMode === 'FrozenStock'" variant="info">Congelado</Badge></p><p class="mt-1 text-sm text-slate-500">{{ item.producibleItemName }}<template v-if="item.frozenPresentation"> · {{ item.frozenPresentation }}</template></p><p class="mt-1 text-sm text-slate-500">{{ item.quantity }} × {{ formatCurrency(item.unitPrice) }}</p></div><p class="font-semibold text-slate-900">{{ formatCurrency(item.total) }}</p></div></article></div>
          </Card>
          <Card v-if="order.confirmation">
            <template #header><h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Efeitos da confirmação</h3><p class="mt-1 text-sm text-slate-500">Consolidados em {{ formatInstant(order.confirmation.confirmedAt) }}</p></template>
            <dl class="grid gap-4 text-sm sm:grid-cols-3"><div><dt class="text-slate-400">Créditos de plano</dt><dd class="mt-1 font-medium">{{ formatCurrency(order.confirmation.planCreditCoveredAmount) }}</dd></div><div><dt class="text-slate-400">Crédito financeiro</dt><dd class="mt-1 font-medium">{{ formatCurrency(order.confirmation.financialCreditApplied) }}</dd></div><div><dt class="text-slate-400">Saldo devido</dt><dd class="mt-1 font-semibold">{{ formatCurrency(order.confirmation.amountDue) }}</dd></div></dl>
            <div v-if="order.confirmation.frozenAllocations.length" class="mt-4 border-t border-slate-100 pt-4"><p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Alocação FEFO persistida</p><p v-for="allocation in order.confirmation.frozenAllocations" :key="`${allocation.orderItemId}-${allocation.frozenLotId}`" class="mt-2 text-sm text-slate-600">{{ allocation.quantity }} un. · lote {{ allocation.frozenLotId }}</p></div>
          </Card>
          <Card v-if="order.lifecycle.length">
            <template #header><h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Histórico autoritativo</h3></template>
            <ol class="space-y-3"><li v-for="event in order.lifecycle" :key="event.id" class="border-l-2 border-slate-200 pl-3"><p class="font-medium text-slate-800">{{ event.type === 'Rescheduled' ? 'Pedido reagendado' : event.type === 'Cancelled' ? 'Pedido cancelado' : `Status alterado para ${orderStatusPresentation[event.newStatus].label}` }}</p><div class="mt-1 text-sm text-slate-500 [&_a]:text-blue-600 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5" v-html="sanitizeRichText(event.reason)" /><p class="mt-1 text-xs text-slate-400">{{ formatInstant(event.occurredAt) }}</p></li></ol>
          </Card>
        </div>
        <Card class="h-fit">
          <template #header><h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Resumo</h3></template>
          <p class="text-2xl font-semibold text-slate-900">{{ formatCurrency(order.totalAmount) }}</p><p class="mt-1 text-sm text-slate-500">{{ order.items.reduce((sum, item) => sum + item.quantity, 0) }} unidades</p>
          <div class="mt-5 border-t border-slate-100 pt-4"><p class="text-sm text-slate-500">Capacidade diária</p><p class="mt-1 font-medium text-slate-800">{{ order.dailyCapacityUnits }} unidades deste pedido</p><p v-if="capacity" class="mt-1 text-sm" :class="projectedAvailable !== undefined && projectedAvailable < 0 ? 'text-red-600' : 'text-slate-500'">{{ capacity.availableUnits }} disponíveis<span v-if="order.status === 'Open'"> · {{ projectedAvailable }} após confirmar</span></p><p v-else class="mt-1 text-sm text-amber-700">Não configurada para esta data</p></div>
        </Card>
      </div>

      <Drawer :open="confirmationOpen" side="right" size="large" :title="`Confirmar pedido #${shortOrderId(order.id)}`" description="A API validará capacidade, restrições, créditos, financeiro e estoque congelado na mesma transação." @update:open="confirmationOpen = $event"><template #trigger><button class="hidden" /></template><Alert variants="info" title="Validação autoritativa" description="A projeção desta tela não reserva recursos. Conflitos de capacidade, versão ou estoque serão devolvidos sem efeitos parciais." /><template #footer><Button :loading="acting" @click="submitConfirmation">Confirmar pedido</Button></template></Drawer>
      <Drawer :open="cancellationOpen" side="right" size="large" :title="`Cancelar pedido #${shortOrderId(order.id)}`" description="A API calculará e registrará as reversões permitidas para o estágio atual." @update:open="cancellationOpen = $event"><template #trigger><button class="hidden" /></template><Textarea v-model="cancellationReason" label="Motivo" rich-text required placeholder="Informe o motivo do cancelamento" /><template #footer><Button variant="danger" :disabled="!richTextPlainText(cancellationReason)" :loading="acting" @click="submitCancellation">Cancelar pedido</Button></template></Drawer>
      <Drawer :open="rescheduleOpen" side="right" size="large" :title="`Reagendar pedido #${shortOrderId(order.id)}`" description="A reserva só será transferida se a nova data tiver capacidade." @update:open="rescheduleOpen = $event"><template #trigger><button class="hidden" /></template><div class="space-y-4"><Input v-model="newOperationalDate" type="date" label="Nova data operacional" required /><Textarea v-model="rescheduleReason" label="Motivo" rich-text required /></div><template #footer><Button :disabled="!newOperationalDate || !richTextPlainText(rescheduleReason)" :loading="acting" @click="submitReschedule">Reagendar</Button></template></Drawer>
    </div>
  </section>
</template>

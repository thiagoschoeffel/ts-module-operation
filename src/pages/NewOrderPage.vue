<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Alert, Badge, Button, Card, EmptyState, Input, Select, TriangleAlertIcon } from '@thiagoschoeffel/ts-components'
import { getDailyCapacity, getOrder, getOrderAuthoringContext, saveOrder, type ApiDailyCapacity, type ApiOrderAuthoringContext, type AuthenticatedApiRequest, type OrderItemInput } from '../services/ordersApi'
import { navigate } from '../utils/navigation'

const props = withDefaults(defineProps<{ mode?: 'create' | 'edit', orderId?: string, apiRequest?: AuthenticatedApiRequest }>(), { mode: 'create' })
const today = new Date().toLocaleDateString('en-CA')
const customerId = ref('11111111-1111-4111-8111-111111111111')
const operationalDate = ref(today)
const items = ref<OrderItemInput[]>([])
const version = ref(0)
const context = ref<ApiOrderAuthoringContext>()
const capacity = ref<ApiDailyCapacity>()
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')
const selectedOfferId = ref('')
const selectedProducibleId = ref('')
const selectedFrozenConfigurationId = ref('')
const quantity = ref(1)
const unitPrice = ref(0)
const itemError = ref('')
const saveIdempotencyKey = ref(crypto.randomUUID())

const customerOptions = [
  { value: '11111111-1111-4111-8111-111111111111', label: 'Maria Silva', description: 'Diretório de clientes será autoritativo no E12' },
  { value: '22222222-2222-4222-8222-222222222222', label: 'João Souza', description: 'Diretório de clientes será autoritativo no E12' },
  { value: '33333333-3333-4333-8333-333333333333', label: 'Ana Lima', description: 'Diretório de clientes será autoritativo no E12' }
]
const customerSelectOptions = computed(() => customerOptions.some(option => option.value === customerId.value)
  ? customerOptions
  : [{ value: customerId.value, label: `Cliente ${customerId.value.slice(0, 8).toUpperCase()}`, description: 'Identificador externo preservado no Pedido' }, ...customerOptions])
const customerName = computed(() => customerSelectOptions.value.find(option => option.value === customerId.value)?.label)
const offerOptions = computed(() => context.value?.offers.map(offer => ({ value: offer.id, label: offer.name, description: offer.fulfillmentMode === 'FrozenStock' ? 'Atendido por estoque congelado' : 'Produção diária' })) ?? [])
const producibleOptions = computed(() => context.value?.producibles.map(item => ({ value: item.id, label: item.name })) ?? [])
const selectedOffer = computed(() => context.value?.offers.find(item => item.id === selectedOfferId.value))
const frozenOptions = computed(() => context.value?.frozenConfigurations
  .filter(item => !selectedOfferId.value || item.offerId === selectedOfferId.value)
  .map(item => ({ value: item.id, label: `${item.producibleItemName} · ${item.presentation}`, description: `${item.availableQuantity} disponíveis · ${formatCurrency(item.unitPrice)}`, disabled: item.availableQuantity < 1 })) ?? [])
const requestedDailyUnits = computed(() => items.value.reduce((total, item) => {
  const offer = context.value?.offers.find(current => current.id === item.offerId)
  return total + (offer?.fulfillmentMode === 'DailyProduction' ? item.quantity : 0)
}, 0))
const projectedAvailable = computed(() => capacity.value ? capacity.value.availableUnits - requestedDailyUnits.value : undefined)
const canSave = computed(() => customerId.value && operationalDate.value && items.value.length && !saving.value)

watch(operationalDate, loadContext)
watch(selectedOfferId, () => {
  selectedProducibleId.value = ''
  selectedFrozenConfigurationId.value = ''
  unitPrice.value = 0
})
watch([customerId, operationalDate, items], () => { saveIdempotencyKey.value = crypto.randomUUID() }, { deep: true })

async function loadContext() {
  if (!props.apiRequest || !operationalDate.value) return
  error.value = ''
  try {
    const [authoringContext, dailyCapacity] = await Promise.all([
      getOrderAuthoringContext(props.apiRequest, operationalDate.value),
      getDailyCapacity(props.apiRequest, operationalDate.value)
    ])
    context.value = authoringContext
    capacity.value = dailyCapacity
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Não foi possível carregar a disponibilidade.' }
}

function addItem() {
  itemError.value = ''
  if (!selectedOffer.value || quantity.value < 1) {
    itemError.value = 'Selecione uma oferta e informe uma quantidade válida.'
    return
  }
  if (selectedOffer.value.fulfillmentMode === 'DailyProduction') {
    if (!selectedProducibleId.value || unitPrice.value < 0) {
      itemError.value = 'Selecione o item produzível e informe o preço unitário.'
      return
    }
    items.value.push({ offerId: selectedOffer.value.id, producibleItemId: selectedProducibleId.value, unitPrice: unitPrice.value, quantity: quantity.value })
  }
  else {
    const configuration = context.value?.frozenConfigurations.find(item => item.id === selectedFrozenConfigurationId.value)
    if (!configuration || configuration.availableQuantity < quantity.value) {
      itemError.value = 'Selecione uma configuração com estoque suficiente para a quantidade.'
      return
    }
    items.value.push({ offerId: selectedOffer.value.id, frozenConfigurationId: configuration.id, quantity: quantity.value })
  }
  selectedOfferId.value = ''
  quantity.value = 1
}

function removeItem(index: number) { items.value.splice(index, 1) }
function itemLabel(item: OrderItemInput) {
  const offer = context.value?.offers.find(current => current.id === item.offerId)
  const producible = context.value?.producibles.find(current => current.id === item.producibleItemId)
  const frozen = context.value?.frozenConfigurations.find(current => current.id === item.frozenConfigurationId)
  return { name: offer?.name ?? 'Oferta', detail: frozen ? `${frozen.producibleItemName} · ${frozen.presentation}` : producible?.name ?? 'Item produzível', price: frozen?.unitPrice ?? item.unitPrice ?? 0 }
}

function returnUrl() {
  const candidate = new URLSearchParams(window.location.search).get('retorno')
  return candidate && /^\/operacoes\/(?:pedidos|atendimento)(?:\?.*)?$/.test(candidate) ? candidate : '/operacoes/pedidos'
}

async function submit() {
  if (!props.apiRequest || !canSave.value) return
  saving.value = true
  error.value = ''
  try {
    const saved = await saveOrder(props.apiRequest, { id: props.mode === 'edit' ? props.orderId : undefined, customerId: customerId.value, customerName: customerName.value, operationalDate: operationalDate.value, expectedVersion: version.value, items: items.value, idempotencyKey: saveIdempotencyKey.value })
    success.value = props.mode === 'edit' ? 'Alterações salvas na API.' : 'Pedido criado como aberto na API.'
    setTimeout(() => navigate(`/operacoes/pedidos/${saved.id}?retorno=${encodeURIComponent(returnUrl())}`), 500)
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Não foi possível salvar o pedido.' }
  finally { saving.value = false }
}

function formatCurrency(value: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value) }

onMounted(async () => {
  if (!props.apiRequest) {
    error.value = 'A sessão autenticada não está disponível.'
    loading.value = false
    return
  }
  try {
    if (props.mode === 'edit' && props.orderId) {
      const order = await getOrder(props.apiRequest, props.orderId)
      if (order.status !== 'Open') throw new Error('Somente pedidos abertos podem ser editados.')
      customerId.value = order.customerId
      operationalDate.value = order.operationalDate
      version.value = order.version
      items.value = order.items.map(item => ({ offerId: item.offerId, quantity: item.quantity, unitPrice: item.fulfillmentMode === 'DailyProduction' ? item.unitPrice : undefined, frozenConfigurationId: item.frozenConfigurationId, producibleItemId: item.fulfillmentMode === 'DailyProduction' ? item.producibleItemId : undefined }))
    }
    await loadContext()
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Não foi possível carregar o pedido.' }
  finally { loading.value = false }
})
</script>

<template>
  <section aria-label="Formulário do pedido">
    <div v-if="loading" class="space-y-4"><div v-for="index in 3" :key="index" class="h-40 animate-pulse rounded-lg border border-slate-200 bg-white" /></div>
    <div v-else class="space-y-4">
      <Alert v-if="error" variants="danger" title="Não foi possível concluir" :description="error"><template #icon><TriangleAlertIcon /></template></Alert>
      <Alert v-if="success" variants="success" :description="success" />
      <Card>
        <template #header><h2 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Identificação e data</h2></template>
        <div class="grid gap-4 sm:grid-cols-2">
          <Select v-model="customerId" label="Cliente" :options="customerSelectOptions" required />
          <Input v-model="operationalDate" type="date" label="Data operacional" required />
        </div>
        <p class="mt-3 text-xs text-slate-500">O Pedido persiste o identificador externo do cliente; o cadastro completo será integrado no E12.</p>
      </Card>

      <Card>
        <template #header><h2 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Itens autoritativos</h2><p class="mt-1 text-sm text-slate-500">Ofertas, produzíveis, preços de congelados e estoque vêm da API.</p></template>
        <EmptyState v-if="!context?.offers.length" size="small" title="Nenhuma oferta ativa" description="Cadastre e ative as referências autoritativas antes de criar um pedido." />
        <template v-else>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Select v-model="selectedOfferId" label="Oferta" placeholder="Selecione" :options="offerOptions" />
            <Select v-if="selectedOffer?.fulfillmentMode === 'DailyProduction'" v-model="selectedProducibleId" label="Item produzível" placeholder="Selecione" :options="producibleOptions" />
            <Select v-else-if="selectedOffer?.fulfillmentMode === 'FrozenStock'" v-model="selectedFrozenConfigurationId" label="Configuração congelada" placeholder="Selecione" :options="frozenOptions" />
            <Input v-if="selectedOffer?.fulfillmentMode === 'DailyProduction'" v-model="unitPrice" type="number" min="0" step="0.01" label="Preço unitário" />
            <Input v-if="selectedOffer" v-model="quantity" type="number" min="1" step="1" label="Quantidade" />
          </div>
          <Alert v-if="itemError" class="mt-3" variants="danger" :description="itemError" />
          <Button v-if="selectedOffer" class="mt-4" type="button" size="small" variant="secondary" @click="addItem">Adicionar item</Button>
        </template>

        <div v-if="items.length" class="mt-5 space-y-2 border-t border-slate-100 pt-4">
          <article v-for="(item, index) in items" :key="`${item.offerId}-${index}`" class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
            <div><p class="font-medium text-slate-800">{{ itemLabel(item).name }} <Badge v-if="item.frozenConfigurationId" variant="info">Congelado</Badge></p><p class="mt-1 text-sm text-slate-500">{{ itemLabel(item).detail }} · {{ item.quantity }} × {{ formatCurrency(itemLabel(item).price) }}</p></div>
            <Button type="button" size="small" variant="danger" @click="removeItem(index)">Remover</Button>
          </article>
        </div>
      </Card>

      <Card>
        <template #header><h2 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Capacidade</h2></template>
        <div v-if="capacity" class="grid gap-3 text-sm sm:grid-cols-4">
          <p><span class="block text-slate-400">Total</span><strong>{{ capacity.totalUnits }}</strong></p>
          <p><span class="block text-slate-400">Reservada</span><strong>{{ capacity.reservedUnits }}</strong></p>
          <p><span class="block text-slate-400">Este pedido</span><strong>{{ requestedDailyUnits }}</strong></p>
          <p><span class="block text-slate-400">Projeção</span><strong :class="projectedAvailable !== undefined && projectedAvailable < 0 ? 'text-red-600' : ''">{{ projectedAvailable }}</strong></p>
        </div>
        <p v-else class="text-sm text-slate-500">A capacidade ainda não foi configurada para esta data. A API fará a validação final na confirmação.</p>
      </Card>

      <div class="flex justify-end gap-3"><Button type="button" variant="secondary" @click="navigate(returnUrl())">Cancelar</Button><Button type="button" :disabled="!canSave" :loading="saving" @click="submit">{{ props.mode === 'edit' ? 'Salvar alterações' : 'Criar pedido aberto' }}</Button></div>
    </div>
  </section>
</template>

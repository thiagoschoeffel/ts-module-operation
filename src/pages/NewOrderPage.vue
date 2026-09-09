<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Alert, AlertDialog, Button, Card, CheckIcon, InfoIcon, Input, TriangleAlertIcon } from '@thiagoschoeffel/ts-components'
import CustomerSection from '../components/new-order/CustomerSection.vue'
import DeliverySection from '../components/new-order/DeliverySection.vue'
import OrderItemsSection from '../components/new-order/OrderItemsSection.vue'
import OrderSummary from '../components/new-order/OrderSummary.vue'
import { formatCurrency, getDefaultDeliveryWindow } from '../components/new-order/mockData'
import type { Customer, CustomerAddress, OrderItem } from '../components/new-order/types'
import { getDailyCapacity, getOrder, getOrderAuthoringContext, saveOrder, type ApiDailyCapacity, type ApiOrderAuthoringContext, type ApiOrderFulfillmentType, type AuthenticatedApiRequest, type OrderItemInput } from '../services/ordersApi'
import { localDateIso } from '../services/todayApi'
import { navigate } from '../utils/navigation'

const props = withDefaults(defineProps<{ mode?: 'create' | 'edit', orderId?: string, apiRequest?: AuthenticatedApiRequest }>(), { mode: 'create' })
const operationalDate = ref(localDateIso())
const customer = ref<Customer>()
const address = ref<CustomerAddress>()
const fulfillmentType = ref<ApiOrderFulfillmentType>('Delivery')
const contactPhone = ref('')
const deliveryWindow = ref(getDefaultDeliveryWindow())
const items = ref<OrderItemInput[]>([])
const version = ref(0)
const context = ref<ApiOrderAuthoringContext>()
const capacity = ref<ApiDailyCapacity>()
const loading = ref(true)
const saving = ref(false)
const showValidation = ref(false)
const error = ref('')
const success = ref('')
const cancelConfirmationOpen = ref(false)
const initialSnapshot = ref('')
const saveIdempotencyKey = ref(crypto.randomUUID())
let navigationTimeout: ReturnType<typeof setTimeout> | undefined
let contextSequence = 0
let initializing = true

const customers = computed<Customer[]>(() => context.value?.customers.map(item => ({
  id: item.id,
  name: item.name,
  phone: item.phone,
  channel: 'Cadastro',
  addresses: item.addresses.map(current => ({
    id: current.id,
    label: current.label,
    postalCode: current.postalCode ?? '',
    street: current.street,
    number: current.number ?? '',
    complement: current.complement,
    neighborhood: current.neighborhood ?? '',
    city: current.city ?? '',
    state: current.state ?? '',
    referencePoint: current.reference
  }))
})) ?? [])
const customerId = computed(() => customer.value?.id ?? '')
const dailyProductionDemand = computed(() => items.value.reduce((total, item) => {
  const offer = context.value?.offers.find(current => current.id === item.offerId)
  return total + (offer?.fulfillmentMode === 'DailyProduction' ? item.quantity : 0)
}, 0))
const summaryItems = computed<OrderItem[]>(() => items.value.map((item, index) => {
  const offer = context.value?.offers.find(current => current.id === item.offerId)
  const producible = context.value?.producibles.find(current => current.id === item.producibleItemId)
  const frozen = context.value?.frozenConfigurations.find(current => current.id === item.frozenConfigurationId)
  const unitPrice = frozen?.unitPrice ?? item.unitPrice ?? 0
  return {
    id: `item-${index}`,
    offerId: item.offerId,
    name: offer?.name ?? 'Oferta',
    price: unitPrice * item.quantity,
    details: [`${frozen ? `${frozen.producibleItemName} · ${frozen.presentation}` : producible?.name ?? 'Opção do cardápio'} · ${item.quantity} ${item.quantity === 1 ? 'unidade' : 'unidades'}`],
    additions: [],
    fulfillmentSource: frozen ? 'frozen-stock' : 'daily-production',
    frozenStock: frozen ? {
      configurationId: frozen.id,
      producibleItemId: frozen.producibleItemId,
      producibleName: frozen.producibleItemName,
      presentation: frozen.presentation,
      unitPrice: frozen.unitPrice,
      allocationStatus: 'pending',
      allocations: []
    } : undefined,
    effectiveComponents: [],
    customizations: [],
    hasRestrictionConflict: false
  }
}))
const subtotal = computed(() => summaryItems.value.reduce((total, item) => total + item.price, 0))
const itemQuantity = computed(() => items.value.reduce((total, item) => total + item.quantity, 0))
const summaryDeliveryWindow = computed(() => !customer.value ? undefined : fulfillmentType.value === 'Pickup' ? 'Retirada' : deliveryWindow.value)
const selectedAddressId = computed(() => fulfillmentType.value === 'Delivery' ? address.value?.id : undefined)
const canSave = computed(() => Boolean(customer.value && operationalDate.value && items.value.length
  && contactPhone.value.replace(/\D/g, '').length >= 10
  && (fulfillmentType.value === 'Pickup' || selectedAddressId.value && deliveryWindow.value.trim())))
const editorSnapshot = computed(() => JSON.stringify({
  operationalDate: operationalDate.value,
  customerId: customerId.value,
  addressId: selectedAddressId.value,
  fulfillmentType: fulfillmentType.value,
  contactPhone: contactPhone.value,
  deliveryWindow: deliveryWindow.value,
  items: items.value
}))
const isDirty = computed(() => initialSnapshot.value ? editorSnapshot.value !== initialSnapshot.value : Boolean(customer.value || items.value.length))

watch(customer, (current, previous) => {
  if (initializing) return
  if (current?.id === previous?.id) return
  address.value = current?.addresses.length === 1 ? current.addresses[0] : undefined
  contactPhone.value = current?.phone ?? ''
  deliveryWindow.value = getDefaultDeliveryWindow()
  if (previous) items.value = []
}, { flush: 'sync' })
watch(operationalDate, async () => {
  if (initializing) return
  items.value = []
  await loadContext()
}, { flush: 'sync' })
watch([customerId, operationalDate, items, fulfillmentType, contactPhone, address, deliveryWindow], () => {
  saveIdempotencyKey.value = crypto.randomUUID()
}, { deep: true })

async function loadContext() {
  if (!props.apiRequest || !operationalDate.value) return
  const sequence = ++contextSequence
  error.value = ''
  try {
    const [authoringContext, dailyCapacity] = await Promise.all([
      getOrderAuthoringContext(props.apiRequest, operationalDate.value),
      getDailyCapacity(props.apiRequest, operationalDate.value)
    ])
    if (sequence !== contextSequence) return
    const selectedCustomerId = customer.value?.id
    context.value = authoringContext
    capacity.value = dailyCapacity
    if (selectedCustomerId) customer.value = customers.value.find(current => current.id === selectedCustomerId)
  }
  catch (cause) {
    if (sequence === contextSequence) error.value = cause instanceof Error ? cause.message : 'Não foi possível carregar a disponibilidade.'
  }
}

function returnUrl() {
  const candidate = new URLSearchParams(window.location.search).get('retorno')
  return candidate && /^\/operacoes\/(?:pedidos|atendimento)(?:\?.*)?$/.test(candidate) ? candidate : '/operacoes/pedidos'
}

function cancel() {
  if (isDirty.value) cancelConfirmationOpen.value = true
  else navigate(returnUrl())
}

async function submit() {
  showValidation.value = true
  if (!props.apiRequest || !canSave.value || saving.value) return
  saving.value = true
  error.value = ''
  try {
    const saved = await saveOrder(props.apiRequest, {
      id: props.mode === 'edit' ? props.orderId : undefined,
      customerId: customer.value!.id,
      customerName: customer.value!.name,
      operationalDate: operationalDate.value,
      expectedVersion: version.value,
      items: items.value,
      fulfillment: {
        type: fulfillmentType.value,
        phone: contactPhone.value,
        addressId: selectedAddressId.value,
        deliveryWindow: fulfillmentType.value === 'Delivery' ? deliveryWindow.value.trim() : undefined
      },
      idempotencyKey: saveIdempotencyKey.value
    })
    success.value = props.mode === 'edit' ? 'Alterações salvas.' : 'Pedido criado como aberto.'
    initialSnapshot.value = editorSnapshot.value
    navigationTimeout = setTimeout(() => navigate(`/operacoes/pedidos/${saved.id}?retorno=${encodeURIComponent(returnUrl())}`), 700)
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Não foi possível salvar o pedido.' }
  finally { saving.value = false }
}

function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (!isDirty.value || success.value) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(async () => {
  window.addEventListener('beforeunload', warnBeforeUnload)
  if (!props.apiRequest) { error.value = 'A sessão autenticada não está disponível.'; loading.value = false; return }
  try {
    if (props.mode === 'edit' && props.orderId) {
      const order = await getOrder(props.apiRequest, props.orderId)
      if (order.status !== 'Open') throw new Error('Somente pedidos abertos podem ser editados.')
      operationalDate.value = order.operationalDate
      version.value = order.version
      await loadContext()
      customer.value = customers.value.find(current => current.id === order.customerId)
      items.value = order.items.map(item => ({
        offerId: item.offerId,
        quantity: item.quantity,
        unitPrice: item.fulfillmentMode === 'DailyProduction' ? item.unitPrice : undefined,
        frozenConfigurationId: item.frozenConfigurationId,
        producibleItemId: item.fulfillmentMode === 'DailyProduction' ? item.producibleItemId : undefined
      }))
      fulfillmentType.value = order.fulfillment.type ?? 'Delivery'
      contactPhone.value = order.fulfillment.phone ?? customer.value?.phone ?? ''
      deliveryWindow.value = order.fulfillment.deliveryWindow ?? getDefaultDeliveryWindow()
      address.value = customer.value?.addresses.find(current => current.street === order.fulfillment.street && current.number === order.fulfillment.number)
    }
    else {
      await loadContext()
      const requestedCustomerId = new URLSearchParams(window.location.search).get('cliente')
      customer.value = customers.value.find(current => current.id === requestedCustomerId)
      address.value = customer.value?.addresses.length === 1 ? customer.value.addresses[0] : undefined
      contactPhone.value = customer.value?.phone ?? ''
      deliveryWindow.value = getDefaultDeliveryWindow()
    }
    initialSnapshot.value = editorSnapshot.value
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Não foi possível carregar o pedido.' }
  finally { initializing = false; loading.value = false }
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', warnBeforeUnload)
  if (navigationTimeout) clearTimeout(navigationTimeout)
})
</script>

<template>
  <div class="pb-20 lg:pb-0">
    <Alert v-if="error" class="mb-4" variants="danger" title="Não foi possível concluir" :description="error"><template #icon><TriangleAlertIcon /></template></Alert>
    <Alert v-if="success" class="mb-4" variants="success" :description="success"><template #icon><CheckIcon /></template></Alert>

    <div v-if="loading" class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="space-y-4"><div v-for="index in 4" :key="index" class="h-40 animate-pulse rounded-lg border border-slate-200 bg-white" /></div>
      <div class="hidden h-96 animate-pulse rounded-lg border border-slate-200 bg-white lg:block" />
    </div>

    <template v-else>
      <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div class="min-w-0 space-y-4">
          <CustomerSection v-model="customer" :customers="customers" />

          <Card>
            <template #header><h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Data operacional</h2><p class="mt-1 text-sm text-slate-500">Ofertas, cardápio e capacidade serão consultados para esta data.</p></template>
            <Input v-model="operationalDate" class="sm:max-w-xs" type="date" label="Data do pedido" required />
          </Card>

          <DeliverySection
            :customer="customer"
            :address="address"
            :delivery-window="deliveryWindow"
            :fulfillment-type="fulfillmentType"
            :contact-phone="contactPhone"
            :show-validation="showValidation"
            @update:address="address = $event"
            @update:delivery-window="deliveryWindow = $event"
            @update:fulfillment-type="fulfillmentType = $event"
            @update:contact-phone="contactPhone = $event" />

          <OrderItemsSection v-model="items" :context="context" :disabled="!customer" />

          <Card :class="!items.length ? 'bg-slate-50 opacity-60' : ''" :aria-disabled="!items.length || undefined">
            <template #header><h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Financeiro</h2><p class="mt-1 text-sm text-slate-500">Créditos, desconto, taxa e condição de pagamento são definidos ao confirmar o pedido.</p></template>
            <Alert variants="info" size="small" title="Consolidação na confirmação" description="O rascunho preserva itens e atendimento. Os efeitos financeiros permanecem autoritativos no fluxo de confirmação."><template #icon><InfoIcon /></template></Alert>
          </Card>
        </div>

        <aside class="min-w-0 lg:sticky lg:top-6">
          <OrderSummary
            :customer="customer"
            :address="fulfillmentType === 'Delivery' ? address : undefined"
            :delivery-window="summaryDeliveryWindow"
            :items="summaryItems"
            :saving="saving"
            :show-validation="showValidation"
            :save-label="props.mode === 'edit' ? 'Salvar alterações' : 'Salvar pedido'"
            :capacity-used="capacity?.reservedUnits ?? 0"
            :capacity-limit="capacity?.totalUnits ?? 0"
            :daily-production-demand="dailyProductionDemand"
            @save="submit" />
        </aside>
      </div>

      <div class="mt-5"><Button type="button" variant="secondary" @click="cancel">Cancelar</Button></div>

      <div class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-6 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
        <div class="flex w-full items-center justify-between gap-4">
          <p class="text-sm font-medium text-slate-700">{{ itemQuantity }} itens · {{ formatCurrency(subtotal) }}</p>
          <Button type="button" :loading="saving" @click="submit">{{ props.mode === 'edit' ? 'Salvar alterações' : 'Salvar pedido' }}</Button>
        </div>
      </div>
    </template>

    <AlertDialog v-model:open="cancelConfirmationOpen" title="Deseja sair?" description="As alterações não salvas serão perdidas." cancel-label="Continuar editando" confirm-label="Sair sem salvar" confirm-variant="danger" @confirm="navigate(returnUrl())" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import {
  Alert,
  AlertDialog,
  Button,
  CheckIcon,
  SectionCard,
  Textarea
} from '@thiagoschoeffel/ts-components'
import type { DateValue } from '@thiagoschoeffel/ts-components'
import CustomerSection from '../components/new-order/CustomerSection.vue'
import DeliverySection from '../components/new-order/DeliverySection.vue'
import FinancialSection from '../components/new-order/FinancialSection.vue'
import OrderItemsSection from '../components/new-order/OrderItemsSection.vue'
import OrderSummary from '../components/new-order/OrderSummary.vue'
import { customers, formatCurrency, offers, paymentConditionOptions, paymentMethodOptions } from '../components/new-order/mockData'
import type { Customer, CustomerAddress, OrderItem, PaymentCondition, PaymentMethod } from '../components/new-order/types'
import { getOrderDetail, getOrderDomainState, nextOrderId, saveOrderDetail, type OrderDetail } from '../mocks/orderDetail'

const props = withDefaults(defineProps<{
  mode?: 'create' | 'edit'
  orderId?: string
}>(), {
  mode: 'create',
  orderId: undefined
})

const customer = ref<Customer>()
const address = ref<CustomerAddress>()
const deliveryWindow = ref<string>()
const items = ref<OrderItem[]>([])
const paymentCondition = ref<PaymentCondition>('cash')
const paymentMethod = ref<PaymentMethod>('pix')
const paymentDueDate = shallowRef<DateValue>()
const deliveryFee = ref(0)
const discount = ref(0)
const discountReason = ref('')
const usePlanCredit = ref(true)
const useFinancialCredit = ref(false)
const note = ref('')
const cancelConfirmationOpen = ref(false)
const saving = ref(false)
const showValidation = ref(false)
const savedMessage = ref('')
const initialEditSnapshot = ref('')
const hydratingEdit = ref(false)
let navigationTimeout: ReturnType<typeof setTimeout> | undefined

const editorSnapshot = computed(() => JSON.stringify({
  customerId: customer.value?.id,
  address: address.value,
  deliveryWindow: deliveryWindow.value,
  items: items.value,
  paymentCondition: paymentCondition.value,
  paymentMethod: paymentMethod.value,
  paymentDueDate: paymentDueDate.value?.toString(),
  deliveryFee: deliveryFee.value,
  discount: discount.value,
  discountReason: discountReason.value,
  usePlanCredit: usePlanCredit.value,
  useFinancialCredit: useFinancialCredit.value,
  note: note.value
}))
const isDirty = computed(() => props.mode === 'edit'
  ? Boolean(initialEditSnapshot.value && editorSnapshot.value !== initialEditSnapshot.value)
  : Boolean(customer.value || items.value.length || note.value.trim())
)
const subtotal = computed(() => items.value.reduce((total, item) => total + item.price, 0))
const planCreditAllocation = computed(() => {
  const acquisitions = [...(customer.value?.planAcquisitions ?? [])]
    .sort((first, second) => first.acquiredAt.localeCompare(second.acquiredAt))
    .map(acquisition => ({ ...acquisition }))
  const planNames = new Set<string>()
  let count = 0
  let value = 0

  for (const item of items.value) {
    const acquisition = acquisitions.find(current =>
      current.remainingCredits > 0 && current.compatibleOfferIds.includes(item.offerId)
    )
    if (!acquisition)
      continue

    acquisition.remainingCredits -= 1
    count += 1
    planNames.add(acquisition.planName)
    value += offers.find(offer => offer.id === item.offerId)?.price ?? 0
  }

  return { count, value, planName: [...planNames].join(', ') }
})
const appliedPlanCredit = computed(() => usePlanCredit.value ? planCreditAllocation.value.value : 0)
const discountLimit = computed(() => Math.max(0, subtotal.value + deliveryFee.value - appliedPlanCredit.value))
const amountBeforeFinancialCredit = computed(() => Math.max(
  0,
  subtotal.value + deliveryFee.value - appliedPlanCredit.value - discount.value
))
const appliedFinancialCredit = computed(() => useFinancialCredit.value
  ? Math.min(customer.value?.financialCreditBalance ?? 0, amountBeforeFinancialCredit.value)
  : 0)
const total = computed(() => Math.max(0, amountBeforeFinancialCredit.value - appliedFinancialCredit.value))
const paymentConditionLabel = computed(() => paymentConditionOptions.find(option => option.value === paymentCondition.value)?.label)
const paymentMethodLabel = computed(() => paymentMethodOptions.find(option => option.value === paymentMethod.value)?.label)
const paymentDueDateIso = computed(() => paymentDueDate.value?.toString())

watch(() => customer.value?.id, () => {
  address.value = customer.value?.addresses.length === 1 ? { ...customer.value.addresses[0] } : undefined
  deliveryWindow.value = undefined
  items.value = []
  paymentCondition.value = customer.value?.paymentPreference?.condition ?? 'cash'
  paymentMethod.value = customer.value?.paymentPreference?.method ?? 'pix'
  paymentDueDate.value = undefined
  discount.value = 0
  discountReason.value = ''
  usePlanCredit.value = true
  useFinancialCredit.value = false
})

watch(() => address.value?.id, () => {
  if (hydratingEdit.value)
    return
  deliveryFee.value = address.value ? 4 : 0
})

watch(paymentCondition, condition => {
  if (condition !== 'deferred')
    paymentDueDate.value = undefined
})

function cancel() {
  if (isDirty.value) {
    cancelConfirmationOpen.value = true
    return
  }
  leavePage()
}

function leavePage() {
  window.location.assign(props.mode === 'edit' && props.orderId
    ? detailUrl(props.orderId)
    : returnUrl())
}

function returnUrl() {
  const candidate = new URLSearchParams(window.location.search).get('retorno')
  return candidate && /^\/operacoes\/pedidos(?:\?.*)?$/.test(candidate)
    ? candidate
    : '/operacoes/pedidos'
}

function detailUrl(orderId: string | number) {
  return `/operacoes/pedidos/${orderId}?retorno=${encodeURIComponent(returnUrl())}`
}

function currentTimeLabel() {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date())
}

function saveOrder() {
  showValidation.value = true
  if (
    !customer.value
    || items.value.length === 0
    || (discount.value > 0 && !discountReason.value.trim())
    || discount.value > discountLimit.value
    || (paymentCondition.value === 'deferred' && !paymentDueDate.value)
  )
    return

  saving.value = true
  const savedOrderId = props.orderId ? Number(props.orderId) : nextOrderId()
  const existingOrder = props.mode === 'edit' ? getOrderDetail(savedOrderId) : undefined
  const time = currentTimeLabel()
  const pendingIssues = [
    ...(items.value.some(item => item.hasRestrictionConflict) ? ['Restrição alimentar'] : []),
    ...(customer.value.channel !== 'Balcão' && !address.value ? ['Endereço não definido'] : []),
    ...(customer.value.channel !== 'Balcão' && !deliveryWindow.value ? ['Janela de entrega não definida'] : [])
  ]
  const savedOrder: OrderDetail = {
    id: savedOrderId,
    status: 'open',
    readyForReview: pendingIssues.length === 0,
    createdAt: existingOrder?.createdAt ?? `Hoje às ${time}`,
    customer: {
      id: customer.value.id,
      name: customer.value.name,
      phone: customer.value.phone,
      channel: customer.value.channel,
      preference: customer.value.preference,
      restriction: customer.value.restriction
    },
    deliveryAddress: address.value ? { ...address.value, id: `order-${savedOrderId}-delivery-snapshot` } : undefined,
    deliveryWindow: deliveryWindow.value,
    deliveryFee: deliveryFee.value,
    items: structuredClone(items.value),
    note: note.value.trim() || undefined,
    planCreditCount: usePlanCredit.value ? planCreditAllocation.value.count : 0,
    planCreditValue: appliedPlanCredit.value,
    financialCreditValue: appliedFinancialCredit.value,
    discountValue: discount.value,
    discountReason: discount.value ? discountReason.value.trim() : undefined,
    pendingIssues,
    ...getOrderDomainState('open'),
    history: props.mode === 'edit' && existingOrder
      ? [{ id: `updated-${Date.now()}`, time: `Hoje ${time}`, title: 'Pedido alterado', actor: 'Ana' }, ...existingOrder.history]
      : [{ id: `created-${savedOrderId}`, time: `Hoje ${time}`, title: 'Pedido criado', actor: 'Ana' }]
  }
  navigationTimeout = setTimeout(() => {
    saveOrderDetail(savedOrder)
    saving.value = false
    savedMessage.value = props.mode === 'edit'
      ? `Alterações do pedido #${savedOrderId} salvas`
      : `Pedido #${savedOrderId} criado como aberto`
    navigationTimeout = setTimeout(() => window.location.assign(detailUrl(savedOrderId)), 900)
  }, 500)
}

function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (!isDirty.value || savedMessage.value)
    return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(async () => {
  window.addEventListener('beforeunload', warnBeforeUnload)
  if (props.mode !== 'edit')
    return

  const existingOrder = props.orderId ? getOrderDetail(props.orderId) : undefined
  if (!existingOrder || existingOrder.status !== 'open') {
    if (props.orderId)
      window.location.assign(detailUrl(props.orderId))
    return
  }

  hydratingEdit.value = true
  customer.value = customers.find(current => current.id === existingOrder.customer.id) ?? {
    ...existingOrder.customer,
    addresses: existingOrder.deliveryAddress ? [{ ...existingOrder.deliveryAddress }] : []
  }
  await nextTick()
  address.value = existingOrder.deliveryAddress ? { ...existingOrder.deliveryAddress } : undefined
  deliveryWindow.value = existingOrder.deliveryWindow
  items.value = structuredClone(existingOrder.items)
  deliveryFee.value = existingOrder.deliveryFee
  discount.value = existingOrder.discountValue
  discountReason.value = existingOrder.discountReason ?? ''
  usePlanCredit.value = existingOrder.planCreditCount > 0
  useFinancialCredit.value = existingOrder.financialCreditValue > 0
  note.value = existingOrder.note ?? ''
  await nextTick()
  hydratingEdit.value = false
  initialEditSnapshot.value = editorSnapshot.value
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', warnBeforeUnload)
  if (navigationTimeout)
    clearTimeout(navigationTimeout)
})
</script>

<template>
  <div class="pb-20 lg:pb-0">
    <Alert v-if="savedMessage" class="mb-4" variants="success" :description="savedMessage">
      <template #icon><CheckIcon /></template>
    </Alert>

    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="min-w-0 space-y-4">
        <CustomerSection v-model="customer" />
        <DeliverySection
          :customer="customer"
          :address="address"
          :delivery-window="deliveryWindow"
          @update:address="address = $event"
          @update:delivery-window="deliveryWindow = $event" />
        <OrderItemsSection v-model="items" :customer="customer" />
        <FinancialSection
          :enabled="Boolean(customer && items.length)"
          :payment-condition="paymentCondition"
          :payment-method="paymentMethod"
          :payment-due-date="paymentDueDate"
          :delivery-fee="deliveryFee"
          :discount="discount"
          :discount-limit="discountLimit"
          :discount-reason="discountReason"
          :use-plan-credit="usePlanCredit"
          :compatible-plan-credit-count="planCreditAllocation.count"
          :compatible-plan-credit-value="planCreditAllocation.value"
          :compatible-plan-name="planCreditAllocation.planName"
          :use-financial-credit="useFinancialCredit"
          :financial-credit-balance="customer?.financialCreditBalance ?? 0"
          :show-validation="showValidation"
          @update:payment-condition="paymentCondition = $event"
          @update:payment-method="paymentMethod = $event"
          @update:payment-due-date="paymentDueDate = $event"
          @update:delivery-fee="deliveryFee = $event"
          @update:discount="discount = $event"
          @update:discount-reason="discountReason = $event"
          @update:use-plan-credit="usePlanCredit = $event"
          @update:use-financial-credit="useFinancialCredit = $event" />

        <SectionCard title="Observação" description="Inclua uma orientação geral para este pedido, se necessário.">
          <Textarea
            id="order-note"
            v-model="note"
            label="Observação do pedido"
            :rows="4"
            placeholder="Ex.: Entregar na portaria..." />
        </SectionCard>
      </div>

      <aside class="min-w-0 lg:sticky lg:top-20">
        <OrderSummary
          :customer="customer"
          :address="address"
          :delivery-window="deliveryWindow"
          :items="items"
          :delivery-fee="deliveryFee"
          :discount="discount"
          :plan-credit-count="usePlanCredit ? planCreditAllocation.count : 0"
          :plan-credit-value="appliedPlanCredit"
          :financial-credit-value="appliedFinancialCredit"
          :payment-condition="paymentConditionLabel"
          :payment-method="paymentMethodLabel"
          :payment-due-date="paymentDueDateIso"
          :saving="saving"
          :show-validation="showValidation"
          :save-label="props.mode === 'edit' ? 'Salvar alterações' : 'Salvar pedido'"
          @save="saveOrder" />
      </aside>
    </div>

    <div class="mt-5 flex justify-start">
      <Button type="button" variant="secondary" @click="cancel">Cancelar</Button>
    </div>

    <div class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-6 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
      <div class="flex w-full items-center justify-between gap-4">
        <p class="text-sm font-medium text-slate-700">{{ items.length }} {{ items.length === 1 ? 'item' : 'itens' }} · {{ formatCurrency(total) }}</p>
        <Button type="button" size="medium" :loading="saving" @click="saveOrder">
          {{ props.mode === 'edit' ? 'Salvar alterações' : 'Salvar pedido' }}
        </Button>
      </div>
    </div>

    <AlertDialog
      v-model:open="cancelConfirmationOpen"
      title="Deseja sair?"
      :description="props.mode === 'edit' ? 'As alterações não salvas serão perdidas.' : 'As alterações deste pedido serão perdidas.'"
      cancel-label="Continuar editando"
      confirm-label="Sair sem salvar"
      confirm-variant="danger"
      @confirm="leavePage" />
  </div>
</template>

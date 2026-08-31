<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Alert,
  AlertDialog,
  Button,
  CheckIcon,
  SectionCard,
  Textarea
} from '@thiagoschoeffel/ts-components'
import CustomerSection from '../components/new-order/CustomerSection.vue'
import DeliverySection from '../components/new-order/DeliverySection.vue'
import OrderItemsSection from '../components/new-order/OrderItemsSection.vue'
import OrderSummary from '../components/new-order/OrderSummary.vue'
import { formatCurrency } from '../components/new-order/mockData'
import type { Customer, CustomerAddress, OrderItem } from '../components/new-order/types'

const customer = ref<Customer>()
const address = ref<CustomerAddress>()
const deliveryWindow = ref<string>()
const items = ref<OrderItem[]>([])
const note = ref('')
const cancelConfirmationOpen = ref(false)
const saving = ref(false)
const showValidation = ref(false)
const savedMessage = ref('')
let navigationTimeout: ReturnType<typeof setTimeout> | undefined

const isDirty = computed(() => Boolean(customer.value || items.value.length || note.value.trim()))
const subtotal = computed(() => items.value.reduce((total, item) => total + item.price, 0))

watch(() => customer.value?.id, () => {
  address.value = customer.value?.addresses.length === 1 ? { ...customer.value.addresses[0] } : undefined
  deliveryWindow.value = undefined
  items.value = []
})

function cancel() {
  if (isDirty.value) {
    cancelConfirmationOpen.value = true
    return
  }
  leavePage()
}

function leavePage() {
  window.location.assign('/operacoes/pedidos')
}

function saveOrder() {
  showValidation.value = true
  if (!customer.value || items.value.length === 0)
    return

  saving.value = true
  navigationTimeout = setTimeout(() => {
    saving.value = false
    savedMessage.value = 'Pedido #149 criado como aberto'
    navigationTimeout = setTimeout(() => window.location.assign('/operacoes/pedidos/149'), 900)
  }, 500)
}

function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (!isDirty.value || savedMessage.value)
    return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => window.addEventListener('beforeunload', warnBeforeUnload))
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

        <SectionCard title="Observação" description="Inclua uma orientação geral para este pedido, se necessário.">
          <Textarea
            id="order-note"
            v-model="note"
            label="Observação do pedido"
            :rows="4"
            placeholder="Ex.: Entregar na portaria..." />
        </SectionCard>
      </div>

      <aside class="min-w-0 lg:sticky lg:top-4">
        <OrderSummary
          :customer="customer"
          :address="address"
          :delivery-window="deliveryWindow"
          :items="items"
          :saving="saving"
          :show-validation="showValidation"
          @save="saveOrder" />
      </aside>
    </div>

    <div class="mt-5 flex justify-start">
      <Button type="button" variant="secondary" @click="cancel">Cancelar</Button>
    </div>

    <div class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
      <div class="mx-auto flex max-w-lg items-center justify-between gap-4">
        <p class="text-sm font-medium text-slate-700">{{ items.length }} {{ items.length === 1 ? 'item' : 'itens' }} · {{ formatCurrency(subtotal) }}</p>
        <Button type="button" size="small" :loading="saving" @click="saveOrder">Salvar</Button>
      </div>
    </div>

    <AlertDialog
      v-model:open="cancelConfirmationOpen"
      title="Deseja sair?"
      description="As alterações deste pedido serão perdidas."
      cancel-label="Continuar editando"
      confirm-label="Sair sem salvar"
      confirm-variant="danger"
      @confirm="leavePage" />
  </div>
</template>

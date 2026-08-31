<script setup lang="ts">
import { computed } from 'vue'
import { Alert, Button, Card, CheckIcon, TriangleAlertIcon } from '@thiagoschoeffel/ts-components'
import { formatCurrency, offers } from './mockData'
import type { Customer, CustomerAddress, OrderItem } from './types'

const props = withDefaults(defineProps<{
  customer?: Customer
  address?: CustomerAddress
  deliveryWindow?: string
  items: OrderItem[]
  saving?: boolean
  showValidation?: boolean
}>(), {
  customer: undefined,
  address: undefined,
  deliveryWindow: undefined,
  saving: false,
  showValidation: false
})

defineEmits<{ save: [] }>()

const subtotal = computed(() => props.items.reduce((total, item) => total + item.price, 0))
const suggestedCredit = computed(() => {
  const firstItem = props.items[0]
  if (!firstItem)
    return 0
  return offers.find((offer) => offer.id === firstItem.offerId)?.price ?? 0
})
const deliveryFee = computed(() => props.address ? 4 : 0)
const total = computed(() => Math.max(0, subtotal.value - suggestedCredit.value) + deliveryFee.value)
const restrictionConflicts = computed(() => props.items.filter((item) => item.hasRestrictionConflict).length)
</script>

<template>
  <Card>
    <template #header>
      <h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Resumo do pedido</h2>
    </template>

    <div class="space-y-5">
      <div>
        <p class="text-xs text-slate-400">Cliente</p>
        <p class="mt-1 font-medium text-slate-800">{{ props.customer?.name ?? 'Não selecionado' }}</p>
      </div>

      <div>
        <p class="text-xs text-slate-400">Entrega</p>
        <p class="mt-1 font-medium text-slate-800">{{ props.deliveryWindow ?? 'Janela não definida' }}</p>
        <p v-if="props.address" class="mt-1 text-xs leading-5 text-slate-500">{{ props.address.street }} · {{ props.address.neighborhood }}</p>
      </div>

      <div class="flex items-center justify-between gap-4">
        <span class="text-sm text-slate-500">Itens</span>
        <span class="font-medium text-slate-800">{{ props.items.length }}</span>
      </div>

      <div class="space-y-2 border-t border-slate-200 pt-4">
        <div class="flex justify-between gap-4 text-sm">
          <span class="text-slate-500">Subtotal</span>
          <span class="font-medium text-slate-800">{{ formatCurrency(subtotal) }}</span>
        </div>
        <div class="flex justify-between gap-4 text-sm">
          <span class="text-slate-500">Taxa de entrega</span>
          <span class="font-medium text-slate-800">{{ formatCurrency(deliveryFee) }}</span>
        </div>
      </div>

      <Alert
        v-if="suggestedCredit"
        variants="success"
        size="small"
        title="1 crédito compatível sugerido"
        description="O crédito será consumido somente na confirmação.">
        <template #icon><CheckIcon /></template>
      </Alert>

      <div class="flex items-end justify-between gap-4 border-t border-slate-200 pt-4">
        <span class="text-sm font-medium text-slate-600">Total financeiro</span>
        <span class="text-lg font-semibold text-slate-900">{{ formatCurrency(total) }}</span>
      </div>

      <Alert
        v-if="restrictionConflicts"
        variants="warning"
        size="small"
        title="Pendência"
        :description="`${restrictionConflicts} item precisa de revisão por restrição alimentar.`">
        <template #icon><TriangleAlertIcon /></template>
      </Alert>

      <Alert
        v-if="props.showValidation && (!props.customer || props.items.length === 0)"
        variants="danger"
        size="small"
        description="Selecione um cliente e adicione pelo menos um item para salvar." />
    </div>

    <template #footer>
      <Button class="w-full" type="button" :loading="props.saving" @click="$emit('save')">Salvar pedido</Button>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Alert, Button, Card, CheckIcon, TriangleAlertIcon } from '@thiagoschoeffel/ts-components'
import { formatAddressLocation, formatAddressStreet } from './address'
import { formatCurrency } from './mockData'
import type { Customer, CustomerAddress, OrderItem } from './types'

const props = withDefaults(defineProps<{
  customer?: Customer
  address?: CustomerAddress
  deliveryWindow?: string
  items: OrderItem[]
  deliveryFee?: number
  discount?: number
  planCreditCount?: number
  planCreditValue?: number
  financialCreditValue?: number
  paymentCondition?: string
  paymentMethod?: string
  paymentDueDate?: string
  saving?: boolean
  showValidation?: boolean
  saveLabel?: string
}>(), {
  customer: undefined,
  address: undefined,
  deliveryWindow: undefined,
  deliveryFee: 0,
  discount: 0,
  planCreditCount: 0,
  planCreditValue: 0,
  financialCreditValue: 0,
  paymentCondition: undefined,
  paymentMethod: undefined,
  paymentDueDate: undefined,
  saving: false,
  showValidation: false,
  saveLabel: 'Salvar pedido'
})

defineEmits<{ save: [] }>()

const subtotal = computed(() => props.items.reduce((total, item) => total + item.price, 0))
const total = computed(() => Math.max(
  0,
  subtotal.value + props.deliveryFee - props.discount - props.planCreditValue - props.financialCreditValue
))
const restrictionConflicts = computed(() => props.items.filter((item) => item.hasRestrictionConflict).length)
const paymentDueDateLabel = computed(() => props.paymentDueDate
  ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${props.paymentDueDate}T12:00:00`))
  : undefined)
</script>

<template>
  <Card class="[&>footer]:hidden lg:[&>footer]:block">
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
        <template v-if="props.address">
          <p class="mt-1 text-xs leading-5 text-slate-600">{{ formatAddressStreet(props.address) }}</p>
          <p class="text-xs leading-5 text-slate-500">{{ formatAddressLocation(props.address) }}</p>
        </template>
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
          <span class="font-medium text-slate-800">{{ formatCurrency(props.deliveryFee) }}</span>
        </div>
        <div v-if="props.discount" class="flex justify-between gap-4 text-sm">
          <span class="text-slate-500">Desconto</span>
          <span class="font-medium text-emerald-700">− {{ formatCurrency(props.discount) }}</span>
        </div>
        <div v-if="props.planCreditValue" class="flex justify-between gap-4 text-sm">
          <span class="text-slate-500">Crédito de plano</span>
          <span class="font-medium text-emerald-700">− {{ formatCurrency(props.planCreditValue) }}</span>
        </div>
        <div v-if="props.financialCreditValue" class="flex justify-between gap-4 text-sm">
          <span class="text-slate-500">Crédito financeiro</span>
          <span class="font-medium text-emerald-700">− {{ formatCurrency(props.financialCreditValue) }}</span>
        </div>
      </div>

      <Alert
        v-if="props.planCreditCount"
        variants="success"
        size="small"
        :title="`${props.planCreditCount} ${props.planCreditCount === 1 ? 'crédito compatível selecionado' : 'créditos compatíveis selecionados'}`"
        description="O crédito será consumido somente na confirmação.">
        <template #icon><CheckIcon /></template>
      </Alert>

      <div v-if="props.paymentCondition || props.paymentMethod" class="border-t border-slate-200 pt-4">
        <p class="text-xs text-slate-400">Pagamento previsto</p>
        <p class="mt-1 font-medium text-slate-800">{{ [props.paymentCondition, props.paymentMethod].filter(Boolean).join(' · ') }}</p>
        <p v-if="paymentDueDateLabel" class="mt-1 text-xs text-slate-500">Vencimento em {{ paymentDueDateLabel }}</p>
        <p class="mt-1 text-xs text-slate-500">Recebimento ainda não registrado</p>
      </div>

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
      <Button class="w-full" type="button" :loading="props.saving" @click="$emit('save')">{{ props.saveLabel }}</Button>
    </template>
  </Card>
</template>

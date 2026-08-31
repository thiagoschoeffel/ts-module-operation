<script setup lang="ts">
import { Checkbox, DatePicker, Input, SectionCard, Select } from '@thiagoschoeffel/ts-components'
import type { DateValue } from '@thiagoschoeffel/ts-components'
import { formatCurrency, paymentConditionOptions, paymentMethodOptions } from './mockData'
import type { PaymentCondition, PaymentMethod } from './types'

const props = withDefaults(defineProps<{
  enabled?: boolean
  paymentCondition: PaymentCondition
  paymentMethod: PaymentMethod
  paymentDueDate?: DateValue
  deliveryFee: number
  discount: number
  discountLimit: number
  discountReason: string
  usePlanCredit: boolean
  compatiblePlanCreditCount: number
  compatiblePlanCreditValue: number
  compatiblePlanName?: string
  useFinancialCredit: boolean
  financialCreditBalance: number
  showValidation?: boolean
}>(), {
  enabled: false,
  compatiblePlanName: undefined,
  showValidation: false
})

const emit = defineEmits<{
  'update:paymentCondition': [value: PaymentCondition]
  'update:paymentMethod': [value: PaymentMethod]
  'update:paymentDueDate': [value: DateValue | undefined]
  'update:deliveryFee': [value: number]
  'update:discount': [value: number]
  'update:discountReason': [value: string]
  'update:usePlanCredit': [value: boolean]
  'update:useFinancialCredit': [value: boolean]
}>()

function normalizeAmount(value: string | number) {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.max(0, amount) : 0
}
</script>

<template>
  <SectionCard
    title="Financeiro"
    :disabled="!props.enabled"
    :description="props.enabled
      ? 'Defina as condições financeiras deste pedido aberto.'
      : 'Adicione pelo menos um item para configurar cobrança e créditos.'">
    <div v-if="props.enabled" class="space-y-5">
      <div class="grid gap-4 sm:grid-cols-2">
        <Select
          :model-value="props.paymentCondition"
          label="Condição de pagamento"
          :options="paymentConditionOptions"
          @update:model-value="emit('update:paymentCondition', $event as PaymentCondition)" />
        <Select
          :model-value="props.paymentMethod"
          label="Forma de pagamento"
          :options="paymentMethodOptions"
          @update:model-value="emit('update:paymentMethod', $event as PaymentMethod)" />
        <DatePicker
          v-if="props.paymentCondition === 'deferred'"
          :model-value="props.paymentDueDate"
          label="Vencimento"
          description="Data prevista da cobrança, não do pagamento recebido."
          :error="props.showValidation && !props.paymentDueDate ? 'Informe o vencimento.' : undefined"
          clearable
          required
          @update:model-value="emit('update:paymentDueDate', $event)" />
      </div>

      <div
        v-if="props.compatiblePlanCreditCount || props.financialCreditBalance"
        class="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <Checkbox
          v-if="props.compatiblePlanCreditCount"
          :model-value="props.usePlanCredit"
          :label="`Usar ${props.compatiblePlanCreditCount} ${props.compatiblePlanCreditCount === 1 ? 'crédito compatível' : 'créditos compatíveis'}`"
          :description="`${props.compatiblePlanName} · ${formatCurrency(props.compatiblePlanCreditValue)} cobertos. O consumo ocorrerá somente na confirmação.`"
          @update:model-value="emit('update:usePlanCredit', $event === true)" />

        <Checkbox
          v-if="props.financialCreditBalance"
          :model-value="props.useFinancialCredit"
          label="Usar crédito financeiro"
          :description="`Saldo disponível: ${formatCurrency(props.financialCreditBalance)}. É separado dos créditos de plano.`"
          @update:model-value="emit('update:useFinancialCredit', $event === true)" />
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <Input
          type="number"
          min="0"
          step="0.01"
          inputmode="decimal"
          label="Taxa de entrega"
          :model-value="props.deliveryFee"
          @update:model-value="emit('update:deliveryFee', normalizeAmount($event))">
          <template #leading><span class="text-sm text-slate-400">R$</span></template>
        </Input>

        <Input
          type="number"
          min="0"
          step="0.01"
          inputmode="decimal"
          label="Desconto manual"
          :model-value="props.discount"
          :max="props.discountLimit"
          :error="props.showValidation && props.discount > props.discountLimit ? `O desconto máximo neste pedido é ${formatCurrency(props.discountLimit)}.` : undefined"
          @update:model-value="emit('update:discount', normalizeAmount($event))">
          <template #leading><span class="text-sm text-slate-400">R$</span></template>
        </Input>
      </div>

      <Input
        v-if="props.discount > 0"
        :model-value="props.discountReason"
        label="Motivo do desconto"
        placeholder="Informe por que o desconto foi aplicado"
        :error="props.showValidation && !props.discountReason.trim() ? 'Informe o motivo do desconto.' : undefined"
        required
        @update:model-value="emit('update:discountReason', String($event))" />

      <p class="text-xs leading-5 text-slate-500">
        Estes dados permanecem provisórios enquanto o pedido estiver aberto. Cobrança, créditos e valores serão consolidados somente na confirmação; o pagamento recebido é registrado separadamente.
      </p>
    </div>
  </SectionCard>
</template>

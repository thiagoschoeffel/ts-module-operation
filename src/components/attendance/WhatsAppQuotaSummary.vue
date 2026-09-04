<script setup lang="ts">
import { computed } from 'vue'
import { Badge, Progress } from '@thiagoschoeffel/ts-components'
import {
  freeMessagesRemaining,
  messagesUntilAutomationPause,
  operationalQuotaUsage,
  quotaPercentage
} from '../../domain/whatsappQuota'
import type { WhatsAppQuotaUsage } from '../../types/attendance'

const props = defineProps<{
  usage: WhatsAppQuotaUsage
}>()

const variant = computed(() => {
  if (props.usage.status === 'automation-blocked') return 'danger'
  if (props.usage.status === 'critical' || props.usage.status === 'alert') return 'warning'
  return props.usage.status === 'attention' ? 'info' : 'success'
})

const statusLabel = computed(() => ({
  normal: 'Dentro da margem',
  attention: 'Atenção',
  alert: 'Alerta',
  critical: 'Crítico',
  'automation-blocked': 'Automação pausada'
})[props.usage.status])
</script>

<template>
  <div class="contents">
    <div class="mt-2 lg:col-start-1 lg:row-start-2">
      <div class="flex flex-wrap items-center gap-2">
        <h2 id="whatsapp-quota-title" class="font-semibold text-slate-800">Franquia do WhatsApp</h2>
        <Badge :variant="variant" size="small">{{ statusLabel }}</Badge>
      </div>
      <p class="mt-0.5 text-xs text-slate-500">{{ usage.periodLabel }} · {{ usage.businessPhoneNumber }}</p>
    </div>

    <section
      class="w-full max-w-md lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:justify-self-end lg:self-end"
      aria-labelledby="whatsapp-quota-title">
      <div class="mb-1.5 flex items-baseline justify-between gap-3">
        <p class="font-semibold tabular-nums text-slate-800">
          {{ usage.deliveredServiceMessages.toLocaleString('pt-BR') }} / {{ usage.freeServiceMessageLimit.toLocaleString('pt-BR') }}
          <span class="font-normal text-slate-500">entregues</span>
        </p>
        <span class="shrink-0 text-xs font-medium tabular-nums text-slate-500">{{ quotaPercentage(usage).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) }}%</span>
      </div>
      <Progress :value="usage.deliveredServiceMessages" :max="usage.freeServiceMessageLimit"
        :variant="variant" size="small" label="Franquia mensal de mensagens de serviço utilizada" />
      <div class="mt-2 text-xs leading-5 text-slate-500">
        <p v-if="usage.status === 'automation-blocked'" class="font-medium text-red-700">
          A margem de segurança foi atingida. Novas respostas automáticas estão pausadas; recebimento, histórico e atendimento humano continuam disponíveis.
        </p>
        <p v-else>
          <span class="font-medium text-slate-700">{{ messagesUntilAutomationPause(usage) }}</span> até pausar a automação
          <span v-if="usage.reservedServiceMessages"> · {{ usage.reservedServiceMessages }} reservadas em processamento</span>
        </p>
        <p>{{ freeMessagesRemaining(usage) }} gratuitas disponíveis · renova em {{ usage.renewsAtLabel }}</p>
        <p class="sr-only">Uso operacional: {{ operationalQuotaUsage(usage) }} mensagens entregues ou reservadas.</p>
      </div>
    </section>
  </div>
</template>

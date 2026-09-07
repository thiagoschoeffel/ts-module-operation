<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRightIcon, Card, ScrollArea } from '@thiagoschoeffel/ts-components'
import type { ApiOrderStatus } from '../../services/ordersApi'
import type { TodaySnapshot } from '../../services/todayApi'

const props = defineProps<{ snapshot?: TodaySnapshot }>()
const confirmedStatuses = new Set<ApiOrderStatus>(['Confirmed', 'InProduction', 'InPacking', 'InDelivery', 'Completed', 'DeliveryFailed'])
const productionStatuses = new Set<ApiOrderStatus>(['InProduction', 'InPacking', 'InDelivery', 'Completed', 'DeliveryFailed'])
const packedStatuses = new Set<ApiOrderStatus>(['InPacking', 'InDelivery', 'Completed', 'DeliveryFailed'])
const pendingLabel = (count: number, singular: string, plural: string) => `${count} ${count === 1 ? singular : plural}`
const dayFlow = computed(() => {
  const date = props.snapshot?.operationalDate
  const orders = props.snapshot?.orders.filter(order => order.operationalDate === date) ?? []
  const open = orders.filter(order => order.status === 'Open').length
  const awaitingProduction = orders.filter(order => order.status === 'Confirmed' && order.dailyCapacityUnits > 0).length
  const awaitingPacking = orders.filter(order => order.status === 'InProduction').length
  const inDelivery = orders.filter(order => order.status === 'InDelivery').length

  return [
    { label: 'Recebidos', value: orders.length, pending: pendingLabel(open, 'ainda aberto', 'ainda abertos') },
    { label: 'Confirmados', value: orders.filter(order => confirmedStatuses.has(order.status)).length, pending: pendingLabel(awaitingProduction, 'aguarda produção', 'aguardam produção') },
    { label: 'Em produção', value: orders.filter(order => order.dailyCapacityUnits > 0 && productionStatuses.has(order.status)).length, pending: pendingLabel(awaitingPacking, 'aguarda embalagem', 'aguardam embalagem') },
    { label: 'Embalados', value: orders.filter(order => packedStatuses.has(order.status)).length, pending: pendingLabel(inDelivery, 'em rota', 'em rota') },
    { label: 'Entregues', value: orders.filter(order => order.status === 'Completed').length }
  ]
})
</script>

<template>
  <Card>
    <template #header>
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-800">
        Fluxo do dia
      </h2>
    </template>

    <ScrollArea orientation="horizontal">
      <ol class="grid min-w-[40rem] grid-cols-5 pb-10">
        <li v-for="(step, index) in dayFlow" :key="step.label" class="relative min-w-0 text-center">
          <strong class="block text-2xl text-slate-800">{{ step.value }}</strong>
          <span class="mt-1 block font-medium text-slate-600">{{ step.label }}</span>

          <ArrowRightIcon
            v-if="index < dayFlow.length - 1"
            :size="18"
            :stroke-width="1.75"
            class="absolute right-0 top-3 translate-x-1/2 text-slate-400"
            aria-hidden="true" />

          <span
            v-if="step.pending"
            class="absolute left-full top-full mt-4 w-36 -translate-x-1/2 text-center text-xs font-medium leading-4 text-slate-500">
            {{ step.pending }}
          </span>
        </li>
      </ol>
    </ScrollArea>
  </Card>
</template>

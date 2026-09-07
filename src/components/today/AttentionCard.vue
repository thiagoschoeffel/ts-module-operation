<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRightIcon, Badge, Button, Card, TriangleAlertIcon } from '@thiagoschoeffel/ts-components'
import type { TodaySnapshot } from '../../services/todayApi'
import { navigate } from '../../utils/navigation'

const props = defineProps<{ snapshot?: TodaySnapshot }>()
const plural = (count: number, singular: string, pluralValue: string) => count === 1 ? singular : pluralValue
const attentionItems = computed(() => {
  const date = props.snapshot?.operationalDate
  const orders = props.snapshot?.orders.filter(order => order.operationalDate === date) ?? []
  const awaitingReview = orders.filter(order => order.status === 'Open').length
  const failedDeliveries = orders.filter(order => order.status === 'DeliveryFailed').length
  const packedWithoutRoute = props.snapshot?.logistics?.availableOrders
    .filter(order => order.date === date && order.status === 'InPacking').length ?? 0

  return [
    awaitingReview ? {
      message: `${awaitingReview} ${plural(awaitingReview, 'pedido aguardando', 'pedidos aguardando')} revisão`,
      actionLabel: 'Revisar pedidos',
      href: '/operacoes/pedidos?tab=aberto'
    } : undefined,
    failedDeliveries ? {
      message: `${failedDeliveries} ${plural(failedDeliveries, 'entrega falhou', 'entregas falharam')}`,
      actionLabel: plural(failedDeliveries, 'Ver entrega', 'Ver entregas'),
      href: '/operacoes/pedidos?tab=problema'
    } : undefined,
    packedWithoutRoute ? {
      message: `${packedWithoutRoute} ${plural(packedWithoutRoute, 'pedido embalado ainda está', 'pedidos embalados ainda estão')} sem rota`,
      actionLabel: 'Montar rota',
      href: '/operacoes/entregas'
    } : undefined
  ].filter((item): item is { message: string, actionLabel: string, href: string } => Boolean(item))
})

function navigateTo(href?: string) {
  if (href) navigate(href)
}
</script>

<template>
  <Card class="border-l-4 border-l-amber-500">
    <template #header>
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-2 text-slate-800">
          <TriangleAlertIcon
            :size="18"
            :stroke-width="1.75"
            class="shrink-0 text-amber-600"
            aria-hidden="true" />
          <h2 class="text-sm font-semibold uppercase tracking-wide">
            Requer atenção
          </h2>
        </div>
        <Badge class="shrink-0" :variant="attentionItems.length ? 'warning' : 'neutral'">
          {{ attentionItems.length }} {{ attentionItems.length === 1 ? 'pendência' : 'pendências' }}
        </Badge>
      </div>
    </template>

    <p v-if="!attentionItems.length" class="text-sm text-slate-500">Nenhuma pendência operacional para hoje.</p>
    <ul v-else class="divide-y divide-slate-200">
      <li
        v-for="item in attentionItems"
        :key="item.message"
        class="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
        <span class="min-w-0 text-slate-800">{{ item.message }}</span>

        <Button
          class="shrink-0"
          variant="secondary"
          size="small"
          @click="navigateTo(item.href)">
          {{ item.actionLabel }}
          <template #trailingIcon>
            <ArrowRightIcon />
          </template>
        </Button>
      </li>
    </ul>
  </Card>
</template>

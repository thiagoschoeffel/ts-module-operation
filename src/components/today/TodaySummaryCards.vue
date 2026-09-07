<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRightIcon, Card, Progress, TriangleAlertIcon } from '@thiagoschoeffel/ts-components'
import type { TodaySnapshot } from '../../services/todayApi'

const props = defineProps<{ snapshot?: TodaySnapshot }>()
const todayRoutes = computed(() => props.snapshot?.logistics?.routes
  .filter(route => route.date === props.snapshot?.operationalDate) ?? [])

interface SummaryCard {
  label: string
  primary: string
  secondary: string
  footerLabel: string
  hasAlert?: boolean
  progress?: {
    value: number
    max: number
    label: string
    variant?: 'info' | 'danger'
  }
  action: {
    label: string
    href: string
  }
}

const summaries = computed<SummaryCard[]>(() => [
  {
    label: 'Pedidos',
    primary: String(props.snapshot?.orders.filter(order => order.operationalDate === props.snapshot?.operationalDate).length ?? 0),
    secondary: 'no dia operacional',
    footerLabel: 'Abrir pedidos',
    action: { label: 'Abrir pedidos', href: '/operacoes/pedidos' }
  },
  {
    label: 'Capacidade',
    primary: props.snapshot?.capacity ? `${props.snapshot.capacity.reservedUnits} / ${props.snapshot.capacity.totalUnits}` : '—',
    secondary: props.snapshot?.capacity ? `${props.snapshot.capacity.availableUnits} restantes` : 'não configurada',
    footerLabel: 'Ver pedidos',
    hasAlert: props.snapshot?.capacity?.availableUnits === 0,
    progress: props.snapshot?.capacity ? {
      value: props.snapshot.capacity.reservedUnits,
      max: props.snapshot.capacity.totalUnits,
      label: 'Capacidade utilizada',
      variant: props.snapshot.capacity.availableUnits === 0 ? 'danger' : 'info'
    } : undefined,
    action: { label: 'Ver pedidos', href: '/operacoes/pedidos' }
  },
  {
    label: 'Embalagem',
    primary: String(props.snapshot?.packing?.awaiting.length ?? 0),
    secondary: 'aguardando',
    footerLabel: 'Abrir fila',
    action: { label: 'Abrir fila', href: '/operacoes/embalagem' }
  },
  {
    label: 'Entregas',
    primary: String(todayRoutes.value.flatMap(route => route.stops).filter(stop => stop.result === 'Succeeded').length),
    secondary: 'concluídas',
    footerLabel: todayRoutes.value.some(route => route.stops.some(stop => stop.result === 'Failed')) ? 'Ver falhas' : 'Ver logística',
    hasAlert: todayRoutes.value.some(route => route.stops.some(stop => stop.result === 'Failed')),
    action: { label: 'Ver logística', href: '/operacoes/entregas' }
  }
])
</script>

<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <Card v-for="summary in summaries" :key="summary.label" class="h-full">
      <template #header>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-800">
          {{ summary.label }}
        </h2>
      </template>

      <p class="text-3xl font-bold text-slate-800">{{ summary.primary }}</p>
      <Progress
        v-if="summary.progress"
        class="mt-3"
        :value="summary.progress.value"
        :max="summary.progress.max"
        :variant="summary.progress.variant"
        :label="summary.progress.label" />
      <p :class="summary.progress ? 'mt-3' : 'mt-1'" class="font-medium text-slate-600">
        {{ summary.secondary }}
      </p>

      <template #footer>
        <a
          :href="summary.action.href"
          :aria-label="summary.action.label"
          class="-mx-6 -my-4 flex items-center justify-between gap-3 px-6 py-4 text-slate-800">
          <span class="flex items-center gap-2 font-medium">
            <TriangleAlertIcon
              v-if="summary.hasAlert"
              :size="16"
              :stroke-width="1.75"
              class="shrink-0 text-amber-600"
              aria-hidden="true" />
            {{ summary.footerLabel }}
          </span>
          <ArrowRightIcon :size="16" :stroke-width="1.75" class="shrink-0" aria-hidden="true" />
        </a>
      </template>
    </Card>
  </div>
</template>

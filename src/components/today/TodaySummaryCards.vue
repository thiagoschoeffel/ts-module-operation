<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRightIcon, Card, Progress, TriangleAlertIcon } from '@thiagoschoeffel/ts-components'
import { getPackingSnapshot } from '../../mocks/packing'

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
  }
  action: {
    label: string
    href: string
  }
}

const packing = getPackingSnapshot()
const summaries = computed<SummaryCard[]>(() => [
  {
    label: 'Pedidos',
    primary: '42',
    secondary: 'confirmados',
    footerLabel: 'Revisar 4 pedidos',
    hasAlert: true,
    action: { label: 'Revisar 4 pedidos', href: '/operacoes/pedidos?tab=revisao' }
  },
  {
    label: 'Capacidade',
    primary: '71 / 90',
    secondary: '19 restantes',
    footerLabel: 'Ver produção',
    progress: {
      value: 71,
      max: 90,
      label: 'Capacidade utilizada'
    },
    action: { label: 'Ver produção', href: '/operacoes/producao' }
  },
  {
    label: 'Embalagem',
    primary: String(packing.awaiting.length),
    secondary: 'aguardando',
    footerLabel: 'Abrir fila',
    action: { label: 'Abrir fila', href: '/operacoes/embalagem' }
  },
  {
    label: 'Entregas',
    primary: '18',
    secondary: 'concluídas',
    footerLabel: 'Ver 1 falha',
    hasAlert: true,
    action: { label: 'Ver 1 falha', href: '/operacoes/entregas' }
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

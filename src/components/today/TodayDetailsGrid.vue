<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRightIcon, Badge, Card, EmptyState } from '@thiagoschoeffel/ts-components'
import { getPublishedMenu, localDateIso } from '../../mocks/dailyMenu'
import { getPackingQueue, getProductionSnapshot, type ApiPackingQueue, type ApiProductionSnapshot } from '../../services/operationsApi'
import type { AuthenticatedApiRequest } from '../../services/ordersApi'
import { getLogistics, type LogisticsSnapshot } from '../../services/logisticsApi'

const props = defineProps<{ apiRequest?: AuthenticatedApiRequest }>()

const menu = getPublishedMenu()
const menuOptions = computed(() => (menu?.options ?? []).map(option => ({
  label: option.category,
  detail: option.producibleName,
  status: option.availability === 'available' ? 'Disponível' : option.availability === 'sold-out' ? 'Esgotada' : 'Suspensa',
  variant: option.availability === 'available' ? 'success' : option.availability === 'sold-out' ? 'warning' : 'danger'
} as const)))
const menuHref = `/cardapios/${menu?.date ?? localDateIso()}`

const production = ref<ApiProductionSnapshot>()
const packing = ref<ApiPackingQueue>()
const logistics = ref<LogisticsSnapshot>()
onMounted(async () => {
  if (!props.apiRequest) return
  try {
    [production.value, packing.value, logistics.value] = await Promise.all([
      getProductionSnapshot(props.apiRequest),
      getPackingQueue(props.apiRequest),
      getLogistics(props.apiRequest)
    ])
  }
  catch { /* As páginas dedicadas oferecem a retentativa operacional. */ }
})
const productionItems = computed(() => (production.value?.needs ?? []).slice(0, 3).map(item => ({
  label: item.name,
  quantity: item.quantity,
  unit: item.unit
})))

const packagingItems = computed(() => [
  { label: 'aguardando conferência', quantity: packing.value?.awaiting.length ?? 0 },
  { label: 'itens pendentes', quantity: packing.value?.awaitingItemCount ?? 0 },
  { label: 'embalados', quantity: packing.value?.packed.length ?? 0 }
])

const routeItems = computed(() => [
  { label: 'pedidos sem rota', quantity: logistics.value?.availableOrders.length ?? 0 },
  { label: 'rotas planejadas', quantity: logistics.value?.routes.filter(x => x.status === 'Planned').length ?? 0 },
  { label: 'rotas em execução', quantity: logistics.value?.routes.filter(x => x.status === 'InProgress').length ?? 0 }
])

const deliveryItems = computed(() => [
  { label: 'entregues', quantity: logistics.value?.routes.flatMap(x => x.stops).filter(x => x.result === 'Succeeded').length ?? 0 },
  { label: 'falhas', quantity: logistics.value?.routes.flatMap(x => x.stops).filter(x => x.result === 'Failed').length ?? 0 }
])
</script>

<template>
  <div class="grid items-start grid-cols-1 gap-4 lg:grid-cols-2">
    <Card>
      <template #header>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-800">
          Cardápio
        </h2>
      </template>

      <div v-if="menu" class="mb-4 flex items-center gap-2 font-medium text-slate-800">
        <span class="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
        Publicado
      </div>

      <dl v-if="menu" class="space-y-2">
        <div v-for="option in menuOptions" :key="option.label" class="flex justify-between gap-4">
          <dt><span class="block">{{ option.label }}</span><span class="text-xs text-slate-500">{{ option.detail }}</span></dt>
          <dd><Badge :variant="option.variant">{{ option.status }}</Badge></dd>
        </div>
      </dl>
      <EmptyState v-else :bordered="false" title="Cardápio não publicado" description="Publique o cardápio para disponibilizá-lo na operação.">
        <template #icon><span class="text-lg" aria-hidden="true">—</span></template>
      </EmptyState>

      <template #footer>
        <a
          :href="menuHref"
          class="-mx-6 -my-4 flex w-[calc(100%+3rem)] cursor-pointer items-center justify-between px-6 py-4 font-medium text-slate-800"
          >
          Ver cardápio
          <ArrowRightIcon :size="16" :stroke-width="1.75" aria-hidden="true" />
        </a>
      </template>
    </Card>

    <Card>
      <template #header>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-800">
          Produção
        </h2>
      </template>

      <dl class="space-y-2">
        <div v-for="item in productionItems" :key="item.label" class="flex justify-between gap-4">
          <dt>{{ item.label }}</dt>
          <dd class="text-slate-600">
            <span class="font-medium text-slate-800">{{ item.quantity }}</span>
            {{ item.unit }}
          </dd>
        </div>
      </dl>

      <template #footer>
        <a
          href="/operacoes/producao"
          class="-mx-6 -my-4 flex items-center justify-between px-6 py-4 font-medium text-slate-800">
          Ver produção
          <ArrowRightIcon :size="16" :stroke-width="1.75" aria-hidden="true" />
        </a>
      </template>
    </Card>

    <Card>
      <template #header>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-800">
          Embalagem
        </h2>
      </template>

      <dl class="space-y-2">
        <div v-for="item in packagingItems" :key="item.label" class="flex items-center gap-2">
          <dt class="order-2">{{ item.label }}</dt>
          <dd class="order-1 font-medium text-slate-800">{{ item.quantity }}</dd>
        </div>
      </dl>

      <template #footer>
        <a
          href="/operacoes/embalagem"
          class="-mx-6 -my-4 flex items-center justify-between px-6 py-4 font-medium text-slate-800">
          Abrir fila
          <ArrowRightIcon :size="16" :stroke-width="1.75" aria-hidden="true" />
        </a>
      </template>
    </Card>

    <Card>
      <template #header>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-800">
          Rotas e entregas
        </h2>
      </template>

      <div class="space-y-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Rotas</p>
          <dl class="mt-2 space-y-2">
            <div v-for="item in routeItems" :key="item.label" class="flex items-center gap-2">
              <dt class="order-2">{{ item.label }}</dt>
              <dd class="order-1 font-medium text-slate-800">{{ item.quantity }}</dd>
            </div>
          </dl>
        </div>

        <div class="border-t border-slate-200 pt-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Entregas</p>
          <dl class="mt-2 space-y-2">
            <div v-for="item in deliveryItems" :key="item.label" class="flex items-center gap-2">
              <dt class="order-2">{{ item.label }}</dt>
              <dd class="order-1 font-medium text-slate-800">{{ item.quantity }}</dd>
            </div>
          </dl>
        </div>
      </div>

      <template #footer>
        <a
          href="/operacoes/entregas"
          class="-mx-6 -my-4 flex items-center justify-between px-6 py-4 font-medium text-slate-800">
          Ver logística
          <ArrowRightIcon :size="16" :stroke-width="1.75" aria-hidden="true" />
        </a>
      </template>
    </Card>
  </div>
</template>

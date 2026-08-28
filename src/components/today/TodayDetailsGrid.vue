<script setup lang="ts">
import { ArrowRightIcon, Badge, Card } from '@thiagoschoeffel/ts-components'

const menuOptions = [
  { label: 'Tradicional', status: 'Disponível', variant: 'success' },
  { label: 'Low Carb', status: 'Disponível', variant: 'success' },
  { label: 'Vegetariano', status: 'Esgotado', variant: 'warning' }
] as const

const productionItems = [
  { label: 'Estrogonofe', quantity: 36, unit: 'porções' },
  { label: 'Frango', quantity: 12, unit: 'porções' },
  { label: 'Salada P', quantity: 22, unit: 'unidades' }
]

const packagingItems = [
  { label: 'aguardando', quantity: 7 },
  { label: 'embalados', quantity: 29 },
  { label: 'prontos para rota', quantity: 8 }
]

const routeItems = [
  { label: 'pedidos sem rota', quantity: 8 },
  { label: 'rotas planejadas', quantity: 2 },
  { label: 'rota em execução', quantity: 1 }
]

const deliveryItems = [
  { label: 'entregues', quantity: 18 },
  { label: 'falha', quantity: 1 }
]
</script>

<template>
  <div class="grid items-start grid-cols-1 gap-4 lg:grid-cols-2">
    <Card>
      <template #header>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-800">
          Cardápio
        </h2>
      </template>

      <div class="mb-4 flex items-center gap-2 font-medium text-slate-800">
        <span class="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
        Publicado
      </div>

      <dl class="space-y-2">
        <div v-for="option in menuOptions" :key="option.label" class="flex justify-between gap-4">
          <dt>{{ option.label }}</dt>
          <dd><Badge :variant="option.variant">{{ option.status }}</Badge></dd>
        </div>
      </dl>

      <template #footer>
        <button
          class="-mx-6 -my-4 flex w-[calc(100%+3rem)] cursor-pointer items-center justify-between px-6 py-4 font-medium text-slate-800"
          type="button">
          Ver cardápio
          <ArrowRightIcon :size="16" :stroke-width="1.75" aria-hidden="true" />
        </button>
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

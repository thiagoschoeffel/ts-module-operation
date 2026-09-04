<script setup lang="ts">
import { computed } from 'vue'
import { Badge, sanitizeRichText } from '@thiagoschoeffel/ts-components'
import type { DeliveryRoute } from '../../mocks/delivery'
import type { OrderDetail } from '../../mocks/orderDetail'

const props = defineProps<{
  route: DeliveryRoute
  orders: OrderDetail[]
}>()

const windows = computed(() => [...new Set(props.orders.map(order => order.deliveryWindow).filter(Boolean))].join(' · '))
const printDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date())

function richTextPlainText(value?: string) {
  return sanitizeRichText(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function fullAddress(order: OrderDetail) {
  const value = order.deliveryAddress
  if (!value)
    return 'Endereço não informado'
  return [
    `${value.street}, ${value.number}`,
    value.complement,
    value.neighborhood,
    `${value.city} - ${value.state}`,
    `CEP ${value.postalCode}`
  ].filter(Boolean).join(' · ')
}
</script>

<template>
  <article class="route-print-sheet bg-white text-slate-900">
    <header class="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-4">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Sabor Santè · Operação</p>
        <h2 class="mt-1 text-2xl font-bold">Folha de rota #{{ route.id }}</h2>
        <p class="mt-1 text-sm text-slate-600">{{ printDate }}</p>
      </div>
      <Badge :variant="route.status === 'in-progress' ? 'info' : 'neutral'">{{ route.status === 'in-progress' ? 'Em rota' : 'Planejada' }}</Badge>
    </header>

    <dl class="grid gap-x-6 gap-y-3 border-b border-slate-300 py-4 text-sm sm:grid-cols-2">
      <div><dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Entregador</dt><dd class="mt-1 font-semibold">{{ route.driverName }}</dd></div>
      <div><dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Janelas</dt><dd class="mt-1 font-semibold">{{ windows || 'Não informada' }}</dd></div>
      <div><dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Paradas</dt><dd class="mt-1 font-semibold">{{ orders.length }}</dd></div>
      <div><dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Início</dt><dd class="mt-1 font-semibold">{{ route.startedAt ?? '____:____' }}</dd></div>
    </dl>

    <ol class="divide-y divide-slate-300">
      <li v-for="order in orders" :key="`print-${order.id}`" class="break-inside-avoid py-4">
        <div class="flex items-start gap-4">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-slate-900 text-sm font-bold">{{ order.route?.stop }}</span>
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-4">
              <div><h3 class="font-bold">{{ order.customer.name }}</h3><p class="text-sm text-slate-600">Pedido #{{ order.id }} · {{ order.items.length }} {{ order.items.length === 1 ? 'volume' : 'volumes' }}</p></div>
              <p class="shrink-0 text-sm font-semibold">{{ order.deliveryWindow }}</p>
            </div>
            <p class="mt-2 text-sm font-medium">{{ fullAddress(order) }}</p>
            <p class="mt-1 text-sm text-slate-600">Telefone: {{ order.customer.phone }}</p>
            <p v-if="order.customer.restriction" class="mt-2 text-sm font-semibold">Atenção: {{ order.customer.restriction }}</p>
            <p v-if="order.note" class="mt-2 text-sm"><span class="font-semibold">Observação:</span> {{ richTextPlainText(order.note) }}</p>
            <div class="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
              <span>□ Entregue</span><span>□ Falha</span><span>Horário: ____:____</span>
            </div>
          </div>
        </div>
      </li>
    </ol>

    <footer class="mt-4 grid gap-6 border-t-2 border-slate-900 pt-6 text-center text-xs sm:grid-cols-2">
      <div class="border-t border-slate-500 pt-2">Assinatura do entregador</div>
      <div class="border-t border-slate-500 pt-2">Conferência da operação</div>
    </footer>
  </article>
</template>

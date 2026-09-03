<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  Alert,
  Badge,
  Button,
  Card,
  CheckIcon,
  Checkbox,
  EmptyState,
  Input,
  PackageCheckIcon,
  ScrollArea,
  SearchIcon,
  Tabs,
  TriangleAlertIcon,
  type TabItem
} from '@thiagoschoeffel/ts-components'
import { markOrderPacked, type OrderDetail } from '../mocks/orderDetail'
import { getPackingSnapshot } from '../mocks/packing'

type PackingTab = 'awaiting' | 'packed'
type PackingMockScenario = 'padrao' | 'sem-embalagens' | 'sem-resultados' | 'erro'
type CheckboxState = boolean | 'indeterminate'

const params = new URLSearchParams(window.location.search)
const validScenarios = new Set<PackingMockScenario>(['padrao', 'sem-embalagens', 'sem-resultados', 'erro'])
const requestedScenario = params.get('mock')
const mockScenario = validScenarios.has(requestedScenario as PackingMockScenario)
  ? requestedScenario as PackingMockScenario
  : 'padrao'
const requestedTab = params.get('tab')

const snapshot = ref(getPackingSnapshot())
const activeTab = ref<PackingTab>(requestedTab === 'packed' ? 'packed' : 'awaiting')
const search = ref(mockScenario === 'sem-resultados' ? 'Cliente inexistente' : '')
const checkedItems = ref<Record<number, string[]>>({})
const feedback = ref('')
const hasError = ref(mockScenario === 'erro')

const tabs: TabItem[] = [
  { value: 'awaiting', label: 'Aguardando conferência' },
  { value: 'packed', label: 'Embalados' }
]

const availableSnapshot = computed(() => mockScenario === 'sem-embalagens'
  ? { ...snapshot.value, awaiting: [], packed: [], awaitingItemCount: 0, packedItemCount: 0, restrictionCount: 0 }
  : snapshot.value)

const selectedOrders = computed(() => activeTab.value === 'awaiting'
  ? availableSnapshot.value.awaiting
  : availableSnapshot.value.packed)

const normalizedSearch = computed(() => search.value.trim().toLocaleLowerCase('pt-BR'))
const filteredOrders = computed(() => selectedOrders.value.filter((order) => {
  if (!normalizedSearch.value)
    return true
  return String(order.id).includes(normalizedSearch.value)
    || order.customer.name.toLocaleLowerCase('pt-BR').includes(normalizedSearch.value)
    || order.customer.phone.includes(normalizedSearch.value)
}))

const groupedOrders = computed(() => {
  const groups = new Map<string, OrderDetail[]>()
  for (const order of filteredOrders.value) {
    const window = order.deliveryWindow ?? 'Sem janela de entrega'
    groups.set(window, [...(groups.get(window) ?? []), order])
  }
  return [...groups.entries()].map(([window, orders]) => ({ window, orders }))
})

function refresh() {
  snapshot.value = getPackingSnapshot()
}

function updateTab(value: string) {
  activeTab.value = value === 'packed' ? 'packed' : 'awaiting'
  const url = new URL(window.location.href)
  if (activeTab.value === 'packed')
    url.searchParams.set('tab', 'packed')
  else
    url.searchParams.delete('tab')
  window.history.replaceState(window.history.state, '', url)
}

function updateItemCheck(orderId: number, itemId: string, state: CheckboxState) {
  const current = new Set(checkedItems.value[orderId] ?? [])
  if (state === true)
    current.add(itemId)
  else
    current.delete(itemId)
  checkedItems.value = { ...checkedItems.value, [orderId]: [...current] }
}

function isChecked(orderId: number, itemId: string) {
  return checkedItems.value[orderId]?.includes(itemId) ?? false
}

function isOrderReady(order: OrderDetail) {
  return order.items.length > 0 && order.items.every(item => isChecked(order.id, item.id))
}

function toggleAll(order: OrderDetail, state: CheckboxState) {
  checkedItems.value = {
    ...checkedItems.value,
    [order.id]: state === true ? order.items.map(item => item.id) : []
  }
}

function orderCheckState(order: OrderDetail): CheckboxState {
  const checkedCount = checkedItems.value[order.id]?.length ?? 0
  if (checkedCount === 0)
    return false
  if (checkedCount === order.items.length)
    return true
  return 'indeterminate'
}

function finishPacking(order: OrderDetail) {
  if (!isOrderReady(order))
    return
  markOrderPacked(order)
  feedback.value = `Pedido #${order.id} marcado como embalado`
  const nextChecked = { ...checkedItems.value }
  delete nextChecked[order.id]
  checkedItems.value = nextChecked
  refresh()
}

function retry() {
  hasError.value = false
  refresh()
}

onMounted(() => window.addEventListener('storage', refresh))
onBeforeUnmount(() => window.removeEventListener('storage', refresh))
</script>

<template>
  <section aria-label="Fila de embalagem do dia">
    <Alert
      v-if="feedback"
      class="mb-4"
      variants="success"
      :description="feedback"
      closable
      @close="feedback = ''">
      <template #icon><CheckIcon /></template>
    </Alert>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      <Card>
        <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Aguardando</p>
        <p class="mt-2 text-3xl font-semibold tabular-nums text-blue-700">{{ availableSnapshot.awaiting.length }}</p>
        <p class="mt-1 text-xs text-slate-500">pedidos para conferir</p>
      </Card>
      <Card>
        <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Itens pendentes</p>
        <p class="mt-2 text-3xl font-semibold tabular-nums text-slate-900">{{ availableSnapshot.awaitingItemCount }}</p>
        <p class="mt-1 text-xs text-slate-500">volumes a separar</p>
      </Card>
      <Card>
        <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Atenção</p>
        <p class="mt-2 text-3xl font-semibold tabular-nums text-amber-700">{{ availableSnapshot.restrictionCount }}</p>
        <p class="mt-1 text-xs text-slate-500">com restrição ou ajuste</p>
      </Card>
      <Card>
        <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Embalados</p>
        <p class="mt-2 text-3xl font-semibold tabular-nums text-emerald-700">{{ availableSnapshot.packed.length }}</p>
        <p class="mt-1 text-xs text-slate-500">{{ availableSnapshot.packedItemCount }} itens liberados</p>
      </Card>
    </div>

    <Card class="mt-6 [&>div]:p-4">
      <Tabs
        :model-value="activeTab"
        :tabs="tabs"
        aria-label="Estado da fila de embalagem"
        @update:model-value="updateTab">
        <template #badge="{ tab }">
          <Badge :variant="tab.value === 'packed' ? 'success' : 'neutral'">
            {{ tab.value === 'packed' ? availableSnapshot.packed.length : availableSnapshot.awaiting.length }}
          </Badge>
        </template>

        <template #content>
          <Input
            v-model="search"
            class="w-full sm:max-w-sm"
            type="search"
            aria-label="Buscar pedido na fila de embalagem"
            placeholder="Buscar pedido ou cliente..."
            clearable>
            <template #leading><SearchIcon class="size-4" /></template>
          </Input>
        </template>
      </Tabs>
    </Card>

    <EmptyState
      v-if="hasError"
      class="mt-4 bg-white"
      title="Não foi possível carregar a fila"
      description="Tente novamente para consultar os pedidos em embalagem.">
      <template #icon><TriangleAlertIcon /></template>
      <template #action><Button variant="secondary" @click="retry">Tentar novamente</Button></template>
    </EmptyState>

    <EmptyState
      v-else-if="groupedOrders.length === 0"
      class="mt-4 bg-white"
      :title="search ? 'Nenhum pedido encontrado' : activeTab === 'packed' ? 'Nenhum pedido embalado' : 'Fila de embalagem vazia'"
      :description="search ? 'Revise a busca ou limpe o campo para ver toda a fila.' : activeTab === 'packed' ? 'Os pedidos conferidos aparecerão aqui.' : 'Pedidos liberados pela produção aparecerão aqui.'">
      <template #icon><PackageCheckIcon /></template>
    </EmptyState>

    <div v-else class="mt-5 space-y-7">
      <section v-for="group in groupedOrders" :key="group.window" :aria-labelledby="`packing-window-${group.window}`">
        <div class="mb-3 flex items-center justify-between gap-4">
          <h2 :id="`packing-window-${group.window}`" class="text-base font-semibold text-slate-900">
            {{ group.window }}
          </h2>
          <Badge variant="neutral" size="medium">
            {{ group.orders.length }} {{ group.orders.length === 1 ? 'pedido' : 'pedidos' }}
          </Badge>
        </div>

        <ScrollArea
          orientation="horizontal"
          scrollbar-visibility="always"
          class="pb-3 [&_[data-reka-scroll-area-viewport]]:!h-auto">
          <div class="flex items-start gap-4 pb-3">
          <Card
            v-for="order in group.orders"
            :key="order.id"
            class="w-[min(22rem,calc(100vw-3rem))] shrink-0 snap-start">
            <template #header>
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <h3 class="text-base font-semibold text-slate-900">Pedido #{{ order.id }}</h3>
                    <Badge :variant="order.packedAt ? 'success' : 'info'">
                      {{ order.packedAt ? 'Embalado' : 'Em conferência' }}
                    </Badge>
                  </div>
                  <p class="mt-1 truncate text-sm font-medium text-slate-700">{{ order.customer.name }}</p>
                  <p class="text-xs text-slate-500">{{ order.customer.phone }} · {{ order.customer.channel }}</p>
                </div>
                <Checkbox
                  v-if="!order.packedAt"
                  :model-value="orderCheckState(order)"
                  :aria-label="`Conferir todos os itens do pedido ${order.id}`"
                  @update:model-value="toggleAll(order, $event)" />
                <CheckIcon v-else class="size-5 shrink-0 text-emerald-600" aria-hidden="true" />
              </div>
            </template>

            <Alert
              v-if="order.customer.restriction"
              class="mb-4"
              variants="warning"
              size="small"
              :description="`Restrição do cliente: ${order.customer.restriction}`">
              <template #icon><TriangleAlertIcon /></template>
            </Alert>

            <ul class="divide-y divide-slate-100">
              <li v-for="(item, index) in order.items" :key="item.id" class="flex gap-3 py-3 first:pt-0 last:pb-0">
                <Checkbox
                  v-if="!order.packedAt"
                  class="mt-0.5"
                  :model-value="isChecked(order.id, item.id)"
                  :aria-label="`Conferir item ${index + 1} do pedido ${order.id}`"
                  @update:model-value="updateItemCheck(order.id, item.id, $event)" />
                <span v-else class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckIcon class="size-3.5" aria-hidden="true" />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-slate-800">{{ index + 1 }}. {{ item.name }}</p>
                  <p v-for="detail in item.details" :key="detail" class="text-xs leading-5 text-slate-500">{{ detail }}</p>
                  <div v-if="item.customizations.length || item.additions.length" class="mt-2 flex flex-wrap gap-1.5">
                    <Badge v-for="customization in item.customizations" :key="customization" variant="warning">
                      {{ customization }}
                    </Badge>
                    <Badge v-for="addition in item.additions" :key="addition" variant="info">
                      {{ addition }}
                    </Badge>
                  </div>
                </div>
              </li>
            </ul>

            <template #footer>
              <div v-if="order.packedAt" class="flex flex-wrap items-center justify-between gap-3">
                <p class="text-sm text-slate-600">{{ order.packedAt }} · {{ order.packedBy }}</p>
                <a :href="`/operacoes/pedidos/${order.id}`" class="text-sm font-medium text-slate-400 hover:text-slate-800">
                  Ver pedido
                </a>
              </div>
              <div v-else class="flex flex-wrap items-center justify-between gap-3">
                <a :href="`/operacoes/pedidos/${order.id}`" class="text-sm font-medium text-slate-400 hover:text-slate-800">
                  Ver pedido
                </a>
                <Button variant="success" :disabled="!isOrderReady(order)" @click="finishPacking(order)">
                  <template #icon><PackageCheckIcon /></template>
                  Marcar como embalado
                </Button>
              </div>
            </template>
          </Card>
          </div>
        </ScrollArea>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ArrowRightIcon,
  Badge,
  Button,
  Card,
  Chips,
  ClipboardListIcon,
  DataTable,
  Drawer,
  EmptyState,
  Input,
  MultiSelect,
  Pagination,
  SearchIcon,
  SettingsIcon,
  Tabs,
  TriangleAlertIcon,
  type DataTableColumn,
  type DataTableRow,
  type DataTableSortDirection,
  type MultiSelectOption,
  type TabItem
} from '@thiagoschoeffel/ts-components'
import { getOrderSummaries } from '../mocks/orderDetail'
import type { DeliveryWindow, MockOrder as Order, OrderChannel, OrderStatus } from '../mocks/orders'

type OrderSortKey = 'id' | 'customer' | 'statusLabel' | 'deliveryWindow' | 'total'
type OrderListMockScenario = 'padrao' | 'sem-pedidos' | 'sem-resultados' | 'erro'

const initialSearchParams = new URLSearchParams(window.location.search)
const validMockScenarios = new Set<OrderListMockScenario>(['padrao', 'sem-pedidos', 'sem-resultados', 'erro'])
const initialMockScenario = initialSearchParams.get('mock')
const mockScenario: OrderListMockScenario = validMockScenarios.has(initialMockScenario as OrderListMockScenario)
  ? initialMockScenario as OrderListMockScenario
  : 'padrao'
const validStatusValues = new Set<OrderStatus | 'todos'>(['todos', 'revisao', 'aberto', 'andamento', 'concluido', 'problema'])
const validChannels = new Set<OrderChannel>(['WhatsApp', 'Telefone', 'Balcão'])
const validDeliveryWindows = new Set<DeliveryWindow>(['11:00–12:00', '12:00–13:00', '13:00–14:00'])
const validSortKeys = new Set<OrderSortKey>(['id', 'customer', 'statusLabel', 'deliveryWindow', 'total'])
const initialStatus = initialSearchParams.get('tab') ?? 'todos'
const initialSortKey = initialSearchParams.get('ordenar')
const initialSortDirection = initialSearchParams.get('direcao')
const hasInitialDefaultSort = initialSortKey === 'padrao'
const initialPage = Number(initialSearchParams.get('pagina'))

const activeStatus = ref(validStatusValues.has(initialStatus as OrderStatus | 'todos') ? initialStatus : 'todos')
const search = ref(
  initialSearchParams.get('busca')
    ?? (mockScenario === 'sem-resultados' ? 'Cliente inexistente' : '')
)
const debouncedSearch = ref(search.value)
const filtersOpen = ref(false)
const currentPage = ref(Number.isInteger(initialPage) && initialPage > 0 ? initialPage : 1)
const itemsPerPage = 10
const activeSortKey = ref<OrderSortKey | undefined>(
  validSortKeys.has(initialSortKey as OrderSortKey)
    ? initialSortKey as OrderSortKey
    : hasInitialDefaultSort ? undefined : 'id'
)
const activeSortDirection = ref<DataTableSortDirection | undefined>(
  initialSortDirection === 'asc' || initialSortDirection === 'desc'
    ? initialSortDirection
    : hasInitialDefaultSort ? undefined : 'desc'
)
const selectedChannels = ref((initialSearchParams.get('origens') ?? '').split(',').filter((value) => validChannels.has(value as OrderChannel)))
const draftChannels = ref<string[]>([])
const selectedDeliveryWindows = ref((initialSearchParams.get('janelas') ?? '').split(',').filter((value) => validDeliveryWindows.has(value as DeliveryWindow)))
const draftDeliveryWindows = ref<string[]>([])
let searchDebounce: ReturnType<typeof setTimeout> | undefined
let loadingTimeout: ReturnType<typeof setTimeout> | undefined
const isLoading = ref(true)
const hasLoadingError = ref(false)
let isRestoringHistory = false

const channelOptions: MultiSelectOption[] = [
  { value: 'WhatsApp', label: 'WhatsApp' },
  { value: 'Telefone', label: 'Telefone' },
  { value: 'Balcão', label: 'Balcão' }
]

const deliveryWindowOptions: MultiSelectOption[] = [
  { value: '11:00–12:00', label: '11–12h' },
  { value: '12:00–13:00', label: '12–13h' },
  { value: '13:00–14:00', label: '13–14h' }
]

const tableColumns: DataTableColumn[] = [
  { key: 'id', label: 'Pedido', size: 'small', sortable: true },
  { key: 'customer', label: 'Cliente', size: 'small', sortable: true },
  { key: 'statusLabel', label: 'Status', size: 'medium', sortable: true },
  { key: 'deliveryWindow', label: 'Entrega', size: 'medium', sortable: true },
  { key: 'total', label: 'Total', size: 'small', align: 'right', sortable: true }
]

const statusTabs: TabItem[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'revisao', label: 'Revisão' },
  { value: 'aberto', label: 'Abertos' },
  { value: 'andamento', label: 'Em andamento' },
  { value: 'concluido', label: 'Concluídos' },
  { value: 'problema', label: 'Problemas' }
]

const orders: Order[] = mockScenario === 'sem-pedidos' ? [] : getOrderSummaries()

watch(search, (value) => {
  if (searchDebounce)
    clearTimeout(searchDebounce)

  searchDebounce = setTimeout(() => {
    debouncedSearch.value = value
  }, 250)
})

watch(filtersOpen, () => {
  draftChannels.value = [...selectedChannels.value]
  draftDeliveryWindows.value = [...selectedDeliveryWindows.value]
})

function setRowsLoading() {
  if (loadingTimeout)
    clearTimeout(loadingTimeout)

  hasLoadingError.value = false
  isLoading.value = true
  loadingTimeout = setTimeout(() => {
    isLoading.value = false
    hasLoadingError.value = mockScenario === 'erro'
  }, 300)
}

function retryLoading() {
  setRowsLoading()
}

function updateSort(state: { key?: string; direction?: DataTableSortDirection }) {
  activeSortKey.value = validSortKeys.has(state.key as OrderSortKey)
    ? state.key as OrderSortKey
    : undefined
  activeSortDirection.value = state.direction
}

function persistScreenState() {
  if (isRestoringHistory)
    return

  const url = new URL(window.location.href)
  const values = {
    tab: activeStatus.value === 'todos' ? undefined : activeStatus.value,
    busca: debouncedSearch.value || undefined,
    origens: selectedChannels.value.length ? selectedChannels.value.join(',') : undefined,
    janelas: selectedDeliveryWindows.value.length ? selectedDeliveryWindows.value.join(',') : undefined,
    ordenar: activeSortKey.value ?? 'padrao',
    direcao: activeSortDirection.value,
    pagina: currentPage.value > 1 ? String(currentPage.value) : undefined
  }

  for (const [key, value] of Object.entries(values)) {
    if (value)
      url.searchParams.set(key, value)
    else
      url.searchParams.delete(key)
  }

  if (url.href !== window.location.href)
    window.history.pushState(window.history.state, '', url)
}

function restoreScreenStateFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const status = params.get('tab') ?? 'todos'

  activeStatus.value = validStatusValues.has(status as OrderStatus | 'todos') ? status : 'todos'
  search.value = params.get('busca') ?? ''
  debouncedSearch.value = search.value
  selectedChannels.value = (params.get('origens') ?? '')
    .split(',')
    .filter((value) => validChannels.has(value as OrderChannel))
  selectedDeliveryWindows.value = (params.get('janelas') ?? '')
    .split(',')
    .filter((value) => validDeliveryWindows.has(value as DeliveryWindow))
  const sortKey = params.get('ordenar')
  const sortDirection = params.get('direcao')
  const page = Number(params.get('pagina'))
  activeSortKey.value = validSortKeys.has(sortKey as OrderSortKey) ? sortKey as OrderSortKey : undefined
  activeSortDirection.value = sortDirection === 'asc' || sortDirection === 'desc' ? sortDirection : undefined
  currentPage.value = Number.isInteger(page) && page > 0 ? page : 1
}

function handlePopState() {
  isRestoringHistory = true
  restoreScreenStateFromUrl()
  queueMicrotask(() => {
    isRestoringHistory = false
  })
}

watch([activeStatus, debouncedSearch, selectedChannels, selectedDeliveryWindows, activeSortKey, activeSortDirection], () => {
  currentPage.value = 1
  setRowsLoading()
})

watch([activeStatus, debouncedSearch, selectedChannels, selectedDeliveryWindows, activeSortKey, activeSortDirection, currentPage], persistScreenState)

onMounted(() => {
  window.addEventListener('popstate', handlePopState)
  setRowsLoading()
})

onBeforeUnmount(() => {
  if (searchDebounce)
    clearTimeout(searchDebounce)
  if (loadingTimeout)
    clearTimeout(loadingTimeout)
  window.removeEventListener('popstate', handlePopState)
})

function normalizePhone(value: string) {
  return value.replace(/\D/g, '')
}

function applyFilters(close: () => void) {
  selectedChannels.value = [...draftChannels.value]
  selectedDeliveryWindows.value = [...draftDeliveryWindows.value]
  close()
}

function clearFilters(close: () => void) {
  clearAdvancedFilters()
  close()
}

function removeChannelFilter() {
  selectedChannels.value = []
  draftChannels.value = []
}

function removeDeliveryWindowFilter() {
  selectedDeliveryWindows.value = []
  draftDeliveryWindows.value = []
}

function clearSearch() {
  if (searchDebounce)
    clearTimeout(searchDebounce)
  search.value = ''
  debouncedSearch.value = ''
}

function clearAdvancedFilters() {
  selectedChannels.value = []
  selectedDeliveryWindows.value = []
  draftChannels.value = []
  draftDeliveryWindows.value = []
}

function clearSearchAndAdvancedFilters() {
  clearSearch()
  clearAdvancedFilters()
}

function createOrder() {
  window.location.assign(`/operacoes/pedidos/novo?retorno=${encodeURIComponent(listReturnUrl())}`)
}

function openOrder(orderId: number) {
  window.location.assign(orderHref(orderId))
}

function listReturnUrl() {
  return `${window.location.pathname}${window.location.search}`
}

function orderHref(orderId: number) {
  return `/operacoes/pedidos/${orderId}?retorno=${encodeURIComponent(listReturnUrl())}`
}

const ordersMatchingSearchAndFilters = computed(() => {
  const query = debouncedSearch.value.trim().toLocaleLowerCase('pt-BR')
  const phoneQuery = normalizePhone(query)

  return orders.filter((order) => {
    const matchesSearch = !query
      || String(order.id).includes(query)
      || order.customer.toLocaleLowerCase('pt-BR').includes(query)
      || (phoneQuery.length > 0 && normalizePhone(order.phone).includes(phoneQuery))
    const matchesChannel = selectedChannels.value.length === 0
      || selectedChannels.value.includes(order.channel)
    const matchesDeliveryWindow = selectedDeliveryWindows.value.length === 0
      || (order.deliveryWindow != null && selectedDeliveryWindows.value.includes(order.deliveryWindow))

    return matchesSearch && matchesChannel && matchesDeliveryWindow
  })
})

const filteredOrders = computed(() => {
  const matchingOrders = ordersMatchingSearchAndFilters.value
    .filter((order) => activeStatus.value === 'todos' || order.status === activeStatus.value)

  const key = activeSortKey.value
  const direction = activeSortDirection.value === 'asc' ? 1 : -1

  // Sem uma preferência explícita, a fila usa pedidos mais recentes primeiro.
  if (!key || !activeSortDirection.value)
    return [...matchingOrders].sort((first, second) => second.id - first.id)

  return [...matchingOrders].sort((first, second) => {
    const firstValue = key === 'total' ? Number(first.total.replace(/[^\d,]/g, '').replace(',', '.')) : first[key]
    const secondValue = key === 'total' ? Number(second.total.replace(/[^\d,]/g, '').replace(',', '.')) : second[key]

    if (firstValue == null && secondValue == null)
      return 0
    if (firstValue == null)
      return 1
    if (secondValue == null)
      return -1
    if (typeof firstValue === 'number' && typeof secondValue === 'number')
      return (firstValue - secondValue) * direction

    return String(firstValue).localeCompare(String(secondValue), 'pt-BR', {
      numeric: true,
      sensitivity: 'base'
    }) * direction
  })
})

const tabCounts = computed<Record<string, number>>(() =>
  Object.fromEntries(statusTabs.map((tab) => [
    tab.value,
    tab.value === 'todos'
      ? ordersMatchingSearchAndFilters.value.length
      : ordersMatchingSearchAndFilters.value.filter((order) => order.status === tab.value).length
  ]))
)

// Cada seção do drawer representa um grupo de filtro. Assim, dois canais
// selecionados em "Origem" continuam contando como um único filtro ativo.
const activeFilterCount = computed(() =>
  Number(selectedChannels.value.length > 0) + Number(selectedDeliveryWindows.value.length > 0)
)
const hasSearch = computed(() => Boolean(debouncedSearch.value.trim()))
const hasAdvancedFilters = computed(() => activeFilterCount.value > 0)
const activeTabLabel = computed(() =>
  statusTabs.find((tab) => tab.value === activeStatus.value)?.label ?? 'Todos'
)
const emptyStateTitle = computed(() => {
  if (hasLoadingError.value)
    return 'Não foi possível carregar os pedidos'
  return orders.length === 0 ? 'Nenhum pedido hoje' : 'Nenhum pedido encontrado'
})
const emptyStateDescription = computed(() => {
  if (hasLoadingError.value)
    return 'Verifique a conexão e tente carregar a lista novamente.'
  if (orders.length === 0)
    return 'Os pedidos da operação aparecerão aqui conforme forem registrados.'
  if (hasSearch.value && hasAdvancedFilters.value)
    return 'Nenhum pedido corresponde à busca e aos filtros atuais.'
  if (hasSearch.value)
    return `Não encontramos pedidos para “${debouncedSearch.value.trim()}”.`
  if (hasAdvancedFilters.value)
    return 'Nenhum pedido corresponde aos filtros selecionados.'
  if (activeStatus.value !== 'todos')
    return `Nenhum pedido está na etapa “${activeTabLabel.value}”.`
  return 'Não há pedidos para exibir nesta lista.'
})

function selectedLabels(options: MultiSelectOption[], values: string[]) {
  const selectedValues = new Set(values)
  return options
    .filter((option) => selectedValues.has(option.value))
    .map((option) => option.label)
    .join(', ')
}

const selectedChannelLabels = computed(() => selectedLabels(channelOptions, selectedChannels.value))
const selectedDeliveryWindowLabels = computed(() => selectedLabels(deliveryWindowOptions, selectedDeliveryWindows.value))

const statusVariants: Record<OrderStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  revisao: 'warning',
  aberto: 'neutral',
  andamento: 'info',
  concluido: 'success',
  problema: 'danger'
}

const orderActions: Record<OrderStatus, string> = {
  revisao: 'Revisar',
  aberto: 'Continuar',
  andamento: 'Ver',
  concluido: 'Ver',
  problema: 'Tratar'
}

const visibleOrders = computed(() =>
  filteredOrders.value
    .slice((currentPage.value - 1) * itemsPerPage, currentPage.value * itemsPerPage)
)
const tableRows = computed<DataTableRow[]>(() =>
  visibleOrders.value
    .map((order) => ({ ...order }))
)
const visibleOrdersStart = computed(() =>
  filteredOrders.value.length === 0 ? 0 : (currentPage.value - 1) * itemsPerPage + 1
)
const visibleOrdersEnd = computed(() =>
  Math.min(currentPage.value * itemsPerPage, filteredOrders.value.length)
)

function getOrder(row: DataTableRow) {
  return row as unknown as Order
}
</script>

<template>
  <section class="md:flex md:h-full md:min-h-0 md:flex-col" aria-label="Lista de pedidos">
    <Card class="md:shrink-0 [&>div]:p-4">
      <Tabs
        v-model="activeStatus"
        :tabs="statusTabs"
        aria-label="Status dos pedidos"
        size="medium">
        <template #badge="{ tab }">
          <Badge
            size="small"
            :variant="
              tab.value === 'revisao' && tabCounts[tab.value] > 0
                ? 'warning'
                : tab.value === 'problema' && tabCounts[tab.value] > 0
                  ? 'danger'
                  : 'neutral'
            ">
            {{ tabCounts[tab.value] }}
          </Badge>
        </template>

        <template #content>
          <div class="space-y-4">
            <div class="flex flex-wrap items-center gap-4">
              <Input
                v-model="search"
                type="search"
                aria-label="Buscar por cliente, telefone ou pedido"
                placeholder="Buscar cliente, telefone ou pedido..."
                clearable
                class="w-full basis-full sm:w-auto sm:basis-auto sm:flex-1 sm:max-w-sm">
                <template #leading>
                  <SearchIcon class="size-4 text-slate-400" aria-hidden="true" />
                </template>
              </Input>

              <Drawer
                v-model:open="filtersOpen"
                side="right"
                size="large"
                title="Filtros"
                description="Refine os pedidos exibidos nesta lista.">
                <template #trigger>
                  <Button type="button" variant="secondary">
                    <template #icon>
                      <SettingsIcon />
                    </template>
                    Filtros
                    <span
                      v-if="activeFilterCount"
                      class="inline-flex size-4 items-center justify-center rounded-full bg-slate-200 text-[0.625rem] tabular-nums text-slate-700"
                      :aria-label="`${activeFilterCount} filtro ativo`">
                      {{ activeFilterCount }}
                    </span>
                  </Button>
                </template>

                <div class="space-y-5">
                  <MultiSelect
                    v-model="draftChannels"
                    label="Origem"
                    :options="channelOptions"
                    placeholder="Todas as origens"
                    description="Selecione uma ou mais origens." />

                  <MultiSelect
                    v-model="draftDeliveryWindows"
                    label="Janela de entrega"
                    :options="deliveryWindowOptions"
                    placeholder="Todas as janelas"
                    description="Selecione uma ou mais janelas de entrega." />
                </div>

                <template #footer="{ close }">
                  <div class="flex items-center justify-between gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      @click="clearFilters(close)">
                      Limpar
                    </Button>
                    <Button type="button" @click="applyFilters(close)">Aplicar</Button>
                  </div>
                </template>
              </Drawer>
            </div>

            <div v-if="activeFilterCount" class="flex flex-wrap gap-2" aria-label="Filtros avançados ativos">
              <Chips
                v-if="selectedChannels.length"
                variant="primary"
                :aria-label="`Remover filtro de origem: ${selectedChannelLabels}`"
                @remove="removeChannelFilter">
                Origem: {{ selectedChannelLabels }}
              </Chips>
              <Chips
                v-if="selectedDeliveryWindows.length"
                variant="primary"
                :aria-label="`Remover filtro de janela de entrega: ${selectedDeliveryWindowLabels}`"
                @remove="removeDeliveryWindowFilter">
                Janela: {{ selectedDeliveryWindowLabels }}
              </Chips>
            </div>
          </div>
        </template>
      </Tabs>
    </Card>

    <Card class="mt-4 md:min-h-0 md:flex-1 [&>div]:flex [&>div]:min-h-0 [&>div]:flex-col [&>div]:p-4">
      <div class="space-y-3 md:hidden">
        <template v-if="isLoading && !hasLoadingError">
          <div
            v-for="index in 4"
            :key="index"
            class="animate-pulse rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div class="h-4 w-28 rounded bg-slate-200"></div>
            <div class="mt-3 h-4 w-40 rounded bg-slate-200"></div>
            <div class="mt-2 h-3 w-28 rounded bg-slate-100"></div>
            <div class="mt-5 h-3 w-32 rounded bg-slate-100"></div>
          </div>
        </template>

        <template v-else-if="hasLoadingError || visibleOrders.length === 0">
          <EmptyState
            class="bg-white shadow-sm"
            size="large"
            :title="emptyStateTitle"
            :description="emptyStateDescription"
            :role="hasLoadingError ? 'alert' : 'status'">
            <template #icon>
              <TriangleAlertIcon v-if="hasLoadingError" />
              <ClipboardListIcon v-else-if="orders.length === 0" />
              <SearchIcon v-else />
            </template>
            <template #action>
              <Button v-if="hasLoadingError" type="button" variant="secondary" size="small" @click="retryLoading">Tentar novamente</Button>
              <Button v-else-if="orders.length === 0" type="button" variant="secondary" size="small" @click="createOrder">Novo pedido</Button>
              <Button v-else-if="hasSearch && hasAdvancedFilters" type="button" variant="secondary" size="small" @click="clearSearchAndAdvancedFilters">Limpar busca e filtros</Button>
              <Button v-else-if="hasSearch" type="button" variant="secondary" size="small" @click="clearSearch">Limpar busca</Button>
              <Button v-else type="button" variant="secondary" size="small" @click="clearAdvancedFilters">Limpar filtros</Button>
            </template>
          </EmptyState>
        </template>

        <template v-else>
          <Card
            v-for="order in visibleOrders"
            :key="order.id">
          <div class="flex items-start justify-between gap-3">
            <p class="font-semibold text-slate-800">#{{ order.id }}</p>
            <Badge :variant="statusVariants[order.status]">{{ order.statusLabel }}</Badge>
          </div>
          <p class="mt-3 font-medium text-slate-800">{{ order.customer }}</p>
          <p class="mt-1 text-sm text-slate-500">
            {{ order.channel }} · {{ order.itemCount }} {{ order.itemCount === 1 ? 'item' : 'itens' }}
          </p>
          <div class="mt-4 flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
            <p class="text-sm text-slate-500">
              Entrega <span class="font-medium text-slate-700">{{ order.deliveryWindow ?? '—' }}</span>
            </p>
            <p class="font-semibold text-slate-800">{{ order.total }}</p>
          </div>
          <p
            v-if="order.dietaryRestriction"
            class="mt-3 flex items-center gap-1 text-xs font-medium text-amber-700">
            <TriangleAlertIcon class="size-3.5" aria-hidden="true" />
            Restrição alimentar
          </p>
          <template #footer>
            <a
              :href="orderHref(order.id)"
              class="-mx-6 -my-4 flex items-center justify-between gap-3 px-6 py-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-800">
              <span>{{ orderActions[order.status] }}</span>
              <ArrowRightIcon class="size-4 shrink-0" aria-hidden="true" />
            </a>
          </template>
          </Card>
        </template>
      </div>

      <DataTable
        :class="[
          'desktop-only-flex min-h-0 flex-1',
          !isLoading && (hasLoadingError || visibleOrders.length === 0)
            ? '[&_table]:h-full [&_tbody>tr>td]:align-middle'
            : ''
        ]"
        :columns="tableColumns"
        :rows="hasLoadingError ? [] : tableRows"
        :selectable="false"
        :loading="isLoading && !hasLoadingError"
        sort-mode="manual"
        :sort-key="activeSortKey"
        :sort-direction="activeSortDirection"
        row-key="id"
        label="Pedidos filtrados por status, busca, origem e janela de entrega"
        actions-label="Ação"
        empty-text="Nenhum pedido encontrado nesta visão."
        @sort="updateSort">
        <template #cell-id="{ row }">
          <p class="font-semibold text-slate-800">#{{ getOrder(row).id }}</p>
          <p class="mt-1 text-xs text-slate-500">{{ getOrder(row).createdAt }}</p>
        </template>

        <template #cell-customer="{ row }">
          <p class="font-medium text-slate-800">{{ getOrder(row).customer }}</p>
          <p class="mt-1 text-xs text-slate-500">
            {{ getOrder(row).channel }} · {{ getOrder(row).itemCount }} {{ getOrder(row).itemCount === 1 ? 'item' : 'itens' }}
          </p>
          <p v-if="getOrder(row).dietaryRestriction" class="mt-2 flex items-center gap-1 text-xs font-medium text-amber-700">
            <TriangleAlertIcon class="size-3.5" aria-hidden="true" />
            Restrição alimentar
          </p>
        </template>

        <template #cell-statusLabel="{ row }">
          <Badge :variant="statusVariants[getOrder(row).status]">{{ getOrder(row).statusLabel }}</Badge>
        </template>

        <template #cell-deliveryWindow="{ row }">
          <span class="font-medium text-slate-700">{{ getOrder(row).deliveryWindow ?? '—' }}</span>
        </template>

        <template #cell-total="{ row }">
          <span class="font-semibold text-slate-800">{{ getOrder(row).total }}</span>
        </template>

        <template #actions="{ row }">
          <Button
            type="button"
            variant="secondary"
            size="small"
            @click="openOrder(getOrder(row).id)">
            {{ orderActions[getOrder(row).status] }}
            <template #trailingIcon>
              <ArrowRightIcon />
            </template>
          </Button>
        </template>

        <template #empty>
          <EmptyState
            :bordered="false"
            size="large"
            :title="emptyStateTitle"
            :description="emptyStateDescription"
            :role="hasLoadingError ? 'alert' : 'status'">
            <template #icon>
              <TriangleAlertIcon v-if="hasLoadingError" />
              <ClipboardListIcon v-else-if="orders.length === 0" />
              <SearchIcon v-else />
            </template>
            <template #action>
              <Button v-if="hasLoadingError" type="button" variant="secondary" size="small" @click="retryLoading">Tentar novamente</Button>
              <Button v-else-if="orders.length === 0" type="button" variant="secondary" size="small" @click="createOrder">Novo pedido</Button>
              <Button v-else-if="hasSearch && hasAdvancedFilters" type="button" variant="secondary" size="small" @click="clearSearchAndAdvancedFilters">Limpar busca e filtros</Button>
              <Button v-else-if="hasSearch" type="button" variant="secondary" size="small" @click="clearSearch">Limpar busca</Button>
              <Button v-else type="button" variant="secondary" size="small" @click="clearAdvancedFilters">Limpar filtros</Button>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div
        v-if="!hasLoadingError"
        class="mt-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-slate-500" aria-live="polite">
          Mostrando {{ visibleOrdersStart }}–{{ visibleOrdersEnd }} de {{ filteredOrders.length }} pedidos
        </p>
        <Pagination
          v-model="currentPage"
          :total="filteredOrders.length"
          :items-per-page="itemsPerPage"
          size="medium"
          label="Paginação de pedidos" />
      </div>
    </Card>
  </section>
</template>

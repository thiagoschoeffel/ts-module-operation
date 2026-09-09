<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowRightIcon, Badge, Button, Card, ClipboardListIcon, DataTable, EmptyState, Input, Pagination, SearchIcon, Tabs, TriangleAlertIcon, type DataTableColumn, type DataTableRow, type DataTableSortDirection, type TabItem } from '@thiagoschoeffel/ts-components'
import { listOrders, orderStatusPresentation, shortOrderId, type ApiOrderSummary, type AuthenticatedApiRequest } from '../services/ordersApi'
import { navigate } from '../utils/navigation'

const props = defineProps<{ apiRequest?: AuthenticatedApiRequest }>()
const params = new URLSearchParams(window.location.search)
const allowedTabs = new Set(['todos', 'aberto', 'andamento', 'concluido', 'problema'])
const activeStatus = ref(allowedTabs.has(params.get('tab') ?? '') ? params.get('tab')! : 'todos')
const search = ref(params.get('busca') ?? '')
const currentPage = ref(Math.max(1, Number(params.get('pagina')) || 1))
type OrderSortKey = 'operationalDate' | 'customer' | 'status' | 'itemCount' | 'dailyCapacityUnits' | 'totalAmount'
const allowedSortKeys = new Set<OrderSortKey>(['operationalDate', 'customer', 'status', 'itemCount', 'dailyCapacityUnits', 'totalAmount'])
const requestedSortKey = params.get('ordenar') as OrderSortKey | null
const sortKey = ref<OrderSortKey>(requestedSortKey && allowedSortKeys.has(requestedSortKey) ? requestedSortKey : 'operationalDate')
const sortDirection = ref<DataTableSortDirection>(params.get('direcao') === 'asc' ? 'asc' : 'desc')
const orders = ref<ApiOrderSummary[]>([])
const loading = ref(true)
const error = ref('')
const itemsPerPage = 10
let debounce: ReturnType<typeof setTimeout> | undefined
const debouncedSearch = ref(search.value)

const tabs: TabItem[] = [
  { value: 'todos', label: 'Todos' }, { value: 'aberto', label: 'Abertos' },
  { value: 'andamento', label: 'Em andamento' }, { value: 'concluido', label: 'Concluídos' },
  { value: 'problema', label: 'Problemas' }
]
const columns: DataTableColumn[] = [
  { key: 'order', label: 'Pedido', size: 'small' },
  { key: 'customer', label: 'Cliente', size: 'large', sortable: true },
  { key: 'operationalDate', label: 'Data', size: 'medium', sortable: true },
  { key: 'status', label: 'Status', size: 'medium', sortable: true },
  { key: 'itemCount', label: 'Itens', size: 'small', align: 'right', sortable: true },
  { key: 'dailyCapacityUnits', label: 'Produção', size: 'medium', align: 'right', sortable: true },
  { key: 'totalAmount', label: 'Total', size: 'small', align: 'right', sortable: true }
]

watch(search, value => {
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => { debouncedSearch.value = value }, 250)
})
watch([activeStatus, debouncedSearch, sortKey, sortDirection], () => { currentPage.value = 1 })
watch([activeStatus, debouncedSearch, currentPage, sortKey, sortDirection], () => {
  const url = new URL(window.location.href)
  activeStatus.value === 'todos' ? url.searchParams.delete('tab') : url.searchParams.set('tab', activeStatus.value)
  debouncedSearch.value ? url.searchParams.set('busca', debouncedSearch.value) : url.searchParams.delete('busca')
  currentPage.value > 1 ? url.searchParams.set('pagina', String(currentPage.value)) : url.searchParams.delete('pagina')
  url.searchParams.set('ordenar', sortKey.value)
  url.searchParams.set('direcao', sortDirection.value)
  window.history.replaceState(window.history.state, '', url)
})

const filtered = computed(() => {
  const query = debouncedSearch.value.trim().toLocaleLowerCase('pt-BR')
  const matching = orders.value.filter(order => {
    const presentation = orderStatusPresentation[order.status]
    return (activeStatus.value === 'todos' || presentation.group === activeStatus.value)
      && (!query || order.id.toLocaleLowerCase().includes(query)
        || order.customerId.toLocaleLowerCase().includes(query)
        || order.customerName?.toLocaleLowerCase('pt-BR').includes(query))
  })
  const direction = sortDirection.value === 'asc' ? 1 : -1
  return [...matching].sort((first, second) => {
    const firstValue = sortValue(first, sortKey.value)
    const secondValue = sortValue(second, sortKey.value)
    if (typeof firstValue === 'number' && typeof secondValue === 'number')
      return (firstValue - secondValue) * direction
    return String(firstValue).localeCompare(String(secondValue), 'pt-BR', {
      numeric: true,
      sensitivity: 'base'
    }) * direction
  })
})
const visible = computed(() => filtered.value.slice((currentPage.value - 1) * itemsPerPage, currentPage.value * itemsPerPage))
const rows = computed<DataTableRow[]>(() => visible.value.map(order => ({
  ...order,
  order: shortOrderId(order.id),
  customer: customerLabel(order)
})))
const counts = computed(() => Object.fromEntries(tabs.map(tab => [tab.value, tab.value === 'todos'
  ? orders.value.length
  : orders.value.filter(order => orderStatusPresentation[order.status].group === tab.value).length])))
const hasSearch = computed(() => Boolean(debouncedSearch.value.trim()))
const hasFilters = computed(() => hasSearch.value || activeStatus.value !== 'todos')
const emptyTitle = computed(() => error.value
  ? 'Não foi possível carregar os pedidos'
  : orders.value.length ? 'Nenhum pedido encontrado' : 'Nenhum pedido registrado')
const emptyDescription = computed(() => {
  if (error.value) return error.value
  if (hasSearch.value && activeStatus.value !== 'todos') return 'Nenhum pedido corresponde à busca e ao status selecionado.'
  if (hasSearch.value) return `Não encontramos pedidos para “${debouncedSearch.value.trim()}”.`
  if (activeStatus.value !== 'todos') return 'Nenhum pedido corresponde ao status selecionado.'
  return 'Os pedidos criados pela operação aparecerão aqui.'
})

async function load() {
  if (!props.apiRequest) {
    error.value = 'A sessão autenticada não está disponível para consultar pedidos.'
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try { orders.value = await listOrders(props.apiRequest) }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Não foi possível carregar os pedidos.' }
  finally { loading.value = false }
}

function orderHref(id: string) {
  const current = `${window.location.pathname}${window.location.search}`
  return `/operacoes/pedidos/${id}?retorno=${encodeURIComponent(current)}`
}
function formatDate(value: string) { return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00`)) }
function formatCurrency(value: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value) }
function customerLabel(order: ApiOrderSummary) { return order.customerName || `Cliente ${order.customerId.slice(0, 8).toUpperCase()}` }
function sortValue(order: ApiOrderSummary, key: OrderSortKey) {
  if (key === 'customer') return customerLabel(order)
  if (key === 'status') return orderStatusPresentation[order.status].label
  return order[key]
}
function asOrder(row: DataTableRow) { return row as unknown as ApiOrderSummary }
function openOrder(id: string) { navigate(orderHref(id)) }
function createOrder() { navigate(`/operacoes/pedidos/novo?retorno=${encodeURIComponent(window.location.pathname + window.location.search)}`) }
function clearFilters() { search.value = ''; debouncedSearch.value = ''; activeStatus.value = 'todos' }
function updateSort(state: { key?: string; direction?: DataTableSortDirection }) {
  sortKey.value = allowedSortKeys.has(state.key as OrderSortKey)
    ? state.key as OrderSortKey
    : 'operationalDate'
  sortDirection.value = state.direction ?? 'desc'
}

onMounted(load)
onBeforeUnmount(() => { if (debounce) clearTimeout(debounce) })
</script>

<template>
  <section class="md:flex md:h-full md:min-h-0 md:flex-col" aria-label="Lista de pedidos">
    <Card class="md:shrink-0 [&>div]:p-4">
      <Tabs v-model="activeStatus" :tabs="tabs" aria-label="Status dos pedidos">
        <template #badge="{ tab }"><Badge size="small" :variant="tab.value === 'problema' && counts[tab.value] ? 'danger' : 'neutral'">{{ counts[tab.value] }}</Badge></template>
        <template #content>
          <Input v-model="search" type="search" aria-label="Buscar por pedido ou cliente" placeholder="Buscar por identificador do pedido ou cliente..." clearable class="w-full sm:max-w-md">
            <template #leading><SearchIcon /></template>
          </Input>
        </template>
      </Tabs>
    </Card>

    <Card class="mt-4 md:min-h-0 md:flex-1 [&>div]:flex [&>div]:min-h-0 [&>div]:flex-col [&>div]:p-4">
      <div class="space-y-3 md:hidden">
        <template v-if="loading && !error">
          <div v-for="index in 4" :key="index" class="h-36 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
        </template>
        <EmptyState v-else-if="error || !visible.length" size="large" :title="emptyTitle" :description="emptyDescription" :role="error ? 'alert' : 'status'">
          <template #icon><TriangleAlertIcon v-if="error" /><ClipboardListIcon v-else-if="!orders.length" /><SearchIcon v-else /></template>
          <template #action><Button v-if="error" variant="secondary" size="small" @click="load">Tentar novamente</Button><Button v-else-if="!orders.length" variant="secondary" size="small" @click="createOrder">Novo pedido</Button><Button v-else-if="hasFilters" variant="secondary" size="small" @click="clearFilters">Limpar filtros</Button></template>
        </EmptyState>
        <template v-else>
          <Card v-for="order in visible" :key="order.id">
            <div class="flex items-start justify-between gap-3">
              <div><p class="font-semibold text-slate-900">#{{ shortOrderId(order.id) }}</p><p class="mt-1 text-xs text-slate-500">{{ formatDate(order.operationalDate) }}</p></div>
              <Badge :variant="orderStatusPresentation[order.status].variant">{{ orderStatusPresentation[order.status].label }}</Badge>
            </div>
            <p class="mt-4 text-sm font-medium text-slate-700">{{ customerLabel(order) }}</p>
            <p class="mt-1 text-sm text-slate-500">{{ order.itemCount }} {{ order.itemCount === 1 ? 'unidade' : 'unidades' }} · {{ order.dailyCapacityUnits }} de produção diária</p>
            <p class="mt-4 border-t border-slate-100 pt-3 text-right font-semibold text-slate-900">{{ formatCurrency(order.totalAmount) }}</p>
            <template #footer><a :href="orderHref(order.id)" class="-mx-6 -my-4 flex items-center justify-between px-6 py-4 text-sm font-medium text-slate-700 hover:bg-slate-50"><span>Abrir</span><ArrowRightIcon class="size-4" /></a></template>
          </Card>
        </template>
      </div>

      <DataTable
        class="desktop-only-flex min-h-0 flex-1"
        :columns="columns" :rows="error ? [] : rows" :selectable="false"
        :loading="loading && !error" :sort-key="sortKey" :sort-direction="sortDirection"
        sort-mode="manual" row-key="id" label="Pedidos filtrados por status e busca"
        actions-label="Ação" @sort="updateSort">
        <template #cell-order="{ row }"><span class="font-semibold text-slate-800">#{{ shortOrderId(asOrder(row).id) }}</span></template>
        <template #cell-customer="{ row }"><span class="font-medium text-slate-700">{{ customerLabel(asOrder(row)) }}</span></template>
        <template #cell-operationalDate="{ row }">{{ formatDate(asOrder(row).operationalDate) }}</template>
        <template #cell-status="{ row }"><Badge :variant="orderStatusPresentation[asOrder(row).status].variant">{{ orderStatusPresentation[asOrder(row).status].label }}</Badge></template>
        <template #cell-itemCount="{ row }">{{ asOrder(row).itemCount }}</template>
        <template #cell-dailyCapacityUnits="{ row }">{{ asOrder(row).dailyCapacityUnits }}</template>
        <template #cell-totalAmount="{ row }"><span class="font-semibold text-slate-800">{{ formatCurrency(asOrder(row).totalAmount) }}</span></template>
        <template #actions="{ row }"><Button size="small" variant="secondary" @click="openOrder(asOrder(row).id)">Abrir<template #trailingIcon><ArrowRightIcon /></template></Button></template>
        <template #empty><EmptyState :bordered="false" size="large" :title="emptyTitle" :description="emptyDescription" :role="error ? 'alert' : 'status'"><template #icon><TriangleAlertIcon v-if="error" /><ClipboardListIcon v-else-if="!orders.length" /><SearchIcon v-else /></template><template #action><Button v-if="error" variant="secondary" size="small" @click="load">Tentar novamente</Button><Button v-else-if="!orders.length" variant="secondary" size="small" @click="createOrder">Novo pedido</Button><Button v-else-if="hasFilters" variant="secondary" size="small" @click="clearFilters">Limpar filtros</Button></template></EmptyState></template>
      </DataTable>

      <Pagination v-if="!error && filtered.length > itemsPerPage" v-model="currentPage" class="mt-4 shrink-0" :total="filtered.length" :items-per-page="itemsPerPage" />
    </Card>
  </section>
</template>

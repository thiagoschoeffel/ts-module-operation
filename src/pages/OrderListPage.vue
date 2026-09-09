<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { parseDate } from '@internationalized/date'
import { ArrowRightIcon, Badge, Button, Card, ClipboardListIcon, DataTable, DateRangePicker, EmptyState, Input, Pagination, SearchIcon, Select, Tabs, TriangleAlertIcon, type DataTableColumn, type DataTableRow, type DataTableSortDirection, type DateRangePickerValue, type TabItem } from '@thiagoschoeffel/ts-components'
import { listOrders, orderStatusPresentation, shortOrderId, type ApiOrderPage, type ApiOrderSummary, type AuthenticatedApiRequest, type OrderListQuery } from '../services/ordersApi'
import { localDateIso } from '../services/todayApi'
import { navigate } from '../utils/navigation'

const props = defineProps<{ apiRequest?: AuthenticatedApiRequest }>()
const params = new URLSearchParams(window.location.search)
const allowedTabs = new Set(['todos', 'aberto', 'andamento', 'concluido', 'problema'])
const activeStatus = ref(allowedTabs.has(params.get('tab') ?? '') ? params.get('tab')! : 'todos')
const search = ref(params.get('busca') ?? '')
const currentPage = ref(Math.max(1, Number(params.get('pagina')) || 1))
type PeriodPreset = 'hoje' | '7dias' | '30dias' | 'personalizado' | 'todos'
type OrderSortKey = 'operationalDate' | 'customer' | 'status' | 'itemCount' | 'dailyCapacityUnits' | 'totalAmount'
const allowedPeriods = new Set<PeriodPreset>(['hoje', '7dias', '30dias', 'personalizado', 'todos'])
const requestedPeriod = params.get('periodo') as PeriodPreset | null
const requestedFrom = params.get('inicio')
const requestedTo = params.get('fim')
const initialFrom = parseUrlDate(requestedFrom)
const initialTo = parseUrlDate(requestedTo)
const hasValidCustomPeriod = Boolean(initialFrom && initialTo && initialFrom.compare(initialTo) <= 0)
const hasImplicitTodayPeriod = requestedFrom === localDateIso() && requestedTo === requestedFrom
const periodPreset = ref<PeriodPreset>(requestedPeriod && allowedPeriods.has(requestedPeriod)
  && (requestedPeriod !== 'personalizado' || hasValidCustomPeriod)
  ? requestedPeriod
  : hasValidCustomPeriod && !hasImplicitTodayPeriod ? 'personalizado' : 'hoje')
const dateRange = shallowRef<DateRangePickerValue>({
  start: hasValidCustomPeriod ? initialFrom : undefined,
  end: hasValidCustomPeriod ? initialTo : undefined
})
const allowedSortKeys = new Set<OrderSortKey>(['operationalDate', 'customer', 'status', 'itemCount', 'dailyCapacityUnits', 'totalAmount'])
const requestedSortKey = params.get('ordenar') as OrderSortKey | null
const sortKey = ref<OrderSortKey>(requestedSortKey && allowedSortKeys.has(requestedSortKey) ? requestedSortKey : 'operationalDate')
const sortDirection = ref<DataTableSortDirection>(params.get('direcao') === 'asc' ? 'asc' : 'desc')
const orders = ref<ApiOrderSummary[]>([])
const total = ref(0)
const counts = ref<ApiOrderPage['counts']>({ all: 0, open: 0, inProgress: 0, completed: 0, problems: 0 })
const loading = ref(true)
const error = ref('')
const itemsPerPage = 10
let debounce: ReturnType<typeof setTimeout> | undefined
let loadSequence = 0
const debouncedSearch = ref(search.value)

const tabs: TabItem[] = [
  { value: 'todos', label: 'Todos' }, { value: 'aberto', label: 'Abertos' },
  { value: 'andamento', label: 'Em andamento' }, { value: 'concluido', label: 'Concluídos' },
  { value: 'problema', label: 'Problemas' }
]
const periodOptions = [
  { value: 'hoje', label: 'Hoje' }, { value: '7dias', label: 'Últimos 7 dias' },
  { value: '30dias', label: 'Últimos 30 dias' }, { value: 'personalizado', label: 'Período personalizado' },
  { value: 'todos', label: 'Todo o histórico' }
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
const statusGroups: Record<string, NonNullable<OrderListQuery['statusGroup']>> = {
  todos: 'All', aberto: 'Open', andamento: 'InProgress', concluido: 'Completed', problema: 'Problems'
}
const sortKeys: Record<OrderSortKey, NonNullable<OrderListQuery['sortBy']>> = {
  operationalDate: 'OperationalDate', customer: 'Customer', status: 'Status', itemCount: 'ItemCount',
  dailyCapacityUnits: 'DailyCapacityUnits', totalAmount: 'TotalAmount'
}

watch(search, value => {
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => { debouncedSearch.value = value }, 250)
})
watch([activeStatus, debouncedSearch, sortKey, sortDirection, periodPreset, dateRange], () => { currentPage.value = 1 })
watch([activeStatus, debouncedSearch, currentPage, sortKey, sortDirection, periodPreset, dateRange], () => {
  const url = new URL(window.location.href)
  activeStatus.value === 'todos' ? url.searchParams.delete('tab') : url.searchParams.set('tab', activeStatus.value)
  debouncedSearch.value ? url.searchParams.set('busca', debouncedSearch.value) : url.searchParams.delete('busca')
  currentPage.value > 1 ? url.searchParams.set('pagina', String(currentPage.value)) : url.searchParams.delete('pagina')
  periodPreset.value === 'hoje' ? url.searchParams.delete('periodo') : url.searchParams.set('periodo', periodPreset.value)
  const period = selectedPeriod()
  period.from && periodPreset.value !== 'hoje' ? url.searchParams.set('inicio', period.from) : url.searchParams.delete('inicio')
  period.to && periodPreset.value !== 'hoje' ? url.searchParams.set('fim', period.to) : url.searchParams.delete('fim')
  url.searchParams.set('ordenar', sortKey.value)
  url.searchParams.set('direcao', sortDirection.value)
  window.history.replaceState(window.history.state, '', url)
  if (periodPreset.value !== 'personalizado' || period.from && period.to) void load()
  else {
    orders.value = []
    total.value = 0
    counts.value = { all: 0, open: 0, inProgress: 0, completed: 0, problems: 0 }
    loading.value = false
  }
})

const rows = computed<DataTableRow[]>(() => orders.value.map(order => ({ ...order, order: shortOrderId(order.id), customer: customerLabel(order) })))
const tabCounts = computed<Record<string, number>>(() => ({
  todos: counts.value.all, aberto: counts.value.open, andamento: counts.value.inProgress,
  concluido: counts.value.completed, problema: counts.value.problems
}))
const hasSearch = computed(() => Boolean(debouncedSearch.value.trim()))
const hasFilters = computed(() => hasSearch.value || activeStatus.value !== 'todos' || periodPreset.value !== 'hoje')
const emptyTitle = computed(() => error.value ? 'Não foi possível carregar os pedidos' : 'Nenhum pedido encontrado')
const emptyDescription = computed(() => {
  if (error.value) return error.value
  if (hasSearch.value && activeStatus.value !== 'todos') return 'Nenhum pedido corresponde à busca e ao status selecionado.'
  if (hasSearch.value) return `Não encontramos pedidos para “${debouncedSearch.value.trim()}”.`
  if (activeStatus.value !== 'todos') return 'Nenhum pedido corresponde ao status selecionado.'
  if (periodPreset.value === 'personalizado' && (!dateRange.value.start || !dateRange.value.end)) return 'Selecione as datas inicial e final para consultar os pedidos.'
  return periodPreset.value === 'hoje' ? 'Não há pedidos para a data operacional de hoje.' : 'Não há pedidos no período selecionado.'
})

function parseUrlDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  try { return parseDate(value) }
  catch { return undefined }
}
function daysAgo(days: number) { const date = new Date(); date.setDate(date.getDate() - days); return localDateIso(date) }
function selectedPeriod() {
  if (periodPreset.value === 'todos') return {}
  if (periodPreset.value === '7dias') return { from: daysAgo(6), to: localDateIso() }
  if (periodPreset.value === '30dias') return { from: daysAgo(29), to: localDateIso() }
  if (periodPreset.value === 'personalizado') return { from: dateRange.value.start?.toString(), to: dateRange.value.end?.toString() }
  const today = localDateIso()
  return { from: today, to: today }
}

async function load() {
  if (!props.apiRequest) { error.value = 'A sessão autenticada não está disponível para consultar pedidos.'; loading.value = false; return }
  const sequence = ++loadSequence
  loading.value = true
  error.value = ''
  try {
    const result = await listOrders(props.apiRequest, {
      ...selectedPeriod(), search: debouncedSearch.value.trim(), statusGroup: statusGroups[activeStatus.value],
      sortBy: sortKeys[sortKey.value], sortDirection: sortDirection.value === 'asc' ? 'Asc' : 'Desc',
      page: currentPage.value, pageSize: itemsPerPage
    })
    if (sequence !== loadSequence) return
    orders.value = result.items
    total.value = result.total
    counts.value = result.counts
    if (currentPage.value > 1 && !result.items.length && result.total) currentPage.value = Math.ceil(result.total / itemsPerPage)
  }
  catch (cause) { if (sequence === loadSequence) error.value = cause instanceof Error ? cause.message : 'Não foi possível carregar os pedidos.' }
  finally { if (sequence === loadSequence) loading.value = false }
}

function orderHref(id: string) { const current = `${window.location.pathname}${window.location.search}`; return `/operacoes/pedidos/${id}?retorno=${encodeURIComponent(current)}` }
function formatDate(value: string) { return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00`)) }
function formatCurrency(value: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value) }
function customerLabel(order: ApiOrderSummary) { return order.customerName || `Cliente ${order.customerId.slice(0, 8).toUpperCase()}` }
function asOrder(row: DataTableRow) { return row as unknown as ApiOrderSummary }
function openOrder(id: string) { navigate(orderHref(id)) }
function createOrder() { navigate(`/operacoes/pedidos/novo?retorno=${encodeURIComponent(window.location.pathname + window.location.search)}`) }
function clearFilters() { search.value = ''; debouncedSearch.value = ''; activeStatus.value = 'todos'; periodPreset.value = 'hoje' }
function updateSort(state: { key?: string; direction?: DataTableSortDirection }) {
  sortKey.value = allowedSortKeys.has(state.key as OrderSortKey) ? state.key as OrderSortKey : 'operationalDate'
  sortDirection.value = state.direction ?? 'desc'
}

onMounted(load)
onBeforeUnmount(() => { if (debounce) clearTimeout(debounce) })
</script>

<template>
  <section class="md:flex md:h-full md:min-h-0 md:flex-col" aria-label="Lista de pedidos">
    <Card class="md:shrink-0 [&>div]:p-4">
      <Tabs v-model="activeStatus" :tabs="tabs" aria-label="Status dos pedidos">
        <template #badge="{ tab }"><Badge size="small" :variant="tab.value === 'problema' && tabCounts[tab.value] ? 'danger' : 'neutral'">{{ tabCounts[tab.value] }}</Badge></template>
        <template #content>
          <div class="grid w-full gap-3 sm:grid-cols-[minmax(14rem,1fr)_14rem] lg:grid-cols-[minmax(18rem,1fr)_14rem_minmax(18rem,22rem)]">
            <Input v-model="search" type="search" aria-label="Buscar por pedido ou cliente" placeholder="Buscar por identificador do pedido ou cliente..." clearable>
              <template #leading><SearchIcon /></template>
            </Input>
            <Select v-model="periodPreset" aria-label="Período dos pedidos" :options="periodOptions" />
            <DateRangePicker v-if="periodPreset === 'personalizado'" v-model="dateRange" aria-label="Período personalizado" :number-of-months="1" close-on-select />
          </div>
        </template>
      </Tabs>
    </Card>

    <Card class="mt-4 md:min-h-0 md:flex-1 [&>div]:flex [&>div]:min-h-0 [&>div]:flex-col [&>div]:p-4">
      <div class="space-y-3 md:hidden">
        <template v-if="loading && !error">
          <div v-for="index in 4" :key="index" class="h-36 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
        </template>
        <EmptyState v-else-if="error || !orders.length" size="large" :title="emptyTitle" :description="emptyDescription" :role="error ? 'alert' : 'status'">
          <template #icon><TriangleAlertIcon v-if="error" /><ClipboardListIcon v-else-if="!orders.length" /><SearchIcon v-else /></template>
          <template #action><Button v-if="error" variant="secondary" size="small" @click="load">Tentar novamente</Button><Button v-else-if="hasFilters" variant="secondary" size="small" @click="clearFilters">Limpar filtros</Button><Button v-else variant="secondary" size="small" @click="createOrder">Novo pedido</Button></template>
        </EmptyState>
        <template v-else>
          <Card v-for="order in orders" :key="order.id">
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
        <template #empty><EmptyState :bordered="false" size="large" :title="emptyTitle" :description="emptyDescription" :role="error ? 'alert' : 'status'"><template #icon><TriangleAlertIcon v-if="error" /><ClipboardListIcon v-else-if="!orders.length" /><SearchIcon v-else /></template><template #action><Button v-if="error" variant="secondary" size="small" @click="load">Tentar novamente</Button><Button v-else-if="hasFilters" variant="secondary" size="small" @click="clearFilters">Limpar filtros</Button><Button v-else variant="secondary" size="small" @click="createOrder">Novo pedido</Button></template></EmptyState></template>
      </DataTable>

      <Pagination v-if="!error && total > itemsPerPage" v-model="currentPage" class="mt-4 shrink-0" :total="total" :items-per-page="itemsPerPage" />
    </Card>
  </section>
</template>

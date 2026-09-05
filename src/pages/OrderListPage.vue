<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowRightIcon, Badge, Button, Card, ClipboardListIcon, EmptyState, Input, Pagination, SearchIcon, Tabs, TriangleAlertIcon, type TabItem } from '@thiagoschoeffel/ts-components'
import { listOrders, orderStatusPresentation, shortOrderId, type ApiOrderSummary, type AuthenticatedApiRequest } from '../services/ordersApi'
import { navigate } from '../utils/navigation'

const props = defineProps<{ apiRequest?: AuthenticatedApiRequest }>()
const params = new URLSearchParams(window.location.search)
const allowedTabs = new Set(['todos', 'aberto', 'andamento', 'concluido', 'problema'])
const activeStatus = ref(allowedTabs.has(params.get('tab') ?? '') ? params.get('tab')! : 'todos')
const search = ref(params.get('busca') ?? '')
const currentPage = ref(Math.max(1, Number(params.get('pagina')) || 1))
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

watch(search, value => {
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => { debouncedSearch.value = value }, 250)
})
watch([activeStatus, debouncedSearch], () => { currentPage.value = 1 })
watch([activeStatus, debouncedSearch, currentPage], () => {
  const url = new URL(window.location.href)
  activeStatus.value === 'todos' ? url.searchParams.delete('tab') : url.searchParams.set('tab', activeStatus.value)
  debouncedSearch.value ? url.searchParams.set('busca', debouncedSearch.value) : url.searchParams.delete('busca')
  currentPage.value > 1 ? url.searchParams.set('pagina', String(currentPage.value)) : url.searchParams.delete('pagina')
  window.history.replaceState(window.history.state, '', url)
})

const filtered = computed(() => {
  const query = debouncedSearch.value.trim().toLocaleLowerCase('pt-BR')
  return orders.value.filter(order => {
    const presentation = orderStatusPresentation[order.status]
    return (activeStatus.value === 'todos' || presentation.group === activeStatus.value)
      && (!query || order.id.toLocaleLowerCase().includes(query) || order.customerId.toLocaleLowerCase().includes(query))
  })
})
const visible = computed(() => filtered.value.slice((currentPage.value - 1) * itemsPerPage, currentPage.value * itemsPerPage))
const counts = computed(() => Object.fromEntries(tabs.map(tab => [tab.value, tab.value === 'todos'
  ? orders.value.length
  : orders.value.filter(order => orderStatusPresentation[order.status].group === tab.value).length])))

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
function createOrder() { navigate(`/operacoes/pedidos/novo?retorno=${encodeURIComponent(window.location.pathname + window.location.search)}`) }

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
      <div v-if="loading" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Carregando pedidos">
        <div v-for="index in 6" :key="index" class="h-36 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
      </div>
      <EmptyState v-else-if="error || !visible.length" :title="error ? 'Não foi possível carregar os pedidos' : orders.length ? 'Nenhum pedido encontrado' : 'Nenhum pedido registrado'" :description="error || (orders.length ? 'Ajuste a busca ou o status selecionado.' : 'Os pedidos criados pela operação aparecerão aqui.')" :role="error ? 'alert' : 'status'">
        <template #icon><TriangleAlertIcon v-if="error" /><ClipboardListIcon v-else /></template>
        <template #action><Button v-if="error" variant="secondary" size="small" @click="load">Tentar novamente</Button><Button v-else-if="!orders.length" size="small" @click="createOrder">Novo pedido</Button></template>
      </EmptyState>
      <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Card v-for="order in visible" :key="order.id">
          <div class="flex items-start justify-between gap-3">
            <div><p class="font-semibold text-slate-900">#{{ shortOrderId(order.id) }}</p><p class="mt-1 text-xs text-slate-500">{{ formatDate(order.operationalDate) }}</p></div>
            <Badge :variant="orderStatusPresentation[order.status].variant">{{ orderStatusPresentation[order.status].label }}</Badge>
          </div>
          <p class="mt-4 text-sm font-medium text-slate-700">Cliente {{ order.customerId.slice(0, 8).toUpperCase() }}</p>
          <p class="mt-1 text-sm text-slate-500">{{ order.itemCount }} {{ order.itemCount === 1 ? 'unidade' : 'unidades' }} · {{ order.dailyCapacityUnits }} de produção diária</p>
          <p class="mt-4 border-t border-slate-100 pt-3 text-right font-semibold text-slate-900">{{ formatCurrency(order.totalAmount) }}</p>
          <template #footer><a :href="orderHref(order.id)" class="-mx-6 -my-4 flex items-center justify-between px-6 py-4 text-sm font-medium text-slate-700 hover:bg-slate-50"><span>Abrir</span><ArrowRightIcon class="size-4" /></a></template>
        </Card>
      </div>
      <Pagination v-if="filtered.length > itemsPerPage" v-model="currentPage" class="mt-auto pt-4" :total="filtered.length" :items-per-page="itemsPerPage" />
    </Card>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Alert,
  ArrowRightIcon,
  Badge,
  Button,
  Card,
  CheckIcon,
  Checkbox,
  ChevronDownIcon,
  ChevronUpIcon,
  Dialog,
  Drawer,
  EmptyState,
  Input,
  MenuIcon,
  PlusIcon,
  sanitizeRichText,
  SearchIcon,
  Select,
  Tabs,
  Textarea,
  TriangleAlertIcon,
  TruckIcon,
  type SelectOption,
  type TabItem
} from '@thiagoschoeffel/ts-components'
import {
  createDeliveryRoute,
  deleteDeliveryRoute,
  finishDeliveryStop,
  getDeliveryDrivers,
  getDeliverySnapshot,
  startDeliveryRoute,
  updateDeliveryRoute,
  type DeliveryRoute,
  type DeliveryRouteStatus
} from '../mocks/delivery'
import type { OrderDetail } from '../mocks/orderDetail'
import RoutePrintSheet from '../components/delivery/RoutePrintSheet.vue'

type DeliveryTab = 'planning' | 'in-progress' | 'completed'
type DeliveryFilter = 'todos' | '11:00–12:00' | '12:00–13:00' | '13:00–14:00'
type DeliveryMockScenario = 'padrao' | 'sem-entregas' | 'sem-resultados' | 'erro'

const params = new URLSearchParams(window.location.search)
const validScenarios = new Set<DeliveryMockScenario>(['padrao', 'sem-entregas', 'sem-resultados', 'erro'])
const requestedScenario = params.get('mock')
const mockScenario = validScenarios.has(requestedScenario as DeliveryMockScenario)
  ? requestedScenario as DeliveryMockScenario
  : 'padrao'
const validFilters = new Set<DeliveryFilter>(['todos', '11:00–12:00', '12:00–13:00', '13:00–14:00'])

function tabFromUrl(): DeliveryTab {
  const value = new URLSearchParams(window.location.search).get('tab')
  return value === 'em-rota' ? 'in-progress' : value === 'concluidas' ? 'completed' : 'planning'
}

const snapshot = ref(getDeliverySnapshot())
const activeTab = ref<DeliveryTab>(tabFromUrl())
const requestedFilter = params.get('filtro') as DeliveryFilter
const activeFilter = ref<DeliveryFilter>(validFilters.has(requestedFilter) ? requestedFilter : 'todos')
const search = ref(params.get('busca') ?? (mockScenario === 'sem-resultados' ? 'Rota inexistente' : ''))
const hasError = ref(mockScenario === 'erro')
const feedback = ref('')
const routeDrawerOpen = ref(false)
const editingRouteId = ref<number>()
const routeSubmitted = ref(false)
const selectedDriverId = ref('')
const selectedWindow = ref('')
const selectedOrderIds = ref<number[]>([])
const draggedOrderId = ref<number>()
const dragOverOrderId = ref<number>()
const deleteConfirmationId = ref<number>()
const routePrintOpen = ref(false)
const printRouteId = ref<number>()
const printMode = ref<'start' | 'reprint'>('start')
const stopDrawerOpen = ref(false)
const activeStop = ref<{ routeId: number; orderId: number }>()
const stopResult = ref<'success' | 'failed'>('success')
const stopReason = ref('')
const stopNote = ref('')
const stopSubmitted = ref(false)

const tabs: TabItem[] = [
  { value: 'planning', label: 'Planejamento' },
  { value: 'in-progress', label: 'Em rota' },
  { value: 'completed', label: 'Concluídas' }
]
const filterTabs: TabItem[] = [
  { value: 'todos', label: 'Todas' },
  { value: '11:00–12:00', label: '11–12h' },
  { value: '12:00–13:00', label: '12–13h' },
  { value: '13:00–14:00', label: '13–14h' }
]
const sectionContent: Record<DeliveryTab, { title: string; subtitle: string }> = {
  planning: {
    title: 'Planejamento',
    subtitle: 'Organize os pedidos embalados e prepare a sequência das próximas rotas.'
  },
  'in-progress': {
    title: 'Em rota',
    subtitle: 'Acompanhe as paradas em andamento e registre o resultado de cada entrega.'
  },
  completed: {
    title: 'Concluídas',
    subtitle: 'Consulte as rotas encerradas, entregas confirmadas e ocorrências do dia.'
  }
}

const failureReasons: SelectOption[] = [
  { value: 'Cliente ausente', label: 'Cliente ausente' },
  { value: 'Endereço não localizado', label: 'Endereço não localizado' },
  { value: 'Cliente recusou o pedido', label: 'Cliente recusou o pedido' },
  { value: 'Problema com o veículo', label: 'Problema com o veículo' },
  { value: 'Outro', label: 'Outro' }
]

const availableOrders = computed(() => mockScenario === 'sem-entregas' ? [] : snapshot.value.available)
const routes = computed(() => mockScenario === 'sem-entregas' ? [] : snapshot.value.routes)
const ordersById = computed(() => mockScenario === 'sem-entregas' ? new Map<number, OrderDetail>() : snapshot.value.ordersById)
const activeDrivers = computed(() => getDeliveryDrivers().filter(driver => driver.active))
const driverOptions = computed<SelectOption[]>(() => activeDrivers.value.map(driver => ({
  value: driver.id,
  label: driver.name,
  description: driver.phone
})))
const editingRoute = computed(() => editingRouteId.value ? routes.value.find(route => route.id === editingRouteId.value) : undefined)
const windowOptions = computed<SelectOption[]>(() => [...new Set([
  ...availableOrders.value,
  ...(editingRoute.value ? routeOrders(editingRoute.value) : [])
].map(order => order.deliveryWindow).filter(Boolean))]
  .sort()
  .map(window => ({ value: window as string, label: window as string })))
const selectableOrders = computed(() => {
  const currentRouteOrders = editingRoute.value ? routeOrders(editingRoute.value) : []
  const candidates = new Map([...availableOrders.value, ...currentRouteOrders].map(order => [order.id, order]))
  return [...candidates.values()].filter(order => order.deliveryWindow === selectedWindow.value)
})
const orderedSelectableOrders = computed(() => {
  const orders = new Map(selectableOrders.value.map(order => [order.id, order]))
  const selected = selectedOrderIds.value.map(id => orders.get(id)).filter((order): order is OrderDetail => Boolean(order))
  const unselected = selectableOrders.value.filter(order => !selectedOrderIds.value.includes(order.id))
  return [...selected, ...unselected]
})

const routeCounts = computed(() => ({
  planning: routes.value.filter(route => route.status === 'planned').length,
  'in-progress': routes.value.filter(route => route.status === 'in-progress').length,
  completed: routes.value.filter(route => route.status === 'completed').length
}))
const activeContent = computed(() => sectionContent[activeTab.value])

const normalizedSearch = computed(() => search.value.trim().toLocaleLowerCase('pt-BR'))
const searchedRoutes = computed(() => routes.value.filter((route) => {
  const expectedStatus: DeliveryRouteStatus = activeTab.value === 'planning' ? 'planned' : activeTab.value
  if (route.status !== expectedStatus)
    return false
  if (!normalizedSearch.value)
    return true
  return String(route.id).includes(normalizedSearch.value)
    || route.driverName.toLocaleLowerCase('pt-BR').includes(normalizedSearch.value)
    || route.orderIds.some((id) => {
      const order = ordersById.value.get(id)
      return String(id).includes(normalizedSearch.value)
        || order?.customer.name.toLocaleLowerCase('pt-BR').includes(normalizedSearch.value)
        || order?.customer.phone.includes(normalizedSearch.value)
    })
}))
const filterCounts = computed<Record<DeliveryFilter, number>>(() => ({
  todos: searchedRoutes.value.length,
  '11:00–12:00': searchedRoutes.value.filter(route => routeMatchesWindow(route, '11:00–12:00')).length,
  '12:00–13:00': searchedRoutes.value.filter(route => routeMatchesWindow(route, '12:00–13:00')).length,
  '13:00–14:00': searchedRoutes.value.filter(route => routeMatchesWindow(route, '13:00–14:00')).length
}))
const visibleRoutes = computed(() => searchedRoutes.value.filter(route => activeFilter.value === 'todos' || routeMatchesWindow(route, activeFilter.value)))

const currentStopOrder = computed(() => activeStop.value ? ordersById.value.get(activeStop.value.orderId) : undefined)
const currentStopRoute = computed(() => activeStop.value ? routes.value.find(route => route.id === activeStop.value?.routeId) : undefined)
const printRoute = computed(() => printRouteId.value ? routes.value.find(route => route.id === printRouteId.value) : undefined)
const printRouteOrders = computed(() => printRoute.value ? routeOrders(printRoute.value) : [])
const availableItemCount = computed(() => availableOrders.value.reduce((total, order) => total + order.items.length, 0))
const stopNoteRequired = computed(() => stopResult.value === 'failed' && stopReason.value === 'Outro')

function richTextPlainText(value?: string) {
  return sanitizeRichText(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function refresh() {
  snapshot.value = getDeliverySnapshot()
}

function updateTab(value: string) {
  activeTab.value = value === 'in-progress' ? 'in-progress' : value === 'completed' ? 'completed' : 'planning'
  search.value = ''
  activeFilter.value = 'todos'
  const url = new URL(window.location.href)
  if (activeTab.value === 'planning') url.searchParams.delete('tab')
  else url.searchParams.set('tab', activeTab.value === 'in-progress' ? 'em-rota' : 'concluidas')
  url.searchParams.delete('busca')
  url.searchParams.delete('filtro')
  window.history.pushState(window.history.state, '', url)
}

function openRouteDrawer() {
  editingRouteId.value = undefined
  routeSubmitted.value = false
  selectedDriverId.value = ''
  selectedWindow.value = windowOptions.value[0]?.value ?? ''
  selectedOrderIds.value = []
  routeDrawerOpen.value = true
}

function openEditRoute(route: DeliveryRoute) {
  const orders = routeOrders(route)
  editingRouteId.value = route.id
  routeSubmitted.value = false
  selectedDriverId.value = route.driverId ?? activeDrivers.value.find(driver => driver.name === route.driverName)?.id ?? ''
  selectedWindow.value = orders[0]?.deliveryWindow ?? ''
  selectedOrderIds.value = [...route.orderIds]
  routeDrawerOpen.value = true
}

function toggleOrder(orderId: number, checked: boolean | 'indeterminate') {
  selectedOrderIds.value = checked === true
    ? selectedOrderIds.value.includes(orderId) ? selectedOrderIds.value : [...selectedOrderIds.value, orderId]
    : selectedOrderIds.value.filter(id => id !== orderId)
}

function moveOrder(orderId: number, offset: number) {
  const current = [...selectedOrderIds.value]
  const index = current.indexOf(orderId)
  const targetIndex = index + offset
  if (index < 0 || targetIndex < 0 || targetIndex >= current.length)
    return
  const [moved] = current.splice(index, 1)
  current.splice(targetIndex, 0, moved)
  selectedOrderIds.value = current
}

function canMoveOrder(orderId: number, offset: number) {
  const index = selectedOrderIds.value.indexOf(orderId)
  return index >= 0 && index + offset >= 0 && index + offset < selectedOrderIds.value.length
}

function startOrderDrag(event: DragEvent, orderId: number) {
  if (!selectedOrderIds.value.includes(orderId) || !event.dataTransfer)
    return
  draggedOrderId.value = orderId
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', String(orderId))
  const card = (event.currentTarget as HTMLElement).closest('article')
  if (card)
    event.dataTransfer.setDragImage(card, 24, 24)
}

function dragOverOrder(event: DragEvent, orderId: number) {
  if (!draggedOrderId.value || draggedOrderId.value === orderId || !selectedOrderIds.value.includes(orderId))
    return
  event.preventDefault()
  if (event.dataTransfer)
    event.dataTransfer.dropEffect = 'move'
  dragOverOrderId.value = orderId
}

function dropOrder(event: DragEvent, targetOrderId: number) {
  event.preventDefault()
  const sourceId = draggedOrderId.value ?? Number(event.dataTransfer?.getData('text/plain'))
  const reordered = [...selectedOrderIds.value]
  const sourceIndex = reordered.indexOf(sourceId)
  const targetIndex = reordered.indexOf(targetOrderId)
  if (sourceIndex >= 0 && targetIndex >= 0 && sourceIndex !== targetIndex) {
    const [source] = reordered.splice(sourceIndex, 1)
    reordered.splice(targetIndex, 0, source)
    selectedOrderIds.value = reordered
  }
  endOrderDrag()
}

function endOrderDrag() {
  draggedOrderId.value = undefined
  dragOverOrderId.value = undefined
}

function saveRoute(close: () => void) {
  routeSubmitted.value = true
  const driver = activeDrivers.value.find(item => item.id === selectedDriverId.value)
  if (!driver || !selectedWindow.value || !selectedOrderIds.value.length)
    return
  const route = editingRouteId.value
    ? updateDeliveryRoute(editingRouteId.value, driver, selectedOrderIds.value)
    : createDeliveryRoute(driver, selectedOrderIds.value)
  if (!route)
    return
  feedback.value = editingRouteId.value
    ? `Rota #${route.id} atualizada com ${route.orderIds.length} ${route.orderIds.length === 1 ? 'parada' : 'paradas'}`
    : `Rota #${route.id} criada com ${route.orderIds.length} ${route.orderIds.length === 1 ? 'parada' : 'paradas'}`
  activeTab.value = 'planning'
  refresh()
  close()
}

function confirmDeleteRoute(route: DeliveryRoute) {
  if (!deleteDeliveryRoute(route.id))
    return
  deleteConfirmationId.value = undefined
  feedback.value = `Rota #${route.id} excluída e pedidos devolvidos ao planejamento`
  refresh()
}

function openRoutePrint(route: DeliveryRoute, mode: 'start' | 'reprint') {
  printRouteId.value = route.id
  printMode.value = mode
  routePrintOpen.value = true
}

function printRouteSheet() {
  window.print()
}

function startRoute(close: () => void) {
  const route = printRoute.value
  if (!route || route.status !== 'planned')
    return
  startDeliveryRoute(route.id)
  feedback.value = `Rota #${route.id} iniciada por ${route.driverName}`
  close()
  updateTab('in-progress')
  refresh()
}

function openStop(route: DeliveryRoute, order: OrderDetail, result: 'success' | 'failed') {
  activeStop.value = { routeId: route.id, orderId: order.id }
  stopResult.value = result
  stopReason.value = ''
  stopNote.value = ''
  stopSubmitted.value = false
  stopDrawerOpen.value = true
}

function saveStop(close: () => void) {
  stopSubmitted.value = true
  if (!activeStop.value
    || (stopResult.value === 'failed' && !stopReason.value)
    || (stopNoteRequired.value && !richTextPlainText(stopNote.value)))
    return
  finishDeliveryStop(activeStop.value.routeId, activeStop.value.orderId, stopResult.value, stopReason.value, stopNote.value)
  feedback.value = stopResult.value === 'success'
    ? `Entrega do pedido #${activeStop.value.orderId} concluída`
    : `Falha registrada no pedido #${activeStop.value.orderId}`
  refresh()
  close()
}

function retry() {
  hasError.value = false
  refresh()
}

function routeOrders(route: DeliveryRoute) {
  return route.orderIds.map(id => ordersById.value.get(id)).filter((order): order is OrderDetail => Boolean(order))
}

function routeMatchesWindow(route: DeliveryRoute, window: Exclude<DeliveryFilter, 'todos'>) {
  return routeOrders(route).some(order => order.deliveryWindow === window)
}

function orderStatus(order: OrderDetail) {
  if (order.status === 'completed') return { label: 'Entregue', variant: 'success' as const }
  if (order.status === 'failed') return { label: 'Falha', variant: 'danger' as const }
  if (order.status === 'delivery') return { label: 'Em entrega', variant: 'info' as const }
  return { label: 'Planejada', variant: 'neutral' as const }
}

function routeStatus(route: DeliveryRoute) {
  if (route.status === 'completed') return { label: 'Concluída', variant: 'success' as const }
  if (route.status === 'in-progress') return { label: 'Em rota', variant: 'info' as const }
  return { label: 'Planejada', variant: 'neutral' as const }
}

function address(order: OrderDetail) {
  const value = order.deliveryAddress
  if (!value)
    return 'Endereço não informado'
  return `${value.street}, ${value.number}${value.complement ? ` · ${value.complement}` : ''} · ${value.neighborhood}`
}

function updateFilterUrl() {
  const url = new URL(window.location.href)
  if (activeFilter.value === 'todos') url.searchParams.delete('filtro')
  else url.searchParams.set('filtro', activeFilter.value)
  window.history.replaceState(window.history.state, '', url)
}

function updateSearchUrl() {
  const url = new URL(window.location.href)
  if (search.value.trim()) url.searchParams.set('busca', search.value.trim())
  else url.searchParams.delete('busca')
  window.history.replaceState(window.history.state, '', url)
}

function clearFilters() {
  search.value = ''
  activeFilter.value = 'todos'
}

function restoreNavigation() {
  const urlParams = new URLSearchParams(window.location.search)
  activeTab.value = tabFromUrl()
  const filter = urlParams.get('filtro') as DeliveryFilter
  activeFilter.value = validFilters.has(filter) ? filter : 'todos'
  search.value = urlParams.get('busca') ?? ''
}

watch(activeFilter, updateFilterUrl)
watch(search, updateSearchUrl)
watch(selectedWindow, () => {
  selectedOrderIds.value = []
  endOrderDrag()
}, { flush: 'sync' })
onMounted(() => {
  window.addEventListener('storage', refresh)
  window.addEventListener('popstate', restoreNavigation)
})
onBeforeUnmount(() => {
  window.removeEventListener('storage', refresh)
  window.removeEventListener('popstate', restoreNavigation)
})
</script>

<template>
  <Tabs
    class="md:flex md:h-full md:min-h-0 md:flex-col md:[&>div:last-child]:min-h-0 md:[&>div:last-child]:flex-1"
    :model-value="activeTab"
    :tabs="tabs"
    variant="primary"
    aria-label="Seções de Entregas"
    @update:model-value="updateTab">
    <template #content>
      <div class="pt-4 md:flex md:h-full md:min-h-0 md:flex-col">
        <div class="flex shrink-0 flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <header class="flex w-full min-w-0 items-start gap-3 text-slate-800">
            <TruckIcon class="size-8 shrink-0" :stroke-width="1.75" aria-hidden="true" />
            <div class="min-w-0 flex-1 overflow-hidden">
              <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:flex-nowrap sm:items-start sm:overflow-hidden">
                <h1 class="m-0 shrink-0 text-xl font-bold leading-none sm:text-2xl">Entregas</h1>
                <span class="inline-flex shrink-0 items-center gap-2 sm:min-w-0 sm:shrink">
                  <ArrowRightIcon class="size-5 shrink-0 text-slate-400" aria-hidden="true" />
                  <span class="text-xl font-bold leading-tight sm:min-w-0 sm:text-2xl">{{ activeContent.title }}</span>
                </span>
              </div>
              <p class="mt-2 text-sm leading-snug text-slate-400">{{ activeContent.subtitle }}</p>
            </div>
          </header>
          <Button v-if="activeTab === 'planning'" type="button" @click="openRouteDrawer">
            <template #icon><PlusIcon /></template>
            Nova rota
          </Button>
        </div>

  <section class="mt-6 md:min-h-0 md:flex-1" aria-label="Entregas do dia">
    <Alert v-if="feedback" class="mb-4" variants="success" :description="feedback" closable @close="feedback = ''">
      <template #icon><CheckIcon /></template>
    </Alert>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      <Card>
        <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Aguardando rota</p>
        <p class="mt-2 text-3xl font-semibold tabular-nums text-blue-700">{{ availableOrders.length }}</p>
        <p class="mt-1 text-xs text-slate-500">{{ availableItemCount }} volumes embalados</p>
      </Card>
      <Card>
        <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Em rota</p>
        <p class="mt-2 text-3xl font-semibold tabular-nums text-slate-900">{{ routeCounts['in-progress'] }}</p>
        <p class="mt-1 text-xs text-slate-500">rotas em andamento</p>
      </Card>
      <Card>
        <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Entregues</p>
        <p class="mt-2 text-3xl font-semibold tabular-nums text-emerald-700">{{ mockScenario === 'sem-entregas' ? 0 : snapshot.deliveredCount }}</p>
        <p class="mt-1 text-xs text-slate-500">pedidos concluídos hoje</p>
      </Card>
      <Card>
        <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Ocorrências</p>
        <p class="mt-2 text-3xl font-semibold tabular-nums text-red-700">{{ mockScenario === 'sem-entregas' ? 0 : snapshot.failedCount }}</p>
        <p class="mt-1 text-xs text-slate-500">falhas para tratar</p>
      </Card>
    </div>

    <Card class="mt-6 [&>div]:p-4">
      <Tabs v-model="activeFilter" :tabs="filterTabs" :aria-label="`Filtrar ${activeContent.title} por janela de entrega`" size="medium">
        <template #badge="{ tab }">
          <Badge variant="neutral">{{ filterCounts[tab.value as DeliveryFilter] }}</Badge>
        </template>
        <template #content>
          <Input v-model="search" class="w-full sm:max-w-sm" type="search" aria-label="Buscar rota, entregador ou pedido" placeholder="Buscar rota, entregador ou pedido..." clearable>
            <template #leading><SearchIcon class="size-4" /></template>
          </Input>
        </template>
      </Tabs>
    </Card>

    <EmptyState v-if="hasError" class="mt-4 bg-white" title="Não foi possível carregar as entregas" description="Tente novamente para consultar o planejamento e as rotas.">
      <template #icon><TriangleAlertIcon /></template>
      <template #action><Button variant="secondary" @click="retry">Tentar novamente</Button></template>
    </EmptyState>

    <EmptyState
      v-else-if="visibleRoutes.length === 0"
      class="mt-4 bg-white"
      :title="search || activeFilter !== 'todos' ? 'Nenhuma rota encontrada' : activeTab === 'planning' ? 'Nenhuma rota planejada' : activeTab === 'in-progress' ? 'Nenhuma rota em andamento' : 'Nenhuma rota concluída'"
      :description="search || activeFilter !== 'todos' ? 'Revise a busca ou limpe os filtros para ver todas as rotas.' : activeTab === 'planning' ? availableOrders.length ? 'Crie uma rota para distribuir os pedidos embalados.' : 'Pedidos embalados e ainda não atribuídos aparecerão aqui.' : activeTab === 'in-progress' ? 'As rotas aparecem aqui assim que o entregador inicia o percurso.' : 'As rotas finalizadas aparecerão aqui.'">
      <template #icon><TruckIcon /></template>
      <template v-if="search || activeFilter !== 'todos'" #action>
        <Button variant="secondary" @click="clearFilters">Limpar filtros</Button>
      </template>
      <template v-else-if="activeTab === 'planning' && availableOrders.length" #action>
        <Button @click="openRouteDrawer">Criar rota</Button>
      </template>
    </EmptyState>

    <div v-else class="mt-4 grid gap-4 2xl:grid-cols-2">
      <Card v-for="route in visibleRoutes" :key="route.id" class="min-w-0">
        <template #header>
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-base font-semibold text-slate-900">Rota #{{ route.id }}</h2>
                <Badge :variant="routeStatus(route).variant">{{ routeStatus(route).label }}</Badge>
              </div>
              <p class="mt-1 font-medium text-slate-700">{{ route.driverName }}</p>
              <p class="text-xs text-slate-500">{{ route.orderIds.length }} {{ route.orderIds.length === 1 ? 'parada' : 'paradas' }} · criada {{ route.createdAt.toLocaleLowerCase('pt-BR') }}</p>
            </div>
            <div v-if="route.status === 'planned' && deleteConfirmationId === route.id" class="flex flex-wrap items-center justify-end gap-2">
              <span class="text-xs font-medium text-slate-600">Remover rota?</span>
              <Button size="small" variant="secondary" @click="deleteConfirmationId = undefined">Cancelar</Button>
              <Button size="small" variant="danger" @click="confirmDeleteRoute(route)">Sim</Button>
            </div>
            <div v-else-if="route.status === 'planned'" class="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <Button size="small" variant="secondary" @click="openEditRoute(route)">Editar</Button>
              <Button size="small" variant="danger" @click="deleteConfirmationId = route.id">Remover</Button>
            </div>
            <Button v-else-if="route.status === 'in-progress'" size="small" variant="secondary" @click="openRoutePrint(route, 'reprint')">Reimprimir</Button>
          </div>
        </template>

        <ol class="divide-y divide-slate-100">
          <li v-for="order in routeOrders(route)" :key="order.id" class="py-4 first:pt-0 last:pb-0">
            <div class="flex items-start gap-3">
              <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold tabular-nums text-slate-600">{{ order.route?.stop }}</span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <p class="font-semibold text-slate-800">{{ order.customer.name }} · #{{ order.id }}</p>
                  <Badge :variant="orderStatus(order).variant">{{ orderStatus(order).label }}</Badge>
                </div>
                <p class="mt-1 text-sm text-slate-600">{{ address(order) }}</p>
                <p class="mt-1 text-xs text-slate-500">{{ order.deliveryWindow }} · {{ order.customer.phone }}</p>
                <div v-if="route.status === 'in-progress' && order.status === 'delivery'" class="mt-3 flex flex-wrap gap-2">
                  <Button size="small" variant="success" @click="openStop(route, order, 'success')">Marcar entregue</Button>
                  <Button size="small" variant="secondary" @click="openStop(route, order, 'failed')">Registrar falha</Button>
                </div>
                <a v-else class="mt-2 inline-flex text-sm font-medium text-slate-400 hover:text-slate-800" :href="`/operacoes/pedidos/${order.id}`">Ver pedido</a>
              </div>
            </div>
          </li>
        </ol>

        <template v-if="route.status === 'planned'" #footer>
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm text-slate-500">Todos os pedidos estão embalados.</p>
            <Button variant="success" @click="openRoutePrint(route, 'start')">
              <template #icon><TruckIcon /></template>
              Iniciar rota
            </Button>
          </div>
        </template>
        <template v-else-if="route.startedAt || route.completedAt" #footer>
          <p class="text-sm text-slate-500">{{ route.completedAt ? `Concluída ${route.completedAt.toLocaleLowerCase('pt-BR')}` : `Iniciada ${route.startedAt?.toLocaleLowerCase('pt-BR')}` }}</p>
        </template>
      </Card>
    </div>

    <div class="h-6 shrink-0" aria-hidden="true" />

    <Dialog
      :open="routePrintOpen"
      size="large"
      :title="printMode === 'start' ? `Iniciar rota #${printRouteId}` : `Reimprimir rota #${printRouteId}`"
      :description="printMode === 'start' ? 'Confira e imprima a folha antes de liberar o entregador.' : 'Confira a folha atualizada e imprima uma nova via.'"
      @update:open="routePrintOpen = $event">
      <template #trigger><button type="button" class="hidden" tabindex="-1" aria-hidden="true"></button></template>

      <RoutePrintSheet
        v-if="printRoute"
        :route="printRoute"
        :orders="printRouteOrders"
        class="route-print-preview max-h-[60vh] overflow-y-auto rounded-lg border border-slate-200 p-5" />

      <template #footer="{ close }">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <Button variant="secondary" @click="close">Cancelar</Button>
          <div class="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" @click="printRouteSheet">Imprimir folha</Button>
            <Button v-if="printMode === 'start'" variant="success" @click="startRoute(close)">
              <template #icon><TruckIcon /></template>
              Iniciar rota
            </Button>
          </div>
        </div>
      </template>
    </Dialog>

    <Teleport to="body">
      <RoutePrintSheet
        v-if="routePrintOpen && printRoute"
        :route="printRoute"
        :orders="printRouteOrders"
        class="route-print-output" />
    </Teleport>

    <Drawer
      :open="routeDrawerOpen"
      side="right"
      size="large"
      :title="editingRouteId ? `Editar rota #${editingRouteId}` : 'Criar rota'"
      :description="editingRouteId ? 'Atualize o entregador, os pedidos e a sequência das paradas.' : 'Agrupe pedidos embalados da mesma janela e escolha o entregador.'"
      @update:open="routeDrawerOpen = $event">
      <template #trigger><button type="button" class="hidden" tabindex="-1" aria-hidden="true"></button></template>
      <div class="space-y-5">
        <Select v-model="selectedDriverId" label="Entregador" placeholder="Selecione um entregador" :options="driverOptions" :error="routeSubmitted && !selectedDriverId ? 'Informe o entregador.' : undefined" required />
        <Select v-model="selectedWindow" label="Janela de entrega" placeholder="Selecione uma janela" :options="windowOptions" :error="routeSubmitted && !selectedWindow ? 'Informe a janela.' : undefined" :disabled="Boolean(editingRouteId)" :description="editingRouteId ? 'A janela é preservada ao editar a rota.' : undefined" required />
        <div>
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold text-slate-800">Pedidos embalados</h3>
              <p class="mt-1 text-xs text-slate-500">Selecione os pedidos e organize a sequência inicial das paradas.</p>
            </div>
            <Badge variant="neutral" size="medium">{{ selectedOrderIds.length }} selecionados</Badge>
          </div>
          <Alert v-if="routeSubmitted && !selectedOrderIds.length" class="mt-3" variants="danger" description="Selecione pelo menos um pedido para criar a rota.">
            <template #icon><TriangleAlertIcon /></template>
          </Alert>
          <div v-if="orderedSelectableOrders.length" class="mt-3 space-y-3">
            <Card
              v-for="order in orderedSelectableOrders"
              :key="order.id"
              class="transition-[border-color,box-shadow,opacity]"
              :class="[
                dragOverOrderId === order.id ? 'border-blue-500 shadow-md' : '',
                draggedOrderId === order.id ? 'opacity-50' : ''
              ]"
              @dragover="dragOverOrder($event, order.id)"
              @drop="dropOrder($event, order.id)">
              <div class="flex items-start gap-3">
                <span
                  v-if="selectedOrderIds.includes(order.id)"
                  draggable="true"
                  class="mt-0.5 hidden size-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-slate-400 outline-none transition-colors hover:text-slate-800 active:cursor-grabbing md:flex"
                  title="Arraste para reposicionar"
                  aria-hidden="true"
                  @dragstart="startOrderDrag($event, order.id)"
                  @dragend="endOrderDrag">
                  <MenuIcon class="size-4" />
                </span>
                <span v-if="selectedOrderIds.includes(order.id)" class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold tabular-nums text-blue-700">
                  {{ selectedOrderIds.indexOf(order.id) + 1 }}
                </span>
                <Checkbox class="min-w-0 flex-1" :model-value="selectedOrderIds.includes(order.id)" :label="`${order.customer.name} · Pedido #${order.id}`" :description="`${address(order)} · ${order.items.length} ${order.items.length === 1 ? 'volume' : 'volumes'}`" @update:model-value="toggleOrder(order.id, $event)" />
              </div>
              <div v-if="selectedOrderIds.includes(order.id)" class="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4">
                <Button type="button" size="medium" variant="secondary" icon-only :aria-label="`Subir pedido ${order.id}`" :disabled="!canMoveOrder(order.id, -1)" @click="moveOrder(order.id, -1)">
                  <template #icon><ChevronUpIcon /></template>
                </Button>
                <Button type="button" size="medium" variant="secondary" icon-only :aria-label="`Descer pedido ${order.id}`" :disabled="!canMoveOrder(order.id, 1)" @click="moveOrder(order.id, 1)">
                  <template #icon><ChevronDownIcon /></template>
                </Button>
              </div>
            </Card>
          </div>
          <EmptyState v-else class="mt-3" :bordered="false" size="small" title="Nenhum pedido nesta janela" description="Escolha outra janela ou aguarde a liberação de novos pedidos.">
            <template #icon><TruckIcon /></template>
          </EmptyState>
        </div>
      </div>
      <template #footer="{ close }">
        <div class="flex items-center justify-between gap-3">
          <Button variant="secondary" @click="close">Cancelar</Button>
          <Button @click="saveRoute(close)">{{ editingRouteId ? 'Salvar alterações' : 'Criar rota' }}</Button>
        </div>
      </template>
    </Drawer>

    <Drawer :open="stopDrawerOpen" side="right" size="large" :title="stopResult === 'success' ? 'Confirmar entrega' : 'Registrar falha'" :description="currentStopOrder ? `Pedido #${currentStopOrder.id} · ${currentStopOrder.customer.name}` : undefined" @update:open="stopDrawerOpen = $event">
      <template #trigger><button type="button" class="hidden" tabindex="-1" aria-hidden="true"></button></template>
      <div v-if="currentStopOrder" class="space-y-5">
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Rota e parada</p>
          <p class="mt-1 font-semibold text-slate-900">Rota #{{ currentStopRoute?.id }} · parada {{ currentStopOrder.route?.stop }} de {{ currentStopOrder.route?.stopCount }}</p>
          <p class="mt-1 text-sm text-slate-600">{{ address(currentStopOrder) }}</p>
        </div>
        <Alert v-if="stopResult === 'success'" variants="success" title="Pedido entregue" description="A confirmação encerra esta parada e atualiza o histórico do pedido.">
          <template #icon><CheckIcon /></template>
        </Alert>
        <Select v-else v-model="stopReason" label="Motivo da falha" placeholder="Selecione o motivo" :options="failureReasons" :error="stopSubmitted && !stopReason ? 'Informe o motivo da falha.' : undefined" required />
        <Textarea
          v-model="stopNote"
          :label="stopNoteRequired ? 'Observação' : 'Observação (opcional)'"
          rich-text
          placeholder="Registre informações úteis sobre esta tentativa"
          :rows="3"
          :required="stopNoteRequired"
          :error="stopSubmitted && stopNoteRequired && !richTextPlainText(stopNote) ? 'Descreva o motivo da falha.' : undefined" />
      </div>
      <template #footer="{ close }">
        <div class="flex items-center justify-between gap-3">
          <Button variant="secondary" @click="close">Cancelar</Button>
          <Button :variant="stopResult === 'success' ? 'success' : 'danger'" @click="saveStop(close)">{{ stopResult === 'success' ? 'Confirmar entrega' : 'Registrar falha' }}</Button>
        </div>
      </template>
    </Drawer>
  </section>
      </div>
    </template>
  </Tabs>
</template>

<style>
.route-print-output {
  display: none;
}

@media print {
  @page {
    size: A4 portrait;
    margin: 12mm;
  }

  body * {
    visibility: hidden !important;
  }

  .route-print-output,
  .route-print-output * {
    visibility: visible !important;
  }

  .route-print-output {
    display: block !important;
    position: absolute !important;
    inset: 0 auto auto 0 !important;
    width: 100% !important;
    max-height: none !important;
    overflow: visible !important;
    border: 0 !important;
    border-radius: 0 !important;
    padding: 0 !important;
  }
}
</style>

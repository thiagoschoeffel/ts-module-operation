<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  Alert,
  Badge,
  Button,
  Card,
  CheckIcon,
  Checkbox,
  Dialog,
  EmptyState,
  Input,
  PackageCheckIcon,
  PrinterIcon,
  sanitizeRichText,
  ScrollArea,
  SearchIcon,
  SnowflakeIcon,
  Tabs,
  TriangleAlertIcon,
  type TabItem
} from '@thiagoschoeffel/ts-components'
import type { OrderItem } from '../components/new-order/types'
import PackingLabelPreviews from '../components/packing/PackingLabelPreviews.vue'
import { createPackingLabelBundle, fullPackingLabelSelection } from '../domain/packingLabels'
import {
  markOrderPacked,
  recordPackingLabelPrint,
  savePackingLabelSnapshot,
  type OrderDetail
} from '../mocks/orderDetail'
import { getPackingSnapshot } from '../mocks/packing'
import {
  printPackingLabels,
  usesDirectZebraPackingPrint,
  type PackingLabelPrintState
} from '../services/packingLabelPrinting'
import type { PackingLabelBundle, PackingLabelPrintSelection } from '../types/packingLabels'

type PackingTab = 'awaiting' | 'packed'
type PackingMockScenario = 'padrao' | 'sem-embalagens' | 'sem-resultados' | 'erro' | 'impressao-erro'
type Feedback = { variant: 'success' | 'danger', title: string, description: string }
type PendingPacking = {
  order: OrderDetail
  bundle: PackingLabelBundle
  selection: PackingLabelPrintSelection
}

const params = new URLSearchParams(window.location.search)
const validScenarios = new Set<PackingMockScenario>(['padrao', 'sem-embalagens', 'sem-resultados', 'erro', 'impressao-erro'])
const requestedScenario = params.get('mock')
const mockScenario = validScenarios.has(requestedScenario as PackingMockScenario)
  ? requestedScenario as PackingMockScenario
  : 'padrao'
const requestedTab = params.get('tab')

const snapshot = ref(getPackingSnapshot())
const activeTab = ref<PackingTab>(requestedTab === 'packed' ? 'packed' : 'awaiting')
const search = ref(mockScenario === 'sem-resultados' ? 'Cliente inexistente' : '')
const feedback = ref<Feedback>()
const hasError = ref(mockScenario === 'erro')
const printingOrderId = ref<number>()
const packingDialogOpen = ref(false)
const pendingPacking = ref<PendingPacking>()
const reprintDialogOpen = ref(false)
const reprintOrder = ref<OrderDetail>()
const reprintSelection = ref<PackingLabelPrintSelection>({ dailyItemLabelIds: [], includeExternalPackageLabel: true })
const reprintState = ref<PackingLabelPrintState>('idle')
const reprintError = ref('')
let simulatedPrintFailureShown = false

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

const reprintBundle = computed(() => reprintOrder.value?.packingLabels)
const selectedReprintCount = computed(() => reprintSelection.value.dailyItemLabelIds.length
  + (reprintSelection.value.includeExternalPackageLabel ? 1 : 0))
const pendingPackingLabelCount = computed(() => pendingPacking.value
  ? pendingPacking.value.selection.dailyItemLabelIds.length + 1
  : 0)
const canReprint = computed(() => selectedReprintCount.value > 0 && reprintState.value !== 'printing')

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

function itemName(item: OrderItem) {
  return item.fulfillmentSource === 'frozen-stock' && item.frozenStock
    ? item.frozenStock.producibleName
    : item.name
}

function itemPresentation(item: OrderItem) {
  return item.fulfillmentSource === 'frozen-stock' ? item.frozenStock?.presentation : undefined
}

function createPrintRecord(
  selection: PackingLabelPrintSelection,
  status: 'success' | 'error',
  errorMessage?: string
) {
  return {
    id: `packing-print-${Date.now()}`,
    occurredAt: new Date().toISOString(),
    responsibleName: 'Ana',
    dailyItemLabelIds: [...selection.dailyItemLabelIds],
    includedExternalPackageLabel: selection.includeExternalPackageLabel,
    status,
    errorMessage
  }
}

async function runPrint(bundle: PackingLabelBundle, selection: PackingLabelPrintSelection) {
  if (mockScenario === 'impressao-erro' && !simulatedPrintFailureShown) {
    simulatedPrintFailureShown = true
    throw new Error('A impressora demonstrativa não respondeu. Tente novamente.')
  }
  await printPackingLabels({ bundle, selection })
}

function startPacking(order: OrderDetail) {
  if (printingOrderId.value) return
  const bundle = createPackingLabelBundle(order)
  pendingPacking.value = { order, bundle, selection: fullPackingLabelSelection(bundle) }
  feedback.value = undefined
  if (usesDirectZebraPackingPrint()) void finishPacking()
  else packingDialogOpen.value = true
}

function updatePackingDialog(open: boolean) {
  if (printingOrderId.value) return
  packingDialogOpen.value = open
  if (!open) pendingPacking.value = undefined
}

async function finishPacking() {
  const pending = pendingPacking.value
  if (!pending || printingOrderId.value) return

  const { order, bundle, selection } = pending

  printingOrderId.value = order.id
  feedback.value = undefined
  let updatedOrder = markOrderPacked(order, bundle)
  refresh()

  try {
    await runPrint(bundle, selection)
    updatedOrder = recordPackingLabelPrint(updatedOrder, createPrintRecord(selection, 'success'))
    feedback.value = {
      variant: 'success',
      title: `Pedido #${order.id} embalado`,
      description: `${selection.dailyItemLabelIds.length} etiqueta(s) de item e 1 etiqueta do pacote foram abertas para impressão.`
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível imprimir as etiquetas.'
    recordPackingLabelPrint(updatedOrder, createPrintRecord(selection, 'error', message))
    feedback.value = {
      variant: 'danger',
      title: `Pedido #${order.id} foi embalado, mas a impressão falhou`,
      description: `${message} Use “Reimprimir etiquetas” no pedido embalado.`
    }
  }
  finally {
    printingOrderId.value = undefined
    packingDialogOpen.value = false
    pendingPacking.value = undefined
    refresh()
  }
}

function openReprintDialog(order: OrderDetail) {
  let storedOrder = order
  if (!storedOrder.packingLabels)
    storedOrder = savePackingLabelSnapshot(storedOrder, createPackingLabelBundle(storedOrder))

  reprintOrder.value = storedOrder
  reprintSelection.value = fullPackingLabelSelection(storedOrder.packingLabels!)
  reprintState.value = 'idle'
  reprintError.value = ''
  reprintDialogOpen.value = true
}

function toggleDailyItemLabel(labelId: string, checked: boolean | 'indeterminate') {
  const selected = new Set(reprintSelection.value.dailyItemLabelIds)
  if (checked === true) selected.add(labelId)
  else selected.delete(labelId)
  reprintSelection.value = { ...reprintSelection.value, dailyItemLabelIds: [...selected] }
}

async function reprintLabels() {
  const order = reprintOrder.value
  const bundle = reprintBundle.value
  if (!order || !bundle || !canReprint.value) return

  reprintState.value = 'printing'
  reprintError.value = ''
  try {
    await runPrint(bundle, reprintSelection.value)
    reprintOrder.value = recordPackingLabelPrint(order, createPrintRecord(reprintSelection.value, 'success'))
    reprintState.value = 'success'
    refresh()
  }
  catch (error) {
    reprintError.value = error instanceof Error ? error.message : 'Não foi possível imprimir as etiquetas.'
    reprintOrder.value = recordPackingLabelPrint(order, createPrintRecord(reprintSelection.value, 'error', reprintError.value))
    reprintState.value = 'error'
    refresh()
  }
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
      :variants="feedback.variant"
      :title="feedback.title"
      :description="feedback.description"
      closable
      @close="feedback = undefined">
      <template #icon><CheckIcon v-if="feedback.variant === 'success'" /><TriangleAlertIcon v-else /></template>
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
                <CheckIcon v-if="order.packedAt" class="size-5 shrink-0 text-emerald-600" aria-hidden="true" />
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
                <span v-if="order.packedAt" class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckIcon class="size-3.5" aria-hidden="true" />
                </span>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <p class="font-semibold text-slate-800">{{ index + 1 }}. {{ itemName(item) }}</p>
                    <Badge v-if="item.fulfillmentSource === 'frozen-stock'" variant="info">
                      <SnowflakeIcon class="mr-1 size-3" aria-hidden="true" />Congelado · já etiquetado
                    </Badge>
                    <Badge v-else variant="neutral">Etiqueta ao embalar</Badge>
                  </div>
                  <p v-if="itemPresentation(item)" class="mt-1 text-xs font-medium text-slate-600">{{ itemPresentation(item) }}</p>
                  <div v-for="detail in item.details" :key="detail" class="space-y-1 text-xs leading-5 text-slate-500 [&_a]:text-blue-600 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-2 [&_em]:italic [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-4 [&_s]:line-through [&_strong]:font-semibold [&_u]:underline [&_ul]:list-disc [&_ul]:pl-4" v-html="sanitizeRichText(detail)" />
                  <p v-if="item.fulfillmentSource === 'frozen-stock' && item.frozenStock?.allocations.length" class="mt-1 text-xs text-slate-500">
                    {{ item.frozenStock.allocations.map(allocation => `${allocation.lotId} · validade ${allocation.expiresOn.split('-').reverse().join('/')}`).join(', ') }}
                  </p>
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
              <div v-if="order.packedAt" class="w-full">
                <p class="text-sm text-slate-600">{{ order.packedAt }} · {{ order.packedBy }}</p>
                <div class="mt-3 flex items-center justify-between gap-3">
                  <a :href="`/operacoes/pedidos/${order.id}`" class="inline-flex text-sm font-medium text-slate-400 hover:text-slate-800">Ver pedido</a>
                  <Button class="ml-auto shrink-0" size="small" variant="secondary" @click="openReprintDialog(order)">
                    <template #icon><PrinterIcon /></template>
                    Reimprimir etiquetas
                  </Button>
                </div>
              </div>
              <div v-else class="flex flex-wrap items-center justify-between gap-3">
                <a :href="`/operacoes/pedidos/${order.id}`" class="text-sm font-medium text-slate-400 hover:text-slate-800">
                  Ver pedido
                </a>
                <Button variant="success" :loading="printingOrderId === order.id" :disabled="Boolean(printingOrderId)" @click="startPacking(order)">
                  <template #icon><PackageCheckIcon /></template>
                  Embalado
                </Button>
              </div>
            </template>
          </Card>
          </div>
        </ScrollArea>
      </section>
    </div>

    <Dialog
      :open="packingDialogOpen"
      :title="pendingPacking ? `Embalar pedido #${pendingPacking.order.id}` : 'Embalar pedido'"
      description="Confira todas as etiquetas. Ao confirmar, o pedido será marcado como embalado e a impressão será iniciada."
      size="large"
      @update:open="updatePackingDialog">
      <div v-if="pendingPacking" class="space-y-5">
        <Alert
          v-if="pendingPacking.bundle.preLabeledFrozenItemIds.length"
          variants="info"
          size="small"
          :description="`${pendingPacking.bundle.preLabeledFrozenItemIds.length} congelado(s) já possui(em) etiqueta de lote e não receberá(ão) duplicata.`">
          <template #icon><SnowflakeIcon /></template>
        </Alert>

        <PackingLabelPreviews
          :bundle="pendingPacking.bundle"
          :selection="pendingPacking.selection" />
      </div>

      <template #footer>
        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="secondary" :disabled="Boolean(printingOrderId)" @click="updatePackingDialog(false)">Cancelar</Button>
          <Button variant="success" :loading="Boolean(printingOrderId)" :disabled="!pendingPacking" @click="finishPacking">
            <template #icon><PackageCheckIcon /></template>
            Embalar e imprimir {{ pendingPackingLabelCount }} etiqueta(s)
          </Button>
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:open="reprintDialogOpen"
      title="Reimprimir etiquetas"
      :description="reprintOrder ? `Pedido #${reprintOrder.id} · selecione somente as etiquetas necessárias.` : undefined"
      size="large">
      <div v-if="reprintBundle" class="space-y-5">
        <section aria-labelledby="daily-labels-title">
          <div class="flex items-center justify-between gap-3">
            <h3 id="daily-labels-title" class="text-sm font-semibold text-slate-900">Itens da produção do dia</h3>
            <Badge variant="neutral">{{ reprintBundle.dailyItemLabels.length }}</Badge>
          </div>
          <div v-if="reprintBundle.dailyItemLabels.length" class="mt-3 space-y-3">
            <Checkbox
              v-for="label in reprintBundle.dailyItemLabels"
              :key="label.id"
              :model-value="reprintSelection.dailyItemLabelIds.includes(label.id)"
              :label="label.productName"
              :description="label.detailLines.join(' · ') || `Pedido #${label.orderId}`"
              :disabled="reprintState === 'printing'"
              @update:model-value="toggleDailyItemLabel(label.id, $event)" />
          </div>
          <p v-else class="mt-2 text-sm text-slate-500">Este pedido não possui itens da produção do dia.</p>
        </section>

        <section v-if="reprintBundle.preLabeledFrozenItemIds.length" class="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div class="flex items-start gap-2 text-sm text-blue-800">
            <SnowflakeIcon class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p><strong>{{ reprintBundle.preLabeledFrozenItemIds.length }} congelado(s) já etiquetado(s).</strong> As etiquetas de lote não serão duplicadas nesta impressão.</p>
          </div>
        </section>

        <section aria-labelledby="package-label-title">
          <h3 id="package-label-title" class="mb-3 text-sm font-semibold text-slate-900">Pacote kraft</h3>
          <Checkbox
            :model-value="reprintSelection.includeExternalPackageLabel"
            :label="`Etiqueta externa · ${reprintBundle.externalPackageLabel.customerName}`"
            :description="`Pedido #${reprintBundle.externalPackageLabel.orderId}`"
            :disabled="reprintState === 'printing'"
            @update:model-value="reprintSelection = { ...reprintSelection, includeExternalPackageLabel: $event === true }" />
        </section>

        <PackingLabelPreviews
          v-if="selectedReprintCount"
          :bundle="reprintBundle"
          :selection="reprintSelection" />

        <Alert v-if="reprintState === 'success'" variants="success" title="Impressão aberta" :description="`${selectedReprintCount} etiqueta(s) selecionada(s).`">
          <template #icon><CheckIcon /></template>
        </Alert>
        <Alert v-else-if="reprintState === 'error'" variants="danger" title="Não foi possível imprimir" :description="reprintError">
          <template #icon><TriangleAlertIcon /></template>
        </Alert>
      </div>

      <template #footer>
        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" :disabled="reprintState === 'printing'" @click="reprintDialogOpen = false">Fechar</Button>
          <Button :loading="reprintState === 'printing'" :disabled="!canReprint" @click="reprintLabels">
            <template #icon><PrinterIcon /></template>
            {{ reprintState === 'error' ? 'Tentar novamente' : `Imprimir ${selectedReprintCount} etiqueta(s)` }}
          </Button>
        </div>
      </template>
    </Dialog>
  </section>
</template>

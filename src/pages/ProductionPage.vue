<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Badge, Button, Card, ChevronLeftIcon, CookingPotIcon, EmptyState, TriangleAlertIcon } from '@thiagoschoeffel/ts-components'
import { getProductionSnapshot } from '../mocks/production'

const REFRESH_INTERVAL = 15_000
const TV_ROTATION_INTERVAL = 10_000
const board = ref<HTMLElement>()
const snapshot = ref(getProductionSnapshot())
const now = ref(new Date())
const isTvMode = ref(false)
const tvColumns = ref(3)
const tvRows = ref(2)
const currentTvPage = ref(0)
let refreshTimer: ReturnType<typeof setInterval> | undefined
let clockTimer: ReturnType<typeof setInterval> | undefined
let tvRotationTimer: ReturnType<typeof setInterval> | undefined

const currentTime = computed(() => new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
}).format(now.value))
const updatedTime = computed(() => new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit'
}).format(snapshot.value.updatedAt))
const tvPageSize = computed(() => tvColumns.value * tvRows.value)
const tvPageCount = computed(() => Math.max(1, Math.ceil(snapshot.value.needs.length / tvPageSize.value)))
const visibleNeeds = computed(() => {
  if (!isTvMode.value)
    return snapshot.value.needs
  const start = currentTvPage.value * tvPageSize.value
  return snapshot.value.needs.slice(start, start + tvPageSize.value)
})
const needsCounter = computed(() => {
  if (!isTvMode.value || tvPageCount.value === 1)
    return `${snapshot.value.needs.length} itens`
  return `Tela ${currentTvPage.value + 1} de ${tvPageCount.value} · alternância automática`
})

function refresh() {
  snapshot.value = getProductionSnapshot()
  if (currentTvPage.value >= tvPageCount.value)
    currentTvPage.value = 0
}

async function toggleTvMode() {
  if (!document.fullscreenElement) {
    await board.value?.requestFullscreen()
    return
  }
  await document.exitFullscreen()
}

function syncTvMode() {
  isTvMode.value = document.fullscreenElement === board.value
  currentTvPage.value = 0
  if (isTvMode.value) {
    updateTvLayout()
    startTvRotation()
  }
  else {
    stopTvRotation()
  }
}

function updateTvLayout() {
  if (!isTvMode.value)
    return
  const width = board.value?.clientWidth ?? window.innerWidth
  const height = board.value?.clientHeight ?? window.innerHeight
  tvColumns.value = width >= 1280 ? 3 : width >= 720 ? 2 : 1
  tvRows.value = height >= 880 ? 2 : 1
  if (currentTvPage.value >= tvPageCount.value)
    currentTvPage.value = 0
}

function stopTvRotation() {
  if (tvRotationTimer)
    clearInterval(tvRotationTimer)
  tvRotationTimer = undefined
}

function startTvRotation() {
  stopTvRotation()
  tvRotationTimer = setInterval(() => {
    if (tvPageCount.value > 1)
      currentTvPage.value = (currentTvPage.value + 1) % tvPageCount.value
  }, TV_ROTATION_INTERVAL)
}

function handleVisibilityChange() {
  if (!document.hidden)
    refresh()
}

onMounted(() => {
  refreshTimer = setInterval(refresh, REFRESH_INTERVAL)
  clockTimer = setInterval(() => { now.value = new Date() }, 1_000)
  window.addEventListener('storage', refresh)
  window.addEventListener('resize', updateTvLayout)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  document.addEventListener('fullscreenchange', syncTvMode)
})

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  if (clockTimer) clearInterval(clockTimer)
  stopTvRotation()
  window.removeEventListener('storage', refresh)
  window.removeEventListener('resize', updateTvLayout)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  document.removeEventListener('fullscreenchange', syncTvMode)
})
</script>

<template>
  <section
    ref="board"
    class="production-board min-h-full bg-slate-50"
    :class="isTvMode ? 'flex h-full flex-col overflow-hidden p-6 lg:p-8' : ''"
    aria-label="Mapa de produção do dia">
    <header v-if="isTvMode" class="mb-6 flex shrink-0 items-center justify-between gap-6">
      <div class="flex items-center gap-4">
        <span class="flex size-14 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
          <CookingPotIcon class="size-8" aria-hidden="true" />
        </span>
        <div>
          <h1 class="text-3xl font-semibold tracking-tight text-slate-900">Produção de hoje</h1>
          <p class="mt-1 text-base text-slate-500">Pedidos confirmados · atualização automática</p>
        </div>
      </div>
      <div class="text-right">
        <p class="font-mono text-3xl font-semibold tabular-nums text-slate-900">{{ currentTime }}</p>
        <button
          type="button"
          class="mt-1 inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-slate-400 transition-colors hover:text-slate-800"
          @click="toggleTvMode">
          <ChevronLeftIcon class="size-4" aria-hidden="true" />
          Sair do modo TV
        </button>
      </div>
    </header>

    <div class="mb-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-sm text-slate-500" role="status" aria-live="polite">
        Atualizado às {{ updatedTime }} · atualiza a cada 15 segundos
      </p>
      <Button v-if="!isTvMode" type="button" variant="secondary" size="medium" @click="toggleTvMode">
        Exibir no modo TV
      </Button>
    </div>

    <div class="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      <Card>
        <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Refeições</p>
        <p class="mt-2 text-3xl font-semibold tabular-nums text-slate-900 lg:text-4xl">{{ snapshot.mealCount }}</p>
      </Card>
      <Card>
        <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Pedidos ativos</p>
        <p class="mt-2 text-3xl font-semibold tabular-nums text-slate-900 lg:text-4xl">{{ snapshot.orderCount }}</p>
      </Card>
      <Card>
        <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Em produção</p>
        <p class="mt-2 text-3xl font-semibold tabular-nums text-blue-700 lg:text-4xl">{{ snapshot.inProductionCount }}</p>
      </Card>
      <Card>
        <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Personalizadas</p>
        <p class="mt-2 text-3xl font-semibold tabular-nums text-amber-700 lg:text-4xl">{{ snapshot.customizationCount }}</p>
      </Card>
    </div>

    <div class="mt-6 flex shrink-0 items-end justify-between gap-4">
      <div>
        <h2 class="text-lg font-semibold text-slate-900 lg:text-xl">Quanto produzir</h2>
        <p class="mt-1 text-sm text-slate-500">Necessidade agregada pelas escolhas efetivas dos pedidos.</p>
      </div>
      <Badge size="medium" variant="success">{{ needsCounter }}</Badge>
    </div>

    <EmptyState
      v-if="snapshot.needs.length === 0"
      class="mt-4 bg-white"
      title="Nada para produzir agora"
      description="A necessidade aparecerá quando houver pedidos confirmados.">
      <template #icon><CookingPotIcon /></template>
    </EmptyState>

    <div
      v-else
      class="mt-4 grid gap-4"
      :class="isTvMode ? 'min-h-0 flex-1' : 'md:grid-cols-2 2xl:grid-cols-3'"
      :style="isTvMode ? {
        gridTemplateColumns: `repeat(${tvColumns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${tvRows}, minmax(0, 1fr))`
      } : undefined">
      <Card v-for="need in visibleNeeds" :key="need.id" :class="isTvMode ? 'min-h-0' : 'min-h-52'">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <h3 class="text-lg font-semibold leading-tight text-slate-900 lg:text-xl">{{ need.name }}</h3>
            <p class="mt-1 text-sm text-slate-500">{{ need.orderCount }} {{ need.orderCount === 1 ? 'pedido' : 'pedidos' }}</p>
          </div>
          <div class="shrink-0 text-right">
            <p class="text-4xl font-bold leading-none tabular-nums text-blue-700 lg:text-5xl">{{ need.quantity }}</p>
            <p class="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{{ need.unit }}</p>
          </div>
        </div>

        <div class="mt-5 grid gap-2 border-t border-slate-100 pt-4" :class="need.windows.length > 1 ? 'grid-cols-2' : 'grid-cols-1'">
          <div v-for="windowNeed in need.windows" :key="windowNeed.window" class="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
            <span class="font-medium text-slate-600">{{ windowNeed.window }}</span>
            <span class="text-lg font-semibold tabular-nums text-slate-900">{{ windowNeed.quantity }}</span>
          </div>
        </div>

        <div v-if="need.customizations.length" class="mt-4 flex flex-wrap gap-2">
          <Badge
            v-for="customization in need.customizations"
            :key="customization.label"
            class="gap-1.5"
            variant="warning"
            size="large">
            <TriangleAlertIcon class="size-4" aria-hidden="true" />
            {{ customization.quantity }} - {{ customization.label }}
          </Badge>
        </div>
      </Card>
    </div>
  </section>
</template>

<style scoped>
.production-board:fullscreen {
  width: 100%;
  height: 100%;
  overflow: hidden;
  scrollbar-width: none;
}

.production-board:fullscreen::-webkit-scrollbar {
  display: none;
}
</style>

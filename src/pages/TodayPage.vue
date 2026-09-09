<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Alert, Button, CheckIcon, Drawer, Input, TriangleAlertIcon } from '@thiagoschoeffel/ts-components'
import AttentionCard from '../components/today/AttentionCard.vue'
import DayFlowCard from '../components/today/DayFlowCard.vue'
import TodayDetailsGrid from '../components/today/TodayDetailsGrid.vue'
import TodaySummaryCards from '../components/today/TodaySummaryCards.vue'
import { ApiConflictError, configureDailyCapacity, getDailyCapacity, type AuthenticatedApiRequest } from '../services/ordersApi'
import { loadTodaySnapshot, type TodaySnapshot } from '../services/todayApi'

const props = defineProps<{ apiRequest?: AuthenticatedApiRequest }>()
const emit = defineEmits<{ synchronization: [status: 'synced' | 'syncing' | 'partial' | 'error'] }>()
const snapshot = ref<TodaySnapshot>()
const capacityDrawerOpen = ref(false)
const capacityTotalUnits = ref<string | number>('')
const capacitySaving = ref(false)
const capacityAttempted = ref(false)
const capacityError = ref('')
const capacitySuccess = ref('')
const capacityIdempotencyKey = ref(crypto.randomUUID())

const minimumCapacity = computed(() => Math.max(1, snapshot.value?.capacity?.reservedUnits ?? 0))
const normalizedCapacity = computed(() => Number(capacityTotalUnits.value))
const capacityValidation = computed(() => {
  if (!Number.isInteger(normalizedCapacity.value) || normalizedCapacity.value <= 0)
    return 'Informe uma quantidade inteira maior que zero.'
  if (normalizedCapacity.value < minimumCapacity.value)
    return `A capacidade não pode ser menor que as ${minimumCapacity.value} unidades já reservadas.`
  return ''
})
const operationalDateLabel = computed(() => snapshot.value?.operationalDate
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(`${snapshot.value.operationalDate}T12:00:00`))
  : '')

watch(capacityTotalUnits, () => {
  if (capacityDrawerOpen.value && !capacitySaving.value)
    capacityIdempotencyKey.value = crypto.randomUUID()
})

function emitSynchronization(current: TodaySnapshot) {
  const failures = current.synchronization.failedSources.length
  emit('synchronization', failures === 0 ? 'synced' : failures === 6 ? 'error' : 'partial')
}

function replaceCapacity(capacity: NonNullable<TodaySnapshot['capacity']>) {
  if (!snapshot.value) return
  snapshot.value = {
    ...snapshot.value,
    capacity,
    synchronization: {
      ...snapshot.value.synchronization,
      failedSources: snapshot.value.synchronization.failedSources.filter(source => source !== 'capacidade'),
      completedAt: new Date().toISOString()
    }
  }
  emitSynchronization(snapshot.value)
}

function openCapacityConfiguration() {
  capacityTotalUnits.value = snapshot.value?.capacity?.totalUnits ?? ''
  capacityAttempted.value = false
  capacityError.value = ''
  capacitySuccess.value = ''
  capacityIdempotencyKey.value = crypto.randomUUID()
  capacityDrawerOpen.value = true
}

async function saveCapacity() {
  capacityAttempted.value = true
  capacityError.value = ''
  if (!props.apiRequest || !snapshot.value || capacityValidation.value || capacitySaving.value) return
  capacitySaving.value = true
  try {
    const capacity = await configureDailyCapacity(
      props.apiRequest,
      snapshot.value.operationalDate,
      normalizedCapacity.value,
      snapshot.value.capacity?.version ?? 0,
      capacityIdempotencyKey.value
    )
    replaceCapacity(capacity)
    capacityDrawerOpen.value = false
    capacitySuccess.value = `Capacidade de ${capacity.totalUnits} unidades configurada para ${operationalDateLabel.value}.`
  }
  catch (cause) {
    if (cause instanceof ApiConflictError) {
      try {
        const latest = await getDailyCapacity(props.apiRequest, snapshot.value.operationalDate)
        if (latest) {
          replaceCapacity(latest)
          capacityTotalUnits.value = latest.totalUnits
          capacityIdempotencyKey.value = crypto.randomUUID()
          capacityError.value = 'A capacidade foi alterada por outra operação. Os dados foram recarregados; revise e salve novamente.'
          return
        }
      }
      catch { /* mantém a mensagem autoritativa original */ }
    }
    capacityError.value = cause instanceof Error ? cause.message : 'Não foi possível configurar a capacidade.'
  }
  finally {
    capacitySaving.value = false
  }
}

onMounted(async () => {
  emit('synchronization', 'syncing')
  if (!props.apiRequest) {
    emit('synchronization', 'error')
    return
  }
  try {
    snapshot.value = await loadTodaySnapshot(props.apiRequest)
    emitSynchronization(snapshot.value)
  }
  catch {
    emit('synchronization', 'error')
  }
})
</script>

<template>
  <div class="space-y-6">
    <Alert
      v-if="capacitySuccess"
      variants="success"
      title="Capacidade atualizada"
      :description="capacitySuccess">
      <template #icon><CheckIcon /></template>
    </Alert>
    <TodaySummaryCards :snapshot="snapshot" @configure-capacity="openCapacityConfiguration" />
    <AttentionCard :snapshot="snapshot" />
    <DayFlowCard :snapshot="snapshot" />
    <TodayDetailsGrid :snapshot="snapshot" />

    <Drawer
      :open="capacityDrawerOpen"
      side="right"
      title="Capacidade do dia"
      :description="`Configure o limite de refeições produzidas em ${operationalDateLabel || 'hoje'}.`"
      @update:open="capacityDrawerOpen = $event">
      <template #trigger><button class="hidden" /></template>

      <div class="space-y-5">
        <Alert
          v-if="capacityError"
          variants="danger"
          title="Não foi possível salvar"
          :description="capacityError">
          <template #icon><TriangleAlertIcon /></template>
        </Alert>

        <Input
          :model-value="capacityTotalUnits"
          type="number"
          inputmode="numeric"
          step="1"
          :min="minimumCapacity"
          label="Capacidade total"
          description="Quantidade máxima de refeições que a cozinha pode produzir nesta data."
          :error="capacityAttempted ? capacityValidation : undefined"
          required
          autofocus
          @update:model-value="capacityTotalUnits = $event" />

        <dl class="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div>
            <dt class="text-xs text-slate-500">Já reservada</dt>
            <dd class="mt-1 font-semibold text-slate-800">{{ snapshot?.capacity?.reservedUnits ?? 0 }} unidades</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">Disponível após salvar</dt>
            <dd class="mt-1 font-semibold text-slate-800">{{ Math.max(0, normalizedCapacity - (snapshot?.capacity?.reservedUnits ?? 0)) }} unidades</dd>
          </div>
        </dl>

        <p class="text-xs leading-5 text-slate-500">
          Pedidos abertos não reservam capacidade. A reserva ocorre somente quando o pedido é confirmado; itens congelados não entram nesta conta.
        </p>
      </div>

      <template #footer>
        <div class="flex items-center justify-between gap-3">
          <Button variant="secondary" :disabled="capacitySaving" @click="capacityDrawerOpen = false">Cancelar</Button>
          <Button :loading="capacitySaving" @click="saveCapacity">Salvar capacidade</Button>
        </div>
      </template>
    </Drawer>
  </div>
</template>

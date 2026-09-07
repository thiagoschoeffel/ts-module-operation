<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AttentionCard from '../components/today/AttentionCard.vue'
import DayFlowCard from '../components/today/DayFlowCard.vue'
import TodayDetailsGrid from '../components/today/TodayDetailsGrid.vue'
import TodaySummaryCards from '../components/today/TodaySummaryCards.vue'
import type { AuthenticatedApiRequest } from '../services/ordersApi'
import { loadTodaySnapshot, type TodaySnapshot } from '../services/todayApi'

const props = defineProps<{ apiRequest?: AuthenticatedApiRequest }>()
const snapshot = ref<TodaySnapshot>()

onMounted(async () => {
  if (props.apiRequest) snapshot.value = await loadTodaySnapshot(props.apiRequest)
})
</script>

<template>
  <div class="space-y-6">
    <TodaySummaryCards :snapshot="snapshot" />
    <AttentionCard :snapshot="snapshot" />
    <DayFlowCard :snapshot="snapshot" />
    <TodayDetailsGrid :snapshot="snapshot" />
  </div>
</template>

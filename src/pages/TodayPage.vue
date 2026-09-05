<script setup lang="ts">
import AttentionCard from '../components/today/AttentionCard.vue'
import DayFlowCard from '../components/today/DayFlowCard.vue'
import TodayDetailsGrid from '../components/today/TodayDetailsGrid.vue'
import TodaySummaryCards from '../components/today/TodaySummaryCards.vue'
import type { AuthenticatedApiRequest } from '../services/ordersApi'

defineProps<{ apiRequest?: AuthenticatedApiRequest }>()
</script>

<template>
  <div class="space-y-6">
    <TodaySummaryCards :api-request="apiRequest" />
    <AttentionCard />
    <DayFlowCard />
    <TodayDetailsGrid />
  </div>
</template>

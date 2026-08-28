<script setup lang="ts">
import AttentionCard from '../components/today/AttentionCard.vue'
import DayFlowCard from '../components/today/DayFlowCard.vue'
import TodayDetailsGrid from '../components/today/TodayDetailsGrid.vue'
import TodaySummaryCards from '../components/today/TodaySummaryCards.vue'
</script>

<template>
  <div class="space-y-6">
    <TodaySummaryCards />
    <AttentionCard />
    <DayFlowCard />
    <TodayDetailsGrid />
  </div>
</template>

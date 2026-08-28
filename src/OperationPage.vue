<script setup lang="ts">
import { computed } from 'vue'
import { Button, PageHeader, PlusIcon } from 'ts-components'
import 'ts-components/style.css'
import './style.css'
import DataSyncStatus from './components/DataSyncStatus.vue'
import { operationPages } from './config/operationPages'
import OperationPlaceholderPage from './pages/OperationPlaceholderPage.vue'
import TodayPage from './pages/TodayPage.vue'
import type { OperationSection, OrderPage } from './types/operation'

const props = withDefaults(
  defineProps<{
    section?: OperationSection
    orderPage?: OrderPage
    orderId?: string
  }>(),
  {
    section: 'hoje',
    orderPage: 'list'
  }
)

const page = computed(() => operationPages[props.section])

function createOrder() {
  window.location.assign('/operacoes/pedidos/novo')
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <PageHeader :title="page.title" :subtitle="page.subtitle">
        <template #icon>
          <component :is="page.icon" :size="32" :stroke-width="1.75" />
        </template>
      </PageHeader>

      <DataSyncStatus v-if="props.section === 'hoje'" status="synced" />

      <Button
        v-if="props.section === 'pedidos' && props.orderPage === 'list'"
        type="button"
        @click="createOrder">
        <template #icon>
          <PlusIcon />
        </template>
        Novo pedido
      </Button>
    </div>

    <main class="mt-6">
      <TodayPage v-if="props.section === 'hoje'" />
      <OperationPlaceholderPage v-else :title="page.title" />
    </main>
  </div>
</template>

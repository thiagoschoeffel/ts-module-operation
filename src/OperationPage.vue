<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, ChevronLeftIcon, PageHeader, PlusIcon } from '@thiagoschoeffel/ts-components'
import '@thiagoschoeffel/ts-components/style.css'
import './style.css'
import DataSyncStatus from './components/DataSyncStatus.vue'
import WhatsAppQuotaSummary from './components/attendance/WhatsAppQuotaSummary.vue'
import { operationPages } from './config/operationPages'
import AttendancePage from './pages/AttendancePage.vue'
import OperationPlaceholderPage from './pages/OperationPlaceholderPage.vue'
import NewOrderPage from './pages/NewOrderPage.vue'
import OrderDetailPage from './pages/OrderDetailPage.vue'
import OrderListPage from './pages/OrderListPage.vue'
import PackingPage from './pages/PackingPage.vue'
import DeliveryPage from './pages/DeliveryPage.vue'
import ProductionPage from './pages/ProductionPage.vue'
import TodayPage from './pages/TodayPage.vue'
import type { WhatsAppQuotaUsage } from './types/attendance'
import type { OperationPageProps } from './types/federation'
import { navigate } from './utils/navigation'

const props = withDefaults(
  defineProps<OperationPageProps>(),
  {
    section: 'hoje',
    orderPage: 'list'
  }
)

const page = computed(() => operationPages[props.section])
const attendanceQuota = ref<WhatsAppQuotaUsage>()
const pageTitle = computed(() => {
  if (props.section !== 'pedidos')
    return page.value.title
  if (props.orderPage === 'new')
    return 'Novo pedido'
  if (props.orderPage === 'edit')
    return `Editar pedido #${props.orderId}`
  if (props.orderPage === 'detail')
    return `Pedido #${props.orderId}`
  return page.value.title
})
const pageSubtitle = computed(() => {
  if (props.section === 'pedidos' && props.orderPage === 'new')
    return 'Monte um novo pedido para a operação de hoje.'
  if (props.section === 'pedidos' && props.orderPage === 'edit')
    return 'Atualize os dados permitidos enquanto o pedido está aberto.'
  if (props.section === 'pedidos' && props.orderPage === 'detail')
    return undefined
  return page.value.subtitle
})

function createOrder() {
  const returnUrl = `${window.location.pathname}${window.location.search}`
  navigate(`/operacoes/pedidos/novo?retorno=${encodeURIComponent(returnUrl)}`)
}

function returnToOrders() {
  const candidate = new URLSearchParams(window.location.search).get('retorno')
  const returnUrl = candidate && /^\/operacoes\/pedidos(?:\?.*)?$/.test(candidate)
    ? candidate
    : '/operacoes/pedidos'
  navigate(returnUrl)
}
</script>

<template>
  <div
    class="isolate"
    :class="(props.section === 'pedidos' && props.orderPage === 'list') || props.section === 'entregas' || props.section === 'atendimento'
      ? 'md:flex md:h-[calc(100dvh-11rem)] md:min-h-0 md:flex-col'
      : ''">
    <div
      v-if="props.section !== 'entregas'"
      :class="props.section === 'atendimento'
        ? 'grid gap-x-8 gap-y-3 lg:grid-cols-[minmax(20rem,1fr)_minmax(30rem,42rem)] lg:items-start'
        : 'ts-responsive-row gap-4'">
      <PageHeader :title="pageTitle" :subtitle="pageSubtitle">
        <template #icon>
          <component :is="page.icon" :size="32" :stroke-width="1.75" />
        </template>
      </PageHeader>

      <DataSyncStatus v-if="props.section === 'hoje'" status="synced" />

      <WhatsAppQuotaSummary
        v-if="props.section === 'atendimento' && attendanceQuota"
        :usage="attendanceQuota" />

      <button
        v-if="props.section === 'pedidos' && props.orderPage !== 'list'"
        type="button"
        class="hidden cursor-pointer items-center gap-1 text-sm font-medium text-slate-400 transition-colors hover:text-slate-800 sm:inline-flex"
        @click="returnToOrders">
        <ChevronLeftIcon class="size-4" aria-hidden="true" />
        Voltar para pedidos
      </button>

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

    <main
      :class="[
        props.section === 'entregas' ? '' : 'mt-6',
        (props.section === 'pedidos' && props.orderPage === 'list') || props.section === 'entregas' || props.section === 'atendimento' ? 'operation-fill-main' : ''
      ]">
      <TodayPage v-if="props.section === 'hoje'" :api-request="props.apiRequest" />
      <AttendancePage v-else-if="props.section === 'atendimento'" :quota-usage="attendanceQuota" :api-request="props.apiRequest" @quota="attendanceQuota = $event" />
      <OrderListPage v-else-if="props.section === 'pedidos' && props.orderPage === 'list'" :api-request="props.apiRequest" />
      <NewOrderPage
        v-else-if="props.section === 'pedidos' && (props.orderPage === 'new' || props.orderPage === 'edit')"
        :mode="props.orderPage === 'edit' ? 'edit' : 'create'"
        :order-id="props.orderId"
        :api-request="props.apiRequest" />
      <OrderDetailPage
        v-else-if="props.section === 'pedidos' && props.orderPage === 'detail'"
        :order-id="props.orderId"
        :api-request="props.apiRequest" />
      <ProductionPage v-else-if="props.section === 'producao'" :api-request="props.apiRequest" />
      <PackingPage v-else-if="props.section === 'embalagem'" :api-request="props.apiRequest" />
      <DeliveryPage v-else-if="props.section === 'entregas'" :api-request="props.apiRequest" />
      <OperationPlaceholderPage v-else :title="page.title" />
    </main>
  </div>
</template>

<style scoped>
@media (min-width: 48rem) {
  .operation-fill-main {
    display: flex;
    min-height: 0;
    flex: 1 1 0%;
    flex-direction: column;
  }
}
</style>

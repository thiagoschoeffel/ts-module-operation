<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Alert, Button, Card, Drawer, EmptyState, HomeIcon, Input, RadioGroup, Select } from '@thiagoschoeffel/ts-components'
import { formatAddressLocation, formatAddressStreet } from './address'
import { deliveryWindowOptions } from './mockData'
import type { ApiOrderFulfillmentType } from '../../services/ordersApi'
import type { Customer, CustomerAddress } from './types'

const props = defineProps<{
  customer?: Customer
  address?: CustomerAddress
  deliveryWindow?: string
  fulfillmentType: ApiOrderFulfillmentType
  contactPhone: string
  showValidation?: boolean
}>()
const emit = defineEmits<{
  'update:address': [address: CustomerAddress | undefined]
  'update:deliveryWindow': [deliveryWindow: string]
  'update:fulfillmentType': [value: ApiOrderFulfillmentType]
  'update:contactPhone': [value: string]
}>()

const addressDrawerOpen = ref(false)
const addresses = computed(() => props.customer?.addresses ?? [])
const phoneIsValid = computed(() => props.contactPhone.replace(/\D/g, '').length >= 10)
const deliveryIsValid = computed(() => props.fulfillmentType === 'Pickup' || Boolean(props.address && props.deliveryWindow?.trim()))
const fulfillmentOptions = [
  { value: 'Delivery', label: 'Entrega' },
  { value: 'Pickup', label: 'Retirada' }
]

watch(() => props.customer?.id, () => {
  emit('update:address', addresses.value.length === 1 ? addresses.value[0] : undefined)
})

function chooseAddress(address: CustomerAddress) {
  emit('update:address', { ...address })
  addressDrawerOpen.value = false
}

const selectedAddressId = computed(() => addresses.value.find(address => address.id === props.address?.id)?.id)
const addressOptions = computed(() => addresses.value.map(address => ({
  value: address.id,
  label: address.label,
  description: `${formatAddressStreet(address)} · ${formatAddressLocation(address)}`
})))

function chooseAddressById(addressId: string) {
  const address = addresses.value.find(current => current.id === addressId)
  if (address) chooseAddress(address)
}
</script>

<template>
  <Card
    :aria-disabled="!props.customer || undefined"
    :inert="!props.customer || undefined"
    :class="!props.customer ? 'bg-slate-50 opacity-60' : ''">
    <template #header>
      <h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Entrega ou retirada</h2>
      <p class="mt-1 text-sm text-slate-500">
        {{ props.customer ? 'Defina como o pedido será atendido. Os dados escolhidos serão preservados no pedido.' : 'Selecione um cliente para configurar o atendimento.' }}
      </p>
    </template>

    <div v-if="props.customer" class="space-y-5">
      <div class="grid gap-4 sm:grid-cols-2">
        <Select :model-value="props.fulfillmentType" label="Modalidade" :options="fulfillmentOptions" required @update:model-value="emit('update:fulfillmentType', $event as ApiOrderFulfillmentType)" />
        <Input :model-value="props.contactPhone" type="tel" label="Telefone de contato" required @update:model-value="emit('update:contactPhone', String($event))" />
      </div>

      <div v-if="props.fulfillmentType === 'Delivery'" class="grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2">
        <div>
          <p class="text-sm font-medium text-slate-700">Endereço de entrega</p>
          <Card v-if="props.address" class="mt-2 !bg-slate-50 shadow-none [&>div]:p-3">
            <address class="not-italic">
              <p class="text-sm font-medium text-slate-800">{{ formatAddressStreet(props.address) }}</p>
              <p class="mt-1 text-xs text-slate-500">{{ formatAddressLocation(props.address) }}</p>
            </address>
          </Card>
          <p v-else class="mt-2 text-sm text-slate-500">Nenhum endereço selecionado.</p>

          <Drawer v-if="addresses.length" v-model:open="addressDrawerOpen" side="right" size="large" title="Endereço de entrega" description="Escolha um endereço cadastrado do cliente.">
            <template #trigger><Button class="mt-3" type="button" variant="secondary" size="small">{{ props.address ? 'Alterar' : 'Escolher endereço' }}</Button></template>
            <RadioGroup :model-value="selectedAddressId" :options="addressOptions" label="Endereços cadastrados" name="delivery-address" @update:model-value="chooseAddressById" />
          </Drawer>
          <EmptyState v-else class="mt-3" :bordered="false" size="small" title="Nenhum endereço cadastrado" description="Cadastre um endereço no perfil do cliente para usar entrega.">
            <template #icon><HomeIcon /></template>
          </EmptyState>
        </div>

        <Select :model-value="props.deliveryWindow" label="Janela de entrega" placeholder="Selecione uma janela" :options="deliveryWindowOptions" @update:model-value="emit('update:deliveryWindow', $event)" />
      </div>

      <Alert v-else variants="info" size="small" description="Na retirada, endereço e janela de entrega não são necessários." />

      <Alert
        v-if="props.showValidation && (!phoneIsValid || !deliveryIsValid)"
        variants="danger"
        size="small"
        :description="!phoneIsValid
          ? 'Informe um telefone de contato válido, com DDD.'
          : 'Selecione o endereço e a janela de entrega para salvar o pedido.'" />
    </div>
  </Card>
</template>

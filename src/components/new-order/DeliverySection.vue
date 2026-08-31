<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, Drawer, Input, PlusIcon, SectionCard, Select } from '@thiagoschoeffel/ts-components'
import { deliveryWindowOptions } from './mockData'
import type { Customer, CustomerAddress } from './types'

const props = defineProps<{
  customer?: Customer
  address?: CustomerAddress
  deliveryWindow?: string
}>()
const emit = defineEmits<{
  'update:address': [address: CustomerAddress | undefined]
  'update:deliveryWindow': [deliveryWindow: string]
}>()

const addressDrawerOpen = ref(false)
const newAddressStreet = ref('')
const newAddressNeighborhood = ref('')

const addresses = computed(() => props.customer?.addresses ?? [])

watch(() => props.customer?.id, () => {
  emit('update:address', addresses.value.length === 1 ? addresses.value[0] : undefined)
})

function chooseAddress(address: CustomerAddress) {
  emit('update:address', { ...address })
  addressDrawerOpen.value = false
}

function addAddress() {
  if (!props.customer)
    return
  const address: CustomerAddress = {
    id: `address-${Date.now()}`,
    label: 'Novo endereço',
    street: newAddressStreet.value.trim(),
    neighborhood: newAddressNeighborhood.value.trim()
  }
  props.customer.addresses.push(address)
  chooseAddress(address)
  newAddressStreet.value = ''
  newAddressNeighborhood.value = ''
}
</script>

<template>
  <SectionCard
    title="Entrega"
    :disabled="!props.customer"
    :description="props.customer ? 'Defina onde e quando o pedido será entregue.' : 'Selecione um cliente para configurar a entrega.'">
    <div v-if="props.customer" class="grid gap-5 sm:grid-cols-2">
      <div>
        <p class="text-sm font-medium text-slate-700">Endereço de entrega</p>
        <div v-if="props.address" class="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p class="text-sm font-medium text-slate-800">{{ props.address.street }}</p>
          <p class="mt-1 text-xs text-slate-500">{{ props.address.neighborhood }}</p>
        </div>
        <p v-else class="mt-2 text-sm text-slate-500">Nenhum endereço selecionado.</p>

        <Drawer
          v-model:open="addressDrawerOpen"
          side="right"
          size="small"
          title="Endereço de entrega"
          description="Escolha um endereço ou cadastre um novo.">
          <template #trigger>
            <Button class="mt-3" type="button" variant="secondary" size="small">
              <template v-if="addresses.length === 0" #icon><PlusIcon /></template>
              {{ props.address ? 'Alterar' : addresses.length ? 'Escolher endereço' : 'Adicionar endereço' }}
            </Button>
          </template>
          <div class="space-y-5">
            <div v-if="addresses.length" class="space-y-2">
              <button
                v-for="address in addresses"
                :key="address.id"
                type="button"
                class="w-full rounded-lg border p-3 text-left transition-colors hover:bg-slate-50"
                :class="props.address?.id === address.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200'"
                @click="chooseAddress(address)">
                <span class="block text-sm font-medium text-slate-800">{{ address.label }}</span>
                <span class="mt-1 block text-xs text-slate-500">{{ address.street }} · {{ address.neighborhood }}</span>
              </button>
            </div>
            <div class="border-t border-slate-200 pt-5">
              <p class="mb-3 text-sm font-medium text-slate-700">Novo endereço</p>
              <div class="space-y-3">
                <Input v-model="newAddressStreet" label="Endereço" placeholder="Rua e número" />
                <Input v-model="newAddressNeighborhood" label="Bairro" placeholder="Bairro" />
                <Button
                  type="button"
                  variant="secondary"
                  :disabled="!newAddressStreet.trim() || !newAddressNeighborhood.trim()"
                  @click="addAddress">
                  Adicionar e usar
                </Button>
              </div>
            </div>
          </div>
        </Drawer>
      </div>

      <Select
        :model-value="props.deliveryWindow"
        label="Janela de entrega"
        placeholder="Selecione uma janela"
        :options="deliveryWindowOptions"
        @update:model-value="emit('update:deliveryWindow', $event)" />
    </div>
  </SectionCard>
</template>

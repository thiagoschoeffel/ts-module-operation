<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, Card, Drawer, EmptyState, HomeIcon, Input, PlusIcon, RadioGroup, Select } from '@thiagoschoeffel/ts-components'
import { formatAddressLocation, formatAddressStreet } from './address'
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
const newAddressLabel = ref('')
const newAddressPostalCode = ref('')
const newAddressStreet = ref('')
const newAddressNumber = ref('')
const newAddressComplement = ref('')
const newAddressNeighborhood = ref('')
const newAddressCity = ref('São Paulo')
const newAddressState = ref('SP')
const newAddressReferencePoint = ref('')

const stateOptions = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
].map(state => ({ value: state, label: state }))

const addresses = computed(() => props.customer?.addresses ?? [])

watch(() => props.customer?.id, () => {
  emit('update:address', addresses.value.length === 1 ? addresses.value[0] : undefined)
})

function chooseAddress(address: CustomerAddress) {
  emit('update:address', { ...address })
  addressDrawerOpen.value = false
}

function isSelectedAddress(address: CustomerAddress) {
  const selectedAddress = props.address
  if (!selectedAddress)
    return false
  if (selectedAddress.id === address.id)
    return true

  return selectedAddress.postalCode === address.postalCode
    && selectedAddress.street === address.street
    && selectedAddress.number === address.number
    && selectedAddress.complement === address.complement
    && selectedAddress.neighborhood === address.neighborhood
    && selectedAddress.city === address.city
    && selectedAddress.state === address.state
}

const selectedAddressId = computed(() =>
  addresses.value.find(isSelectedAddress)?.id
)
const addressOptions = computed(() =>
  addresses.value.map(address => ({
    value: address.id,
    label: address.label,
    description: `${formatAddressStreet(address)} · ${formatAddressLocation(address)}`
  }))
)

function chooseAddressById(addressId: string) {
  const address = addresses.value.find(current => current.id === addressId)
  if (address)
    chooseAddress(address)
}

const canAddAddress = computed(() => Boolean(
  newAddressLabel.value.trim()
  && newAddressPostalCode.value.replace(/\D/g, '').length === 8
  && newAddressStreet.value.trim()
  && newAddressNumber.value.trim()
  && newAddressNeighborhood.value.trim()
  && newAddressCity.value.trim()
  && newAddressState.value
))

function formatPostalCode() {
  const digits = newAddressPostalCode.value.replace(/\D/g, '').slice(0, 8)
  newAddressPostalCode.value = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

function resetNewAddress() {
  newAddressLabel.value = ''
  newAddressPostalCode.value = ''
  newAddressStreet.value = ''
  newAddressNumber.value = ''
  newAddressComplement.value = ''
  newAddressNeighborhood.value = ''
  newAddressCity.value = 'São Paulo'
  newAddressState.value = 'SP'
  newAddressReferencePoint.value = ''
}

function addAddress() {
  if (!props.customer || !canAddAddress.value)
    return
  const address: CustomerAddress = {
    id: `address-${Date.now()}`,
    label: newAddressLabel.value.trim(),
    postalCode: newAddressPostalCode.value,
    street: newAddressStreet.value.trim(),
    number: newAddressNumber.value.trim(),
    complement: newAddressComplement.value.trim() || undefined,
    neighborhood: newAddressNeighborhood.value.trim(),
    city: newAddressCity.value.trim(),
    state: newAddressState.value,
    referencePoint: newAddressReferencePoint.value.trim() || undefined
  }
  props.customer.addresses.push(address)
  chooseAddress(address)
  resetNewAddress()
}
</script>

<template>
  <Card
    :aria-disabled="!props.customer || undefined"
    :inert="!props.customer || undefined"
    :class="!props.customer ? 'bg-slate-50 opacity-60' : ''">
    <template #header>
      <h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Entrega</h2>
      <p class="mt-1 text-sm text-slate-500">
        {{ props.customer ? 'Defina onde e quando o pedido será entregue.' : 'Selecione um cliente para configurar a entrega.' }}
      </p>
    </template>
    <div v-if="props.customer" class="grid gap-5 sm:grid-cols-2">
      <div>
        <p class="text-sm font-medium text-slate-700">Endereço de entrega</p>
        <Card v-if="props.address" class="mt-2 !bg-slate-50 shadow-none [&>div]:p-3">
          <address class="not-italic">
            <p class="text-sm font-medium text-slate-800">{{ formatAddressStreet(props.address) }}</p>
            <p class="mt-1 text-xs text-slate-500">{{ formatAddressLocation(props.address) }}</p>
          </address>
        </Card>
        <p v-else class="mt-2 text-sm text-slate-500">Nenhum endereço selecionado.</p>

        <Drawer
          v-model:open="addressDrawerOpen"
          side="right"
          size="large"
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
              <RadioGroup
                :model-value="selectedAddressId"
                :options="addressOptions"
                label="Endereços cadastrados"
                name="delivery-address"
                @update:model-value="chooseAddressById" />
            </div>
            <EmptyState
              v-else
              size="small"
              title="Nenhum endereço cadastrado"
              description="Preencha os dados abaixo para cadastrar o primeiro endereço deste cliente.">
              <template #icon><HomeIcon /></template>
            </EmptyState>
            <div class="border-t border-slate-200 pt-5">
              <p class="mb-3 text-sm font-medium text-slate-700">Novo endereço</p>
              <div class="space-y-3">
                <Input v-model="newAddressLabel" label="Identificação" placeholder="Ex.: Casa ou Trabalho" autocomplete="off" required />
                <Input
                  v-model="newAddressPostalCode"
                  label="CEP"
                  placeholder="00000-000"
                  autocomplete="postal-code"
                  inputmode="numeric"
                  :maxlength="9"
                  required
                  @input="formatPostalCode" />
                <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
                  <Input v-model="newAddressStreet" label="Logradouro" placeholder="Rua, avenida..." autocomplete="address-line1" required />
                  <Input v-model="newAddressNumber" label="Número" placeholder="Nº ou s/n" autocomplete="address-line2" required />
                </div>
                <Input v-model="newAddressComplement" label="Complemento (opcional)" placeholder="Apto., bloco, sala..." autocomplete="address-line3" />
                <Input v-model="newAddressNeighborhood" label="Bairro" placeholder="Bairro" required />
                <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
                  <Input v-model="newAddressCity" label="Cidade" placeholder="Cidade" autocomplete="address-level2" required />
                  <Select v-model="newAddressState" label="UF" :options="stateOptions" required />
                </div>
                <Input v-model="newAddressReferencePoint" label="Ponto de referência (opcional)" placeholder="Ex.: próximo à praça" />
              </div>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-end">
              <Button
                type="button"
                variant="primary"
                :disabled="!canAddAddress"
                @click="addAddress">
                Adicionar e usar
              </Button>
            </div>
          </template>
        </Drawer>
      </div>

      <Select
        :model-value="props.deliveryWindow"
        label="Janela de entrega"
        placeholder="Selecione uma janela"
        :options="deliveryWindowOptions"
        @update:model-value="emit('update:deliveryWindow', $event)" />
    </div>
  </Card>
</template>

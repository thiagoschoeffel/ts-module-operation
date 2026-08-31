<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Badge,
  Button,
  Combobox,
  Drawer,
  EmptyState,
  Input,
  PlusIcon,
  SearchIcon,
  SectionCard,
  TriangleAlertIcon
} from '@thiagoschoeffel/ts-components'
import { customers } from './mockData'
import type { Customer } from './types'

const props = defineProps<{ modelValue?: Customer }>()
const emit = defineEmits<{
  'update:modelValue': [customer: Customer | undefined]
}>()

const search = ref('')
const newCustomerOpen = ref(false)
const newCustomerName = ref('')
const newCustomerPhone = ref('')

const matchingCustomers = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('pt-BR')
  if (!query)
    return []

  const normalizedQuery = query.replace(/\D/g, '')
  return customers.filter((customer) =>
    customer.name.toLocaleLowerCase('pt-BR').includes(query)
    || (normalizedQuery && customer.phone.replace(/\D/g, '').includes(normalizedQuery))
  )
})
const matchingCustomerOptions = computed(() => matchingCustomers.value.map((customer) => ({
  value: customer.id,
  label: customer.name,
  description: customer.phone
})))

function selectCustomer(customer: Customer) {
  emit('update:modelValue', customer)
  search.value = ''
}

function selectCustomerById(customerId?: string) {
  const customer = customers.find((current) => current.id === customerId)
  if (customer)
    selectCustomer(customer)
}

function createCustomer() {
  const customer: Customer = {
    id: `customer-${Date.now()}`,
    name: newCustomerName.value.trim(),
    phone: newCustomerPhone.value.trim(),
    channel: 'WhatsApp',
    addresses: []
  }
  customers.push(customer)
  selectCustomer(customer)
  newCustomerOpen.value = false
  newCustomerName.value = ''
  newCustomerPhone.value = ''
}
</script>

<template>
  <SectionCard title="Cliente" description="Busque por nome ou telefone para começar.">
    <div v-if="!props.modelValue">
      <Combobox
        :model-value="undefined"
        v-model:search-value="search"
        :options="matchingCustomerOptions"
        external-filter
        aria-label="Buscar cliente por nome ou telefone"
        placeholder="Buscar cliente por nome ou telefone..."
        @update:model-value="selectCustomerById">
        <template #leading><SearchIcon /></template>
        <template #empty>
          <EmptyState
            v-if="search.trim()"
            :bordered="false"
            size="small"
            title="Nenhum cliente encontrado"
            description="Cadastre um novo cliente para continuar.">
            <template #icon><SearchIcon /></template>
            <template #action>
              <Drawer
                v-model:open="newCustomerOpen"
                side="right"
                size="small"
                title="Novo cliente"
                description="Cadastre os dados essenciais para continuar o pedido.">
                <template #trigger>
                  <Button type="button" variant="secondary" size="small">
                    <template #icon><PlusIcon /></template>
                    Cadastrar novo cliente
                  </Button>
                </template>
                <div class="space-y-4">
                  <Input v-model="newCustomerName" label="Nome" required placeholder="Nome do cliente" />
                  <Input v-model="newCustomerPhone" label="Telefone" required placeholder="(00) 00000-0000" />
                </div>
                <template #footer="{ close }">
                  <div class="flex justify-end gap-3">
                    <Button type="button" variant="secondary" @click="close">Cancelar</Button>
                    <Button
                      type="button"
                      :disabled="!newCustomerName.trim() || !newCustomerPhone.trim()"
                      @click="createCustomer">
                      Cadastrar
                    </Button>
                  </div>
                </template>
              </Drawer>
            </template>
          </EmptyState>
        </template>
      </Combobox>
    </div>

    <div v-else>
      <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p class="font-semibold text-slate-800">{{ props.modelValue.name }}</p>
          <p class="mt-1 text-sm text-slate-500">{{ props.modelValue.phone }}</p>
          <Badge class="mt-3" variant="success">{{ props.modelValue.channel }}</Badge>
        </div>
        <Button type="button" variant="secondary" size="small" @click="$emit('update:modelValue', undefined)">
          Trocar cliente
        </Button>
      </div>

      <div v-if="props.modelValue.restriction || props.modelValue.preference" class="mt-4 space-y-2 border-t border-slate-100 pt-4">
        <p v-if="props.modelValue.restriction" class="flex items-center gap-2 text-sm font-medium text-amber-700">
          <TriangleAlertIcon class="size-4" />
          Restrição: {{ props.modelValue.restriction.toLocaleLowerCase('pt-BR') }}
        </p>
        <p v-if="props.modelValue.preference" class="text-sm text-slate-600">
          Preferência: {{ props.modelValue.preference.toLocaleLowerCase('pt-BR') }}
        </p>
      </div>
    </div>
  </SectionCard>
</template>
